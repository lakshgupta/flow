package workspace

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestResolveLocalBuildsCanonicalPaths(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	resolved, err := ResolveLocal(rootDir)
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	if resolved.Scope != LocalScope {
		t.Fatalf("resolved.Scope = %q, want %q", resolved.Scope, LocalScope)
	}

	if resolved.FlowPath != filepath.Join(rootDir, DirName) {
		t.Fatalf("resolved.FlowPath = %q", resolved.FlowPath)
	}

	if resolved.ConfigPath != filepath.Join(rootDir, DirName, ConfigFileName) {
		t.Fatalf("resolved.ConfigPath = %q", resolved.ConfigPath)
	}

	if resolved.IndexPath != filepath.Join(rootDir, DirName, IndexFileName) {
		t.Fatalf("resolved.IndexPath = %q", resolved.IndexPath)
	}
}

func TestDefaultGlobalLocatorPathUsesFlowConfigDir(t *testing.T) {
	t.Parallel()

	configDir := filepath.Join(string(filepath.Separator), "tmp", "config-root")
	got := DefaultGlobalLocatorPath(configDir)
	want := filepath.Join(configDir, AppConfigDirName, GlobalLocatorFileName)

	if got != want {
		t.Fatalf("DefaultGlobalLocatorPath() = %q, want %q", got, want)
	}
}

func TestWriteAndResolveGlobalLocator(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	locatorPath := filepath.Join(tempDir, "config", GlobalLocatorFileName)
	workspacePath := filepath.Join(tempDir, "global", "workspace")

	if err := WriteGlobalLocator(locatorPath, GlobalLocator{WorkspacePath: workspacePath}); err != nil {
		t.Fatalf("WriteGlobalLocator() error = %v", err)
	}

	if _, err := os.Stat(filepath.Dir(workspacePath)); err != nil {
		t.Fatalf("workspace parent directory missing: %v", err)
	}

	resolved, err := ResolveGlobal(locatorPath)
	if err != nil {
		t.Fatalf("ResolveGlobal() error = %v", err)
	}

	if resolved.Scope != GlobalScope {
		t.Fatalf("resolved.Scope = %q, want %q", resolved.Scope, GlobalScope)
	}

	if resolved.WorkspacePath != workspacePath {
		t.Fatalf("resolved.WorkspacePath = %q, want %q", resolved.WorkspacePath, workspacePath)
	}

	if resolved.ConfigPath != filepath.Join(workspacePath, DirName, ConfigFileName) {
		t.Fatalf("resolved.ConfigPath = %q", resolved.ConfigPath)
	}
}

func TestWriteGlobalLocatorRejectsRelativeWorkspacePath(t *testing.T) {
	t.Parallel()

	err := WriteGlobalLocator(filepath.Join(t.TempDir(), "locator.yaml"), GlobalLocator{WorkspacePath: "relative/path"})
	if err == nil {
		t.Fatal("WriteGlobalLocator() error = nil, want validation error")
	}

	if !strings.Contains(err.Error(), "workspacePath") {
		t.Fatalf("WriteGlobalLocator() error = %v, want workspacePath validation", err)
	}
}
