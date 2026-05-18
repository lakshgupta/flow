package workspace

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/lex/flow/internal/config"
	"github.com/lex/flow/internal/core"
)

// WorkspaceGitignoreContent is the canonical .flow/.gitignore content required
// for derived artifacts and runtime logs.
const WorkspaceGitignoreContent = "config/flow.index\nconfig/flow.index.tmp\nconfig/gui-server.json\nlogs/\n"

// EnsureInitialized prepares the canonical workspace directories, config, home
// document, and derived index so all transports observe consistent baseline
// state before serving mutations.
func EnsureInitialized(root Root) error {
	if err := os.MkdirAll(root.FlowPath, 0o755); err != nil {
		return fmt.Errorf("create workspace metadata directory: %w", err)
	}

	for _, path := range []string{root.ConfigDirPath, root.DataPath, root.GraphsPath} {
		if err := os.MkdirAll(path, 0o755); err != nil {
			return fmt.Errorf("create workspace directory %s: %w", path, err)
		}
	}

	if err := ensureWorkspaceGitignore(root); err != nil {
		return err
	}

	workspaceConfig, err := ReadOrDefaultConfig(root.ConfigPath)
	if err != nil {
		return err
	}

	if err := config.Write(root.ConfigPath, workspaceConfig); err != nil {
		return err
	}

	if err := ensureHomeDocument(root.HomePath); err != nil {
		return err
	}

	if err := core.RebuildIndex(core.RebuildIndexRequest{IndexPath: root.IndexPath, FlowPath: root.FlowPath}); err != nil {
		return err
	}

	return nil
}

// ReadOrDefaultConfig reads a persisted workspace config or returns defaults
// when the file does not yet exist.
func ReadOrDefaultConfig(path string) (config.Workspace, error) {
	workspaceConfig, err := config.Read(path)
	if err == nil {
		return workspaceConfig, nil
	}

	if !config.IsNotFound(err) {
		return config.Workspace{}, err
	}

	return config.DefaultWorkspace(), nil
}

func ensureWorkspaceGitignore(root Root) error {
	ignorePath := filepath.Join(root.FlowPath, ".gitignore")
	requiredEntries := strings.Split(strings.TrimSpace(strings.ReplaceAll(WorkspaceGitignoreContent, "\r\n", "\n")), "\n")

	existingContent, err := os.ReadFile(ignorePath)
	if errors.Is(err, os.ErrNotExist) {
		if err := os.WriteFile(ignorePath, []byte(WorkspaceGitignoreContent), 0o644); err != nil {
			return fmt.Errorf("write workspace ignore file: %w", err)
		}

		return nil
	}

	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("read workspace ignore file: %w", err)
	}

	existingLines := []string{}
	if err == nil {
		existingLines = strings.Split(strings.ReplaceAll(string(existingContent), "\r\n", "\n"), "\n")
	}

	present := make(map[string]bool, len(existingLines))
	for _, line := range existingLines {
		present[strings.TrimSpace(line)] = true
	}

	updatedLines := append([]string(nil), existingLines...)
	changed := false
	for _, entry := range requiredEntries {
		if present[entry] {
			continue
		}
		updatedLines = append(updatedLines, entry)
		changed = true
	}

	if err == nil && !changed {
		return nil
	}

	content := strings.TrimRight(strings.Join(updatedLines, "\n"), "\n") + "\n"
	if err := os.WriteFile(ignorePath, []byte(content), 0o644); err != nil {
		return fmt.Errorf("write workspace ignore file: %w", err)
	}

	return nil
}

func ensureHomeDocument(path string) error {
	if _, err := os.Stat(path); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("stat home document: %w", err)
	}

	if err := os.WriteFile(path, []byte("# Home\n"), 0o644); err != nil {
		return fmt.Errorf("write home document: %w", err)
	}

	return nil
}
