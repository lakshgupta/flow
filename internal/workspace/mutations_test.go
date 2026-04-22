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

	if workspaceDocument.Path != "data/content/release/publish/publish.md" {
		t.Fatalf("workspaceDocument.Path = %q, want data/content/release/publish/publish.md", workspaceDocument.Path)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "release", "publish", "publish.md")); err != nil {
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
	if workspaceDocument.Path != "data/content/release/parser/parser.md" {
		t.Fatalf("workspaceDocument.Path = %q, want data/content/release/parser/parser.md", workspaceDocument.Path)
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

	if relativePath != "data/content/demo/execution/parser.md" {
		t.Fatalf("relativePath = %q, want data/content/demo/execution/parser.md", relativePath)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "demo", "execution", "parser.md")); !errors.Is(err, os.ErrNotExist) {
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

	if relativePath != "data/content/demo/notes/architecture.md" {
		t.Fatalf("relativePath = %q, want data/content/demo/notes/architecture.md", relativePath)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "demo", "notes", "architecture.md")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("Stat(deleted note) error = %v, want not exist", err)
	}

	followUpDocument, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "demo", "notes", "follow-up.md"))
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

	taskDocument, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "demo", "execution", "parser.md"))
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

	commandDocument, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "release", "build.md"))
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

	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "demo", "notes", "architecture.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "wrong", Title: "Architecture", Description: "Architecture description"},
			References:   []markdown.NodeReference{{Node: "note-2"}},
		},
		Body: "Architecture body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "demo", "notes", "follow-up.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-2", Type: markdown.NoteType, Graph: "wrong", Title: "Follow Up", Description: "Follow up description"},
			References:   []markdown.NodeReference{{Node: "note-1"}},
		},
		Body: "Follow up body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "demo", "execution", "parser.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "wrong", Title: "Parser", Description: "Parser description"},
			Status:       "doing",
			References:   []markdown.NodeReference{{Node: "note-1"}},
		},
		Body: "Parser body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "release", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "wrong", Title: "Build", Description: "Build description"},
			Name:         "build",
			References:   []markdown.NodeReference{{Node: "note-1"}},
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

// TestDeleteDocumentByIDCleansUpDependsOnInChildTasks verifies that when a parent task
// is deleted, every task that listed it in dependsOn has the deleted ID removed.
func TestDeleteDocumentByIDCleansUpDependsOnInChildTasks(t *testing.T) {
	t.Parallel()

	root := createDependencyCleanupWorkspace(t)

	_, err := DeleteDocumentByID(root, "parent-task")
	if err != nil {
		t.Fatalf("DeleteDocumentByID() error = %v", err)
	}

	// child-task had dependsOn: ["parent-task"] — must now be empty.
	childTaskDoc, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "proj", "child-task.md"))
	if err != nil {
		t.Fatalf("readDocumentFile(child-task) error = %v", err)
	}
	childTask, ok := childTaskDoc.(markdown.TaskDocument)
	if !ok {
		t.Fatalf("childTaskDoc = %T, want markdown.TaskDocument", childTaskDoc)
	}
	if len(childTask.Metadata.DependsOn) != 0 {
		t.Fatalf("childTask.Metadata.DependsOn = %v, want empty after parent deletion", childTask.Metadata.DependsOn)
	}
}

// TestDeleteDocumentByIDCleansUpDependsOnInChildCommands verifies that when a parent
// command is deleted, every command that listed it in dependsOn has the deleted ID removed.
func TestDeleteDocumentByIDCleansUpDependsOnInChildCommands(t *testing.T) {
	t.Parallel()

	root := createDependencyCleanupWorkspace(t)

	_, err := DeleteDocumentByID(root, "parent-cmd")
	if err != nil {
		t.Fatalf("DeleteDocumentByID() error = %v", err)
	}

	// child-cmd had dependsOn: ["parent-cmd"] — must now be empty.
	childCmdDoc, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "proj", "child-cmd.md"))
	if err != nil {
		t.Fatalf("readDocumentFile(child-cmd) error = %v", err)
	}
	childCmd, ok := childCmdDoc.(markdown.CommandDocument)
	if !ok {
		t.Fatalf("childCmdDoc = %T, want markdown.CommandDocument", childCmdDoc)
	}
	if len(childCmd.Metadata.DependsOn) != 0 {
		t.Fatalf("childCmd.Metadata.DependsOn = %v, want empty after parent deletion", childCmd.Metadata.DependsOn)
	}
}

