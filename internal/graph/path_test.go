package graph

import (
	"reflect"
	"testing"

	"github.com/lex/flow/internal/markdown"
)

func TestFindShortestPathViaLinks(t *testing.T) {
	t.Parallel()

	documents := []markdown.WorkspaceDocument{
		{
			Path: "data/content/execution/a.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "note-a", Type: markdown.NoteType, Graph: "execution", Title: "Alpha"},
					Links:        []markdown.NodeLink{{Node: "task-b"}},
				},
			},
		},
		{
			Path: "data/content/execution/b.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-b", Type: markdown.TaskType, Graph: "execution", Title: "Beta"},
					Status:       "Running",
					Links:        []markdown.NodeLink{{Node: "note-c"}},
				},
			},
		},
		{
			Path: "data/content/execution/c.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "note-c", Type: markdown.NoteType, Graph: "execution", Title: "Gamma"},
				},
			},
		},
	}

	result, err := FindShortestPath(documents, "note-a", "note-c", true)
	if err != nil {
		t.Fatalf("FindShortestPath() error = %v", err)
	}

	if !result.Found {
		t.Fatal("FindShortestPath() Found = false, want true")
	}
	if result.Distance != 2 {
		t.Fatalf("FindShortestPath() Distance = %d, want 2", result.Distance)
	}
	if !reflect.DeepEqual(result.Nodes, []PathNode{
		{ID: "note-a", Type: "note", Graph: "execution", Title: "Alpha"},
		{ID: "task-b", Type: "task", Graph: "execution", Title: "Beta", Status: "Running"},
		{ID: "note-c", Type: "note", Graph: "execution", Title: "Gamma"},
	}) {
		t.Fatalf("FindShortestPath() Nodes = %#v", result.Nodes)
	}
	if !reflect.DeepEqual(result.Edges, []PathEdge{
		{Kind: "link", From: "note-a", To: "task-b"},
		{Kind: "link", From: "task-b", To: "note-c"},
	}) {
		t.Fatalf("FindShortestPath() Edges = %#v", result.Edges)
	}
}

func TestFindShortestPathPrefersDirectConnection(t *testing.T) {
	t.Parallel()

	documents := []markdown.WorkspaceDocument{
		{
			Path: "data/content/execution/a.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "a", Type: markdown.NoteType, Graph: "execution", Title: "A"},
					Links:        []markdown.NodeLink{{Node: "b"}, {Node: "c"}},
				},
			},
		},
		{
			Path: "data/content/execution/b.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "b", Type: markdown.NoteType, Graph: "execution", Title: "B"},
					Links:        []markdown.NodeLink{{Node: "c"}},
				},
			},
		},
		{
			Path: "data/content/execution/c.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "c", Type: markdown.NoteType, Graph: "execution", Title: "C"},
				},
			},
		},
	}

	result, err := FindShortestPath(documents, "a", "c", true)
	if err != nil {
		t.Fatalf("FindShortestPath() error = %v", err)
	}

	if !result.Found || result.Distance != 1 {
		t.Fatalf("FindShortestPath() = %#v, want direct distance 1", result)
	}
	if !reflect.DeepEqual(result.Edges, []PathEdge{{Kind: "link", From: "a", To: "c"}}) {
		t.Fatalf("FindShortestPath() Edges = %#v, want direct a->c edge", result.Edges)
	}
}

