package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// FileName is the canonical workspace configuration file name inside .flow.
const FileName = "flow.yaml"

// DefaultGUIPort is used when a workspace config is created without an explicit port.
const DefaultGUIPort = 4317

// Default panel width ratios for the desktop GUI shell.
const (
	DefaultLeftPanelRatio  = 0.25
	DefaultRightPanelRatio = 0.24
)

// Workspace holds persisted workspace settings.
type Workspace struct {
	GUI GUI `yaml:"gui"`
}

// GUI holds loopback server settings for a workspace.
type GUI struct {
	Port        int         `yaml:"port"`
	PanelWidths PanelWidths `yaml:"panelWidths"`
}

// PanelWidths stores persisted panel width ratios for the desktop GUI shell.
type PanelWidths struct {
	LeftRatio  float64 `yaml:"leftRatio"`
	RightRatio float64 `yaml:"rightRatio"`
}

// DefaultWorkspace returns the default workspace configuration for new workspaces.
func DefaultWorkspace() Workspace {
	return Workspace{GUI: GUI{
		Port: DefaultGUIPort,
		PanelWidths: PanelWidths{
			LeftRatio:  DefaultLeftPanelRatio,
			RightRatio: DefaultRightPanelRatio,
		},
	}}
}

// Validate checks the supported workspace configuration fields.
func (workspace Workspace) Validate() error {
	if workspace.GUI.Port < 1 || workspace.GUI.Port > 65535 {
		return fmt.Errorf("gui.port must be between 1 and 65535")
	}

	if workspace.GUI.PanelWidths.LeftRatio <= 0 || workspace.GUI.PanelWidths.LeftRatio >= 1 {
		return fmt.Errorf("gui.panelWidths.leftRatio must be between 0 and 1")
	}

	if workspace.GUI.PanelWidths.RightRatio <= 0 || workspace.GUI.PanelWidths.RightRatio >= 1 {
		return fmt.Errorf("gui.panelWidths.rightRatio must be between 0 and 1")
	}

	if workspace.GUI.PanelWidths.LeftRatio+workspace.GUI.PanelWidths.RightRatio >= 0.9 {
		return fmt.Errorf("gui.panelWidths ratios must leave space for the middle panel")
	}

	return nil
}

// Parse decodes YAML configuration bytes and validates the result.
func Parse(data []byte) (Workspace, error) {
	var workspace Workspace

	if err := yaml.Unmarshal(data, &workspace); err != nil {
		return Workspace{}, fmt.Errorf("parse workspace config: %w", err)
	}

	workspace = normalizeWorkspace(workspace)

	if err := workspace.Validate(); err != nil {
		return Workspace{}, err
	}

	return workspace, nil
}

// Marshal encodes a workspace configuration as YAML after validation.
func Marshal(workspace Workspace) ([]byte, error) {
	workspace = normalizeWorkspace(workspace)

	if err := workspace.Validate(); err != nil {
		return nil, err
	}

	data, err := yaml.Marshal(workspace)
	if err != nil {
		return nil, fmt.Errorf("marshal workspace config: %w", err)
	}

	return data, nil
}

// Read loads and validates a workspace configuration from disk.
func Read(path string) (Workspace, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Workspace{}, fmt.Errorf("read workspace config: %w", err)
	}

	return Parse(data)
}

// Write persists a validated workspace configuration to disk.
func Write(path string, workspace Workspace) error {
	data, err := Marshal(workspace)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create config directory: %w", err)
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write workspace config: %w", err)
	}

	return nil
}

// IsNotFound reports whether the error means the configuration file is missing.
func IsNotFound(err error) bool {
	return errors.Is(err, os.ErrNotExist)
}

func normalizeWorkspace(workspace Workspace) Workspace {
	defaultWorkspace := DefaultWorkspace()

	if workspace.GUI.Port == 0 {
		workspace.GUI.Port = defaultWorkspace.GUI.Port
	}

	if workspace.GUI.PanelWidths.LeftRatio <= 0 || workspace.GUI.PanelWidths.LeftRatio >= 1 {
		workspace.GUI.PanelWidths.LeftRatio = defaultWorkspace.GUI.PanelWidths.LeftRatio
	}

	if workspace.GUI.PanelWidths.RightRatio <= 0 || workspace.GUI.PanelWidths.RightRatio >= 1 {
		workspace.GUI.PanelWidths.RightRatio = defaultWorkspace.GUI.PanelWidths.RightRatio
	}

	if workspace.GUI.PanelWidths.LeftRatio+workspace.GUI.PanelWidths.RightRatio >= 0.9 {
		workspace.GUI.PanelWidths = defaultWorkspace.GUI.PanelWidths
	}

	return workspace
}
