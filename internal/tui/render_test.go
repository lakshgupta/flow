package tui

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lex/flow/internal/index"
	"github.com/lex/flow/internal/workspace"
)

func TestRenderShowsGroupedListsLayersAndSearch(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	writeMarkdownDocumentForRender(t, filepath.Join(flowPath, "features", "demo", "notes", "architecture.md"), "---\nid: note-1\ntype: note\ngraph: notes\ntitle: Architecture\n---\n\nBuild architecture notes.\n")
	writeMarkdownDocumentForRender(t, filepath.Join(flowPath, "features", "demo", "tasks", "foundation.md"), "---\nid: task-0\ntype: task\ngraph: planning\ntitle: Foundation\nstatus: todo\n---\n\nFoundation work.\n")
	writeMarkdownDocumentForRender(t, filepath.Join(flowPath, "features", "demo", "tasks", "parser.md"), "---\nid: task-1\ntype: task\ngraph: execution\ntitle: Parser\nstatus: todo\ndependsOn:\n  - task-0\n---\n\nParser work.\n")
	writeMarkdownDocumentForRender(t, filepath.Join(flowPath, "features", "release", "commands", "build.md"), "---\nid: cmd-1\ntype: command\ngraph: release\ntitle: Build\nname: build\nrun: go build ./cmd/flow\n---\n\nBuild release binary.\n")

	indexPath := filepath.Join(flowPath, workspace.IndexFileName)
	if err := index.Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	root, err := workspace.ResolveLocal(rootDir)
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	output, err := Render(root, Options{SearchQuery: "build"})
	if err != nil {
		t.Fatalf("Render() error = %v", err)
	}

	assertContains(t, output, "Scope: local")
	assertContains(t, output, "Notes: notes")
	assertContains(t, output, "Tasks: execution, planning")
	assertContains(t, output, "Commands: release")
	assertContains(t, output, "L0: Foundation [planning]")
	assertContains(t, output, "L1: Parser [execution]")
	assertContains(t, output, "Selected graph: release")
	assertContains(t, output, "- command cmd-1 [release] features/release/commands/build.md")
}

func TestRenderRebuildsMissingIndexForSearch(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	writeMarkdownDocumentForRender(t, filepath.Join(flowPath, "features", "demo", "notes", "architecture.md"), "---\nid: note-1\ntype: note\ngraph: notes\ntitle: Architecture\n---\n\nBuild architecture notes.\n")

	root, err := workspace.ResolveLocal(rootDir)
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	output, err := Render(root, Options{SearchQuery: "build"})
	if err != nil {
		t.Fatalf("Render() error = %v", err)
	}

	assertContains(t, output, "Indexed Search\nQuery: build")
	assertContains(t, output, "- note note-1 [notes] features/demo/notes/architecture.md")

	if _, err := os.Stat(root.IndexPath); err != nil {
		t.Fatalf("Stat(index) error = %v", err)
	}
}

func writeMarkdownDocumentForRender(t *testing.T, path string, content string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
}

func assertContains(t *testing.T, output string, want string) {
	t.Helper()

	if !strings.Contains(output, want) {
		t.Fatalf("output does not contain %q:\n%s", want, output)
	}
}
