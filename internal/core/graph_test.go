package core

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCreateGraphRequiresCreator(t *testing.T) {
	t.Parallel()

	err := CreateGraph(CreateGraphRequest{Name: "demo"}, nil)
	if err == nil {
		t.Fatal("CreateGraph() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "graph creator must not be nil") {
		t.Fatalf("CreateGraph() error = %q, want nil-creator validation", err.Error())
	}
}

func TestCreateGraphPropagatesCreatorError(t *testing.T) {
	t.Parallel()

	err := CreateGraph(CreateGraphRequest{Name: "demo"}, func(string) error {
		return errors.New("boom")
	})
	if err == nil {
		t.Fatal("CreateGraph() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "boom") {
		t.Fatalf("CreateGraph() error = %q, want propagated creator error", err.Error())
	}
}

func TestCreateGraphRebuildsIndexAfterCreation(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	graphsPath := filepath.Join(flowPath, "data", "content")
	configPath := filepath.Join(flowPath, "config")
	indexPath := filepath.Join(configPath, "flow.index")
	if err := os.MkdirAll(graphsPath, 0o755); err != nil {
		t.Fatalf("MkdirAll(graphs) error = %v", err)
	}
	if err := os.MkdirAll(configPath, 0o755); err != nil {
		t.Fatalf("MkdirAll(config) error = %v", err)
	}

	err := CreateGraph(CreateGraphRequest{
		Name:      "delivery/parser",
		IndexPath: indexPath,
		FlowPath:  flowPath,
	}, func(name string) error {
		return os.MkdirAll(filepath.Join(graphsPath, filepath.FromSlash(name)), 0o755)
	})
	if err != nil {
		t.Fatalf("CreateGraph() error = %v", err)
	}

	if _, err := os.Stat(filepath.Join(graphsPath, "delivery", "parser")); err != nil {
		t.Fatalf("Stat(created graph) error = %v", err)
	}
	if _, err := os.Stat(indexPath); err != nil {
		t.Fatalf("Stat(index) error = %v", err)
	}
}

func TestRenameGraphRequiresRenamer(t *testing.T) {
	t.Parallel()

	err := RenameGraph(RenameGraphRequest{CurrentName: "a", NextName: "b"}, nil)
	if err == nil {
		t.Fatal("RenameGraph() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "graph renamer must not be nil") {
		t.Fatalf("RenameGraph() error = %q, want nil-renamer validation", err.Error())
	}
}

func TestRenameGraphRunsAfterRenameHook(t *testing.T) {
	t.Parallel()

	calledRenamer := false
	calledHook := false
	err := RenameGraph(RenameGraphRequest{
		CurrentName: "execution",
		NextName:    "delivery/execution",
		AfterRename: func() error {
			calledHook = true
			return nil
		},
	}, func(currentName string, nextName string) error {
		calledRenamer = true
		if currentName != "execution" || nextName != "delivery/execution" {
			return errors.New("unexpected rename args")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("RenameGraph() error = %v", err)
	}
	if !calledRenamer {
		t.Fatal("RenameGraph() did not call renamer")
	}
	if !calledHook {
		t.Fatal("RenameGraph() did not call after-rename hook")
	}
}

func TestRenameGraphPropagatesAfterRenameError(t *testing.T) {
	t.Parallel()

	err := RenameGraph(RenameGraphRequest{
		CurrentName: "execution",
		NextName:    "delivery/execution",
		AfterRename: func() error {
			return errors.New("remap failed")
		},
	}, func(string, string) error {
		return nil
	})
	if err == nil {
		t.Fatal("RenameGraph() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "after graph rename") || !strings.Contains(err.Error(), "remap failed") {
		t.Fatalf("RenameGraph() error = %q, want wrapped hook error", err.Error())
	}
}

func TestDeleteGraphRequiresDeleter(t *testing.T) {
	t.Parallel()

	err := DeleteGraph(DeleteGraphRequest{Name: "execution"}, nil)
	if err == nil {
		t.Fatal("DeleteGraph() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "graph deleter must not be nil") {
		t.Fatalf("DeleteGraph() error = %q, want nil-deleter validation", err.Error())
	}
}

func TestDeleteGraphRunsAfterDeleteHook(t *testing.T) {
	t.Parallel()

	calledDeleter := false
	calledHook := false
	err := DeleteGraph(DeleteGraphRequest{
		Name: "execution",
		AfterDelete: func() error {
			calledHook = true
			return nil
		},
	}, func(name string) error {
		calledDeleter = true
		if name != "execution" {
			return errors.New("unexpected delete arg")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("DeleteGraph() error = %v", err)
	}
	if !calledDeleter {
		t.Fatal("DeleteGraph() did not call deleter")
	}
	if !calledHook {
		t.Fatal("DeleteGraph() did not call after-delete hook")
	}
}

func TestDeleteGraphPropagatesAfterDeleteError(t *testing.T) {
	t.Parallel()

	err := DeleteGraph(DeleteGraphRequest{
		Name: "execution",
		AfterDelete: func() error {
			return errors.New("cleanup failed")
		},
	}, func(string) error {
		return nil
	})
	if err == nil {
		t.Fatal("DeleteGraph() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "after graph delete") || !strings.Contains(err.Error(), "cleanup failed") {
		t.Fatalf("DeleteGraph() error = %q, want wrapped hook error", err.Error())
	}
}
