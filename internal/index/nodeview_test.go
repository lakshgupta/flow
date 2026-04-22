package index

import (
	"path/filepath"
	"testing"
)

func TestReadNodeViewReturnsNoteDocument(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "arch", "overview.md"),
		"---\nid: note-1\ntype: note\ngraph: arch\ntitle: Overview\nreferences:\n  - note-2\n---\n\nNote body.\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "arch", "detail.md"),
		"---\nid: note-2\ntype: note\ngraph: arch\ntitle: Detail\n---\n\nDetail body.\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	view, err := ReadNodeView(indexPath, "note-1", "")
	if err != nil {
		t.Fatalf("ReadNodeView() error = %v", err)
	}

	if view.ID != "note-1" {
		t.Errorf("view.ID = %q, want note-1", view.ID)
	}
	if view.Type != "note" {
		t.Errorf("view.Type = %q, want note", view.Type)
	}
	if view.Role != "context" {
		t.Errorf("view.Role = %q, want context", view.Role)
	}
	if view.Graph != "arch" {
		t.Errorf("view.Graph = %q, want arch", view.Graph)
	}
	if view.Title != "Overview" {
		t.Errorf("view.Title = %q, want Overview", view.Title)
	}
	if view.Body != "Note body.\n" {
		t.Errorf("view.Body = %q, want Note body.\\n", view.Body)
	}
	if view.Status != "" {
		t.Errorf("view.Status = %q, want empty", view.Status)
	}
	if view.Run != "" {
		t.Errorf("view.Run = %q, want empty", view.Run)
	}
	if len(view.References) != 1 || view.References[0] != "note-2" {
		t.Errorf("view.References = %v, want [note-2]", view.References)
	}
	if len(view.DependsOn) != 0 {
		t.Errorf("view.DependsOn = %v, want empty", view.DependsOn)
	}
}

func TestReadNodeViewReturnsTaskDocument(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "work", "impl.md"),
		"---\nid: task-1\ntype: task\ngraph: work\ntitle: Implement feature\nstatus: todo\ndependsOn:\n  - task-0\nreferences:\n  - note-1\n---\n\nTask body.\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "work", "setup.md"),
		"---\nid: task-0\ntype: task\ngraph: work\ntitle: Setup\nstatus: done\n---\n\nSetup body.\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "work", "context.md"),
		"---\nid: note-1\ntype: note\ngraph: work\ntitle: Context\n---\n\nContext body.\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	view, err := ReadNodeView(indexPath, "task-1", "")
	if err != nil {
		t.Fatalf("ReadNodeView() error = %v", err)
	}

	if view.Type != "task" {
		t.Errorf("view.Type = %q, want task", view.Type)
	}
	if view.Role != "work" {
		t.Errorf("view.Role = %q, want work", view.Role)
	}
	if view.Status != "todo" {
		t.Errorf("view.Status = %q, want todo", view.Status)
	}
	if len(view.DependsOn) != 1 || view.DependsOn[0] != "task-0" {
		t.Errorf("view.DependsOn = %v, want [task-0]", view.DependsOn)
	}
	if len(view.References) != 1 || view.References[0] != "note-1" {
		t.Errorf("view.References = %v, want [note-1]", view.References)
	}
}

func TestReadNodeViewReturnsCommandDocument(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "release", "build.md"),
		"---\nid: cmd-1\ntype: command\ngraph: release\ntitle: Build\nname: build\nrun: go build ./cmd/flow\ndependsOn:\n  - cmd-0\n---\n\nCommand body.\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "release", "setup.md"),
		"---\nid: cmd-0\ntype: command\ngraph: release\ntitle: Setup\nname: setup\nrun: ./setup.sh\n---\n\nSetup body.\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	view, err := ReadNodeView(indexPath, "cmd-1", "")
	if err != nil {
		t.Fatalf("ReadNodeView() error = %v", err)
	}

	if view.Type != "command" {
		t.Errorf("view.Type = %q, want command", view.Type)
	}
	if view.Role != "decision" {
		t.Errorf("view.Role = %q, want decision", view.Role)
	}
	if view.Run != "go build ./cmd/flow" {
		t.Errorf("view.Run = %q, want go build ./cmd/flow", view.Run)
	}
	if len(view.DependsOn) != 1 || view.DependsOn[0] != "cmd-0" {
		t.Errorf("view.DependsOn = %v, want [cmd-0]", view.DependsOn)
	}
}

