package graph

import (
	"slices"
	"testing"

	"github.com/lex/flow/internal/markdown"
)

func TestBuildTaskLayerViewComputesCrossGraphLayers(t *testing.T) {
	t.Parallel()

	view, err := BuildTaskLayerView([]markdown.WorkspaceDocument{
		{
			Path: "data/graphs/planning/foundation.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-0", Type: markdown.TaskType, Graph: "planning", Title: "Foundation"},
					Status:       "todo",
				},
			},
		},
		{
			Path: "data/graphs/execution/parser.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "execution", Title: "Parser"},
					DependsOn:    []string{"task-0"},
					References:   []string{"note-1"},
				},
			},
		},
		{
			Path: "data/graphs/execution/tests.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-2", Type: markdown.TaskType, Graph: "execution", Title: "Tests"},
					DependsOn:    []string{"task-0"},
				},
			},
		},
		{
			Path: "data/graphs/release/release.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-3", Type: markdown.TaskType, Graph: "release", Title: "Release"},
					DependsOn:    []string{"task-1", "task-2"},
				},
			},
		},
		{
			Path: "data/graphs/notes/architecture.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "notes", Title: "Architecture"},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("BuildTaskLayerView() error = %v", err)
	}

	if len(view.Layers) != 3 {
		t.Fatalf("len(view.Layers) = %d, want 3", len(view.Layers))
	}

	assertLayerTaskIDs(t, view.Layers[0], []string{"task-0"})
	assertLayerTaskIDs(t, view.Layers[1], []string{"task-1", "task-2"})
	assertLayerTaskIDs(t, view.Layers[2], []string{"task-3"})

	if view.Tasks["task-3"].Layer != 2 {
		t.Fatalf("view.Tasks[task-3].Layer = %d, want 2", view.Tasks["task-3"].Layer)
	}

	if view.Tasks["task-3"].FeatureSlug != "release" {
		t.Fatalf("view.Tasks[task-3].FeatureSlug = %q, want release", view.Tasks["task-3"].FeatureSlug)
	}

	if view.Tasks["task-1"].Graph != "execution" {
		t.Fatalf("view.Tasks[task-1].Graph = %q, want execution", view.Tasks["task-1"].Graph)
	}
}

func TestBuildTaskLayerViewRejectsMissingDependency(t *testing.T) {
	t.Parallel()

	_, err := BuildTaskLayerView([]markdown.WorkspaceDocument{
		{
			Path: "data/graphs/execution/parser.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "execution", Title: "Parser"},
					DependsOn:    []string{"task-0"},
				},
			},
		},
	})
	if err == nil {
		t.Fatal("BuildTaskLayerView() error = nil, want missing dependency error")
	}
}

func TestBuildTaskLayerViewRejectsCycle(t *testing.T) {
	t.Parallel()

	_, err := BuildTaskLayerView([]markdown.WorkspaceDocument{
		{
			Path: "data/graphs/execution/a.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-a", Type: markdown.TaskType, Graph: "execution", Title: "A"},
					DependsOn:    []string{"task-b"},
				},
			},
		},
		{
			Path: "data/graphs/execution/b.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-b", Type: markdown.TaskType, Graph: "execution", Title: "B"},
					DependsOn:    []string{"task-a"},
				},
			},
		},
	})
	if err == nil {
		t.Fatal("BuildTaskLayerView() error = nil, want cycle error")
	}
}

