package desktop

import (
	"bytes"
	"net/url"
	"os"
	"path/filepath"
	"strings"
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

func TestBackendUploadFileSavesContentAndReturnsURL(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	content := []byte("fake-image-bytes")
	url, err := backend.UploadFile("screenshot.png", content, "")
	if err != nil {
		t.Fatalf("UploadFile() error = %v", err)
	}
	if !strings.HasPrefix(url, "/api/files?path=") {
		t.Fatalf("UploadFile() url = %q, want /api/files?path=...", url)
	}

	// Verify the file was written to data/uploads/.
	uploadsDir := filepath.Join(root.FlowPath, "data", "uploads")
	entries, err := os.ReadDir(uploadsDir)
	if err != nil {
		t.Fatalf("ReadDir(uploads) error = %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("len(uploads entries) = %d, want 1", len(entries))
	}

	persisted, err := os.ReadFile(filepath.Join(uploadsDir, entries[0].Name()))
	if err != nil {
		t.Fatalf("ReadFile(uploaded) error = %v", err)
	}
	if string(persisted) != "fake-image-bytes" {
		t.Fatalf("uploaded content = %q, want fake-image-bytes", string(persisted))
	}
}

func TestBackendUploadFileWithDocumentPath(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	docPath := "data/content/notes/architecture.md"
	content := []byte("document-adjacent-image")
	uploadedURL, err := backend.UploadFile("diagram.png", content, docPath)
	if err != nil {
		t.Fatalf("UploadFile() error = %v", err)
	}
	if !strings.HasPrefix(uploadedURL, "/api/files?path=") {
		t.Fatalf("UploadFile() uploadedURL = %q, want /api/files?path=...", uploadedURL)
	}

	// Verify the file was written alongside the document, not in uploads/.
	noteDir := filepath.Join(root.FlowPath, "data", "content", "notes")
	entries, err := os.ReadDir(noteDir)
	if err != nil {
		t.Fatalf("ReadDir(noteDir) error = %v", err)
	}

	foundUpload := false
	for _, entry := range entries {
		if entry.Name() == "diagram.png" {
			foundUpload = true
			data, readErr := os.ReadFile(filepath.Join(noteDir, entry.Name()))
			if readErr != nil {
				t.Fatalf("ReadFile(uploaded) error = %v", readErr)
			}
			if string(data) != "document-adjacent-image" {
				t.Fatalf("uploaded content = %q, want document-adjacent-image", string(data))
			}
			break
		}
	}
	if !foundUpload {
		t.Fatalf("diagram.png not found alongside the document")
	}

	// URL path should reference the document-adjacent location.
	parsedURL, parseErr := url.Parse(uploadedURL)
	if parseErr != nil {
		t.Fatalf("url.Parse(%q) error = %v", uploadedURL, parseErr)
	}
	parsedPath := parsedURL.Query().Get("path")
	if strings.Contains(parsedPath, "uploads") {
		t.Fatalf("url path = %q, should NOT reference uploads/ directory", parsedPath)
	}
	if !strings.Contains(parsedPath, "content/notes") {
		t.Fatalf("url path = %q, should reference content/notes directory", parsedPath)
	}
}

func TestBackendUploadFileCreatesUniqueNameOnCollision(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	firstURL, err := backend.UploadFile("logo.png", []byte("first-image"), "")
	if err != nil {
		t.Fatalf("first UploadFile() error = %v", err)
	}

	secondURL, err := backend.UploadFile("logo.png", []byte("second-image"), "")
	if err != nil {
		t.Fatalf("second UploadFile() error = %v", err)
	}

	if firstURL == secondURL {
		t.Fatalf("duplicate upload returned same URL: %q", firstURL)
	}

	// First file content must still be intact.
	uploadsDir := filepath.Join(root.FlowPath, "data", "uploads")
	entries, err := os.ReadDir(uploadsDir)
	if err != nil {
		t.Fatalf("ReadDir(uploads) error = %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("len(uploads entries) = %d, want 2", len(entries))
	}

	for _, entry := range entries {
		data, readErr := os.ReadFile(filepath.Join(uploadsDir, entry.Name()))
		if readErr != nil {
			t.Fatalf("ReadFile(%s) error = %v", entry.Name(), readErr)
		}
		if string(data) != "first-image" && string(data) != "second-image" {
			t.Fatalf("unexpected content in %s: %q", entry.Name(), string(data))
		}
	}
}

func TestBackendUploadFileRejectsInvalidFileName(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	_, err := backend.UploadFile(".", []byte("content"), "")
	if err == nil {
		t.Fatal("UploadFile('.') error = nil, want non-nil")
	}
	if !strings.Contains(err.Error(), "invalid file name") {
		t.Fatalf("UploadFile('.') error = %q, want 'invalid file name'", err.Error())
	}

	_, err = backend.UploadFile("", []byte("content"), "")
	if err == nil {
		t.Fatal("UploadFile('') error = nil, want non-nil")
	}
	if !strings.Contains(err.Error(), "invalid file name") {
		t.Fatalf("UploadFile('') error = %q, want 'invalid file name'", err.Error())
	}
}

func TestBackendUploadFileRejectsInvalidDocumentPath(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	_, err := backend.UploadFile("photo.png", []byte("content"), ".")
	if err == nil {
		t.Fatal("UploadFile with documentPath '.' error = nil, want non-nil")
	}

	_, err = backend.UploadFile("photo.png", []byte("content"), "../outside")
	if err == nil {
		t.Fatal("UploadFile with documentPath '../outside' error = nil, want non-nil")
	}
}

func TestBackendUploadFilePersistsContentCorrectly(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	// Binary content with null bytes and special chars to test fidelity.
	content := []byte{0x00, 0x01, 0x02, 0xFF, 0xFE, 0x7F, 'A', 'B', 'C'}
	url, err := backend.UploadFile("binary.dat", content, "")
	if err != nil {
		t.Fatalf("UploadFile() error = %v", err)
	}

	// Parse the URL to find the file path.
	if !strings.HasPrefix(url, "/api/files?path=") {
		t.Fatalf("url = %q, want /api/files?path=...", url)
	}

	uploadsDir := filepath.Join(root.FlowPath, "data", "uploads")
	entries, err := os.ReadDir(uploadsDir)
	if err != nil {
		t.Fatalf("ReadDir(uploads) error = %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("len(uploads entries) = %d, want 1", len(entries))
	}

	persisted, err := os.ReadFile(filepath.Join(uploadsDir, entries[0].Name()))
	if err != nil {
		t.Fatalf("ReadFile(uploaded) error = %v", err)
	}
	if !bytes.Equal(persisted, content) {
		t.Fatalf("persisted content = %v, want %v", persisted, content)
	}
}

func TestSanitizeAssetFileName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{name: "normal", input: "Screenshot.png", expected: "screenshot.png"},
		{name: "spaces", input: "My Photo.png", expected: "my-photo.png"},
		{name: "special chars", input: "hello@world!.jpg", expected: "helloworld.jpg"},
		{name: "empty", input: "", expected: "file.bin"},
		{name: "dots", input: "file.name.with.dots.png", expected: "file-name-with-dots.png"},
		{name: "mixed case", input: "MIXED_CASE-File.PNG", expected: "mixed_case-file.png"},
		{name: "leading/trailing spaces", input: "  spaced.png  ", expected: "spaced.png"},
		{name: "no extension", input: "README", expected: "readme.bin"},
		{name: "only special chars", input: "!!!@@@", expected: "file.bin"},
		{name: "all numbers", input: "12345.jpg", expected: "12345.jpg"},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			result := workspace.SanitizeAssetFileName(tt.input)
			if result != tt.expected {
				t.Fatalf("SanitizeAssetFileName(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestMakeUniqueUploadFileName(t *testing.T) {
	t.Parallel()

	// Use a real temp directory so os.Stat reflects real files.
	dir := t.TempDir()

	// First call returns the candidate as-is.
	name1 := workspace.MakeUniqueFileName(dir, "photo.png")
	if name1 != "photo.png" {
		t.Fatalf("first call = %q, want photo.png", name1)
	}
	os.WriteFile(filepath.Join(dir, name1), []byte("first"), 0o644)

	// Second call with same candidate returns suffixed name.
	name2 := workspace.MakeUniqueFileName(dir, "photo.png")
	if name2 != "photo-2.png" {
		t.Fatalf("second call = %q, want photo-2.png", name2)
	}
	os.WriteFile(filepath.Join(dir, name2), []byte("second"), 0o644)

	// Third call with same candidate returns next suffix.
	name3 := workspace.MakeUniqueFileName(dir, "photo.png")
	if name3 != "photo-3.png" {
		t.Fatalf("third call = %q, want photo-3.png", name3)
	}

	// Calling with a different name returns as-is.
	name4 := workspace.MakeUniqueFileName(dir, "other.png")
	if name4 != "other.png" {
		t.Fatalf("different name call = %q, want other.png", name4)
	}
}

func TestMakeUniqueUploadFileNameNoExtension(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()

	name := workspace.MakeUniqueFileName(dir, "readme")
	if name != "readme.bin" {
		t.Fatalf("first call = %q, want readme.bin", name)
	}
	os.WriteFile(filepath.Join(dir, name), []byte("first"), 0o644)

	name = workspace.MakeUniqueFileName(dir, "readme")
	if name != "readme-2.bin" {
		t.Fatalf("second call = %q, want readme-2.bin", name)
	}
}

func TestBackendUploadFileFromLocalPath(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	// Create a real file on disk to reference via file:// URI.
	sourceDir := t.TempDir()
	sourcePath := filepath.Join(sourceDir, "source-image.png")
	if err := os.WriteFile(sourcePath, []byte("local-image-content"), 0o644); err != nil {
		t.Fatalf("WriteFile(source) error = %v", err)
	}

	uri := "file://" + sourcePath
	url, err := backend.UploadFileFromLocalPath(uri, "")
	if err != nil {
		t.Fatalf("UploadFileFromLocalPath() error = %v", err)
	}
	if !strings.HasPrefix(url, "/api/files?path=") {
		t.Fatalf("UploadFileFromLocalPath() url = %q, want /api/files?path=...", url)
	}

	// Verify the file was written to data/uploads/.
	uploadsDir := filepath.Join(root.FlowPath, "data", "uploads")
	entries, err := os.ReadDir(uploadsDir)
	if err != nil {
		t.Fatalf("ReadDir(uploads) error = %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("len(uploads entries) = %d, want 1", len(entries))
	}

	persisted, err := os.ReadFile(filepath.Join(uploadsDir, entries[0].Name()))
	if err != nil {
		t.Fatalf("ReadFile(uploaded) error = %v", err)
	}
	if string(persisted) != "local-image-content" {
		t.Fatalf("uploaded content = %q, want local-image-content", string(persisted))
	}
}

func TestBackendUploadFileFromLocalPathWithEncodedSpaces(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	// Create a file with spaces in the name.
	sourceDir := t.TempDir()
	sourcePath := filepath.Join(sourceDir, "my photo.png")
	if err := os.WriteFile(sourcePath, []byte("spaced-image"), 0o644); err != nil {
		t.Fatalf("WriteFile(source) error = %v", err)
	}

	// Encode the path so spaces become %20.
	encodedPath := filepath.Join(sourceDir, "my%20photo.png")
	uri := "file://" + encodedPath
	url, err := backend.UploadFileFromLocalPath(uri, "")
	if err != nil {
		t.Fatalf("UploadFileFromLocalPath() error = %v", err)
	}
	if !strings.HasPrefix(url, "/api/files?path=") {
		t.Fatalf("UploadFileFromLocalPath() url = %q, want /api/files?path=...", url)
	}

	// Verify the uploaded content.
	uploadsDir := filepath.Join(root.FlowPath, "data", "uploads")
	entries, err := os.ReadDir(uploadsDir)
	if err != nil {
		t.Fatalf("ReadDir(uploads) error = %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("len(uploads entries) = %d, want 1", len(entries))
	}

	persisted, err := os.ReadFile(filepath.Join(uploadsDir, entries[0].Name()))
	if err != nil {
		t.Fatalf("ReadFile(uploaded) error = %v", err)
	}
	if string(persisted) != "spaced-image" {
		t.Fatalf("uploaded content = %q, want spaced-image", string(persisted))
	}
}

func TestBackendUploadFileFromLocalPathRejectsEmptyURI(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	_, err := backend.UploadFileFromLocalPath("", "")
	if err == nil {
		t.Fatal("UploadFileFromLocalPath('') error = nil, want non-nil")
	}
	if !strings.Contains(err.Error(), "empty local URI") {
		t.Fatalf("UploadFileFromLocalPath('') error = %q, want 'empty local URI'", err.Error())
	}
}

func TestBackendUploadFileFromLocalPathRejectsNonFileScheme(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	_, err := backend.UploadFileFromLocalPath("http://example.com/image.png", "")
	if err == nil {
		t.Fatal("UploadFileFromLocalPath('http://...') error = nil, want non-nil")
	}
	if !strings.Contains(err.Error(), "unsupported URI scheme") {
		t.Fatalf("UploadFileFromLocalPath('http://...') error = %q, want 'unsupported URI scheme'", err.Error())
	}
}

func TestBackendUploadFileFromLocalPathRejectsMissingFile(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	uri := "file:///nonexistent/path/image.png"
	_, err := backend.UploadFileFromLocalPath(uri, "")
	if err == nil {
		t.Fatal("UploadFileFromLocalPath('file:///nonexistent/...') error = nil, want non-nil")
	}
	if !strings.Contains(err.Error(), "read local file") {
		t.Fatalf("UploadFileFromLocalPath('file:///nonexistent/...') error = %q, want 'read local file'", err.Error())
	}
}

func TestBackendUploadFileFromLocalPathWithDocumentPath(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	sourceDir := t.TempDir()
	sourcePath := filepath.Join(sourceDir, "diagram.png")
	if err := os.WriteFile(sourcePath, []byte("doc-adjacent-local"), 0o644); err != nil {
		t.Fatalf("WriteFile(source) error = %v", err)
	}

	uri := "file://" + sourcePath
	docPath := "data/content/notes/architecture.md"
	uploadedURL, err := backend.UploadFileFromLocalPath(uri, docPath)
	if err != nil {
		t.Fatalf("UploadFileFromLocalPath() error = %v", err)
	}
	if !strings.HasPrefix(uploadedURL, "/api/files?path=") {
		t.Fatalf("UploadFileFromLocalPath() uploadedURL = %q, want /api/files?path=...", uploadedURL)
	}

	// Verify the file was written alongside the document.
	noteDir := filepath.Join(root.FlowPath, "data", "content", "notes")
	entries, err := os.ReadDir(noteDir)
	if err != nil {
		t.Fatalf("ReadDir(noteDir) error = %v", err)
	}

	foundUpload := false
	for _, entry := range entries {
		if entry.Name() == "diagram.png" {
			foundUpload = true
			data, readErr := os.ReadFile(filepath.Join(noteDir, entry.Name()))
			if readErr != nil {
				t.Fatalf("ReadFile(uploaded) error = %v", readErr)
			}
			if string(data) != "doc-adjacent-local" {
				t.Fatalf("uploaded content = %q, want doc-adjacent-local", string(data))
			}
			break
		}
	}
	if !foundUpload {
		t.Fatalf("diagram.png not found alongside the document")
	}
}

func TestBackendCreateGraphFileNoteFromPath(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	// Create a real file on disk to reference via file:// URI.
	sourceDir := t.TempDir()
	sourcePath := filepath.Join(sourceDir, "photo.png")
	if err := os.WriteFile(sourcePath, []byte("canvas-image-content"), 0o644); err != nil {
		t.Fatalf("WriteFile(source) error = %v", err)
	}

	uri := "file://" + sourcePath
	graphPath := "execution"
	result, err := backend.CreateGraphFileNoteFromPath(uri, graphPath)
	if err != nil {
		t.Fatalf("CreateGraphFileNoteFromPath() error = %v", err)
	}

	if result.Type != "note" {
		t.Fatalf("result.Type = %q, want note", result.Type)
	}
	if result.Graph != graphPath {
		t.Fatalf("result.Graph = %q, want %q", result.Graph, graphPath)
	}
	if result.Title != "Photo" {
		t.Fatalf("result.Title = %q, want Photo", result.Title)
	}
	if result.Path == "" {
		t.Fatal("result.Path is empty")
	}

	// Verify the file was saved to the graph directory.
	graphDir := filepath.Join(root.FlowPath, "data", "content", graphPath)
	entries, err := os.ReadDir(graphDir)
	if err != nil {
		t.Fatalf("ReadDir(graphDir) error = %v", err)
	}
	found := false
	for _, entry := range entries {
		if entry.Name() == "photo.png" {
			found = true
			data, readErr := os.ReadFile(filepath.Join(graphDir, entry.Name()))
			if readErr != nil {
				t.Fatalf("ReadFile(uploaded) error = %v", readErr)
			}
			if string(data) != "canvas-image-content" {
				t.Fatalf("uploaded content = %q, want canvas-image-content", string(data))
			}
			break
		}
	}
	if !found {
		t.Fatal("photo.png not found in graph directory")
	}

	// Verify the note document was created.
	notePath := result.Path
	if _, err := os.Stat(filepath.Join(root.FlowPath, notePath)); err != nil {
		t.Fatalf("Stat(note) error = %v", err)
	}
}

func TestBackendCreateGraphFileNoteFromPathRejectsInvalidURI(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	_, err := backend.CreateGraphFileNoteFromPath("", "execution")
	if err == nil {
		t.Fatal("CreateGraphFileNoteFromPath('') error = nil, want non-nil")
	}

	_, err = backend.CreateGraphFileNoteFromPath("http://example.com/file.png", "execution")
	if err == nil {
		t.Fatal("CreateGraphFileNoteFromPath('http://...') error = nil, want non-nil")
	}
}

func TestBackendCreateGraphFileNoteFromPathRejectsMissingGraph(t *testing.T) {
	t.Parallel()

	root := createDesktopBackendTestWorkspace(t)
	backend := NewBackend(root)

	sourceDir := t.TempDir()
	sourcePath := filepath.Join(sourceDir, "file.png")
	if err := os.WriteFile(sourcePath, []byte("content"), 0o644); err != nil {
		t.Fatalf("WriteFile(source) error = %v", err)
	}

	_, err := backend.CreateGraphFileNoteFromPath("file://"+sourcePath, "nonexistent-graph")
	if err == nil {
		t.Fatal("CreateGraphFileNoteFromPath(nonexistent) error = nil, want non-nil")
	}
}
