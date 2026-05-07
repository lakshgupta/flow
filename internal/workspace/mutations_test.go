package workspace

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
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
		Status:      "Ready",
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

	root := createInlineReferenceMutationWorkspace(t)
	workspaceDocument, err := UpdateDocumentByID(root, "task-1", DocumentPatch{
		Graph:       stringPointer("release/parser"),
		Title:       stringPointer("Updated parser"),
		Description: stringPointer("Updated task description"),
		Status:      stringPointer("Done"),
		Body:        stringPointer("Updated body\n"),
	})
	if err != nil {
		t.Fatalf("UpdateDocumentByID() error = %v", err)
	}

	updatedTask, ok := workspaceDocument.Document.(markdown.TaskDocument)
	if !ok {
		t.Fatalf("workspaceDocument.Document = %T, want markdown.TaskDocument", workspaceDocument.Document)
	}

	if updatedTask.Metadata.Title != "Updated parser" || updatedTask.Metadata.Status != "Done" {
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

func TestUpdateDocumentByIDRenamesFileAndRebuildsIndex(t *testing.T) {
	t.Parallel()

	root := createMutationWorkspace(t)
	workspaceDocument, err := UpdateDocumentByID(root, "task-1", DocumentPatch{
		FileName: stringPointer("parser-renamed"),
	})
	if err != nil {
		t.Fatalf("UpdateDocumentByID() error = %v", err)
	}

	if workspaceDocument.Path != "data/content/demo/execution/parser-renamed.md" {
		t.Fatalf("workspaceDocument.Path = %q, want data/content/demo/execution/parser-renamed.md", workspaceDocument.Path)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "demo", "execution", "parser-renamed.md")); err != nil {
		t.Fatalf("Stat(renamed file) error = %v", err)
	}
	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "demo", "execution", "parser.md")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("Stat(old file) error = %v, want not exist", err)
	}

	results, err := index.Search(root.IndexPath, "parser", 10)
	if err != nil {
		t.Fatalf("index.Search() error = %v", err)
	}
	if len(results) == 0 || results[0].Path != "data/content/demo/execution/parser-renamed.md" {
		t.Fatalf("search results = %#v, want renamed path", results)
	}
}

func TestUpdateDocumentByIDMoveAcrossGraphsRejectsOutgoingLinks(t *testing.T) {
	t.Parallel()

	root := createDependencyCleanupWorkspace(t)
	_, err := UpdateDocumentByID(root, "child-task", DocumentPatch{
		Graph: stringPointer("proj/moved"),
	})
	if err == nil {
		t.Fatalf("UpdateDocumentByID() error = nil, want outgoing-link validation failure")
	}
	if !strings.Contains(err.Error(), "outgoing links") {
		t.Fatalf("UpdateDocumentByID() error = %v, want outgoing-links message", err)
	}

	if _, statErr := os.Stat(filepath.Join(root.FlowPath, "data", "content", "proj", "child-task.md")); statErr != nil {
		t.Fatalf("Stat(original child-task path) error = %v", statErr)
	}
	if _, statErr := os.Stat(filepath.Join(root.FlowPath, "data", "content", "proj", "moved", "child-task.md")); !errors.Is(statErr, os.ErrNotExist) {
		t.Fatalf("Stat(moved child-task path) error = %v, want not exist", statErr)
	}
	childTaskDocument, readErr := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "proj", "child-task.md"))
	if readErr != nil {
		t.Fatalf("readDocumentFile(child-task) error = %v", readErr)
	}
	childTask, ok := childTaskDocument.(markdown.TaskDocument)
	if !ok {
		t.Fatalf("child-task document = %T, want markdown.TaskDocument", childTaskDocument)
	}
	if len(childTask.Metadata.Links) != 1 || childTask.Metadata.Links[0].Node != "parent-task" {
		t.Fatalf("child-task.links = %+v, want link to parent-task preserved", childTask.Metadata.Links)
	}
}

