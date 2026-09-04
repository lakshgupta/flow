package workspace

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"

	"github.com/lex/flow/internal/markdown"
)

type DocumentLoadIssue struct {
	Path  string
	Error string
}

// LoadDocuments reads and parses all Flow-managed Markdown documents under .flow/data.
func LoadDocuments(flowPath string) ([]markdown.WorkspaceDocument, error) {
	documents, issues, err := loadDocuments(flowPath, false)
	if err != nil {
		return nil, err
	}
	if len(issues) > 0 {
		return nil, fmt.Errorf("%s: %s", issues[0].Path, issues[0].Error)
	}
	return documents, nil
}

// LoadDocumentsBestEffort reads and parses Flow-managed Markdown documents under .flow/data,
// skipping malformed files while returning their paths and parse errors separately.
func LoadDocumentsBestEffort(flowPath string) ([]markdown.WorkspaceDocument, []DocumentLoadIssue, error) {
	return loadDocuments(flowPath, true)
}

func loadDocuments(flowPath string, bestEffort bool) ([]markdown.WorkspaceDocument, []DocumentLoadIssue, error) {
	dataPath := filepath.Join(flowPath, DataDirName)
	if _, err := os.Stat(dataPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil, nil
		}

		return nil, nil, fmt.Errorf("stat data directory: %w", err)
	}

	documents := []markdown.WorkspaceDocument{}
	issues := []DocumentLoadIssue{}
	if issue, err := loadHomeDocument(flowPath, filepath.Join(dataPath, HomeFileName), &documents, bestEffort); err != nil {
		return nil, nil, err
	} else if issue != nil {
		issues = append(issues, *issue)
	}

	graphsPath := filepath.Join(dataPath, GraphsDirName)
	if _, err := os.Stat(graphsPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return documents, issues, nil
		}

		return nil, nil, fmt.Errorf("stat graphs directory: %w", err)
	}

	// Collect candidate file paths sequentially (fast WalkDir), then parse in parallel
	// to exploit I/O concurrency. This is bounded to avoid excessive goroutines or
	// memory use on large workspaces.
	var mdPaths []string
	if err := filepath.WalkDir(graphsPath, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || filepath.Ext(path) != ".md" {
			return nil
		}
		mdPaths = append(mdPaths, path)
		return nil
	}); err != nil {
		return nil, nil, fmt.Errorf("scan workspace documents: %w", err)
	}

	if len(mdPaths) == 0 {
		return documents, issues, nil
	}

	// Bounded parallel parsing: at most NumCPU*2 workers, but never more than files.
	workerCount := runtime.NumCPU() * 2
	if workerCount > len(mdPaths) {
		workerCount = len(mdPaths)
	}
	if workerCount < 1 {
		workerCount = 1
	}
	// For small workspaces sequential is faster (avoid goroutine overhead).
	if len(mdPaths) < 16 {
		for _, path := range mdPaths {
			issue, appendErr := appendWorkspaceDocument(flowPath, path, &documents, bestEffort)
			if appendErr != nil {
				return nil, nil, appendErr
			}
			if issue != nil {
				issues = append(issues, *issue)
			}
		}
		return documents, issues, nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	jobs := make(chan string, len(mdPaths))
	for _, p := range mdPaths {
		jobs <- p
	}
	close(jobs)

	type parseResult struct {
		doc   *markdown.WorkspaceDocument
		issue *DocumentLoadIssue
		err   error
	}

	results := make(chan parseResult, len(mdPaths))
	var wg sync.WaitGroup
	wg.Add(workerCount)
	for i := 0; i < workerCount; i++ {
		go func() {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case path, ok := <-jobs:
					if !ok {
						return
					}
					// Each worker parses one file into a temporary slot to avoid
					// races on shared slices; results are aggregated after wg.Wait.
					var tmp []markdown.WorkspaceDocument
					issue, appendErr := appendWorkspaceDocument(flowPath, path, &tmp, bestEffort)
					if appendErr != nil {
						// Non-best-effort parse error: cancel other workers and report.
						select {
						case results <- parseResult{err: appendErr}:
						case <-ctx.Done():
						}
						cancel()
						return
					}
					if issue != nil {
						results <- parseResult{issue: issue}
						continue
					}
					if len(tmp) == 1 {
						doc := tmp[0]
						results <- parseResult{doc: &doc}
					}
				}
			}
		}()
	}

	// Close results once all workers exit to avoid goroutine leak on the
	// collector; this is done in a separate goroutine so wg.Wait does not block
	// the main path from draining results.
	go func() {
		wg.Wait()
		close(results)
	}()

	for r := range results {
		if r.err != nil {
			return nil, nil, r.err
		}
		if r.issue != nil {
			issues = append(issues, *r.issue)
			continue
		}
		if r.doc != nil {
			documents = append(documents, *r.doc)
		}
	}

	// Sort to keep deterministic order regardless of parallel completion order,
	// matching the stable WalkDir ordering expected by callers and tests.
	sort.Slice(documents, func(i, j int) bool { return documents[i].Path < documents[j].Path })
	sort.Slice(issues, func(i, j int) bool { return issues[i].Path < issues[j].Path })

	return documents, issues, nil
}

func loadHomeDocument(flowPath string, homePath string, documents *[]markdown.WorkspaceDocument, bestEffort bool) (*DocumentLoadIssue, error) {
	data, err := os.ReadFile(homePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}

		return nil, fmt.Errorf("read home document: %w", err)
	}

	if !looksLikeFlowDocument(data) {
		return nil, nil
	}

	return appendWorkspaceDocument(flowPath, homePath, documents, bestEffort)
}

func appendWorkspaceDocument(flowPath string, path string, documents *[]markdown.WorkspaceDocument, bestEffort bool) (*DocumentLoadIssue, error) {
	relativePath, err := filepath.Rel(flowPath, path)
	if err != nil {
		return nil, fmt.Errorf("resolve relative document path: %w", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read document: %w", err)
	}

	document, err := markdown.ParseDocument(data)
	if err != nil {
		if bestEffort {
			return &DocumentLoadIssue{Path: filepath.ToSlash(relativePath), Error: fmt.Sprintf("parse document: %v", err)}, nil
		}
		return nil, fmt.Errorf("parse document: %w", err)
	}

	item, err := markdown.NormalizeWorkspaceDocument(markdown.WorkspaceDocument{
		Path:     filepath.ToSlash(relativePath),
		Document: document,
	})
	if err != nil {
		if bestEffort {
			return &DocumentLoadIssue{Path: filepath.ToSlash(relativePath), Error: fmt.Sprintf("normalize document: %v", err)}, nil
		}
		return nil, fmt.Errorf("normalize document: %w", err)
	}

	*documents = append(*documents, item)
	return nil, nil
}

func looksLikeFlowDocument(data []byte) bool {
	normalized := strings.ReplaceAll(string(data), "\r\n", "\n")
	return strings.HasPrefix(normalized, "---\n")
}
