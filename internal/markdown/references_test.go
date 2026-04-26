package markdown

import "testing"

func TestResolveReferenceTargetSupportsIDBreadcrumbAndSameGraphTitle(t *testing.T) {
	t.Parallel()

	documents := []WorkspaceDocument{
		{
			Path: "data/content/execution/overview.md",
			Document: NoteDocument{
				Metadata: NoteMetadata{
					CommonFields: CommonFields{ID: "note-1", Type: NoteType, Graph: "wrong-graph", Title: "Overview"},
				},
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
			Path: "data/content/release/details.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{
					CommonFields: CommonFields{ID: "task-1", Type: TaskType, Graph: "release", Title: "Details"},
				},
			},
		},
	}

	tests := []struct {
		name        string
		rawTarget   string
		sourceGraph string
		wantID      string
	}{
		{name: "exact id", rawTarget: "note-1", sourceGraph: "execution", wantID: "note-1"},
		{name: "breadcrumb", rawTarget: "release > Details", sourceGraph: "execution", wantID: "task-1"},
		{name: "same graph title", rawTarget: "Details", sourceGraph: "execution", wantID: "note-2"},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			resolved, ok, err := ResolveReferenceTarget(documents, test.rawTarget, test.sourceGraph)
			if err != nil {
				t.Fatalf("ResolveReferenceTarget() error = %v", err)
			}
			if !ok {
				t.Fatalf("ResolveReferenceTarget() ok = false, want true")
			}
			if resolved.ID != test.wantID {
				t.Fatalf("resolved.ID = %q, want %q", resolved.ID, test.wantID)
			}
		})
	}
}

func TestLookupReferenceTargetsPrefersSameGraphTitleMatches(t *testing.T) {
	t.Parallel()

	documents := []WorkspaceDocument{
		{
			Path:     "data/content/execution/overview.md",
			Document: NoteDocument{Metadata: NoteMetadata{CommonFields: CommonFields{ID: "note-1", Type: NoteType, Graph: "execution", Title: "Overview"}}},
		},
		{
			Path:     "data/content/release/overview.md",
			Document: NoteDocument{Metadata: NoteMetadata{CommonFields: CommonFields{ID: "note-2", Type: NoteType, Graph: "release", Title: "Overview"}}},
		},
		{
			Path:     "data/content/execution/parser.md",
			Document: TaskDocument{Metadata: TaskMetadata{CommonFields: CommonFields{ID: "task-1", Type: TaskType, Graph: "execution", Title: "Parser rollout"}}},
		},
	}

	results, err := LookupReferenceTargets(documents, "overview", "execution", 10)
	if err != nil {
		t.Fatalf("LookupReferenceTargets() error = %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("len(results) = %d, want 2", len(results))
	}
	if results[0].ID != "note-1" {
		t.Fatalf("results[0].ID = %q, want note-1", results[0].ID)
	}
	if results[0].Breadcrumb != "execution > Overview" {
		t.Fatalf("results[0].Breadcrumb = %q, want execution > Overview", results[0].Breadcrumb)
	}
}

func TestResolveInlineReferencesReturnsResolvedTargets(t *testing.T) {
	t.Parallel()

	documents := []WorkspaceDocument{
		{
			Path: "data/content/execution/overview.md",
			Document: NoteDocument{
				Metadata: NoteMetadata{CommonFields: CommonFields{ID: "note-1", Type: NoteType, Graph: "execution", Title: "Overview"}},
				Body:     "See [[Details]] and [[release > Ship it]].\n",
			},
		},
		{
			Path: "data/content/execution/details.md",
			Document: NoteDocument{
				Metadata: NoteMetadata{CommonFields: CommonFields{ID: "note-2", Type: NoteType, Graph: "execution", Title: "Details"}},
			},
		},
		{
			Path: "data/content/release/ship-it.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{CommonFields: CommonFields{ID: "task-1", Type: TaskType, Graph: "release", Title: "Ship it"}},
			},
		},
	}

	resolved, err := ResolveInlineReferences(documents, documents[0])
	if err != nil {
		t.Fatalf("ResolveInlineReferences() error = %v", err)
	}
	if len(resolved) != 2 {
		t.Fatalf("len(resolved) = %d, want 2", len(resolved))
	}
	if resolved[0].Token != "[[Details]]" || resolved[0].Target.ID != "note-2" {
		t.Fatalf("resolved[0] = %#v", resolved[0])
	}
	if resolved[1].Token != "[[release > Ship it]]" || resolved[1].Target.ID != "task-1" {
		t.Fatalf("resolved[1] = %#v", resolved[1])
	}
}

func TestResolveInlineReferencesSupportsLegacyEscapedTokens(t *testing.T) {
	t.Parallel()

	documents := []WorkspaceDocument{
		{
			Path: "data/content/graph1/note1.md",
			Document: NoteDocument{
				Metadata: NoteMetadata{CommonFields: CommonFields{ID: "graph1/note1", Type: NoteType, Graph: "graph1", Title: "Note1"}},
				Body:     `See \[\[graph2 > Task1\]\] for the next step.`,
			},
		},
		{
			Path: "data/content/graph2/task1.md",
			Document: TaskDocument{
				Metadata: TaskMetadata{CommonFields: CommonFields{ID: "graph2/task1", Type: TaskType, Graph: "graph2", Title: "Task1"}},
			},
		},
	}

	resolved, err := ResolveInlineReferences(documents, documents[0])
	if err != nil {
		t.Fatalf("ResolveInlineReferences() error = %v", err)
	}
	if len(resolved) != 1 {
		t.Fatalf("len(resolved) = %d, want 1", len(resolved))
	}
	if resolved[0].Token != "[[graph2 > Task1]]" || resolved[0].Target.ID != "graph2/task1" {
		t.Fatalf("resolved[0] = %#v", resolved[0])
	}
}
