package desktop

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lex/flow/internal/workspace"
)

func TestResolveDesktopRootPrefersLocalWorkspace(t *testing.T) {
	t.Parallel()

	workingDirectory := t.TempDir()
	root, err := workspace.ResolveLocal(workingDirectory)
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}
	if err := os.MkdirAll(root.FlowPath, 0o755); err != nil {
		t.Fatalf("MkdirAll(.flow) error = %v", err)
	}

	resolved, err := resolveDesktopRoot(Options{Global: false}, runtimeEnvironment{
		getwd: func() (string, error) {
			return workingDirectory, nil
		},
		userConfigDir: func() (string, error) {
			return t.TempDir(), nil
		},
	})
	if err != nil {
		t.Fatalf("resolveDesktopRoot() error = %v", err)
	}
	if resolved.Scope != workspace.LocalScope {
		t.Fatalf("resolved.Scope = %q, want %q", resolved.Scope, workspace.LocalScope)
	}
	if resolved.WorkspacePath != workingDirectory {
		t.Fatalf("resolved.WorkspacePath = %q, want %q", resolved.WorkspacePath, workingDirectory)
	}
}

func TestResolveDesktopRootFallsBackToGlobalWorkspace(t *testing.T) {
	t.Parallel()

	configHome := t.TempDir()
	workingDirectory := t.TempDir()
	globalWorkspacePath := filepath.Join(t.TempDir(), "global-workspace")
	locatorPath := workspace.DefaultGlobalLocatorPath(configHome)
	if err := workspace.WriteGlobalLocator(locatorPath, workspace.GlobalLocator{WorkspacePath: globalWorkspacePath}); err != nil {
		t.Fatalf("WriteGlobalLocator() error = %v", err)
	}

	resolved, err := resolveDesktopRoot(Options{Global: false}, runtimeEnvironment{
		getwd: func() (string, error) {
			return workingDirectory, nil
		},
		userConfigDir: func() (string, error) {
			return configHome, nil
		},
	})
	if err != nil {
		t.Fatalf("resolveDesktopRoot() error = %v", err)
	}
	if resolved.Scope != workspace.GlobalScope {
		t.Fatalf("resolved.Scope = %q, want %q", resolved.Scope, workspace.GlobalScope)
	}
	if resolved.WorkspacePath != globalWorkspacePath {
		t.Fatalf("resolved.WorkspacePath = %q, want %q", resolved.WorkspacePath, globalWorkspacePath)
	}
}

func TestResolveGlobalRootRequiresConfiguredWorkspace(t *testing.T) {
	t.Parallel()

	_, err := resolveGlobalRoot(runtimeEnvironment{
		getwd: func() (string, error) {
			return t.TempDir(), nil
		},
		userConfigDir: func() (string, error) {
			return t.TempDir(), nil
		},
	})
	if err == nil {
		t.Fatal("resolveGlobalRoot() error = nil, want non-nil")
	}
	if !strings.Contains(err.Error(), "global workspace is not configured") {
		t.Fatalf("resolveGlobalRoot() error = %q, want configuration guidance", err.Error())
	}
}