func TestBuildCommandLayerViewComputesSelectedGraphLayers(t *testing.T) {
	t.Parallel()

	view, err := BuildCommandLayerView([]markdown.WorkspaceDocument{
		{
			Path: "data/graphs/setup/prepare.md",
			Document: markdown.CommandDocument{
				Metadata: markdown.CommandMetadata{
					CommonFields: markdown.CommonFields{ID: "cmd-0", Type: markdown.CommandType, Graph: "setup", Title: "Prepare"},
					Name:         "prepare",
					Run:          "./prepare.sh",
				},
			},
		},
		{
			Path: "data/graphs/release/lint.md",
			Document: markdown.CommandDocument{
				Metadata: markdown.CommandMetadata{
					CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "release", Title: "Lint"},
					Name:         "lint",
					Run:          "go test ./...",
				},
			},
		},
		{
			Path: "data/graphs/release/build.md",
			Document: markdown.CommandDocument{
				Metadata: markdown.CommandMetadata{
					CommonFields: markdown.CommonFields{ID: "cmd-2", Type: markdown.CommandType, Graph: "release", Title: "Build"},
					Name:         "build",
					DependsOn:    []string{"cmd-0"},
					Run:          "go build ./cmd/flow",
				},
			},
		},
		{
			Path: "data/graphs/release/package.md",
			Document: markdown.CommandDocument{
				Metadata: markdown.CommandMetadata{
					CommonFields: markdown.CommonFields{ID: "cmd-3", Type: markdown.CommandType, Graph: "release", Title: "Package"},
					Name:         "package",
					DependsOn:    []string{"cmd-2"},
					Run:          "tar -czf flow.tgz flow",
				},
			},
		},
	}, "release")
	if err != nil {
		t.Fatalf("BuildCommandLayerView() error = %v", err)
	}

	if view.SelectedGraph != "release" {
		t.Fatalf("view.SelectedGraph = %q, want release", view.SelectedGraph)
	}

	assertStringSlicesEqual(t, view.AvailableGraphs, []string{"release", "setup"})
	assertStringSlicesEqual(t, view.GraphCommands["release"], []string{"cmd-2", "cmd-1", "cmd-3"})
	assertStringSlicesEqual(t, view.GraphCommands["setup"], []string{"cmd-0"})

	if len(view.Layers) != 3 {
		t.Fatalf("len(view.Layers) = %d, want 3", len(view.Layers))
	}

	assertLayerCommandIDs(t, view.Layers[0], []string{"cmd-1"})
	assertLayerCommandIDs(t, view.Layers[1], []string{"cmd-2"})
	assertLayerCommandIDs(t, view.Layers[2], []string{"cmd-3"})

	if view.Commands["cmd-2"].Layer != 1 {
		t.Fatalf("view.Commands[cmd-2].Layer = %d, want 1", view.Commands["cmd-2"].Layer)
	}

	if view.Commands["cmd-0"].Layer != 0 {
		t.Fatalf("view.Commands[cmd-0].Layer = %d, want 0", view.Commands["cmd-0"].Layer)
	}
}

func TestBuildCommandLayerViewRejectsUnknownSelectedGraph(t *testing.T) {
	t.Parallel()

	_, err := BuildCommandLayerView([]markdown.WorkspaceDocument{
		{
			Path: "data/graphs/release/build.md",
			Document: markdown.CommandDocument{
				Metadata: markdown.CommandMetadata{
					CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "release", Title: "Build"},
					Name:         "build",
					Run:          "go build ./cmd/flow",
				},
			},
		},
	}, "missing")
	if err == nil {
		t.Fatal("BuildCommandLayerView() error = nil, want unknown graph error")
	}
}

func TestBuildCommandLayerViewRejectsCycle(t *testing.T) {
	t.Parallel()

	_, err := BuildCommandLayerView([]markdown.WorkspaceDocument{
		{
			Path: "data/graphs/release/a.md",
			Document: markdown.CommandDocument{
				Metadata: markdown.CommandMetadata{
					CommonFields: markdown.CommonFields{ID: "cmd-a", Type: markdown.CommandType, Graph: "release", Title: "A"},
					Name:         "a",
					DependsOn:    []string{"cmd-b"},
					Run:          "./a.sh",
				},
			},
		},
		{
			Path: "data/graphs/release/b.md",
			Document: markdown.CommandDocument{
				Metadata: markdown.CommandMetadata{
					CommonFields: markdown.CommonFields{ID: "cmd-b", Type: markdown.CommandType, Graph: "release", Title: "B"},
					Name:         "b",
					DependsOn:    []string{"cmd-a"},
					Run:          "./b.sh",
				},
			},
		},
	}, "release")
	if err == nil {
		t.Fatal("BuildCommandLayerView() error = nil, want cycle error")
	}
}

