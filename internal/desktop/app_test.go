package desktop

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/lex/flow/internal/core"
	"github.com/lex/flow/internal/httpapi"
	"github.com/lex/flow/internal/index"
	"github.com/lex/flow/internal/markdown"
	"github.com/lex/flow/internal/workspace"
)

func TestAppDelegatesDocumentMutations(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	app := NewApp(NewBackend(root))

	created, err := app.CreateDocument(core.CreateDocumentRequest{
		Type:        markdown.NoteType,
		FeatureSlug: "release",
		FileName:    "app-plan",
		ID:          "note-3",
		Graph:       "release",
		Title:       "App Plan",
		Body:        "App plan body\n",
	})
	if err != nil {
		t.Fatalf("CreateDocument() error = %v", err)
	}
	if created.Path != "data/content/release/app-plan.md" {
		t.Fatalf("CreateDocument() path = %q, want data/content/release/app-plan.md", created.Path)
	}

	title := "App Plan Updated"
	updated, err := app.UpdateDocument(core.UpdateDocumentRequest{
		DocumentID: "note-3",
		Patch: core.UpdateDocumentPatch{
			Title: &title,
		},
	})
	if err != nil {
		t.Fatalf("UpdateDocument() error = %v", err)
	}
	if updated.Path != "data/content/release/app-plan.md" {
		t.Fatalf("UpdateDocument() path = %q, want data/content/release/app-plan.md", updated.Path)
	}

	deleted, err := app.DeleteDocument(core.DeleteDocumentRequest{DocumentID: "note-3"})
	if err != nil {
		t.Fatalf("DeleteDocument() error = %v", err)
	}
	if deleted.Path != "data/content/release/app-plan.md" {
		t.Fatalf("DeleteDocument() path = %q, want data/content/release/app-plan.md", deleted.Path)
	}
	if deleted.StrippedReferences != nil {
		t.Fatalf("DeleteDocument() strippedReferences = %v, want nil for plain delete", deleted.StrippedReferences)
	}
}

// TestAppForceDeleteDocumentSurfacesStrippedReferences verifies the Wails
// binding's result struct carries the referencer paths on a force delete.
func TestAppForceDeleteDocumentSurfacesStrippedReferences(t *testing.T) {
	t.Parallel()

	root, err := workspace.ResolveLocal(t.TempDir())
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	// note-1 references task-1 via [[task-1]], so a force delete strips it.
	writeDesktopBackendDocument(t, filepath.Join(root.FlowPath, "data", "content", "notes", "architecture.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "notes", Title: "Architecture"},
		},
		Body: "Architecture body references [[task-1]].\n",
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

	app := NewApp(NewBackend(root))
	deleted, err := app.DeleteDocument(core.DeleteDocumentRequest{DocumentID: "task-1", Force: true})
	if err != nil {
		t.Fatalf("DeleteDocument() error = %v", err)
	}
	if deleted.Path != "data/content/execution/parser.md" {
		t.Fatalf("DeleteDocument() path = %q, want data/content/execution/parser.md", deleted.Path)
	}
	if len(deleted.StrippedReferences) != 1 || deleted.StrippedReferences[0] != "data/content/notes/architecture.md" {
		t.Fatalf("DeleteDocument() strippedReferences = %v, want data/content/notes/architecture.md", deleted.StrippedReferences)
	}
}

func TestAppDocumentMutationsDelegateToBackend(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	app := NewApp(NewBackend(root))

	_, err := app.CreateDocument(core.CreateDocumentRequest{
		Type:        markdown.NoteType,
		FeatureSlug: "release",
		FileName:    "alpha",
		ID:          "release/alpha",
		Graph:       "release",
		Title:       "Alpha",
		Body:        "Alpha body\n",
	})
	if err != nil {
		t.Fatalf("CreateDocument() error = %v", err)
	}
	_, err = app.CreateDocument(core.CreateDocumentRequest{
		Type:        markdown.NoteType,
		FeatureSlug: "release",
		FileName:    "beta",
		ID:          "release/beta",
		Graph:       "release",
		Title:       "Beta",
		Body:        "Beta body\n",
	})
	if err != nil {
		t.Fatalf("CreateDocument() error = %v", err)
	}

	merged, err := app.MergeDocuments(MergeDocumentsRequest{
		DocumentIDs: []string{"release/alpha", "release/beta"},
	})
	if err != nil {
		t.Fatalf("MergeDocuments() error = %v", err)
	}
	if merged.ID != "release/alpha" {
		t.Fatalf("MergeDocuments() id = %q, want release/alpha", merged.ID)
	}

	renamed, err := app.RenameGraph(RenameGraphRequest{
		CurrentName: "release",
		NextName:    "release-2026",
	})
	if err != nil {
		t.Fatalf("RenameGraph() error = %v", err)
	}
	if renamed.Name != "release-2026" {
		t.Fatalf("RenameGraph() name = %q, want release-2026", renamed.Name)
	}

	body := "Updated home body.\n"
	updatedHome, err := app.UpdateHome(httpapi.HomeUpdateRequest{Body: &body})
	if err != nil {
		t.Fatalf("UpdateHome() error = %v", err)
	}
	if updatedHome.ID != "home" || !strings.Contains(updatedHome.Body, "Updated home body.") {
		t.Fatalf("UpdateHome() = %+v, want id home with updated body", updatedHome)
	}
}

func TestAppGraphMutationsDelegateToBackend(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	app := NewApp(NewBackend(root))

	created, err := app.CreateGraph(CreateGraphRequest{Name: "releases"})
	if err != nil {
		t.Fatalf("CreateGraph() error = %v", err)
	}
	if created.Name != "releases" {
		t.Fatalf("CreateGraph() name = %q, want releases", created.Name)
	}

	colored, err := app.UpdateGraphColor(UpdateGraphColorRequest{GraphPath: "execution", Color: "sky"})
	if err != nil {
		t.Fatalf("UpdateGraphColor() error = %v", err)
	}
	if colored.Color != "sky" {
		t.Fatalf("UpdateGraphColor() color = %q, want sky", colored.Color)
	}

	disabled, err := app.UpdateGraphCanvasDisabled(UpdateGraphCanvasDisabledRequest{GraphPath: "execution", Disabled: true})
	if err != nil {
		t.Fatalf("UpdateGraphCanvasDisabled() error = %v", err)
	}
	if !disabled.CanvasDisabled {
		t.Fatalf("UpdateGraphCanvasDisabled() canvasDisabled = false, want true")
	}

	deleted, err := app.DeleteGraph(DeleteGraphRequest{Name: "releases"})
	if err != nil {
		t.Fatalf("DeleteGraph() error = %v", err)
	}
	if !deleted.Deleted || deleted.Name != "releases" {
		t.Fatalf("DeleteGraph() = %+v, want deleted releases", deleted)
	}
}