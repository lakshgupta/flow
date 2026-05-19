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
	// Icon= uses the 256x256 path; 512x512 is written for HiDPI coverage.
	iconPath256 := filepath.Join(homePath, ".local", "share", "icons", "hicolor", "256x256", "apps", "flow.png")
	iconPath512 := filepath.Join(homePath, ".local", "share", "icons", "hicolor", "512x512", "apps", "flow.png")

	desktopData, err := os.ReadFile(desktopPath)
	if err != nil {
		t.Fatalf("read desktop entry: %v", err)
	}
	iconData256, err := os.ReadFile(iconPath256)
	if err != nil {
		t.Fatalf("read 256x256 icon file: %v", err)
	}
	iconData512, err := os.ReadFile(iconPath512)
	if err != nil {
		t.Fatalf("read 512x512 icon file: %v", err)
	}

	if string(iconData256) != string(iconPNG) {
		t.Fatalf("256x256 icon bytes mismatch: got %v want %v", iconData256, iconPNG)
	}
	if string(iconData512) != string(iconPNG) {
		t.Fatalf("512x512 icon bytes mismatch: got %v want %v", iconData512, iconPNG)
	}

	desktopContent := string(desktopData)
	if !strings.Contains(desktopContent, "Exec=/tmp/flow-desktop --mode desktop") {
		t.Fatalf("desktop entry missing executable command: %q", desktopContent)
	}
	if !strings.Contains(desktopContent, "StartupWMClass=flow") {
		t.Fatalf("desktop entry missing StartupWMClass=flow: %q", desktopContent)
	}
	// Icon= must point to the 256x256 absolute path so GNOME resolves it immediately.
	expectedIconField := "Icon=" + iconPath256
	if !strings.Contains(desktopContent, expectedIconField) {
		t.Fatalf("desktop entry missing absolute Icon path: %q", desktopContent)
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
