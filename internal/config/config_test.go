package config

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestParseValidWorkspaceConfig(t *testing.T) {
	t.Parallel()

	workspace, err := Parse([]byte("gui:\n  port: 4317\n  panelWidths:\n    leftRatio: 0.28\n    rightRatio: 0.22\n    documentTOCRatio: 0.19\n"))
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}

	if workspace.GUI.Port != 4317 {
		t.Fatalf("workspace.GUI.Port = %d, want 4317", workspace.GUI.Port)
	}
	if workspace.GUI.Appearance != AppearanceSystem {
		t.Fatalf("workspace.GUI.Appearance = %q, want %q", workspace.GUI.Appearance, AppearanceSystem)
	}

	if workspace.GUI.PanelWidths.LeftRatio != 0.28 || workspace.GUI.PanelWidths.RightRatio != 0.22 || workspace.GUI.PanelWidths.DocumentTOCRatio != 0.19 {
		t.Fatalf("workspace.GUI.PanelWidths = %#v, want 0.28/0.22/0.19", workspace.GUI.PanelWidths)
	}
}

func TestParseRejectsInvalidPort(t *testing.T) {
	t.Parallel()

	_, err := Parse([]byte("gui:\n  port: 70000\n"))
	if err == nil {
		t.Fatal("Parse() error = nil, want validation error")
	}

	if !strings.Contains(err.Error(), "gui.port") {
		t.Fatalf("Parse() error = %v, want gui.port validation", err)
	}
}

func TestWriteAndReadRoundTrip(t *testing.T) {
	t.Parallel()

	configPath := filepath.Join(t.TempDir(), ".flow", FileName)
	input := Workspace{GUI: GUI{Port: 4317, Appearance: AppearanceDark, PanelWidths: PanelWidths{LeftRatio: 0.27, RightRatio: 0.21, DocumentTOCRatio: 0.2}}}

	if err := Write(configPath, input); err != nil {
		t.Fatalf("Write() error = %v", err)
	}

	loaded, err := Read(configPath)
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}

	if loaded != input {
		t.Fatalf("Read() = %#v, want %#v", loaded, input)
	}
}

func TestDefaultWorkspaceUsesDefaultGUIPort(t *testing.T) {
	t.Parallel()

	workspace := DefaultWorkspace()
	if workspace.GUI.Port != DefaultGUIPort {
		t.Fatalf("DefaultWorkspace().GUI.Port = %d, want %d", workspace.GUI.Port, DefaultGUIPort)
	}
	if workspace.GUI.Appearance != AppearanceSystem {
		t.Fatalf("DefaultWorkspace().GUI.Appearance = %q, want %q", workspace.GUI.Appearance, AppearanceSystem)
	}

	if workspace.GUI.PanelWidths.LeftRatio != DefaultLeftPanelRatio || workspace.GUI.PanelWidths.RightRatio != DefaultRightPanelRatio || workspace.GUI.PanelWidths.DocumentTOCRatio != DefaultDocumentTOCRatio {
		t.Fatalf("DefaultWorkspace().GUI.PanelWidths = %#v, want default ratios", workspace.GUI.PanelWidths)
	}
}

func TestParseDefaultsMissingPanelWidths(t *testing.T) {
	t.Parallel()

	workspace, err := Parse([]byte("gui:\n  port: 4317\n"))
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}

	if workspace.GUI.PanelWidths.LeftRatio != DefaultLeftPanelRatio || workspace.GUI.PanelWidths.RightRatio != DefaultRightPanelRatio || workspace.GUI.PanelWidths.DocumentTOCRatio != DefaultDocumentTOCRatio {
		t.Fatalf("workspace.GUI.PanelWidths = %#v, want default ratios", workspace.GUI.PanelWidths)
	}
}

func TestParseRejectsInvalidAppearance(t *testing.T) {
	t.Parallel()

	_, err := Parse([]byte("gui:\n  port: 4317\n  appearance: sepia\n"))
	if err == nil {
		t.Fatal("Parse() error = nil, want validation error")
	}

	if !strings.Contains(err.Error(), "gui.appearance") {
		t.Fatalf("Parse() error = %v, want gui.appearance validation", err)
	}
}

func TestParseClampsInvalidPanelWidths(t *testing.T) {
	t.Parallel()

	workspace, err := Parse([]byte("gui:\n  port: 4317\n  panelWidths:\n    leftRatio: 0.95\n    rightRatio: 0.4\n"))
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}

	if workspace.GUI.PanelWidths.LeftRatio != DefaultLeftPanelRatio || workspace.GUI.PanelWidths.RightRatio != DefaultRightPanelRatio {
		t.Fatalf("workspace.GUI.PanelWidths = %#v, want default ratios after clamp", workspace.GUI.PanelWidths)
	}
}
