package desktop

import (
	"testing"

	"github.com/lex/flow/internal/core"
	"github.com/lex/flow/internal/markdown"
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

	deletedPath, err := app.DeleteDocument(core.DeleteDocumentRequest{DocumentID: "note-3"})
	if err != nil {
		t.Fatalf("DeleteDocument() error = %v", err)
	}
	if deletedPath != "data/content/release/app-plan.md" {
		t.Fatalf("DeleteDocument() path = %q, want data/content/release/app-plan.md", deletedPath)
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
