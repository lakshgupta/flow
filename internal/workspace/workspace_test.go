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

	if resolved.ConfigDirPath != filepath.Join(rootDir, DirName, ConfigDirName) {
		t.Fatalf("resolved.ConfigDirPath = %q", resolved.ConfigDirPath)
	}

	if resolved.ConfigPath != filepath.Join(rootDir, DirName, ConfigDirName, ConfigFileName) {
		t.Fatalf("resolved.ConfigPath = %q", resolved.ConfigPath)
	}

	if resolved.IndexPath != filepath.Join(rootDir, DirName, ConfigDirName, IndexFileName) {
		t.Fatalf("resolved.IndexPath = %q", resolved.IndexPath)
	}

	if resolved.DataPath != filepath.Join(rootDir, DirName, DataDirName) {
		t.Fatalf("resolved.DataPath = %q", resolved.DataPath)
	}

	if resolved.GraphsPath != filepath.Join(rootDir, DirName, DataDirName, GraphsDirName) {
		t.Fatalf("resolved.GraphsPath = %q", resolved.GraphsPath)
	}

	if resolved.HomePath != filepath.Join(rootDir, DirName, DataDirName, HomeFileName) {
		t.Fatalf("resolved.HomePath = %q", resolved.HomePath)
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

	if resolved.ConfigPath != filepath.Join(workspacePath, DirName, ConfigDirName, ConfigFileName) {
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

func TestResolveNearestLocalFindsWorkspaceInParentDirectory(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(rootDir, DirName), 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	nestedDir := filepath.Join(rootDir, "a", "b", "c")
	if err := os.MkdirAll(nestedDir, 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	resolved, err := ResolveNearestLocal(nestedDir)
	if err != nil {
		t.Fatalf("ResolveNearestLocal() error = %v", err)
	}

	if resolved.WorkspacePath != rootDir {
		t.Fatalf("resolved.WorkspacePath = %q, want %q", resolved.WorkspacePath, rootDir)
	}
}

func TestResolveNearestLocalReturnsErrorWhenNoWorkspaceExists(t *testing.T) {
	t.Parallel()

	_, err := ResolveNearestLocal(t.TempDir())
	if err == nil {
		t.Fatal("ResolveNearestLocal() error = nil, want error")
	}
}

func TestRegisterLocalWorkspaceAddsTrackedLocalWorkspace(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	globalPath := filepath.Join(tempDir, "global", "workspace")
	localPath := filepath.Join(tempDir, "repo", "workspace")
	locatorPath := filepath.Join(tempDir, "config", GlobalLocatorFileName)

	if err := WriteGlobalLocator(locatorPath, GlobalLocator{WorkspacePath: globalPath}); err != nil {
		t.Fatalf("WriteGlobalLocator() error = %v", err)
	}

	if err := RegisterLocalWorkspace(locatorPath, localPath); err != nil {
		t.Fatalf("RegisterLocalWorkspace() error = %v", err)
	}

	locator, err := ReadGlobalLocator(locatorPath)
	if err != nil {
		t.Fatalf("ReadGlobalLocator() error = %v", err)
	}

	if len(locator.LocalWorkspaces) != 1 || locator.LocalWorkspaces[0] != localPath {
		t.Fatalf("locator.LocalWorkspaces = %#v, want [%q]", locator.LocalWorkspaces, localPath)
	}

	if err := RegisterLocalWorkspace(locatorPath, localPath); err != nil {
		t.Fatalf("RegisterLocalWorkspace(second) error = %v", err)
	}

	locator, err = ReadGlobalLocator(locatorPath)
	if err != nil {
		t.Fatalf("ReadGlobalLocator(second) error = %v", err)
	}

	if len(locator.LocalWorkspaces) != 1 {
		t.Fatalf("locator.LocalWorkspaces = %#v, want one deduplicated path", locator.LocalWorkspaces)
	}
}

func TestDeregisterLocalWorkspaceRemovesTrackedLocalWorkspace(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	globalPath := filepath.Join(tempDir, "global", "workspace")
	localPathA := filepath.Join(tempDir, "repo-a", "workspace")
	localPathB := filepath.Join(tempDir, "repo-b", "workspace")
	locatorPath := filepath.Join(tempDir, "config", GlobalLocatorFileName)

	if err := WriteGlobalLocator(locatorPath, GlobalLocator{
		WorkspacePath:   globalPath,
		LocalWorkspaces: []string{localPathA, localPathB},
	}); err != nil {
		t.Fatalf("WriteGlobalLocator() error = %v", err)
	}

	if err := DeregisterLocalWorkspace(locatorPath, localPathA); err != nil {
		t.Fatalf("DeregisterLocalWorkspace() error = %v", err)
	}

	locator, err := ReadGlobalLocator(locatorPath)
	if err != nil {
		t.Fatalf("ReadGlobalLocator() error = %v", err)
	}

	if len(locator.LocalWorkspaces) != 1 || locator.LocalWorkspaces[0] != localPathB {
		t.Fatalf("locator.LocalWorkspaces = %#v, want [%q]", locator.LocalWorkspaces, localPathB)
	}
}

func TestDeregisterLocalWorkspaceRejectsGlobalWorkspacePath(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	globalPath := filepath.Join(tempDir, "global", "workspace")
	locatorPath := filepath.Join(tempDir, "config", GlobalLocatorFileName)

	if err := WriteGlobalLocator(locatorPath, GlobalLocator{WorkspacePath: globalPath}); err != nil {
		t.Fatalf("WriteGlobalLocator() error = %v", err)
	}

	err := DeregisterLocalWorkspace(locatorPath, globalPath)
	if err == nil {
		t.Fatal("DeregisterLocalWorkspace() error = nil, want error")
	}
}
