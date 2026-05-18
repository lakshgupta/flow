package desktop

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lex/flow/internal/core"
	"github.com/lex/flow/internal/index"
	"github.com/lex/flow/internal/markdown"
	"github.com/lex/flow/internal/workspace"
)

func TestBackendCreateDocumentRebuildsIndex(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	created, err := backend.CreateDocument(core.CreateDocumentRequest{
		Type:        markdown.NoteType,
		FeatureSlug: "release",
		FileName:    "desktop-plan",
		ID:          "note-2",
		Graph:       "release",
		Title:       "Desktop Plan",
		Body:        "Desktop plan body\n",
	})
	if err != nil {
		t.Fatalf("CreateDocument() error = %v", err)
	}
	if created.Path != "data/content/release/desktop-plan.md" {
		t.Fatalf("CreateDocument() path = %q, want data/content/release/desktop-plan.md", created.Path)
	}

	results, err := index.Search(root.IndexPath, "desktop", 10)
	if err != nil {
		t.Fatalf("index.Search() error = %v", err)
	}
	if len(results) != 1 || results[0].ID != "note-2" {
		t.Fatalf("search results = %#v, want note-2 match", results)
	}
	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "release", "desktop-plan.md")); err != nil {
		t.Fatalf("Stat(created file) error = %v", err)
	}
}

func TestBackendUpdateAndDeleteDocumentReuseCoreWorkflows(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)
	title := "Parser Updated"
	fileName := "parser-updated"

	updated, err := backend.UpdateDocument(core.UpdateDocumentRequest{
		DocumentID: "task-1",
		Patch: core.UpdateDocumentPatch{
			Title:    &title,
			FileName: &fileName,
		},
	})
	if err != nil {
		t.Fatalf("UpdateDocument() error = %v", err)
	}
	if updated.Path != "data/content/execution/parser-updated.md" {
		t.Fatalf("UpdateDocument() path = %q, want data/content/execution/parser-updated.md", updated.Path)
	}

	deletedPath, err := backend.DeleteDocument(core.DeleteDocumentRequest{DocumentID: "task-1"})
	if err != nil {
		t.Fatalf("DeleteDocument() error = %v", err)
	}
	if deletedPath != "data/content/execution/parser-updated.md" {
		t.Fatalf("DeleteDocument() path = %q, want data/content/execution/parser-updated.md", deletedPath)
	}
	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "execution", "parser-updated.md")); !os.IsNotExist(err) {
		t.Fatalf("Stat(deleted file) error = %v, want not exist", err)
	}
}

func TestBackendReadQueriesExposeWorkspaceState(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	workspaceConfig, err := backend.WorkspaceConfig()
	if err != nil {
		t.Fatalf("WorkspaceConfig() error = %v", err)
	}
	if workspaceConfig.GUI.Port != 4317 {
		t.Fatalf("WorkspaceConfig().GUI.Port = %d, want default 4317", workspaceConfig.GUI.Port)
	}

	documents, err := backend.Documents()
	if err != nil {
		t.Fatalf("Documents() error = %v", err)
	}
	if len(documents) != 2 {
		t.Fatalf("len(Documents()) = %d, want 2", len(documents))
	}

	results, err := backend.Search("Parser", 10)
	if err != nil {
		t.Fatalf("Search() error = %v", err)
	}
	if len(results) != 1 || results[0].ID != "task-1" {
		t.Fatalf("Search() results = %#v, want task-1 match", results)
	}

	nodeView, err := backend.NodeView("task-1", "execution")
	if err != nil {
		t.Fatalf("NodeView() error = %v", err)
	}
	if nodeView.Title != "Parser" || nodeView.Graph != "execution" {
		t.Fatalf("NodeView() = %#v, want execution parser node", nodeView)
	}

	canvas, err := backend.GraphCanvas("execution")
	if err != nil {
		t.Fatalf("GraphCanvas() error = %v", err)
	}
	if canvas.View.SelectedGraph != "execution" {
		t.Fatalf("GraphCanvas().View.SelectedGraph = %q, want execution", canvas.View.SelectedGraph)
	}
	if len(canvas.View.Nodes) == 0 {
		t.Fatal("GraphCanvas().View.Nodes = empty, want visible nodes")
	}
}

func createDesktopBackendTestWorkspace(t *testing.T) workspace.Root {
	t.Helper()

	root, err := workspace.ResolveLocal(t.TempDir())
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	writeDesktopBackendDocument(t, filepath.Join(root.FlowPath, "data", "content", "notes", "architecture.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "notes", Title: "Architecture"},
		},
		Body: "Architecture body\n",
	})
	writeDesktopBackendDocument(t, filepath.Join(root.FlowPath, "data", "content", "execution", "parser.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "execution", Title: "Parser"},
			Status:       "Running",
		},
		Body: "Parser body\n",
	})

	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		t.Fatalf("index.Rebuild() error = %v", err)
	}

	return root
}

func writeDesktopBackendDocument(t *testing.T, path string, document markdown.Document) {
	t.Helper()

	data, err := markdown.SerializeDocument(document)
	if err != nil {
		t.Fatalf("SerializeDocument() error = %v", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
}