func TestUpdateDocumentByIDMoveAcrossGraphsRemovesIncomingLinks(t *testing.T) {
	t.Parallel()

	root := createDependencyCleanupWorkspace(t)
	workspaceDocument, err := UpdateDocumentByID(root, "parent-task", DocumentPatch{
		Graph: stringPointer("proj/moved"),
	})
	if err != nil {
		t.Fatalf("UpdateDocumentByID() error = %v", err)
	}
	if workspaceDocument.Path != "data/content/proj/moved/parent-task.md" {
		t.Fatalf("workspaceDocument.Path = %q, want data/content/proj/moved/parent-task.md", workspaceDocument.Path)
	}

	movedDocument, readErr := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "proj", "moved", "parent-task.md"))
	if readErr != nil {
		t.Fatalf("readDocumentFile(moved parent-task) error = %v", readErr)
	}
	movedTask, ok := movedDocument.(markdown.TaskDocument)
	if !ok {
		t.Fatalf("moved parent-task document = %T, want markdown.TaskDocument", movedDocument)
	}
	if movedTask.Metadata.Graph != "proj/moved" {
		t.Fatalf("movedTask.Metadata.Graph = %q, want proj/moved", movedTask.Metadata.Graph)
	}
	if _, statErr := os.Stat(filepath.Join(root.FlowPath, "data", "content", "proj", "parent-task.md")); !errors.Is(statErr, os.ErrNotExist) {
		t.Fatalf("Stat(original parent-task path) error = %v, want not exist", statErr)
	}

	childTaskDocument, readErr := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "proj", "child-task.md"))
	if readErr != nil {
		t.Fatalf("readDocumentFile(child-task) error = %v", readErr)
	}
	childTask, ok := childTaskDocument.(markdown.TaskDocument)
	if !ok {
		t.Fatalf("child-task document = %T, want markdown.TaskDocument", childTaskDocument)
	}
	if len(childTask.Metadata.Links) != 0 {
		t.Fatalf("child-task.links = %+v, want empty after moving parent-task", childTask.Metadata.Links)
	}

	refNoteDocument, readErr := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "proj", "ref-note.md"))
	if readErr != nil {
		t.Fatalf("readDocumentFile(ref-note) error = %v", readErr)
	}
	refNote, ok := refNoteDocument.(markdown.NoteDocument)
	if !ok {
		t.Fatalf("ref-note document = %T, want markdown.NoteDocument", refNoteDocument)
	}
	if len(refNote.Metadata.Links) != 0 {
		t.Fatalf("ref-note.links = %+v, want empty after moving parent-task", refNote.Metadata.Links)
	}
}

func TestUpdateDocumentByIDRewritesInlineReferenceBreadcrumbs(t *testing.T) {
	t.Parallel()

	root := createInlineReferenceMutationWorkspace(t)
	_, err := UpdateDocumentByID(root, "task-1", DocumentPatch{
		Title: stringPointer("Parser Renamed"),
	})
	if err != nil {
		t.Fatalf("UpdateDocumentByID() error = %v", err)
	}

	referenceDocument, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "demo", "notes", "reference.md"))
	if err != nil {
		t.Fatalf("readDocumentFile(reference) error = %v", err)
	}
	referenceNote, ok := referenceDocument.(markdown.NoteDocument)
	if !ok {
		t.Fatalf("referenceDocument = %T, want markdown.NoteDocument", referenceDocument)
	}
	if strings.TrimSpace(referenceNote.Body) != "See [[demo/execution > Parser Renamed]] for details." {
		t.Fatalf("referenceNote.Body = %q", referenceNote.Body)
	}
}

func TestRenameGraphMovesDirectoryAndRebuildsIndex(t *testing.T) {
	t.Parallel()

	root := createMutationWorkspace(t)
	if err := RenameGraph(root, "demo", "renamed/demo"); err != nil {
		t.Fatalf("RenameGraph() error = %v", err)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "renamed", "demo", "execution", "parser.md")); err != nil {
		t.Fatalf("Stat(renamed graph file) error = %v", err)
	}
	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "demo")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("Stat(old graph directory) error = %v, want not exist", err)
	}

	results, err := index.Search(root.IndexPath, "parser", 10)
	if err != nil {
		t.Fatalf("index.Search() error = %v", err)
	}
	if len(results) == 0 || results[0].Path != "data/content/renamed/demo/execution/parser.md" {
		t.Fatalf("search results = %#v, want renamed graph path", results)
	}
}

