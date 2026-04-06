package markdown

import (
	"strings"
	"testing"
)

func TestValidateCommandDocumentRejectsInvalidEnvKey(t *testing.T) {
	t.Parallel()

	err := ValidateCommandDocument(CommandDocument{
		Metadata: CommandMetadata{
			CommonFields: CommonFields{
				ID:    "cmd-1",
				Type:  CommandType,
				Graph: "release",
			},
			Name: "build",
			Run:  "go build ./cmd/flow",
			Env: map[string]string{
				"BAD-KEY": "value",
			},
		},
	})
	if err == nil {
		t.Fatal("ValidateCommandDocument() error = nil, want invalid env key")
	}

	if !strings.Contains(err.Error(), "env key") {
		t.Fatalf("ValidateCommandDocument() error = %v", err)
	}
}

func TestValidateWorkspaceDocumentsRejectsDuplicateCommandShortName(t *testing.T) {
	t.Parallel()

	err := ValidateWorkspaceDocuments([]WorkspaceDocument{
		{
			Path: "features/release/commands/build.md",
			Document: CommandDocument{
				Metadata: CommandMetadata{
					CommonFields: CommonFields{ID: "cmd-1", Type: CommandType, Graph: "release"},
					Name:         "build",
					Run:          "go build ./cmd/flow",
				},
			},
		},
		{
			Path: "features/demo/commands/build.md",
			Document: CommandDocument{
				Metadata: CommandMetadata{
					CommonFields: CommonFields{ID: "cmd-2", Type: CommandType, Graph: "demo"},
					Name:         "build",
					Run:          "go test ./...",
				},
			},
		},
	})
	if err == nil {
		t.Fatal("ValidateWorkspaceDocuments() error = nil, want duplicate short name error")
	}

	if !strings.Contains(err.Error(), "duplicate command short name") {
		t.Fatalf("ValidateWorkspaceDocuments() error = %v", err)
	}
}

func TestValidateWorkspaceDocumentsRejectsNonCommandDependency(t *testing.T) {
	t.Parallel()

	err := ValidateWorkspaceDocuments([]WorkspaceDocument{
		{
			Path: "features/demo/notes/architecture.md",
			Document: NoteDocument{
				Metadata: NoteMetadata{
					CommonFields: CommonFields{ID: "note-1", Type: NoteType, Graph: "notes"},
				},
			},
		},
		{
			Path: "features/release/commands/build.md",
			Document: CommandDocument{
				Metadata: CommandMetadata{
					CommonFields: CommonFields{ID: "cmd-1", Type: CommandType, Graph: "release"},
					Name:         "build",
					DependsOn:    []string{"note-1"},
					Run:          "go build ./cmd/flow",
				},
			},
		},
	})
	if err == nil {
		t.Fatal("ValidateWorkspaceDocuments() error = nil, want non-command dependency error")
	}

	if !strings.Contains(err.Error(), "must reference another command") {
		t.Fatalf("ValidateWorkspaceDocuments() error = %v", err)
	}
}

func TestValidateWorkspaceDocumentsRejectsNonTaskDependency(t *testing.T) {
	t.Parallel()

	err := ValidateWorkspaceDocuments([]WorkspaceDocument{
		{
			Path: "features/release/commands/build.md",
			Document: CommandDocument{
				Metadata: CommandMetadata{
					CommonFields: CommonFields{ID: "cmd-1", Type: CommandType, Graph: "release"},
					Name:         "build",
					Run:          "go build ./cmd/flow",
				},
			},
		},
		{
			Path: "features/demo/tasks/parser.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{
					CommonFields: CommonFields{ID: "task-1", Type: TaskType, Graph: "execution"},
					DependsOn:    []string{"cmd-1"},
				},
			},
		},
	})
	if err == nil {
		t.Fatal("ValidateWorkspaceDocuments() error = nil, want non-task dependency error")
	}

	if !strings.Contains(err.Error(), "must reference another task") {
		t.Fatalf("ValidateWorkspaceDocuments() error = %v", err)
	}
}

func TestValidateWorkspaceDocumentsAllowsCrossGraphSameTypeDependencyAndCrossTypeReference(t *testing.T) {
	t.Parallel()

	err := ValidateWorkspaceDocuments([]WorkspaceDocument{
		{
			Path: "features/demo/notes/architecture.md",
			Document: NoteDocument{
				Metadata: NoteMetadata{
					CommonFields: CommonFields{ID: "note-1", Type: NoteType, Graph: "notes"},
				},
			},
		},
		{
			Path: "features/demo/tasks/foundation.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{
					CommonFields: CommonFields{ID: "task-0", Type: TaskType, Graph: "planning"},
				},
			},
		},
		{
			Path: "features/demo/tasks/parser.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{
					CommonFields: CommonFields{ID: "task-1", Type: TaskType, Graph: "execution"},
					DependsOn:    []string{"task-0"},
					References:   []string{"note-1"},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("ValidateWorkspaceDocuments() error = %v", err)
	}
}

func TestValidateWorkspaceDocumentsUsesGraphPathForCommandValidation(t *testing.T) {
	t.Parallel()

	err := ValidateWorkspaceDocuments([]WorkspaceDocument{
		{
			Path: "data/content/release/build.md",
			Document: CommandDocument{
				Metadata: CommandMetadata{
					CommonFields: CommonFields{ID: "cmd-1", Type: CommandType, Graph: ""},
					Name:         "build",
					Run:          "go build ./cmd/flow",
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("ValidateWorkspaceDocuments() error = %v", err)
	}
}

func TestNormalizeWorkspaceDocumentUsesGraphPathOverFrontmatter(t *testing.T) {
	t.Parallel()

	item, err := NormalizeWorkspaceDocument(WorkspaceDocument{
		Path: "data/content/execution/parser/build.md",
		Document: TaskDocument{
			Metadata: TaskMetadata{
				CommonFields: CommonFields{ID: "task-1", Type: TaskType, Graph: "wrong-value"},
			},
		},
	})
	if err != nil {
		t.Fatalf("NormalizeWorkspaceDocument() error = %v", err)
	}

	document := item.Document.(TaskDocument)
	if document.Metadata.Graph != "execution/parser" {
		t.Fatalf("document.Metadata.Graph = %q, want execution/parser", document.Metadata.Graph)
	}
}

func TestGraphPathFromWorkspacePathRejectsGraphRootFile(t *testing.T) {
	t.Parallel()

	_, ok, err := GraphPathFromWorkspacePath("data/content/build.md")
	if err == nil {
		t.Fatal("GraphPathFromWorkspacePath() error = nil, want canonical layout error")
	}

	if ok {
		t.Fatal("GraphPathFromWorkspacePath() ok = true, want false")
	}
}
