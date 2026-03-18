package index

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSearchFindsIndexedDocuments(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "home.md"), "---\ntype: home\ntitle: Home\ndescription: Build dashboard\n---\n\nWelcome home.\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "graphs", "demo", "architecture.md"), "---\nid: note-1\ntype: note\ngraph: notes\ntitle: Architecture\ndescription: Build pipeline overview\n---\n\nBuild pipeline design and release notes.\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "graphs", "release", "build.md"), "---\nid: cmd-1\ntype: command\ngraph: release\ntitle: Build release\nname: build\nrun: go build ./cmd/flow\n---\n\nBuild the release binary.\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	results, err := Search(indexPath, "build", 10)
	if err != nil {
		t.Fatalf("Search() error = %v", err)
	}

	if len(results) != 3 {
		t.Fatalf("len(results) = %d, want 3", len(results))
	}

	if results[0].ID != "cmd-1" {
		t.Fatalf("results[0].ID = %q, want cmd-1", results[0].ID)
	}

	if results[1].ID != "home" {
		t.Fatalf("results[1].ID = %q, want home", results[1].ID)
	}

	if results[1].Type != "home" {
		t.Fatalf("results[1].Type = %q, want home", results[1].Type)
	}

	if results[1].Description != "Build dashboard" {
		t.Fatalf("results[1].Description = %q, want Build dashboard", results[1].Description)
	}

	if results[2].ID != "note-1" {
		t.Fatalf("results[2].ID = %q, want note-1", results[2].ID)
	}

	if results[0].Snippet == "" {
		t.Fatal("results[0].Snippet = empty, want non-empty snippet")
	}
}

func TestSearchMatchesDescriptionWithoutBodyHit(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "graphs", "demo", "plan.md"), "---\nid: note-1\ntype: note\ngraph: demo\ntitle: Planning\ndescription: Parser migration checklist\n---\n\nGeneral notes only.\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	results, err := Search(indexPath, "checklist", 10)
	if err != nil {
		t.Fatalf("Search() error = %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("len(results) = %d, want 1", len(results))
	}

	if results[0].ID != "note-1" {
		t.Fatalf("results[0].ID = %q, want note-1", results[0].ID)
	}

	if results[0].Description != "Parser migration checklist" {
		t.Fatalf("results[0].Description = %q, want Parser migration checklist", results[0].Description)
	}
}

func TestSearchRejectsEmptyQuery(t *testing.T) {
	t.Parallel()

	_, err := Search(filepath.Join(t.TempDir(), "flow.index"), "   ", 5)
	if err == nil {
		t.Fatal("Search() error = nil, want empty query error")
	}
}

func TestSearchWorkspaceRebuildsMissingIndex(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "graphs", "demo", "architecture.md"), "---\nid: note-1\ntype: note\ngraph: notes\ntitle: Architecture\n---\n\nBuild architecture notes.\n")

	results, err := SearchWorkspace(indexPath, flowPath, "build", 10)
	if err != nil {
		t.Fatalf("SearchWorkspace() error = %v", err)
	}

	if len(results) != 1 || results[0].ID != "note-1" {
		t.Fatalf("results = %#v, want note-1", results)
	}

	if _, err := os.Stat(indexPath); err != nil {
		t.Fatalf("Stat(indexPath) error = %v", err)
	}
}
