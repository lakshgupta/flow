package workspace

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/lex/flow/internal/markdown"
)

// LoadDocuments reads and parses all Markdown documents under .flow/features.
func LoadDocuments(flowPath string) ([]markdown.WorkspaceDocument, error) {
	featuresPath := filepath.Join(flowPath, "features")
	if _, err := os.Stat(featuresPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}

		return nil, fmt.Errorf("stat features directory: %w", err)
	}

	documents := []markdown.WorkspaceDocument{}
	err := filepath.WalkDir(featuresPath, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if entry.IsDir() || filepath.Ext(path) != ".md" {
			return nil
		}

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

		documents = append(documents, markdown.WorkspaceDocument{
			Path:     filepath.ToSlash(relativePath),
			Document: document,
		})

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("scan workspace documents: %w", err)
	}

	return documents, nil
}