func TestReadNodeViewOutboundEdgesAlwaysEmpty(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "arch", "a.md"),
		"---\nid: note-a\ntype: note\ngraph: arch\ntitle: Node A\nreferences:\n  - {node: note-b, context: relates to}\n---\n\nA body.\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "arch", "b.md"),
		"---\nid: note-b\ntype: note\ngraph: arch\ntitle: Node B\n---\n\nB body.\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	view, err := ReadNodeView(indexPath, "note-a", "arch")
	if err != nil {
		t.Fatalf("ReadNodeView() error = %v", err)
	}

	if len(view.OutboundEdges) != 0 {
		t.Errorf("len(view.OutboundEdges) = %d, want 0 (edges are now inline references)", len(view.OutboundEdges))
	}
	if len(view.References) != 1 || view.References[0] != "note-b" {
		t.Errorf("view.References = %v, want [note-b]", view.References)
	}
}

func TestReadNodeViewLegacyEdgeFileIsSkipped(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "arch", "a.md"),
		"---\nid: note-a\ntype: note\ngraph: arch\ntitle: Node A\n---\n\nA body.\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "arch", "b.md"),
		"---\nid: note-b\ntype: note\ngraph: arch\ntitle: Node B\n---\n\nB body.\n")
	// Legacy edge file: should be silently skipped during indexing.
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "arch", "edge-1.md"),
		"---\nid: edge-1\ntype: edge\ngraph: arch\nfrom: note-a\nto: note-b\nlabel: uses\n---\n\nEdge body.\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	// The edge file must not appear as a node.
	_, err := ReadNodeView(indexPath, "edge-1", "")
	if err == nil {
		t.Fatal("ReadNodeView(edge-1) expected error for skipped legacy edge, got nil")
	}
}

func TestReadNodeViewFiltersByGraph(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "alpha", "note.md"),
		"---\nid: note-x\ntype: note\ngraph: alpha\ntitle: Alpha Note\n---\n\nAlpha body.\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	_, err := ReadNodeView(indexPath, "note-x", "beta")
	if err == nil {
		t.Fatal("ReadNodeView() expected error for mismatched graph, got nil")
	}

	view, err := ReadNodeView(indexPath, "note-x", "alpha")
	if err != nil {
		t.Fatalf("ReadNodeView() error = %v", err)
	}
	if view.Graph != "alpha" {
		t.Errorf("view.Graph = %q, want alpha", view.Graph)
	}
}

func TestReadNodeViewNotFoundReturnsError(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	_, err := ReadNodeView(indexPath, "does-not-exist", "")
	if err == nil {
		t.Fatal("ReadNodeView() expected error for missing node, got nil")
	}
}

func TestReadNodeViewEmptyIDReturnsError(t *testing.T) {
	t.Parallel()

	_, err := ReadNodeView("/any/path", "", "")
	if err == nil {
		t.Fatal("ReadNodeView() expected error for empty ID, got nil")
	}
}

func TestReadAllNodeViewsReturnsAllDocumentsInGraph(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "proj", "note.md"),
		"---\nid: note-1\ntype: note\ngraph: proj\ntitle: Note\n---\n\nNote body.\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "proj", "task.md"),
		"---\nid: task-1\ntype: task\ngraph: proj\ntitle: Task\nstatus: todo\n---\n\nTask body.\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "other", "note.md"),
		"---\nid: note-2\ntype: note\ngraph: other\ntitle: Other\n---\n\nOther body.\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	views, err := ReadAllNodeViews(indexPath, "proj")
	if err != nil {
		t.Fatalf("ReadAllNodeViews() error = %v", err)
	}

	if len(views) != 2 {
		t.Fatalf("len(views) = %d, want 2", len(views))
	}

	ids := map[string]bool{}
	for _, v := range views {
		ids[v.ID] = true
		if v.Graph != "proj" {
			t.Errorf("view.Graph = %q, want proj", v.Graph)
		}
	}
	if !ids["note-1"] || !ids["task-1"] {
		t.Errorf("views IDs = %v, want note-1 and task-1", ids)
	}
}

func TestReadAllNodeViewsEmptyGraphReturnsError(t *testing.T) {
	t.Parallel()

	_, err := ReadAllNodeViews("/any/path", "")
	if err == nil {
		t.Fatal("ReadAllNodeViews() expected error for empty graph, got nil")
	}
}

func TestDeriveRole(t *testing.T) {
	t.Parallel()

	cases := []struct {
		docType string
		want    string
	}{
		{"note", "context"},
		{"home", "context"},
		{"task", "work"},
		{"command", "decision"},
		{"unknown", "context"},
	}

	for _, tc := range cases {
		got := deriveRole(tc.docType)
		if got != tc.want {
			t.Errorf("deriveRole(%q) = %q, want %q", tc.docType, got, tc.want)
		}
	}
}
