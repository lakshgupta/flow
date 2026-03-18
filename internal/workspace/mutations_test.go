package workspace

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/lex/flow/internal/index"
	"github.com/lex/flow/internal/markdown"
)

func TestCreateDocumentWritesMarkdownAndRebuildsIndex(t *testing.T) {
	t.Parallel()

	root, err := ResolveLocal(t.TempDir())
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	workspaceDocument, err := CreateDocument(root, CreateDocumentInput{
		Type:        markdown.TaskType,
		FileName:    "publish",
		ID:          "task-1",
		Graph:       "release/publish",
		Title:       "Publish",
		Description: "Publish release task",
		Status:      "todo",
		Body:        "Publish body\n",
	})
	if err != nil {
		t.Fatalf("CreateDocument() error = %v", err)
	}

	if workspaceDocument.Path != "data/graphs/release/publish/publish.md" {
		t.Fatalf("workspaceDocument.Path = %q, want data/graphs/release/publish/publish.md", workspaceDocument.Path)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "graphs", "release", "publish", "publish.md")); err != nil {
		t.Fatalf("Stat(created file) error = %v", err)
	}

	createdTask, ok := workspaceDocument.Document.(markdown.TaskDocument)
	if !ok {
		t.Fatalf("workspaceDocument.Document = %T, want markdown.TaskDocument", workspaceDocument.Document)
	}

	if createdTask.Metadata.Description != "Publish release task" {
		t.Fatalf("createdTask.Metadata.Description = %q, want Publish release task", createdTask.Metadata.Description)
	}

	if _, err := os.Stat(root.IndexPath); err != nil {
		t.Fatalf("Stat(index) error = %v", err)
	}
}

func TestUpdateDocumentByIDAppliesPatchAndRebuildsIndex(t *testing.T) {
	t.Parallel()

	root := createMutationWorkspace(t)
	workspaceDocument, err := UpdateDocumentByID(root, "task-1", DocumentPatch{
		Graph:       stringPointer("release/parser"),
		Title:       stringPointer("Updated parser"),
		Description: stringPointer("Updated task description"),
		Status:      stringPointer("done"),
		Body:        stringPointer("Updated body\n"),
	})
	if err != nil {
		t.Fatalf("UpdateDocumentByID() error = %v", err)
	}

	updatedTask, ok := workspaceDocument.Document.(markdown.TaskDocument)
	if !ok {
		t.Fatalf("workspaceDocument.Document = %T, want markdown.TaskDocument", workspaceDocument.Document)
	}

	if updatedTask.Metadata.Title != "Updated parser" || updatedTask.Metadata.Status != "done" {
		t.Fatalf("updatedTask.Metadata = %#v", updatedTask.Metadata)
	}
	if updatedTask.Metadata.Description != "Updated task description" {
		t.Fatalf("updatedTask.Metadata.Description = %q, want Updated task description", updatedTask.Metadata.Description)
	}
	if workspaceDocument.Path != "data/graphs/release/parser/parser.md" {
		t.Fatalf("workspaceDocument.Path = %q, want data/graphs/release/parser/parser.md", workspaceDocument.Path)
	}
	if updatedTask.Metadata.Graph != "release/parser" {
		t.Fatalf("updatedTask.Metadata.Graph = %q, want release/parser", updatedTask.Metadata.Graph)
	}

	results, err := index.Search(root.IndexPath, "updated", 10)
	if err != nil {
		t.Fatalf("index.Search() error = %v", err)
	}
	if len(results) == 0 || results[0].ID != "task-1" {
		t.Fatalf("search results = %#v, want task-1 match", results)
	}
}

func TestDeleteDocumentByIDRemovesMarkdownAndReportsMissingDocument(t *testing.T) {
	t.Parallel()

	root := createMutationWorkspace(t)
	relativePath, err := DeleteDocumentByID(root, "task-1")
	if err != nil {
		t.Fatalf("DeleteDocumentByID() error = %v", err)
	}

	if relativePath != "data/graphs/demo/execution/parser.md" {
		t.Fatalf("relativePath = %q, want data/graphs/demo/execution/parser.md", relativePath)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "graphs", "demo", "execution", "parser.md")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("Stat(deleted file) error = %v, want not exist", err)
	}

	_, err = DeleteDocumentByID(root, "task-1")
	var notFound DocumentNotFoundError
	if !errors.As(err, &notFound) {
		t.Fatalf("DeleteDocumentByID() second error = %v, want DocumentNotFoundError", err)
	}
}