func TestRenameGraphRewritesInlineReferenceBreadcrumbs(t *testing.T) {
	t.Parallel()

	root := createInlineReferenceMutationWorkspace(t)
	if err := RenameGraph(root, "demo", "renamed/demo"); err != nil {
		t.Fatalf("RenameGraph() error = %v", err)
	}

	referenceDocument, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "external", "reference.md"))
	if err != nil {
		t.Fatalf("readDocumentFile(reference) error = %v", err)
	}
	referenceNote, ok := referenceDocument.(markdown.NoteDocument)
	if !ok {
		t.Fatalf("referenceDocument = %T, want markdown.NoteDocument", referenceDocument)
	}
	if strings.TrimSpace(referenceNote.Body) != "Track [[renamed/demo/execution > Parser]] from outside the graph." {
		t.Fatalf("referenceNote.Body = %q", referenceNote.Body)
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
	if len(followUpNote.Metadata.Links) != 0 {
		t.Fatalf("followUpNote.Metadata.Links = %#v, want empty", followUpNote.Metadata.Links)
	}

	taskDocument, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "demo", "execution", "parser.md"))
	if err != nil {
		t.Fatalf("readDocumentFile(task) error = %v", err)
	}
	task, ok := taskDocument.(markdown.TaskDocument)
	if !ok {
		t.Fatalf("taskDocument = %T, want markdown.TaskDocument", taskDocument)
	}
	if len(task.Metadata.Links) != 0 {
		t.Fatalf("task.Metadata.Links = %#v, want empty", task.Metadata.Links)
	}

	commandDocument, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "release", "build.md"))
	if err != nil {
		t.Fatalf("readDocumentFile(command) error = %v", err)
	}
	command, ok := commandDocument.(markdown.CommandDocument)
	if !ok {
		t.Fatalf("commandDocument = %T, want markdown.CommandDocument", commandDocument)
	}
	if len(command.Metadata.Links) != 0 {
		t.Fatalf("command.Metadata.Links = %#v, want empty", command.Metadata.Links)
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
			Links:        []markdown.NodeLink{{Node: "note-2"}},
		},
		Body: "Architecture body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "demo", "notes", "follow-up.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-2", Type: markdown.NoteType, Graph: "wrong", Title: "Follow Up", Description: "Follow up description"},
			Links:        []markdown.NodeLink{{Node: "note-1"}},
		},
		Body: "Follow up body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "demo", "execution", "parser.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "wrong", Title: "Parser", Description: "Parser description"},
			Status:       "Running",
			Links:        []markdown.NodeLink{{Node: "note-1"}},
		},
		Body: "Parser body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "release", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "wrong", Title: "Build", Description: "Build description"},
			Name:         "build",
			Links:        []markdown.NodeLink{{Node: "note-1"}},
			Run:          "go build ./cmd/flow",
		},
		Body: "Build body\n",
	})

	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		t.Fatalf("index.Rebuild() error = %v", err)
	}

	return root
}

func createInlineReferenceMutationWorkspace(t *testing.T) Root {
	t.Helper()

	root, err := ResolveLocal(t.TempDir())
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "demo", "execution", "parser.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "wrong", Title: "Parser"},
			Status:       "Running",
		},
		Body: "Parser body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "demo", "notes", "reference.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "wrong", Title: "Reference"},
		},
		Body: "See [[demo/execution > Parser]] for details.\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "external", "reference.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-2", Type: markdown.NoteType, Graph: "wrong", Title: "External Reference"},
		},
		Body: "Track [[demo/execution > Parser]] from outside the graph.\n",
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

