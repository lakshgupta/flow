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