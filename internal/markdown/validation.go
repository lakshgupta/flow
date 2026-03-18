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

	for _, dependencyID := range document.Metadata.DependsOn {
		if strings.TrimSpace(dependencyID) == "" {
			return fmt.Errorf("command dependencies must not contain empty ids")
		}
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
	commandNames := map[string]string{}
	documentKindsByID := map[string]DocumentType{}
	documentsByID := map[string]WorkspaceDocument{}

	for _, item := range documents {
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

	for _, item := range documents {
		sourceID, sourceType, dependencyIDs, referenceIDs := linkTargets(item.Document)

		for _, dependencyID := range dependencyIDs {
			dependencyType, exists := documentKindsByID[dependencyID]
			if !exists {
				return fmt.Errorf("%s: %s dependency %q does not exist", item.Path, sourceType, dependencyID)
			}

			if dependencyType != sourceType {
				return fmt.Errorf("%s: %s dependency %q must reference another %s", item.Path, sourceType, dependencyID, sourceType)
			}

			if dependencyID == sourceID {
				return fmt.Errorf("%s: %s dependency %q must not reference itself", item.Path, sourceType, dependencyID)
			}
		}

		for _, referenceID := range referenceIDs {
			if _, exists := documentKindsByID[referenceID]; !exists {
				return fmt.Errorf("%s: reference %q does not exist", item.Path, referenceID)
			}
		}
	}

	return nil
}

func linkTargets(document Document) (string, DocumentType, []string, []string) {
	switch value := document.(type) {
	case NoteDocument:
		return value.Metadata.ID, value.Metadata.Type, nil, value.Metadata.References
	case TaskDocument:
		return value.Metadata.ID, value.Metadata.Type, value.Metadata.DependsOn, value.Metadata.References
	case CommandDocument:
		return value.Metadata.ID, value.Metadata.Type, value.Metadata.DependsOn, value.Metadata.References
	default:
		return "", "", nil, nil
	}
}