// TestDeleteDocumentByIDCleansUpReferencesInChildTasks verifies that when a parent task
// is deleted, every task that referenced it has the deleted ID removed.
func TestDeleteDocumentByIDCleansUpReferencesInChildTasks(t *testing.T) {
	t.Parallel()

	root := createDependencyCleanupWorkspace(t)

	_, err := DeleteDocumentByID(root, "parent-task")
	if err != nil {
		t.Fatalf("DeleteDocumentByID() error = %v", err)
	}

	// child-task had references: ["parent-task"] — must now be empty.
	childTaskDoc, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "proj", "child-task.md"))
	if err != nil {
		t.Fatalf("readDocumentFile(child-task) error = %v", err)
	}
	childTask, ok := childTaskDoc.(markdown.TaskDocument)
	if !ok {
		t.Fatalf("childTaskDoc = %T, want markdown.TaskDocument", childTaskDoc)
	}
	if len(childTask.Metadata.Links) != 0 {
		t.Fatalf("childTask.Metadata.Links = %v, want empty after parent deletion", childTask.Metadata.Links)
	}
}

// TestDeleteDocumentByIDCleansUpReferencesInChildCommands verifies that when a parent
// command is deleted, every command that referenced it has the deleted ID removed.
func TestDeleteDocumentByIDCleansUpReferencesInChildCommands(t *testing.T) {
	t.Parallel()

	root := createDependencyCleanupWorkspace(t)

	_, err := DeleteDocumentByID(root, "parent-cmd")
	if err != nil {
		t.Fatalf("DeleteDocumentByID() error = %v", err)
	}

	// child-cmd had references: ["parent-cmd"] — must now be empty.
	childCmdDoc, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "proj", "child-cmd.md"))
	if err != nil {
		t.Fatalf("readDocumentFile(child-cmd) error = %v", err)
	}
	childCmd, ok := childCmdDoc.(markdown.CommandDocument)
	if !ok {
		t.Fatalf("childCmdDoc = %T, want markdown.CommandDocument", childCmdDoc)
	}
	if len(childCmd.Metadata.Links) != 0 {
		t.Fatalf("childCmd.Metadata.Links = %v, want empty after parent deletion", childCmd.Metadata.Links)
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
	if len(refNote.Metadata.Links) != 0 {
		t.Fatalf("refNote.Metadata.Links = %v, want empty after target deletion", refNote.Metadata.Links)
	}
}

func TestMergeDocumentsTransfersAndRetargetsLinks(t *testing.T) {
	t.Parallel()

	root, err := ResolveLocal(t.TempDir())
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "graph1", "target.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "target", Type: markdown.NoteType, Graph: "graph1", Title: "Target"},
			Links:        []markdown.NodeLink{{Node: "outside-a", Context: "existing"}},
		},
		Body: "Target body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "graph1", "other.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "other", Type: markdown.NoteType, Graph: "graph1", Title: "Other"},
			Links:        []markdown.NodeLink{{Node: "outside-b", Context: "from other"}},
		},
		Body: "Other body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "graph1", "incoming.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "incoming", Type: markdown.NoteType, Graph: "graph1", Title: "Incoming"},
			Links:        []markdown.NodeLink{{Node: "other", Context: "points to merged"}},
		},
		Body: "Incoming body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "graph1", "outside-a.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{CommonFields: markdown.CommonFields{ID: "outside-a", Type: markdown.NoteType, Graph: "graph1", Title: "Outside A"}},
		Body:     "Outside A body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "graph1", "outside-b.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{CommonFields: markdown.CommonFields{ID: "outside-b", Type: markdown.NoteType, Graph: "graph1", Title: "Outside B"}},
		Body:     "Outside B body\n",
	})

	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		t.Fatalf("index.Rebuild() error = %v", err)
	}

	merged, err := MergeDocuments(root, MergeDocumentsInput{DocumentIDs: []string{"target", "other"}})
	if err != nil {
		t.Fatalf("MergeDocuments() error = %v", err)
	}

	mergedNote, ok := merged.Document.(markdown.NoteDocument)
	if !ok {
		t.Fatalf("merged.Document = %T, want markdown.NoteDocument", merged.Document)
	}

	if !strings.Contains(mergedNote.Body, "Target body") || !strings.Contains(mergedNote.Body, "Other body") {
		t.Fatalf("merged body = %q, want both source bodies", mergedNote.Body)
	}

	mergedLinkNodes := map[string]bool{}
	for _, link := range mergedNote.Metadata.Links {
		mergedLinkNodes[link.Node] = true
	}
	if !mergedLinkNodes["outside-a"] || !mergedLinkNodes["outside-b"] {
		t.Fatalf("merged links = %#v, want outgoing links from both documents", mergedNote.Metadata.Links)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "graph1", "other.md")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("Stat(merged-away doc) error = %v, want not exist", err)
	}

	incomingDoc, err := readDocumentFile(filepath.Join(root.FlowPath, "data", "content", "graph1", "incoming.md"))
	if err != nil {
		t.Fatalf("readDocumentFile(incoming) error = %v", err)
	}
	incomingNote, ok := incomingDoc.(markdown.NoteDocument)
	if !ok {
		t.Fatalf("incomingDoc = %T, want markdown.NoteDocument", incomingDoc)
	}
	if len(incomingNote.Metadata.Links) != 1 || incomingNote.Metadata.Links[0].Node != "target" {
		t.Fatalf("incoming links = %#v, want retargeted link to target", incomingNote.Metadata.Links)
	}
}