func TestBuildNoteGraphViewComputesBidirectionalRelationships(t *testing.T) {
	t.Parallel()

	view, err := BuildNoteGraphView([]markdown.WorkspaceDocument{
		{
			Path: "data/graphs/notes/alpha.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "notes", Title: "Alpha"},
					References:   []string{"note-2", "task-1"},
				},
			},
		},
		{
			Path: "data/graphs/notes/beta.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "note-2", Type: markdown.NoteType, Graph: "notes", Title: "Beta"},
					References:   []string{"note-1", "note-3"},
				},
			},
		},
		{
			Path: "data/graphs/research/gamma.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "note-3", Type: markdown.NoteType, Graph: "research", Title: "Gamma"},
				},
			},
		},
		{
			Path: "data/graphs/execution/task.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "execution", Title: "Task"},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("BuildNoteGraphView() error = %v", err)
	}

	assertStringSlicesEqual(t, view.AvailableGraphs, []string{"notes", "research"})
	assertStringSlicesEqual(t, view.GraphNotes["notes"], []string{"note-1", "note-2"})
	assertStringSlicesEqual(t, view.GraphNotes["research"], []string{"note-3"})

	if len(view.Edges) != 2 {
		t.Fatalf("len(view.Edges) = %d, want 2", len(view.Edges))
	}

	assertNoteEdge(t, view.Edges[0], "note-1", "note-2")
	assertNoteEdge(t, view.Edges[1], "note-2", "note-3")

	assertStringSlicesEqual(t, view.Nodes["note-1"].RelatedNoteIDs, []string{"note-2"})
	assertStringSlicesEqual(t, view.Nodes["note-2"].RelatedNoteIDs, []string{"note-1", "note-3"})
	assertStringSlicesEqual(t, view.Nodes["note-3"].RelatedNoteIDs, []string{"note-2"})
	assertStringSlicesEqual(t, view.Nodes["note-1"].References, []string{"note-2", "task-1"})

	if view.Nodes["note-3"].FeatureSlug != "research" {
		t.Fatalf("view.Nodes[note-3].FeatureSlug = %q, want research", view.Nodes["note-3"].FeatureSlug)
	}
}

func TestBuildNoteGraphViewRejectsInvalidPath(t *testing.T) {
	t.Parallel()

	_, err := BuildNoteGraphView([]markdown.WorkspaceDocument{
		{
			Path: "notes/alpha.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "notes", Title: "Alpha"},
				},
			},
		},
	})
	if err == nil {
		t.Fatal("BuildNoteGraphView() error = nil, want invalid path error")
	}
}

