package markdown

import (
	"slices"
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

func TestValidateWorkspaceDocumentsRejectsMissingReference(t *testing.T) {
	t.Parallel()

	err := ValidateWorkspaceDocuments([]WorkspaceDocument{
		{
			Path: "features/release/commands/build.md",
			Document: CommandDocument{
				Metadata: CommandMetadata{
					CommonFields: CommonFields{ID: "cmd-1", Type: CommandType, Graph: "release"},
					Name:         "build",
					Links:        []NodeLink{{Node: "missing-note"}},
					Run:          "go build ./cmd/flow",
				},
			},
		},
	})
	if err == nil {
		t.Fatal("ValidateWorkspaceDocuments() error = nil, want missing reference error")
	}

	if !strings.Contains(err.Error(), "reference \"missing-note\" does not exist") {
		t.Fatalf("ValidateWorkspaceDocuments() error = %v", err)
	}
}

func TestValidateWorkspaceDocumentsRejectsMissingInlineReference(t *testing.T) {
	t.Parallel()

	err := ValidateWorkspaceDocuments([]WorkspaceDocument{
		{
			Path: "features/release/notes/context.md",
			Document: NoteDocument{
				Metadata: NoteMetadata{
					CommonFields: CommonFields{ID: "note-1", Type: NoteType, Graph: "release"},
				},
				Body: "See [[missing-note]] for details.\n",
			},
		},
	})
	if err == nil {
		t.Fatal("ValidateWorkspaceDocuments() error = nil, want missing inline reference error")
	}

	if !strings.Contains(err.Error(), "reference \"missing-note\" does not exist") {
		t.Fatalf("ValidateWorkspaceDocuments() error = %v", err)
	}
}

func TestValidateWorkspaceDocumentsAllowsBreadcrumbInlineReference(t *testing.T) {
	t.Parallel()

	err := ValidateWorkspaceDocuments([]WorkspaceDocument{
		{
			Path: "data/content/execution/overview.md",
			Document: NoteDocument{
				Metadata: NoteMetadata{
					CommonFields: CommonFields{ID: "note-1", Type: NoteType, Graph: "execution", Title: "Overview"},
				},
				Body: "See [[release > Ship it]] and [[Details]].\n",
			},
		},
		{
			Path: "data/content/execution/details.md",
			Document: NoteDocument{
				Metadata: NoteMetadata{
					CommonFields: CommonFields{ID: "note-2", Type: NoteType, Graph: "execution", Title: "Details"},
				},
			},
		},
		{
			Path: "data/content/release/ship-it.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{
					CommonFields: CommonFields{ID: "task-1", Type: TaskType, Graph: "release", Title: "Ship it"},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("ValidateWorkspaceDocuments() error = %v", err)
	}
}

func TestValidateWorkspaceDocumentsAllowsCrossGraphAndCrossTypeLinks(t *testing.T) {
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
					Links:        []NodeLink{{Node: "task-0"}, {Node: "note-1"}},
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

func TestValidateWorkspaceDocumentsAllowsCanonicalTaskStatuses(t *testing.T) {
	t.Parallel()

	err := ValidateWorkspaceDocuments([]WorkspaceDocument{
		{
			Path: "data/content/execution/task.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{
					CommonFields: CommonFields{ID: "task-1", Type: TaskType, Graph: "execution", Title: "Task"},
					Status:       "Success",
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("ValidateWorkspaceDocuments() error = %v", err)
	}
}

func TestValidateWorkspaceDocumentsRejectsUnknownTaskStatus(t *testing.T) {
	t.Parallel()

	err := ValidateWorkspaceDocuments([]WorkspaceDocument{
		{
			Path: "data/content/execution/task.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{
					CommonFields: CommonFields{ID: "task-1", Type: TaskType, Graph: "execution", Title: "Task"},
					Status:       "Blocked",
				},
			},
		},
	})
	if err == nil {
		t.Fatal("ValidateWorkspaceDocuments() error = nil, want invalid task status")
	}

	if !strings.Contains(err.Error(), "allowed values") {
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

func TestValidateEdgeTypeCompatibilityAllowsCanonicalEdges(t *testing.T) {
	t.Parallel()

	documents := []WorkspaceDocument{
		{
			Path: "data/content/demo/task-a.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{
					CommonFields: CommonFields{ID: "task-a", Type: TaskType, Graph: "demo"},
					Links:        []NodeLink{{Node: "task-b", Relationships: []string{"depends-on"}}},
				},
			},
		},
		{
			Path: "data/content/demo/task-b.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{
					CommonFields: CommonFields{ID: "task-b", Type: TaskType, Graph: "demo"},
				},
			},
		},
		{
			Path: "data/content/demo/commit-notes.md",
			Document: NoteDocument{
				Metadata: NoteMetadata{
					CommonFields: CommonFields{ID: "note-a", Type: NoteType, Graph: "demo"},
					Links:        []NodeLink{{Node: "task-a", Relationships: []string{"maps-to"}}},
				},
			},
		},
		{
			Path: "data/content/design/overview.md",
			Document: NoteDocument{
				Metadata: NoteMetadata{
					CommonFields: CommonFields{ID: "note-b", Type: NoteType, Graph: "design"},
					Links:        []NodeLink{{Node: "task-a", Relationships: []string{"evolves-from"}}},
				},
			},
		},
	}

	violations := ValidateEdgeTypeCompatibility(documents)
	if len(violations) != 0 {
		t.Fatalf("ValidateEdgeTypeCompatibility() = %+v, want no violations", violations)
	}
}

func TestValidateEdgeTypeCompatibilityReportsViolations(t *testing.T) {
	t.Parallel()

	documents := []WorkspaceDocument{
		{
			Path: "data/content/demo/task-a.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{
					CommonFields: CommonFields{ID: "task-a", Type: TaskType, Graph: "demo"},
					Links:        []NodeLink{{Node: "note-a", Relationships: []string{"depends-on"}}},
				},
			},
		},
		{
			Path: "data/content/demo/note-a.md",
			Document: NoteDocument{
				Metadata: NoteMetadata{
					CommonFields: CommonFields{ID: "note-a", Type: NoteType, Graph: "demo"},
					Links:        []NodeLink{{Node: "task-a", Relationships: []string{"depends_on"}}},
				},
			},
		},
		{
			Path: "data/content/demo/update.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{
					CommonFields: CommonFields{ID: "task-b", Type: TaskType, Graph: "demo"},
					Links:        []NodeLink{{Node: "note-a", Relationships: []string{"maps-to"}}},
				},
			},
		},
		{
			Path: "data/content/release/build.md",
			Document: CommandDocument{
				Metadata: CommandMetadata{
					CommonFields: CommonFields{ID: "cmd-1", Type: CommandType, Graph: "release"},
					Links:        []NodeLink{{Node: "task-a", Relationships: []string{"evolves-from"}}},
					Name:         "build",
					Run:          "go build ./cmd/flow",
				},
			},
		},
		{
			Path: "data/content/release/supersede.md",
			Document: CommandDocument{
				Metadata: CommandMetadata{
					CommonFields: CommonFields{ID: "cmd-2", Type: CommandType, Graph: "release"},
					Links:        []NodeLink{{Node: "task-a", Relationships: []string{"supersedes"}}},
					Name:         "supersede",
					Run:          "./supersede.sh",
				},
			},
		},
	}

	violations := ValidateEdgeTypeCompatibility(documents)
	if len(violations) != 5 {
		t.Fatalf("ValidateEdgeTypeCompatibility() len = %d, want 5; got %+v", len(violations), violations)
	}

	byPath := map[string]EdgeTypeViolation{}
	for _, violation := range violations {
		byPath[violation.Path] = violation
	}

	// Only the rule whose message recommends a replacement emits fix tags;
	// the others fix by removing the offending tag (empty FixTags).
	if violation := byPath["data/content/demo/task-a.md"]; violation.Severity != EdgeTypeSeverityWarning {
		t.Fatalf("task-a depends-on note severity = %q, want warning", violation.Severity)
	} else if !slices.Equal(violation.FixTags, []string{"relates-to"}) {
		t.Fatalf("task-a depends-on note fixTags = %v, want [relates-to]", violation.FixTags)
	}
	if violation := byPath["data/content/demo/note-a.md"]; violation.Severity != EdgeTypeSeverityError {
		t.Fatalf("note depends-on source severity = %q, want error", violation.Severity)
	} else if len(violation.FixTags) != 0 {
		t.Fatalf("note depends-on source fixTags = %v, want none (remove tag)", violation.FixTags)
	}
	if violation := byPath["data/content/demo/update.md"]; violation.Severity != EdgeTypeSeverityWarning {
		t.Fatalf("task maps-to note severity = %q, want warning", violation.Severity)
	} else if len(violation.FixTags) != 0 {
		t.Fatalf("task maps-to note fixTags = %v, want none (remove tag)", violation.FixTags)
	}
	if violation := byPath["data/content/release/build.md"]; violation.Severity != EdgeTypeSeverityError {
		t.Fatalf("command evolves-from severity = %q, want error", violation.Severity)
	} else if len(violation.FixTags) != 0 {
		t.Fatalf("command evolves-from fixTags = %v, want none (remove tag)", violation.FixTags)
	}
	if violation := byPath["data/content/release/supersede.md"]; violation.Severity != EdgeTypeSeverityError {
		t.Fatalf("command supersedes severity = %q, want error", violation.Severity)
	} else if len(violation.FixTags) != 0 {
		t.Fatalf("command supersedes fixTags = %v, want none (remove tag)", violation.FixTags)
	}
}

func TestValidateEdgeTypeCompatibilityIgnoresUnknownRelationships(t *testing.T) {
	t.Parallel()

	documents := []WorkspaceDocument{
		{
			Path: "data/content/demo/task-a.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{
					CommonFields: CommonFields{ID: "task-a", Type: TaskType, Graph: "demo"},
					Links:        []NodeLink{{Node: "note-a", Relationships: []string{"documents", "captures", "references"}}},
				},
			},
		},
		{
			Path: "data/content/demo/note-a.md",
			Document: NoteDocument{
				Metadata: NoteMetadata{
					CommonFields: CommonFields{ID: "note-a", Type: NoteType, Graph: "demo"},
				},
			},
		},
	}

	violations := ValidateEdgeTypeCompatibility(documents)
	if len(violations) != 0 {
		t.Fatalf("ValidateEdgeTypeCompatibility() = %+v, want no violations for unknown relationships", violations)
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
