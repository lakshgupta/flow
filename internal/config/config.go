package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

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

// Supported persisted GUI appearance selections.
const (
	AppearanceSystem = "system"
	AppearanceLight  = "light"
	AppearanceDark   = "dark"
)

// Supported persisted graph directory color selections.
const (
	GraphDirectoryColorRose  = "rose"
	GraphDirectoryColorPeach = "peach"
	GraphDirectoryColorAmber = "amber"
	GraphDirectoryColorLemon = "lemon"
	GraphDirectoryColorMint  = "mint"
	GraphDirectoryColorSage  = "sage"
	GraphDirectoryColorSky   = "sky"
	GraphDirectoryColorLilac = "lilac"
	GraphDirectoryColorBlush = "blush"
)

// Workspace holds persisted workspace settings.
type Workspace struct {
	GUI          GUI          `yaml:"gui"`
	Integrations Integrations `yaml:"integrations,omitempty"`
}

// Integrations holds settings for external trackers. Credentials are never
// stored here; they are read from environment variables or the credentials
// file at sync time.
type Integrations struct {
	Jira map[string]JiraConfig `yaml:"jira,omitempty"`
	Aha  map[string]AhaConfig  `yaml:"aha,omitempty"`
}

// JiraConfig describes one Jira instance and the project keys to mirror.
type JiraConfig struct {
	// Host is the Jira base URL, for example "https://example.atlassian.net".
	Host string `yaml:"host,omitempty"`
	// Projects are the project keys to sync, for example ["PROJ"].
	Projects []string `yaml:"projects,omitempty"`
}

// AhaConfig describes one Aha! instance. Reserved for future sync support.
type AhaConfig struct {
	Host     string   `yaml:"host,omitempty"`
	Projects []string `yaml:"projects,omitempty"`
}

// DefaultServiceAlias is used when no alias is specified.
const DefaultServiceAlias = "default"

// UnmarshalYAML handles both the legacy single-object shape
// (jira: {host: ..., projects: [...]}) and the new map shape
// (jira: {default: {host: ...}, j1: {host: ...}}).
func (integrations *Integrations) UnmarshalYAML(node *yaml.Node) error {
	if node.Kind != yaml.MappingNode {
		return nil
	}
	raw := make(map[string]yaml.Node, len(node.Content)/2)
	for i := 0; i < len(node.Content); i += 2 {
		raw[node.Content[i].Value] = *node.Content[i+1]
	}
	if n, ok := raw["jira"]; ok {
		if err := decodeIntegrationMap(n, &integrations.Jira); err != nil {
			return err
		}
	}
	if n, ok := raw["aha"]; ok {
		if err := decodeIntegrationMap(n, &integrations.Aha); err != nil {
			return err
		}
	}
	return nil
}

func decodeIntegrationMap[M JiraConfig | AhaConfig](node yaml.Node, target *map[string]M) error {
	isSingle := false
	for i := 0; i < len(node.Content); i += 2 {
		if node.Content[i].Value == "host" || node.Content[i].Value == "projects" {
			isSingle = true
			break
		}
	}
	if isSingle {
		var single M
		if err := node.Decode(&single); err != nil {
			return err
		}
		var host string
		var projects []string
		switch v := any(single).(type) {
		case JiraConfig:
			host, projects = v.Host, v.Projects
		case AhaConfig:
			host, projects = v.Host, v.Projects
		}
		if host != "" || len(projects) > 0 {
			if *target == nil {
				*target = make(map[string]M)
			}
			(*target)[DefaultServiceAlias] = single
		}
		return nil
	}
	var m map[string]M
	if err := node.Decode(&m); err != nil {
		return err
	}
	*target = m
	return nil
}

// JiraConfigForAlias returns the Jira config for the given alias (empty → default).
func (integrations Integrations) JiraConfigForAlias(alias string) (JiraConfig, bool) {
	alias = strings.TrimSpace(alias)
	if alias == "" {
		alias = DefaultServiceAlias
	}
	if integrations.Jira == nil {
		return JiraConfig{}, false
	}
	cfg, ok := integrations.Jira[alias]
	return cfg, ok
}