// TestDeleteDocumentByIDCleansUpReferencesToDeletedTaskOrCommand verifies that when a
// task or command is deleted, every document that listed it in references has the
// deleted ID removed.
func TestDeleteDocumentByIDCleansUpReferencesToDeletedTaskOrCommand(t *testing.T) {
	t.Parallel()

	root := createDependencyCleanupWorkspace(t)

	_, err := DeleteDocumentByID(root, "parent-task")
	if err != nil {
		t.Fatalf("DeleteDocumentByID() error = %v", err)
	}

	// ref-note had references: ["parent-task"] — must now be empty.
	refNoteDoc, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "proj", "ref-note.md"))
	if err != nil {
		t.Fatalf("readDocumentFile(ref-note) error = %v", err)
	}
	refNote, ok := refNoteDoc.(markdown.NoteDocument)
	if !ok {
		t.Fatalf("refNoteDoc = %T, want markdown.NoteDocument", refNoteDoc)
	}
	if len(refNote.Metadata.References) != 0 {
		t.Fatalf("refNote.Metadata.References = %v, want empty after target deletion", refNote.Metadata.References)
	}
}

// createDependencyCleanupWorkspace builds a minimal workspace for testing graph
// edge cleanup on deletion.
//
//	parent-task  ←  child-task (task dependsOn)
//	parent-cmd   ←  child-cmd  (command dependsOn)
//	parent-task  ←  ref-note   (references)
func createDependencyCleanupWorkspace(t *testing.T) Root {
	t.Helper()

	root, err := ResolveLocal(t.TempDir())
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "proj", "parent-task.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "parent-task", Type: markdown.TaskType, Graph: "proj", Title: "Parent Task"},
			Status:       "todo",
		},
		Body: "Parent body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "proj", "child-task.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "child-task", Type: markdown.TaskType, Graph: "proj", Title: "Child Task"},
			Status:       "todo",
			DependsOn:    []string{"parent-task"},
		},
		Body: "Child task body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "proj", "parent-cmd.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "parent-cmd", Type: markdown.CommandType, Graph: "proj", Title: "Parent Command"},
			Name:         "parent-cmd",
			Run:          "echo parent",
		},
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "proj", "child-cmd.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "child-cmd", Type: markdown.CommandType, Graph: "proj", Title: "Child Command"},
			Name:         "child-cmd",
			DependsOn:    []string{"parent-cmd"},
			Run:          "echo child",
		},
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "proj", "ref-note.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "ref-note", Type: markdown.NoteType, Graph: "proj", Title: "Ref Note"},
			References:   []markdown.NodeReference{{Node: "parent-task"}},
		},
		Body: "Ref note body\n",
	})

	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		t.Fatalf("index.Rebuild() error = %v", err)
	}

	return root
}

// TestAddReferenceAppendsInlineReference verifies that AddReference adds an entry
// to the source node's inline references list.
func TestAddReferenceAppendsInlineReference(t *testing.T) {
	t.Parallel()

	root, err := ResolveLocal(t.TempDir())
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "proj", "note-a.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-a", Type: markdown.NoteType, Graph: "proj", Title: "Alpha"},
		},
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "proj", "note-b.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-b", Type: markdown.NoteType, Graph: "proj", Title: "Beta"},
		},
	})
	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		t.Fatalf("index.Rebuild() error = %v", err)
	}

	if err := AddReference(root, "note-a", "note-b", "informs"); err != nil {
		t.Fatalf("AddReference() error = %v", err)
	}

	doc, err := findDocumentByID(root.FlowPath, "note-a")
	if err != nil {
		t.Fatalf("findDocumentByID(note-a) error = %v", err)
	}
	note, ok := doc.Document.(markdown.NoteDocument)
	if !ok {
		t.Fatalf("note-a document is not a NoteDocument")
	}
	if len(note.Metadata.References) != 1 || note.Metadata.References[0].Node != "note-b" || note.Metadata.References[0].Context != "informs" {
		t.Fatalf("note-a.references = %+v, want [{Node:note-b Context:informs}]", note.Metadata.References)
	}
}

// TestRemoveReferenceRemovesInlineReference verifies that RemoveReference removes
// the matching entry from the source node's inline references list.
func TestRemoveReferenceRemovesInlineReference(t *testing.T) {
	t.Parallel()

	root, err := ResolveLocal(t.TempDir())
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "proj", "note-a.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-a", Type: markdown.NoteType, Graph: "proj", Title: "Alpha"},
			References:   []markdown.NodeReference{{Node: "note-b", Context: "informs"}},
		},
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "proj", "note-b.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-b", Type: markdown.NoteType, Graph: "proj", Title: "Beta"},
		},
	})
	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		t.Fatalf("index.Rebuild() error = %v", err)
	}

	if err := RemoveReference(root, "note-a", "note-b"); err != nil {
		t.Fatalf("RemoveReference() error = %v", err)
	}

	doc, err := findDocumentByID(root.FlowPath, "note-a")
	if err != nil {
		t.Fatalf("findDocumentByID(note-a) error = %v", err)
	}
	note, ok := doc.Document.(markdown.NoteDocument)
	if !ok {
		t.Fatalf("note-a document is not a NoteDocument")
	}
	if len(note.Metadata.References) != 0 {
		t.Fatalf("note-a.references = %+v, want empty after removal", note.Metadata.References)
	}
}

func stringPointer(value string) *string {
	return &value
}
