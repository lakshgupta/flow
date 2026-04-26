package markdown

import (
	"fmt"
	"regexp"
	"strings"
)

var envKeyPattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// WorkspaceDocument describes a parsed workspace document together with its relative path.
type WorkspaceDocument struct {
	Path     string
	Document Document
}

// ValidateCommandDocument applies command-specific validation rules that do not require workspace context.
func ValidateCommandDocument(document CommandDocument) error {
	if strings.TrimSpace(document.Metadata.ID) == "" {
		return fmt.Errorf("command id must not be empty")
	}

	if strings.TrimSpace(document.Metadata.Graph) == "" {
		return fmt.Errorf("command graph must not be empty")
	}

	if strings.TrimSpace(document.Metadata.Name) == "" {
		return fmt.Errorf("command short name must not be empty")
	}

	if strings.TrimSpace(document.Metadata.Name) != document.Metadata.Name {
		return fmt.Errorf("command short name must not have leading or trailing whitespace")
	}

	if strings.TrimSpace(document.Metadata.Run) == "" {
		return fmt.Errorf("command run must not be empty")
	}

	for key := range document.Metadata.Env {
		if !envKeyPattern.MatchString(key) {
			return fmt.Errorf("command env key %q is invalid", key)
		}
	}

	return nil
}

// ValidateWorkspaceDocuments applies workspace-wide document validation rules.
func ValidateWorkspaceDocuments(documents []WorkspaceDocument) error {
	normalizedDocuments := make([]WorkspaceDocument, 0, len(documents))
	for _, item := range documents {
		normalizedItem, err := NormalizeWorkspaceDocument(item)
		if err != nil {
			return err
		}

		normalizedDocuments = append(normalizedDocuments, normalizedItem)
	}

	commandNames := map[string]string{}
	documentKindsByID := map[string]DocumentType{}
	documentsByID := map[string]WorkspaceDocument{}

	for _, item := range normalizedDocuments {
		switch document := item.Document.(type) {
		case NoteDocument:
			if strings.TrimSpace(document.Metadata.ID) == "" {
				return fmt.Errorf("%s: note id must not be empty", item.Path)
			}

			if previous, exists := documentsByID[document.Metadata.ID]; exists {
				return fmt.Errorf("duplicate document id %q in %s and %s", document.Metadata.ID, previous.Path, item.Path)
			}

			documentsByID[document.Metadata.ID] = item
			documentKindsByID[document.Metadata.ID] = document.Metadata.Type
		case TaskDocument:
			if strings.TrimSpace(document.Metadata.ID) == "" {
				return fmt.Errorf("%s: task id must not be empty", item.Path)
			}

			if previous, exists := documentsByID[document.Metadata.ID]; exists {
				return fmt.Errorf("duplicate document id %q in %s and %s", document.Metadata.ID, previous.Path, item.Path)
			}

			documentsByID[document.Metadata.ID] = item
			documentKindsByID[document.Metadata.ID] = document.Metadata.Type
		case CommandDocument:
			if err := ValidateCommandDocument(document); err != nil {
				return fmt.Errorf("%s: %w", item.Path, err)
			}

			if previous, exists := documentsByID[document.Metadata.ID]; exists {
				return fmt.Errorf("duplicate document id %q in %s and %s", document.Metadata.ID, previous.Path, item.Path)
			}

			if previousPath, exists := commandNames[document.Metadata.Name]; exists {
				return fmt.Errorf("duplicate command short name %q in %s and %s", document.Metadata.Name, previousPath, item.Path)
			}

			documentsByID[document.Metadata.ID] = item
			commandNames[document.Metadata.Name] = item.Path
			documentKindsByID[document.Metadata.ID] = document.Metadata.Type
		}
	}

	for _, item := range normalizedDocuments {
		_, _, linkIDs, referenceIDs := linkTargets(item.Document)
		_, sourceGraph := documentBodyAndGraph(item.Document)

		for _, linkID := range linkIDs {
			if _, exists := documentKindsByID[linkID]; !exists {
				return fmt.Errorf("%s: reference %q does not exist", item.Path, linkID)
			}
		}

		for _, referenceID := range referenceIDs {
			if _, ok, err := ResolveReferenceTarget(normalizedDocuments, referenceID, sourceGraph); err != nil {
				return err
			} else if !ok {
				return fmt.Errorf("%s: reference %q does not exist", item.Path, referenceID)
			}
		}
	}

	return nil
}

// NormalizeWorkspaceDocument applies path-derived metadata rules for canonical workspace paths.
func NormalizeWorkspaceDocument(item WorkspaceDocument) (WorkspaceDocument, error) {
	graphPath, ok, err := GraphPathFromWorkspacePath(item.Path)
	if err != nil {
		return WorkspaceDocument{}, err
	}

	if !ok {
		return item, nil
	}

	switch document := item.Document.(type) {
	case NoteDocument:
		document.Metadata.Graph = graphPath
		item.Document = document
	case TaskDocument:
		document.Metadata.Graph = graphPath
		item.Document = document
	case CommandDocument:
		document.Metadata.Graph = graphPath
		item.Document = document
	}

	return item, nil
}

// GraphPathFromWorkspacePath returns the canonical graph path for a graph-backed document path.
func GraphPathFromWorkspacePath(path string) (string, bool, error) {
	normalizedPath := strings.TrimPrefix(strings.ReplaceAll(path, "\\", "/"), "./")
	normalizedPath = strings.TrimPrefix(normalizedPath, "/")

	const graphRoot = "data/content/"
	if !strings.HasPrefix(normalizedPath, graphRoot) {
		return "", false, nil
	}

	remainder := strings.TrimPrefix(normalizedPath, graphRoot)
	parts := strings.Split(remainder, "/")
	if len(parts) < 2 {
		return "", false, fmt.Errorf("document path %q is not in canonical data/content/<graph-path>/<file>.md layout", path)
	}

	segments := parts[:len(parts)-1]
	fileName := parts[len(parts)-1]
	if strings.TrimSpace(fileName) == "" || !strings.HasSuffix(fileName, ".md") {
		return "", false, fmt.Errorf("document path %q is not in canonical data/content/<graph-path>/<file>.md layout", path)
	}

	for _, segment := range segments {
		if segment == "" || segment == "." || segment == ".." {
			return "", false, fmt.Errorf("document path %q is not in canonical data/content/<graph-path>/<file>.md layout", path)
		}
	}

	return strings.Join(segments, "/"), true, nil
}

func linkTargets(document Document) (string, DocumentType, []string, []string) {
	switch value := document.(type) {
	case NoteDocument:
		return value.Metadata.ID, value.Metadata.Type, NodeLinkIDs(value.Metadata.Links), InlineReferenceIDs(value.Body)
	case TaskDocument:
		return value.Metadata.ID, value.Metadata.Type, NodeLinkIDs(value.Metadata.Links), InlineReferenceIDs(value.Body)
	case CommandDocument:
		return value.Metadata.ID, value.Metadata.Type, NodeLinkIDs(value.Metadata.Links), InlineReferenceIDs(value.Body)
	default:
		return "", "", nil, nil
	}
}
