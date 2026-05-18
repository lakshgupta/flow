package workspace

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lex/flow/internal/config"
)

func TestEnsureInitializedCreatesWorkspaceBaseline(t *testing.T) {
	t.Parallel()

	root, err := ResolveLocal(t.TempDir())
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	if err := EnsureInitialized(root); err != nil {
		t.Fatalf("EnsureInitialized() error = %v", err)
	}

	gitignorePath := filepath.Join(root.FlowPath, ".gitignore")
	gitignoreData, err := os.ReadFile(gitignorePath)
	if err != nil {
		t.Fatalf("ReadFile(.gitignore) error = %v", err)
	}
	if string(gitignoreData) != WorkspaceGitignoreContent {
		t.Fatalf(".gitignore = %q, want %q", string(gitignoreData), WorkspaceGitignoreContent)
	}

	if _, err := os.Stat(root.ConfigPath); err != nil {
		t.Fatalf("Stat(config) error = %v", err)
	}
	if _, err := os.Stat(root.HomePath); err != nil {
		t.Fatalf("Stat(home) error = %v", err)
	}
	if _, err := os.Stat(root.IndexPath); err != nil {
		t.Fatalf("Stat(index) error = %v", err)
	}
}

func TestReadOrDefaultConfigReturnsDefaultWhenMissing(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), ".flow", ConfigDirName, config.FileName)
	workspaceConfig, err := ReadOrDefaultConfig(path)
	if err != nil {
		t.Fatalf("ReadOrDefaultConfig() error = %v", err)
	}

	if workspaceConfig.GUI.Port != config.DefaultGUIPort {
		t.Fatalf("workspaceConfig.GUI.Port = %d, want %d", workspaceConfig.GUI.Port, config.DefaultGUIPort)
	}
}
