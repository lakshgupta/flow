package desktop

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWriteLinuxDesktopIntegrationWritesDesktopEntryAndIcon(t *testing.T) {
	t.Parallel()

	homePath := t.TempDir()
	executablePath := "/tmp/flow-desktop"
	iconPNG := []byte{0x89, 0x50, 0x4e, 0x47}

	if err := writeLinuxDesktopIntegration(homePath, executablePath, iconPNG); err != nil {
		t.Fatalf("writeLinuxDesktopIntegration() error = %v", err)
	}

	desktopPath := filepath.Join(homePath, ".local", "share", "applications", "flow.desktop")
	iconPath := filepath.Join(homePath, ".local", "share", "icons", "hicolor", "1024x1024", "apps", "flow.png")

	desktopData, err := os.ReadFile(desktopPath)
	if err != nil {
		t.Fatalf("read desktop entry: %v", err)
	}
	iconData, err := os.ReadFile(iconPath)
	if err != nil {
		t.Fatalf("read icon file: %v", err)
	}

	if string(iconData) != string(iconPNG) {
		t.Fatalf("icon bytes mismatch: got %v want %v", iconData, iconPNG)
	}

	desktopContent := string(desktopData)
	if !strings.Contains(desktopContent, "Exec=/tmp/flow-desktop --mode desktop") {
		t.Fatalf("desktop entry missing executable command: %q", desktopContent)
	}
	if !strings.Contains(desktopContent, "StartupWMClass=flow") {
		t.Fatalf("desktop entry missing StartupWMClass=flow: %q", desktopContent)
	}
	if !strings.Contains(desktopContent, "Icon=flow") {
		t.Fatalf("desktop entry missing Icon=flow: %q", desktopContent)
	}
}

func TestWriteLinuxDesktopIntegrationEscapesSpacesInExecPath(t *testing.T) {
	t.Parallel()

	homePath := t.TempDir()
	executablePath := "/tmp/Flow Desktop/flow"

	if err := writeLinuxDesktopIntegration(homePath, executablePath, []byte{1}); err != nil {
		t.Fatalf("writeLinuxDesktopIntegration() error = %v", err)
	}

	desktopPath := filepath.Join(homePath, ".local", "share", "applications", "flow.desktop")
	desktopData, err := os.ReadFile(desktopPath)
	if err != nil {
		t.Fatalf("read desktop entry: %v", err)
	}

	if !strings.Contains(string(desktopData), `Exec=/tmp/Flow\ Desktop/flow --mode desktop`) {
		t.Fatalf("desktop entry did not escape executable path spaces: %q", string(desktopData))
	}
}