// SetJiraConfig sets the Jira config for an alias (empty → default).
func (integrations *Integrations) SetJiraConfig(alias string, cfg JiraConfig) {
	alias = strings.TrimSpace(alias)
	if alias == "" {
		alias = DefaultServiceAlias
	}
	if integrations.Jira == nil {
		integrations.Jira = map[string]JiraConfig{}
	}
	integrations.Jira[alias] = cfg
}

// GUI holds loopback server settings for a workspace.
type GUI struct {
	Port                 int               `yaml:"port"`
	Appearance           string            `yaml:"appearance,omitempty"`
	PanelWidths          PanelWidths       `yaml:"panelWidths"`
	GraphDirectoryColors map[string]string `yaml:"graphDirectoryColors,omitempty"`
	GraphCanvasEnabled   map[string]bool   `yaml:"graphCanvasEnabled,omitempty"`
}

// PanelWidths stores persisted panel width ratios for the desktop GUI shell.
type PanelWidths struct {
	LeftRatio  float64 `yaml:"leftRatio"`
	RightRatio float64 `yaml:"rightRatio"`
}

// DefaultWorkspace returns the default workspace configuration for new workspaces.
func DefaultWorkspace() Workspace {
	return Workspace{GUI: GUI{
		Port:       DefaultGUIPort,
		Appearance: AppearanceSystem,
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

	if workspace.GUI.Appearance != AppearanceSystem && workspace.GUI.Appearance != AppearanceLight && workspace.GUI.Appearance != AppearanceDark {
		return fmt.Errorf("gui.appearance must be one of %q, %q, or %q", AppearanceSystem, AppearanceLight, AppearanceDark)
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

	for graphPath, color := range workspace.GUI.GraphDirectoryColors {
		if strings.TrimSpace(graphPath) == "" {
			return fmt.Errorf("gui.graphDirectoryColors keys must not be empty")
		}

		cleanedGraphPath := filepath.Clean(graphPath)
		if strings.HasPrefix(cleanedGraphPath, "..") {
			return fmt.Errorf("gui.graphDirectoryColors key %q is invalid", graphPath)
		}

		if !isSupportedGraphDirectoryColor(color) {
			return fmt.Errorf("gui.graphDirectoryColors[%q] must be one of %q, %q, %q, %q, %q, %q, %q, %q, or %q", graphPath, GraphDirectoryColorRose, GraphDirectoryColorPeach, GraphDirectoryColorAmber, GraphDirectoryColorLemon, GraphDirectoryColorMint, GraphDirectoryColorSage, GraphDirectoryColorSky, GraphDirectoryColorLilac, GraphDirectoryColorBlush)
		}
	}

	for graphPath := range workspace.GUI.GraphCanvasEnabled {
		if strings.TrimSpace(graphPath) == "" {
			return fmt.Errorf("gui.graphCanvasEnabled keys must not be empty")
		}

		cleanedGraphPath := filepath.Clean(graphPath)
		if strings.HasPrefix(cleanedGraphPath, "..") {
			return fmt.Errorf("gui.graphCanvasEnabled key %q is invalid", graphPath)
		}
	}

	if err := validateIntegrationMap(workspace.Integrations.Jira, "jira"); err != nil {
		return err
	}
	if err := validateIntegrationMap(workspace.Integrations.Aha, "aha"); err != nil {
		return err
	}

	return nil
}

func validateIntegrationMap[M JiraConfig | AhaConfig](configs map[string]M, service string) error {
	for alias, cfg := range configs {
		if strings.TrimSpace(alias) == "" {
			return fmt.Errorf("integrations.%s alias must not be empty", service)
		}
		var host string
		var projects []string
		switch v := any(cfg).(type) {
		case JiraConfig:
			host = v.Host
			projects = v.Projects
		case AhaConfig:
			host = v.Host
			projects = v.Projects
		}
		if strings.TrimSpace(host) == "" && len(projects) > 0 {
			return fmt.Errorf("integrations.%s[%q].host is required when integrations.%s[%q].projects are configured", service, alias, service, alias)
		}
		for _, project := range projects {
			if strings.TrimSpace(project) == "" {
				return fmt.Errorf("integrations.%s[%q].projects entries must not be empty", service, alias)
			}
		}
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

	if workspace.GUI.Appearance == "" {
		workspace.GUI.Appearance = defaultWorkspace.GUI.Appearance
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

	normalizedGraphDirectoryColors := map[string]string{}
	for graphPath, color := range workspace.GUI.GraphDirectoryColors {
		trimmedGraphPath := strings.TrimSpace(graphPath)
		trimmedColor := strings.TrimSpace(color)
		if trimmedGraphPath == "" || trimmedColor == "" {
			continue
		}

		normalizedGraphDirectoryColors[filepath.ToSlash(filepath.Clean(trimmedGraphPath))] = trimmedColor
	}

	if len(normalizedGraphDirectoryColors) > 0 {
		workspace.GUI.GraphDirectoryColors = normalizedGraphDirectoryColors
	} else {
		workspace.GUI.GraphDirectoryColors = nil
	}

	normalizedGraphCanvasEnabled := map[string]bool{}
	for graphPath, enabled := range workspace.GUI.GraphCanvasEnabled {
		trimmedGraphPath := strings.TrimSpace(graphPath)
		if trimmedGraphPath == "" || !enabled {
			continue
		}

		normalizedGraphCanvasEnabled[filepath.ToSlash(filepath.Clean(trimmedGraphPath))] = true
	}

	if len(normalizedGraphCanvasEnabled) > 0 {
		workspace.GUI.GraphCanvasEnabled = normalizedGraphCanvasEnabled
	} else {
		workspace.GUI.GraphCanvasEnabled = nil
	}

	workspace.Integrations.Jira = normalizeIntegrationMap(workspace.Integrations.Jira)
	workspace.Integrations.Aha = normalizeIntegrationMap(workspace.Integrations.Aha)

	return workspace
}

func normalizeIntegrationMap[M JiraConfig | AhaConfig](configs map[string]M) map[string]M {
	if len(configs) == 0 {
		return nil
	}
	normalized := make(map[string]M, len(configs))
	for alias, cfg := range configs {
		alias = strings.TrimSpace(alias)
		if alias == "" {
			alias = DefaultServiceAlias
		}
		var host string
		var projects []string
		switch v := any(cfg).(type) {
		case JiraConfig:
			host = strings.TrimSpace(v.Host)
			projects = normalizeProjects(v.Projects)
			if host == "" && len(projects) == 0 {
				continue
			}
			normalized[alias] = any(JiraConfig{Host: host, Projects: projects}).(M)
		case AhaConfig:
			host = strings.TrimSpace(v.Host)
			projects = normalizeProjects(v.Projects)
			if host == "" && len(projects) == 0 {
				continue
			}
			normalized[alias] = any(AhaConfig{Host: host, Projects: projects}).(M)
		}
	}
	if len(normalized) == 0 {
		return nil
	}
	return normalized
}

func normalizeProjects(projects []string) []string {
	seen := make(map[string]struct{}, len(projects))
	out := make([]string, 0, len(projects))
	for _, p := range projects {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		out = append(out, p)
	}
	return out
}

func isSupportedGraphDirectoryColor(value string) bool {
	switch value {
	case GraphDirectoryColorRose,
		GraphDirectoryColorPeach,
		GraphDirectoryColorAmber,
		GraphDirectoryColorLemon,
		GraphDirectoryColorMint,
		GraphDirectoryColorSage,
		GraphDirectoryColorSky,
		GraphDirectoryColorLilac,
		GraphDirectoryColorBlush:
		return true
	default:
		return false
	}
}
