package execution

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/lex/flow/internal/workspace"
)

// GUIStateFileName is the transient workspace-local GUI process metadata file.
const GUIStateFileName = "gui-server.json"

// GUIState describes the running GUI process for one workspace.
type GUIState struct {
	PID  int    `json:"pid"`
	Port int    `json:"port"`
	URL  string `json:"url"`
}

// GUIStatePath returns the workspace-local GUI state file path.
func GUIStatePath(root workspace.Root) string {
	return filepath.Join(root.ConfigDirPath, GUIStateFileName)
}

// ReadGUIState loads persisted GUI process metadata for a workspace.
func ReadGUIState(root workspace.Root) (GUIState, error) {
	data, err := os.ReadFile(GUIStatePath(root))
	if err != nil {
		return GUIState{}, fmt.Errorf("read gui state: %w", err)
	}

	var state GUIState
	if err := json.Unmarshal(data, &state); err != nil {
		return GUIState{}, fmt.Errorf("parse gui state: %w", err)
	}

	return state, nil
}

// WriteGUIState persists GUI process metadata for a workspace.
func WriteGUIState(root workspace.Root, state GUIState) error {
	data, err := json.Marshal(state)
	if err != nil {
		return fmt.Errorf("marshal gui state: %w", err)
	}

	if err := os.MkdirAll(root.ConfigDirPath, 0o755); err != nil {
		return fmt.Errorf("create gui state directory: %w", err)
	}

	if err := os.WriteFile(GUIStatePath(root), data, 0o644); err != nil {
		return fmt.Errorf("write gui state: %w", err)
	}

	return nil
}

// RemoveGUIState removes persisted GUI process metadata for a workspace.
func RemoveGUIState(root workspace.Root) error {
	if err := os.Remove(GUIStatePath(root)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove gui state: %w", err)
	}

	return nil
}