func TestFindShortestPathTraversesReferencesUndirected(t *testing.T) {
	t.Parallel()

	documents := []markdown.WorkspaceDocument{
		{
			Path: "data/content/execution/overview.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "execution", Title: "Overview"},
				},
				// Body references [[parser]] but the reference is declared FROM note-1.
				Body: "Overview references [[parser]].",
			},
		},
		{
			Path: "data/content/execution/parser.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "parser", Type: markdown.NoteType, Graph: "execution", Title: "Parser"},
				},
			},
		},
	}

	// Directed search cannot go from parser back to note-1.
	directed, err := FindShortestPath(documents, "parser", "note-1", true)
	if err != nil {
		t.Fatalf("FindShortestPath(directed) error = %v", err)
	}
	if directed.Found {
		t.Fatalf("FindShortestPath(directed) Found = true, want false")
	}

	// Undirected search can.
	undirected, err := FindShortestPath(documents, "parser", "note-1", false)
	if err != nil {
		t.Fatalf("FindShortestPath(undirected) error = %v", err)
	}
	if !undirected.Found || undirected.Distance != 1 {
		t.Fatalf("FindShortestPath(undirected) = %#v, want found distance 1", undirected)
	}
	if len(undirected.Edges) != 1 || undirected.Edges[0].Kind != "reference" {
		t.Fatalf("FindShortestPath(undirected) Edges = %#v, want reverse reference edge", undirected.Edges)
	}
}

func TestFindShortestPathSameNode(t *testing.T) {
	t.Parallel()

	documents := []markdown.WorkspaceDocument{
		{
			Path: "data/content/execution/a.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "a", Type: markdown.NoteType, Graph: "execution", Title: "A"},
				},
			},
		},
	}

	result, err := FindShortestPath(documents, "a", "a", true)
	if err != nil {
		t.Fatalf("FindShortestPath() error = %v", err)
	}
	if !result.Found || result.Distance != 0 || len(result.Nodes) != 1 || result.Nodes[0].ID != "a" {
		t.Fatalf("FindShortestPath() same-node = %#v, want found distance 0 with one node", result)
	}
	if len(result.Edges) != 0 {
		t.Fatalf("FindShortestPath() same-node Edges = %#v, want none", result.Edges)
	}
}

func TestFindShortestPathNoConnection(t *testing.T) {
	t.Parallel()

	documents := []markdown.WorkspaceDocument{
		{
			Path: "data/content/execution/a.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "a", Type: markdown.NoteType, Graph: "execution", Title: "A"},
				},
			},
		},
		{
			Path: "data/content/execution/b.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "b", Type: markdown.NoteType, Graph: "execution", Title: "B"},
				},
			},
		},
	}

	result, err := FindShortestPath(documents, "a", "b", true)
	if err != nil {
		t.Fatalf("FindShortestPath() error = %v", err)
	}
	if result.Found {
		t.Fatalf("FindShortestPath() Found = true, want false")
	}
	if result.Distance != 0 || len(result.Nodes) != 0 {
		t.Fatalf("FindShortestPath() = %#v, want empty result", result)
	}
}

func TestFindShortestPathUnknownNode(t *testing.T) {
	t.Parallel()

	documents := []markdown.WorkspaceDocument{
		{
			Path: "data/content/execution/a.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "a", Type: markdown.NoteType, Graph: "execution", Title: "A"},
				},
			},
		},
	}

	if _, err := FindShortestPath(documents, "a", "missing", true); err == nil {
		t.Fatal("FindShortestPath() error = nil, want unknown node error")
	}
	if _, err := FindShortestPath(documents, "missing", "a", true); err == nil {
		t.Fatal("FindShortestPath() error = nil, want unknown node error")
	}
}

func TestFindShortestPathSkipsHome(t *testing.T) {
	t.Parallel()

	documents := []markdown.WorkspaceDocument{
		{
			Path: "data/home.md",
			Document: markdown.HomeDocument{
				Metadata: markdown.CommonFields{ID: "home", Type: markdown.HomeType, Title: "Home"},
			},
		},
		{
			Path: "data/content/execution/a.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "a", Type: markdown.NoteType, Graph: "execution", Title: "A"},
				},
			},
		},
	}

	result, err := FindShortestPath(documents, "a", "a", true)
	if err != nil {
		t.Fatalf("FindShortestPath() error = %v", err)
	}
	if !result.Found {
		t.Fatal("FindShortestPath() Found = false, want true")
	}
	for _, node := range result.Nodes {
		if node.Type == "home" {
			t.Fatalf("FindShortestPath() Nodes include home node %#v", node)
		}
	}
}