func TestBuildTaskFocusedGraphSnapshotCollapsesAndExpandsBoundaries(t *testing.T) {
	t.Parallel()

	baseDocuments := []markdown.WorkspaceDocument{
		{
			Path: "data/graphs/planning/foundation.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-0", Type: markdown.TaskType, Graph: "planning", Title: "Foundation"},
				},
			},
		},
		{
			Path: "data/graphs/execution/parser.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "execution", Title: "Parser"},
					DependsOn:    []string{"task-0"},
				},
			},
		},
		{
			Path: "data/graphs/execution/tests.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-2", Type: markdown.TaskType, Graph: "execution", Title: "Tests"},
				},
			},
		},
		{
			Path: "data/graphs/release/release.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-3", Type: markdown.TaskType, Graph: "release", Title: "Release"},
					DependsOn:    []string{"task-1", "task-2"},
				},
			},
		},
		{
			Path: "data/graphs/release/follow-up.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-4", Type: markdown.TaskType, Graph: "release", Title: "Follow Up"},
					DependsOn:    []string{"task-3"},
				},
			},
		},
	}

	snapshot, err := BuildTaskFocusedGraphSnapshot(baseDocuments, "execution", nil)
	if err != nil {
		t.Fatalf("BuildTaskFocusedGraphSnapshot() error = %v", err)
	}

	assertStringSlicesEqual(t, snapshot.AvailableGraphs, []string{"execution", "planning", "release"})
	assertTaskSnapshotNodeIDs(t, snapshot.Nodes, []string{"task-1", "task-2"})
	assertDependencyEdges(t, snapshot.Edges, []DependencyEdge{})
	assertBoundaryMarkers(t, snapshot.BoundaryMarkers, []BoundaryMarker{
		{ID: "dependencies:execution:planning", Direction: BoundaryDependencies, Graph: "planning", Count: 1, NodeIDs: []string{"task-0"}},
		{ID: "dependents:execution:release", Direction: BoundaryDependents, Graph: "release", Count: 1, NodeIDs: []string{"task-3"}},
	})
	assertBoundaryConnections(t, snapshot.BoundaryConnections, []BoundaryConnection{
		{BoundaryID: "dependencies:execution:planning", NodeID: "task-1"},
		{BoundaryID: "dependents:execution:release", NodeID: "task-1"},
		{BoundaryID: "dependents:execution:release", NodeID: "task-2"},
	})

	expandedSnapshot, err := BuildTaskFocusedGraphSnapshot(baseDocuments, "execution", []string{"dependents:execution:release"})
	if err != nil {
		t.Fatalf("BuildTaskFocusedGraphSnapshot() expanded error = %v", err)
	}

	assertTaskSnapshotNodeIDs(t, expandedSnapshot.Nodes, []string{"task-1", "task-2", "task-3", "task-4"})
	assertDependencyEdges(t, expandedSnapshot.Edges, []DependencyEdge{
		{FromID: "task-1", ToID: "task-3"},
		{FromID: "task-2", ToID: "task-3"},
		{FromID: "task-3", ToID: "task-4"},
	})
	assertBoundaryMarkers(t, expandedSnapshot.BoundaryMarkers, []BoundaryMarker{
		{ID: "dependencies:execution:planning", Direction: BoundaryDependencies, Graph: "planning", Count: 1, NodeIDs: []string{"task-0"}},
	})
}

func TestBuildCommandFocusedGraphSnapshotExpandsDependencyBoundary(t *testing.T) {
	t.Parallel()

	baseDocuments := []markdown.WorkspaceDocument{
		{
			Path: "data/graphs/setup/prepare.md",
			Document: markdown.CommandDocument{
				Metadata: markdown.CommandMetadata{
					CommonFields: markdown.CommonFields{ID: "cmd-0", Type: markdown.CommandType, Graph: "setup", Title: "Prepare"},
					Name:         "prepare",
					Run:          "./prepare.sh",
				},
			},
		},
		{
			Path: "data/graphs/release/lint.md",
			Document: markdown.CommandDocument{
				Metadata: markdown.CommandMetadata{
					CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "release", Title: "Lint"},
					Name:         "lint",
					Run:          "go test ./...",
				},
			},
		},
		{
			Path: "data/graphs/release/build.md",
			Document: markdown.CommandDocument{
				Metadata: markdown.CommandMetadata{
					CommonFields: markdown.CommonFields{ID: "cmd-2", Type: markdown.CommandType, Graph: "release", Title: "Build"},
					Name:         "build",
					DependsOn:    []string{"cmd-0", "cmd-1"},
					Run:          "go build ./cmd/flow",
				},
			},
		},
	}

	snapshot, err := BuildCommandFocusedGraphSnapshot(baseDocuments, "release", []string{"dependencies:release:setup"})
	if err != nil {
		t.Fatalf("BuildCommandFocusedGraphSnapshot() error = %v", err)
	}

	assertCommandSnapshotNodeIDs(t, snapshot.Nodes, []string{"cmd-0", "cmd-1", "cmd-2"})
	assertDependencyEdges(t, snapshot.Edges, []DependencyEdge{
		{FromID: "cmd-1", ToID: "cmd-2"},
		{FromID: "cmd-0", ToID: "cmd-2"},
	})
	assertBoundaryMarkers(t, snapshot.BoundaryMarkers, []BoundaryMarker{})
}

