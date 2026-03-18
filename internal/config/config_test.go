package config

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestParseValidWorkspaceConfig(t *testing.T) {
	t.Parallel()

	workspace, err := Parse([]byte("gui:\n  port: 4317\n"))
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}

	if workspace.GUI.Port != 4317 {
		t.Fatalf("workspace.GUI.Port = %d, want 4317", workspace.GUI.Port)
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
	input := Workspace{GUI: GUI{Port: 4317}}

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
}