func TestDeleteDocumentByIDCleansUpNoteRelationshipsAndSoftReferences(t *testing.T) {
	t.Parallel()

	root := createMutationWorkspace(t)
	relativePath, err := DeleteDocumentByID(root, "note-1")
	if err != nil {
		t.Fatalf("DeleteDocumentByID() error = %v", err)
	}

	if relativePath != "data/graphs/demo/notes/architecture.md" {
		t.Fatalf("relativePath = %q, want data/graphs/demo/notes/architecture.md", relativePath)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "graphs", "demo", "notes", "architecture.md")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("Stat(deleted note) error = %v, want not exist", err)
	}

	followUpDocument, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "graphs", "demo", "notes", "follow-up.md"))
	if err != nil {
		t.Fatalf("readDocumentFile(follow-up) error = %v", err)
	}
	followUpNote, ok := followUpDocument.(markdown.NoteDocument)
	if !ok {
		t.Fatalf("followUpDocument = %T, want markdown.NoteDocument", followUpDocument)
	}
	if len(followUpNote.Metadata.References) != 0 {
		t.Fatalf("followUpNote.Metadata.References = %#v, want empty", followUpNote.Metadata.References)
	}

	taskDocument, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "graphs", "demo", "execution", "parser.md"))
	if err != nil {
		t.Fatalf("readDocumentFile(task) error = %v", err)
	}
	task, ok := taskDocument.(markdown.TaskDocument)
	if !ok {
		t.Fatalf("taskDocument = %T, want markdown.TaskDocument", taskDocument)
	}
	if len(task.Metadata.References) != 0 {
		t.Fatalf("task.Metadata.References = %#v, want empty", task.Metadata.References)
	}

	commandDocument, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "graphs", "release", "build.md"))
	if err != nil {
		t.Fatalf("readDocumentFile(command) error = %v", err)
	}
	command, ok := commandDocument.(markdown.CommandDocument)
	if !ok {
		t.Fatalf("commandDocument = %T, want markdown.CommandDocument", commandDocument)
	}
	if len(command.Metadata.References) != 0 {
		t.Fatalf("command.Metadata.References = %#v, want empty", command.Metadata.References)
	}

	results, err := index.Search(root.IndexPath, "architecture", 10)
	if err != nil {
		t.Fatalf("index.Search() error = %v", err)
	}
	for _, result := range results {
		if result.ID == "note-1" {
			t.Fatalf("search results still include deleted note: %#v", results)
		}
	}
}

func createMutationWorkspace(t *testing.T) Root {
	t.Helper()

	root, err := ResolveLocal(t.TempDir())
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "graphs", "demo", "notes", "architecture.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "wrong", Title: "Architecture", Description: "Architecture description"},
			References:   []string{"note-2"},
		},
		Body: "Architecture body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "graphs", "demo", "notes", "follow-up.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-2", Type: markdown.NoteType, Graph: "wrong", Title: "Follow Up", Description: "Follow up description"},
			References:   []string{"note-1"},
		},
		Body: "Follow up body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "graphs", "demo", "execution", "parser.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "wrong", Title: "Parser", Description: "Parser description"},
			Status:       "doing",
			References:   []string{"note-1"},
		},
		Body: "Parser body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "graphs", "release", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "wrong", Title: "Build", Description: "Build description"},
			Name:         "build",
			References:   []string{"note-1"},
			Run:          "go build ./cmd/flow",
		},
		Body: "Build body\n",
	})

	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		t.Fatalf("index.Rebuild() error = %v", err)
	}

	return root
}

func writeMutationDocument(t *testing.T, path string, document markdown.Document) {
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

func stringPointer(value string) *string {
	return &value
}
