package workspace

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

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

	err := filepath.WalkDir(graphsPath, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if entry.IsDir() || filepath.Ext(path) != ".md" {
			return nil
		}

		issue, appendErr := appendWorkspaceDocument(flowPath, path, &documents, bestEffort)
		if appendErr != nil {
			return appendErr
		}
		if issue != nil {
			issues = append(issues, *issue)
		}
		return nil
	})
	if err != nil {
		return nil, nil, fmt.Errorf("scan workspace documents: %w", err)
	}

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
