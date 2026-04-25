package graph

import (
	"testing"

	"github.com/lex/flow/internal/markdown"
)

func TestBuildGraphCanvasViewProjectsScopedNodesEdgesAndPositions(t *testing.T) {
	t.Parallel()

	view, err := BuildGraphCanvasView([]markdown.WorkspaceDocument{
		{
			Path: "data/content/planning/foundation.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-0", Type: markdown.TaskType, Graph: "planning", Title: "Foundation"},
				},
			},
		},
		{
			Path: "data/content/execution/overview.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "execution", Title: "Overview", Description: "Execution overview"},
					References:   []markdown.NodeReference{{Node: "cmd-1"}},
				},
			},
		},
		{
			Path: "data/content/execution/build.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "execution", Title: "Build"},
					DependsOn:    []string{"task-0"},
					References:   []markdown.NodeReference{{Node: "note-1"}},
				},
			},
		},
		{
			Path: "data/content/execution/parser/run.md",
			Document: markdown.CommandDocument{
				Metadata: markdown.CommandMetadata{
					CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "execution/parser", Title: "Run Parser"},
					Name:         "parser",
					Run:          "./parser.sh",
				},
			},
		},
	}, "execution", map[string]GraphCanvasPosition{"note-1": {X: 512, Y: 128}})
	if err != nil {
		t.Fatalf("BuildGraphCanvasView() error = %v", err)
	}

	assertStringSlicesEqual(t, view.AvailableGraphs, []string{"execution", "execution/parser", "planning"})
	if view.SelectedGraph != "execution" {
		t.Fatalf("view.SelectedGraph = %q, want execution", view.SelectedGraph)
	}
	if len(view.Nodes) != 3 {
		t.Fatalf("len(view.Nodes) = %d, want 3", len(view.Nodes))
	}
	if view.LayerGuidance.MagneticThresholdPx != 18 {
		t.Fatalf("view.LayerGuidance.MagneticThresholdPx = %v, want 18", view.LayerGuidance.MagneticThresholdPx)
	}
	assertGraphCanvasGuides(t, view.LayerGuidance.Guides, []GraphCanvasLayerGuide{{Layer: 0, X: 140}, {Layer: 1, X: 460}, {Layer: 2, X: 780}})

	note := graphCanvasNodeByID(t, view.Nodes, "note-1")
	if !note.PositionPersisted || note.Position.X != 512 || note.Position.Y != 128 {
		t.Fatalf("note position = %#v, want persisted 512/128", note)
	}

	command := graphCanvasNodeByID(t, view.Nodes, "cmd-1")
	if command.Graph != "execution/parser" {
		t.Fatalf("command.Graph = %q, want execution/parser", command.Graph)
	}
	if command.PositionPersisted {
		t.Fatal("command.PositionPersisted = true, want false")
	}
	if command.Position.X != 780 || command.Position.Y != 120 {
		t.Fatalf("command.Position = %#v, want layer-2 seeded position", command.Position)
	}

	task := graphCanvasNodeByID(t, view.Nodes, "task-1")
	if task.Position.X != 140 || task.Position.Y != 120 {
		t.Fatalf("task.Position = %#v, want layer-0 seeded position", task.Position)
	}

	assertGraphCanvasEdges(t, view.Edges, []GraphCanvasEdge{
		{ID: "link:note-1:cmd-1", Source: "note-1", Target: "cmd-1", Kind: "link"},
		{ID: "link:task-1:note-1", Source: "task-1", Target: "note-1", Kind: "link"},
	})
}

func TestBuildGraphCanvasViewUsesStablePseudoTopologicalOrderingForCycles(t *testing.T) {
	t.Parallel()

	view, err := BuildGraphCanvasView([]markdown.WorkspaceDocument{
		{
			Path: "data/content/execution/alpha.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "note-a", Type: markdown.NoteType, Graph: "execution", Title: "Alpha", CreatedAt: "2026-03-17T08:00:00Z"},
					References:   []markdown.NodeReference{{Node: "note-b"}},
				},
			},
		},
		{
			Path: "data/content/execution/beta.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "note-b", Type: markdown.NoteType, Graph: "execution", Title: "Beta", CreatedAt: "2026-03-17T09:00:00Z"},
					References:   []markdown.NodeReference{{Node: "note-a"}},
				},
			},
		},
	}, "execution", nil)
	if err != nil {
		t.Fatalf("BuildGraphCanvasView() error = %v", err)
	}

	alpha := graphCanvasNodeByID(t, view.Nodes, "note-a")
	beta := graphCanvasNodeByID(t, view.Nodes, "note-b")
	if alpha.Position.X != 140 || beta.Position.X != 460 {
		t.Fatalf("cycle positions = alpha:%#v beta:%#v, want stable layer order by creation time", alpha.Position, beta.Position)
	}
	assertGraphCanvasGuides(t, view.LayerGuidance.Guides, []GraphCanvasLayerGuide{{Layer: 0, X: 140}, {Layer: 1, X: 460}})
}

func TestBuildGraphCanvasViewRejectsUnknownGraph(t *testing.T) {
	t.Parallel()

	_, err := BuildGraphCanvasView([]markdown.WorkspaceDocument{
		{
			Path: "data/content/execution/overview.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "execution", Title: "Overview"},
				},
			},
		},
	}, "missing", nil)
	if err == nil {
		t.Fatal("BuildGraphCanvasView() error = nil, want unknown graph error")
	}
}

func graphCanvasNodeByID(t *testing.T, nodes []GraphCanvasNode, id string) GraphCanvasNode {
	t.Helper()

	for _, node := range nodes {
		if node.ID == id {
			return node
		}
	}

	t.Fatalf("graph canvas nodes missing %q in %#v", id, nodes)
	return GraphCanvasNode{}
}

func assertGraphCanvasEdges(t *testing.T, got []GraphCanvasEdge, want []GraphCanvasEdge) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("len(edges) = %d, want %d", len(got), len(want))
	}

	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("edges[%d] = %#v, want %#v", index, got[index], want[index])
		}
	}
}

func assertGraphCanvasGuides(t *testing.T, got []GraphCanvasLayerGuide, want []GraphCanvasLayerGuide) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("len(guides) = %d, want %d", len(got), len(want))
	}

	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("guides[%d] = %#v, want %#v", index, got[index], want[index])
		}
	}
}
