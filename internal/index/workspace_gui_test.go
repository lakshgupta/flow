package index

import (
	"path/filepath"
	"testing"
)

func TestWriteAndReadWorkspaceGUISettings(t *testing.T) {
	t.Parallel()

	indexPath := filepath.Join(t.TempDir(), ".flow", "config", "flow.index")
	if err := Rebuild(indexPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	if err := WriteWorkspaceGUISettings(indexPath, WorkspaceGUISettings{
		Appearance:      "light",
		PanelLeftRatio:  0.33,
		PanelRightRatio: 0.21,
		PanelTOCRatio:   0.19,
	}); err != nil {
		t.Fatalf("WriteWorkspaceGUISettings() error = %v", err)
	}

	settings, ok, err := ReadWorkspaceGUISettings(indexPath)
	if err != nil {
		t.Fatalf("ReadWorkspaceGUISettings() error = %v", err)
	}
	if !ok {
		t.Fatal("ReadWorkspaceGUISettings() ok = false, want true")
	}

	if settings.Appearance != "light" || settings.PanelLeftRatio != 0.33 || settings.PanelRightRatio != 0.21 || settings.PanelTOCRatio != 0.19 {
		t.Fatalf("settings = %#v, want light + 0.33/0.21/0.19", settings)
	}
}

func TestReplaceAndReadWorkspaceGraphDirectoryColors(t *testing.T) {
	t.Parallel()

	indexPath := filepath.Join(t.TempDir(), ".flow", "config", "flow.index")
	if err := Rebuild(indexPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	if err := ReplaceWorkspaceGraphDirectoryColors(indexPath, map[string]string{
		"graph1":         "mint",
		"graph1/graph11": "rose",
	}); err != nil {
		t.Fatalf("ReplaceWorkspaceGraphDirectoryColors() error = %v", err)
	}

	colors, err := ReadWorkspaceGraphDirectoryColors(indexPath)
	if err != nil {
		t.Fatalf("ReadWorkspaceGraphDirectoryColors() error = %v", err)
	}
	if len(colors) != 2 || colors["graph1"] != "mint" || colors["graph1/graph11"] != "rose" {
		t.Fatalf("colors = %#v, want graph1=mint and graph1/graph11=rose", colors)
	}

	if err := ReplaceWorkspaceGraphDirectoryColors(indexPath, map[string]string{"graph2": "sky"}); err != nil {
		t.Fatalf("ReplaceWorkspaceGraphDirectoryColors(second) error = %v", err)
	}

	colors, err = ReadWorkspaceGraphDirectoryColors(indexPath)
	if err != nil {
		t.Fatalf("ReadWorkspaceGraphDirectoryColors(second) error = %v", err)
	}
	if len(colors) != 1 || colors["graph2"] != "sky" {
		t.Fatalf("colors(second) = %#v, want graph2=sky", colors)
	}
}

func TestRebuildPreservesWorkspaceGUIState(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "execution", "build.md"), "---\nid: task-1\ntype: task\ngraph: execution\ntitle: Build\nstatus: todo\n---\n\nBuild\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild(first) error = %v", err)
	}

	if err := WriteWorkspaceGUISettings(indexPath, WorkspaceGUISettings{
		Appearance:      "dark",
		PanelLeftRatio:  0.29,
		PanelRightRatio: 0.22,
		PanelTOCRatio:   0.17,
	}); err != nil {
		t.Fatalf("WriteWorkspaceGUISettings() error = %v", err)
	}

	if err := ReplaceWorkspaceGraphDirectoryColors(indexPath, map[string]string{
		"execution":        "mint",
		"execution/parser": "rose",
	}); err != nil {
		t.Fatalf("ReplaceWorkspaceGraphDirectoryColors() error = %v", err)
	}

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild(second) error = %v", err)
	}

	settings, ok, err := ReadWorkspaceGUISettings(indexPath)
	if err != nil {
		t.Fatalf("ReadWorkspaceGUISettings() error = %v", err)
	}
	if !ok {
		t.Fatal("ReadWorkspaceGUISettings() ok = false after rebuild, want true")
	}
	if settings.Appearance != "dark" || settings.PanelLeftRatio != 0.29 || settings.PanelRightRatio != 0.22 || settings.PanelTOCRatio != 0.17 {
		t.Fatalf("settings after rebuild = %#v, want dark + 0.29/0.22/0.17", settings)
	}

	colors, err := ReadWorkspaceGraphDirectoryColors(indexPath)
	if err != nil {
		t.Fatalf("ReadWorkspaceGraphDirectoryColors() error = %v", err)
	}
	if len(colors) != 2 || colors["execution"] != "mint" || colors["execution/parser"] != "rose" {
		t.Fatalf("colors after rebuild = %#v, want execution=mint and execution/parser=rose", colors)
	}
}