func TestBuildTaskFocusedGraphSnapshotRejectsUnknownGraph(t *testing.T) {
	t.Parallel()

	_, err := BuildTaskFocusedGraphSnapshot([]markdown.WorkspaceDocument{
		{
			Path: "data/graphs/execution/task.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "execution", Title: "Task"},
				},
			},
		},
	}, "missing", nil)
	if err == nil {
		t.Fatal("BuildTaskFocusedGraphSnapshot() error = nil, want unknown graph error")
	}
}

func assertLayerTaskIDs(t *testing.T, layer TaskLayer, want []string) {
	t.Helper()

	if len(layer.Tasks) != len(want) {
		t.Fatalf("len(layer.Tasks) = %d, want %d", len(layer.Tasks), len(want))
	}

	for index, task := range layer.Tasks {
		if task.ID != want[index] {
			t.Fatalf("layer.Tasks[%d].ID = %q, want %q", index, task.ID, want[index])
		}
	}
}

func assertLayerCommandIDs(t *testing.T, layer CommandLayer, want []string) {
	t.Helper()

	if len(layer.Commands) != len(want) {
		t.Fatalf("len(layer.Commands) = %d, want %d", len(layer.Commands), len(want))
	}

	for index, command := range layer.Commands {
		if command.ID != want[index] {
			t.Fatalf("layer.Commands[%d].ID = %q, want %q", index, command.ID, want[index])
		}
	}
}

func assertStringSlicesEqual(t *testing.T, got []string, want []string) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("len(slice) = %d, want %d (%v)", len(got), len(want), got)
	}

	for index := range got {
		if got[index] != want[index] {
			t.Fatalf("slice[%d] = %q, want %q", index, got[index], want[index])
		}
	}
}

func assertNoteEdge(t *testing.T, edge NoteEdge, left string, right string) {
	t.Helper()

	if edge.LeftNoteID != left || edge.RightNoteID != right {
		t.Fatalf("edge = %q %q, want %q %q", edge.LeftNoteID, edge.RightNoteID, left, right)
	}
}

func assertTaskSnapshotNodeIDs(t *testing.T, nodes map[string]TaskNode, want []string) {
	t.Helper()

	got := make([]string, 0, len(nodes))
	for id := range nodes {
		got = append(got, id)
	}
	slices.Sort(got)
	slices.Sort(want)
	assertStringSlicesEqual(t, got, want)
}

func assertCommandSnapshotNodeIDs(t *testing.T, nodes map[string]CommandNode, want []string) {
	t.Helper()

	got := make([]string, 0, len(nodes))
	for id := range nodes {
		got = append(got, id)
	}
	slices.Sort(got)
	slices.Sort(want)
	assertStringSlicesEqual(t, got, want)
}

func assertDependencyEdges(t *testing.T, got []DependencyEdge, want []DependencyEdge) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("len(edges) = %d, want %d", len(got), len(want))
	}

	for index := range got {
		if got[index] != want[index] {
			t.Fatalf("edges[%d] = %#v, want %#v", index, got[index], want[index])
		}
	}
}

func assertBoundaryMarkers(t *testing.T, got []BoundaryMarker, want []BoundaryMarker) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("len(boundaryMarkers) = %d, want %d", len(got), len(want))
	}

	for index := range got {
		if got[index].ID != want[index].ID || got[index].Direction != want[index].Direction || got[index].Graph != want[index].Graph || got[index].Count != want[index].Count {
			t.Fatalf("boundaryMarkers[%d] = %#v, want %#v", index, got[index], want[index])
		}

		assertStringSlicesEqual(t, got[index].NodeIDs, want[index].NodeIDs)
	}
}

func assertBoundaryConnections(t *testing.T, got []BoundaryConnection, want []BoundaryConnection) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("len(boundaryConnections) = %d, want %d", len(got), len(want))
	}

	for index := range got {
		if got[index] != want[index] {
			t.Fatalf("boundaryConnections[%d] = %#v, want %#v", index, got[index], want[index])
		}
	}
}