// createDependencyCleanupWorkspace builds a minimal workspace for testing graph
// edge cleanup on deletion.
//
//	parent-task  ←  child-task (task references)
//	parent-cmd   ←  child-cmd  (command references)
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
			Status:       "Ready",
		},
		Body: "Parent body\n",
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "proj", "child-task.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "child-task", Type: markdown.TaskType, Graph: "proj", Title: "Child Task"},
			Status:       "Ready",
			Links:        []markdown.NodeLink{{Node: "parent-task"}},
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
			Links:        []markdown.NodeLink{{Node: "parent-cmd"}},
			Run:          "echo child",
		},
	})
	writeMutationDocument(t, filepath.Join(root.FlowPath, "data", "content", "proj", "ref-note.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "ref-note", Type: markdown.NoteType, Graph: "proj", Title: "Ref Note"},
			Links:        []markdown.NodeLink{{Node: "parent-task"}},
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

	if err := AddLink(root, "note-a", "note-b", "informs", []string{"depends_on", "blocks"}); err != nil {
		t.Fatalf("AddLink() error = %v", err)
	}

	doc, err := findDocumentByID(root.FlowPath, "note-a")
	if err != nil {
		t.Fatalf("findDocumentByID(note-a) error = %v", err)
	}
	note, ok := doc.Document.(markdown.NoteDocument)
	if !ok {
		t.Fatalf("note-a document is not a NoteDocument")
	}
	if len(note.Metadata.Links) != 1 || note.Metadata.Links[0].Node != "note-b" || note.Metadata.Links[0].Context != "informs" || len(note.Metadata.Links[0].Relationships) != 2 {
		t.Fatalf("note-a.links = %+v, want relationships [depends_on blocks]", note.Metadata.Links)
	}
	if note.Metadata.Links[0].Relationships[0] != "depends_on" || note.Metadata.Links[0].Relationships[1] != "blocks" {
		t.Fatalf("note-a.links[0].Relationships = %#v, want [depends_on blocks]", note.Metadata.Links[0].Relationships)
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
			Links:        []markdown.NodeLink{{Node: "note-b", Context: "informs"}},
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

	if err := RemoveLink(root, "note-a", "note-b"); err != nil {
		t.Fatalf("RemoveLink() error = %v", err)
	}

	doc, err := findDocumentByID(root.FlowPath, "note-a")
	if err != nil {
		t.Fatalf("findDocumentByID(note-a) error = %v", err)
	}
	note, ok := doc.Document.(markdown.NoteDocument)
	if !ok {
		t.Fatalf("note-a document is not a NoteDocument")
	}
	if len(note.Metadata.Links) != 0 {
		t.Fatalf("note-a.links = %+v, want empty after removal", note.Metadata.Links)
	}
}

func stringPointer(value string) *string {
	return &value
}
