package workspace

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

const (
	// DirName is the canonical Flow metadata directory inside a workspace.
	DirName = ".flow"
	// ConfigDirName is the directory that stores workspace config and runtime files.
	ConfigDirName = "config"
	// DataDirName is the directory that stores canonical Markdown content.
	DataDirName = "data"
	// ConfigFileName is the persisted workspace configuration file name.
	ConfigFileName = "flow.yaml"
	// IndexFileName is the derived workspace index file name.
	IndexFileName = "flow.index"
	// GraphsDirName is the directory that stores graph-backed Markdown content.
	GraphsDirName = "graphs"
	// HomeFileName is the canonical home document file name.
	HomeFileName = "home.md"
	// AppConfigDirName is the platform-config subdirectory used by Flow.
	AppConfigDirName = "flow"
	// GlobalLocatorFileName stores the configured global workspace location.
	GlobalLocatorFileName = "global-workspace.yaml"
)

// Scope identifies whether a resolved workspace is local or global.
type Scope string

const (
	LocalScope  Scope = "local"
	GlobalScope Scope = "global"
)

// Root describes the canonical paths for a Flow workspace.
type Root struct {
	Scope         Scope
	WorkspacePath string
	FlowPath      string
	ConfigDirPath string
	ConfigPath    string
	IndexPath     string
	DataPath      string
	GraphsPath    string
	HomePath      string
}

// GlobalLocator stores the configured global workspace root path.
type GlobalLocator struct {
	WorkspacePath string `yaml:"workspacePath"`
}

// ResolveLocal returns the Flow paths for a local workspace rooted at workDir.
func ResolveLocal(workDir string) (Root, error) {
	return newRoot(LocalScope, workDir)
}

// ResolveGlobal returns the Flow paths for the configured global workspace.
func ResolveGlobal(locatorPath string) (Root, error) {
	locator, err := ReadGlobalLocator(locatorPath)
	if err != nil {
		return Root{}, err
	}

	return newRoot(GlobalScope, locator.WorkspacePath)
}

// UserGlobalLocatorPath returns the platform-default locator file path.
func UserGlobalLocatorPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolve user config directory: %w", err)
	}

	return DefaultGlobalLocatorPath(configDir), nil
}

// DefaultGlobalLocatorPath builds the locator path from a user config directory.
func DefaultGlobalLocatorPath(configDir string) string {
	return filepath.Join(configDir, AppConfigDirName, GlobalLocatorFileName)
}

// ParseGlobalLocator decodes and validates locator YAML.
func ParseGlobalLocator(data []byte) (GlobalLocator, error) {
	var locator GlobalLocator

	if err := yaml.Unmarshal(data, &locator); err != nil {
		return GlobalLocator{}, fmt.Errorf("parse global locator: %w", err)
	}

	if err := locator.Validate(); err != nil {
		return GlobalLocator{}, err
	}

	return locator, nil
}

// ReadGlobalLocator loads the configured global workspace locator.
func ReadGlobalLocator(path string) (GlobalLocator, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return GlobalLocator{}, fmt.Errorf("read global locator: %w", err)
	}

	return ParseGlobalLocator(data)
}

// WriteGlobalLocator validates and persists the global workspace locator.
func WriteGlobalLocator(path string, locator GlobalLocator) error {
	if err := locator.Validate(); err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create locator directory: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(locator.WorkspacePath), 0o755); err != nil {
		return fmt.Errorf("create global workspace parent directory: %w", err)
	}

	data, err := yaml.Marshal(locator)
	if err != nil {
		return fmt.Errorf("marshal global locator: %w", err)
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write global locator: %w", err)
	}

	return nil
}

// Validate checks that the global workspace locator points to an absolute path.
func (locator GlobalLocator) Validate() error {
	if locator.WorkspacePath == "" {
		return fmt.Errorf("workspacePath must not be empty")
	}

	if !filepath.IsAbs(locator.WorkspacePath) {
		return fmt.Errorf("workspacePath must be absolute")
	}

	return nil
}

func newRoot(scope Scope, workspacePath string) (Root, error) {
	if workspacePath == "" {
		return Root{}, fmt.Errorf("workspace path must not be empty")
	}

	absPath, err := filepath.Abs(workspacePath)
	if err != nil {
		return Root{}, fmt.Errorf("resolve workspace path: %w", err)
	}

	flowPath := filepath.Join(absPath, DirName)
	configDirPath := filepath.Join(flowPath, ConfigDirName)
	dataPath := filepath.Join(flowPath, DataDirName)

	return Root{
		Scope:         scope,
		WorkspacePath: absPath,
		FlowPath:      flowPath,
		ConfigDirPath: configDirPath,
		ConfigPath:    filepath.Join(configDirPath, ConfigFileName),
		IndexPath:     filepath.Join(configDirPath, IndexFileName),
		DataPath:      dataPath,
		GraphsPath:    filepath.Join(dataPath, GraphsDirName),
		HomePath:      filepath.Join(dataPath, HomeFileName),
	}, nil
}
