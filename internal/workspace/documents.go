package workspace

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/lex/flow/internal/markdown"
)

// LoadDocuments reads and parses all Flow-managed Markdown documents under .flow/data.
func LoadDocuments(flowPath string) ([]markdown.WorkspaceDocument, error) {
	dataPath := filepath.Join(flowPath, DataDirName)
	if _, err := os.Stat(dataPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}

		return nil, fmt.Errorf("stat data directory: %w", err)
	}

	documents := []markdown.WorkspaceDocument{}
	if err := loadHomeDocument(flowPath, filepath.Join(dataPath, HomeFileName), &documents); err != nil {
		return nil, err
	}

	graphsPath := filepath.Join(dataPath, GraphsDirName)
	if _, err := os.Stat(graphsPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return documents, nil
		}

		return nil, fmt.Errorf("stat graphs directory: %w", err)
	}

	err := filepath.WalkDir(graphsPath, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if entry.IsDir() || filepath.Ext(path) != ".md" {
			return nil
		}

		return appendWorkspaceDocument(flowPath, path, &documents)
	})
	if err != nil {
		return nil, fmt.Errorf("scan workspace documents: %w", err)
	}

	return documents, nil
}

func loadHomeDocument(flowPath string, homePath string, documents *[]markdown.WorkspaceDocument) error {
	data, err := os.ReadFile(homePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}

		return fmt.Errorf("read home document: %w", err)
	}

	if !looksLikeFlowDocument(data) {
		return nil
	}

	return appendWorkspaceDocument(flowPath, homePath, documents)
}

func appendWorkspaceDocument(flowPath string, path string, documents *[]markdown.WorkspaceDocument) error {
	relativePath, err := filepath.Rel(flowPath, path)
	if err != nil {
		return fmt.Errorf("resolve relative document path: %w", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read document: %w", err)
	}

	document, err := markdown.ParseDocument(data)
	if err != nil {
		return fmt.Errorf("parse document: %w", err)
	}

	item, err := markdown.NormalizeWorkspaceDocument(markdown.WorkspaceDocument{
		Path:     filepath.ToSlash(relativePath),
		Document: document,
	})
	if err != nil {
		return fmt.Errorf("normalize document: %w", err)
	}

	*documents = append(*documents, item)
	return nil
}

func looksLikeFlowDocument(data []byte) bool {
	normalized := strings.ReplaceAll(string(data), "\r\n", "\n")
	return strings.HasPrefix(normalized, "---\n")
}
