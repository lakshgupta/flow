package core

import (
	"errors"
	"strings"
	"testing"

	"github.com/lex/flow/internal/markdown"
)

func TestCreateDocumentRequiresCreator(t *testing.T) {
	t.Parallel()

	_, err := CreateDocument(CreateDocumentRequest{ID: "note-1"}, nil)
	if err == nil {
		t.Fatal("CreateDocument() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "document creator must not be nil") {
		t.Fatalf("CreateDocument() error = %q, want nil-creator validation", err.Error())
	}
}

func TestCreateDocumentPropagatesCreatedDocument(t *testing.T) {
	t.Parallel()

	called := false
	created, err := CreateDocument(CreateDocumentRequest{
		Type:  markdown.NoteType,
		ID:    "note-1",
		Graph: "execution",
		Title: "First Note",
	}, func(request CreateDocumentRequest) (markdown.WorkspaceDocument, error) {
		called = true
		if request.ID != "note-1" {
			return markdown.WorkspaceDocument{}, errors.New("unexpected document id")
		}
		if request.Graph != "execution" {
			return markdown.WorkspaceDocument{}, errors.New("unexpected graph")
		}

		return markdown.WorkspaceDocument{
			Path: "data/content/graphs/execution/first-note.md",
			Document: markdown.NoteDocument{
				Metadata: markdown.NoteMetadata{
					CommonFields: markdown.CommonFields{
						ID:    "note-1",
						Type:  markdown.NoteType,
						Graph: "execution",
						Title: "First Note",
					},
				},
			},
		}, nil
	})
	if err != nil {
		t.Fatalf("CreateDocument() error = %v", err)
	}
	if !called {
		t.Fatal("CreateDocument() did not call creator")
	}
	if created.Path != "data/content/graphs/execution/first-note.md" {
		t.Fatalf("CreateDocument() path = %q, want created document path", created.Path)
	}
	note, ok := created.Document.(markdown.NoteDocument)
	if !ok {
		t.Fatalf("CreateDocument() document = %T, want markdown.NoteDocument", created.Document)
	}
	if note.Metadata.ID != "note-1" {
		t.Fatalf("CreateDocument() id = %q, want note-1", note.Metadata.ID)
	}
}

func TestUpdateDocumentRequiresUpdater(t *testing.T) {
	t.Parallel()

	_, err := UpdateDocument(UpdateDocumentRequest{DocumentID: "task-1"}, nil)
	if err == nil {
		t.Fatal("UpdateDocument() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "document updater must not be nil") {
		t.Fatalf("UpdateDocument() error = %q, want nil-updater validation", err.Error())
	}
}

func TestUpdateDocumentPropagatesUpdatedDocument(t *testing.T) {
	t.Parallel()

	title := "Updated Task"
	called := false
	updated, err := UpdateDocument(UpdateDocumentRequest{
		DocumentID: "task-1",
		Patch: UpdateDocumentPatch{
			Title: &title,
		},
	}, func(documentID string, patch UpdateDocumentPatch) (markdown.WorkspaceDocument, error) {
		called = true
		if documentID != "task-1" {
			return markdown.WorkspaceDocument{}, errors.New("unexpected document id")
		}
		if patch.Title == nil || *patch.Title != "Updated Task" {
			return markdown.WorkspaceDocument{}, errors.New("unexpected title patch")
		}

		return markdown.WorkspaceDocument{
			Path: "data/content/release/updated-task.md",
			Document: markdown.TaskDocument{
				Metadata: markdown.TaskMetadata{
					CommonFields: markdown.CommonFields{
						ID:    "task-1",
						Type:  markdown.TaskType,
						Graph: "release",
						Title: "Updated Task",
					},
				},
			},
		}, nil
	})
	if err != nil {
		t.Fatalf("UpdateDocument() error = %v", err)
	}
	if !called {
		t.Fatal("UpdateDocument() did not call updater")
	}
	task, ok := updated.Document.(markdown.TaskDocument)
	if !ok {
		t.Fatalf("UpdateDocument() document = %T, want markdown.TaskDocument", updated.Document)
	}
	if task.Metadata.Title != "Updated Task" {
		t.Fatalf("UpdateDocument() title = %q, want Updated Task", task.Metadata.Title)
	}
}

func TestDeleteDocumentRequiresDeleter(t *testing.T) {
	t.Parallel()

	_, err := DeleteDocument(DeleteDocumentRequest{DocumentID: "note-1"}, nil)
	if err == nil {
		t.Fatal("DeleteDocument() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "document deleter must not be nil") {
		t.Fatalf("DeleteDocument() error = %q, want nil-deleter validation", err.Error())
	}
}

func TestDeleteDocumentPropagatesDeletionResult(t *testing.T) {
	t.Parallel()

	called := false
	path, err := DeleteDocument(DeleteDocumentRequest{DocumentID: "note-1"}, func(documentID string) (string, error) {
		called = true
		if documentID != "note-1" {
			return "", errors.New("unexpected document id")
		}
		return "data/content/notes/note-1.md", nil
	})
	if err != nil {
		t.Fatalf("DeleteDocument() error = %v", err)
	}
	if !called {
		t.Fatal("DeleteDocument() did not call deleter")
	}
	if path != "data/content/notes/note-1.md" {
		t.Fatalf("DeleteDocument() path = %q, want deleted document path", path)
	}
}
