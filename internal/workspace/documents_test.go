package workspace

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lex/flow/internal/markdown"
)

func TestLoadDocumentsScansGraphTreeAndNormalizesGraphFromPath(t *testing.T) {
	t.Parallel()

	flowPath := filepath.Join(t.TempDir(), DirName)
	writeWorkspaceMarkdownDocument(t, filepath.Join(flowPath, DataDirName, GraphsDirName, "execution", "parser", "build.md"), "---\nid: task-1\ntype: task\ngraph: wrong\ntitle: Build parser\nstatus: todo\n---\n\nTask body\n")
	if err := os.WriteFile(filepath.Join(flowPath, DataDirName, HomeFileName), []byte("# Home\n"), 0o644); err != nil {
		t.Fatalf("WriteFile(home.md) error = %v", err)
	}

	documents, err := LoadDocuments(flowPath)
	if err != nil {
		t.Fatalf("LoadDocuments() error = %v", err)
	}

	if len(documents) != 1 {
		t.Fatalf("len(documents) = %d, want 1", len(documents))
	}

	if documents[0].Path != "data/graphs/execution/parser/build.md" {
		t.Fatalf("documents[0].Path = %q", documents[0].Path)
	}

	document, ok := documents[0].Document.(markdown.TaskDocument)
	if !ok {
		t.Fatalf("documents[0].Document type = %T, want markdown.TaskDocument", documents[0].Document)
	}

	if document.Metadata.Graph != "execution/parser" {
		t.Fatalf("document.Metadata.Graph = %q, want execution/parser", document.Metadata.Graph)
	}
	if document.Metadata.Type != markdown.TaskType {
		t.Fatalf("document.Metadata.Type = %q, want %q", document.Metadata.Type, markdown.TaskType)
	}
}

func TestLoadDocumentsIncludesTypedHomeDocumentWhenPresent(t *testing.T) {
	t.Parallel()

	flowPath := filepath.Join(t.TempDir(), DirName)
	writeWorkspaceMarkdownDocument(t, filepath.Join(flowPath, DataDirName, HomeFileName), "---\nid: note-home\ntype: note\ngraph: ignored\ntitle: Home\n---\n\nHome body\n")

	documents, err := LoadDocuments(flowPath)
	if err != nil {
		t.Fatalf("LoadDocuments() error = %v", err)
	}

	if len(documents) != 1 {
		t.Fatalf("len(documents) = %d, want 1", len(documents))
	}

	if documents[0].Path != "data/home.md" {
		t.Fatalf("documents[0].Path = %q, want data/home.md", documents[0].Path)
	}
}

func TestLoadDocumentsRejectsInvalidGraphDocumentPath(t *testing.T) {
	t.Parallel()

	flowPath := filepath.Join(t.TempDir(), DirName)
	writeWorkspaceMarkdownDocument(t, filepath.Join(flowPath, DataDirName, GraphsDirName, "build.md"), "---\nid: cmd-1\ntype: command\ngraph: release\ntitle: Build\nname: build\nrun: go build ./cmd/flow\n---\n\nBuild\n")

	_, err := LoadDocuments(flowPath)
	if err == nil {
		t.Fatal("LoadDocuments() error = nil, want canonical graph path error")
	}
}

func writeWorkspaceMarkdownDocument(t *testing.T, path string, contents string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
}
