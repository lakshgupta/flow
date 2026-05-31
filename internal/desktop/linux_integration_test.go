package desktop

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// makeTestIconPNG creates a minimal valid 64×64 RGBA PNG for use in tests.
// Using a real PNG lets the resize path run without falling back.
func makeTestIconPNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 64, 64))
	// Fill with a non-transparent colour so resize output is deterministic.
	for y := range 64 {
		for x := range 64 {
			img.Set(x, y, color.RGBA{R: 0x42, G: 0x84, B: 0xc6, A: 0xff})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("makeTestIconPNG: encode: %v", err)
	}
	return buf.Bytes()
}

func TestWriteLinuxDesktopIntegrationWritesDesktopEntryAndIcon(t *testing.T) {
	t.Parallel()

	homePath := t.TempDir()
	executablePath := "/tmp/flow-desktop"
	iconPNG := makeTestIconPNG(t)

	if err := writeLinuxDesktopIntegration(homePath, executablePath, iconPNG); err != nil {
		t.Fatalf("writeLinuxDesktopIntegration() error = %v", err)
	}

	desktopPath := filepath.Join(homePath, ".local", "share", "applications", "flow.desktop")

	// All standard hicolor sizes must be present.
	iconSizes := []string{"32x32", "48x48", "64x64", "128x128", "256x256", "512x512"}
	for _, sz := range iconSizes {
		iconPath := filepath.Join(homePath, ".local", "share", "icons", "hicolor", sz, "apps", "flow.png")
		data, err := os.ReadFile(iconPath)
		if err != nil {
			t.Fatalf("read %s icon: %v", sz, err)
		}
		if len(data) == 0 {
			t.Fatalf("%s icon file is empty", sz)
		}
	}

	desktopData, err := os.ReadFile(desktopPath)
	if err != nil {
		t.Fatalf("read desktop entry: %v", err)
	}

	if !strings.Contains(string(desktopData), "Exec=/tmp/flow-desktop --mode desktop") {
		t.Fatalf("desktop entry missing executable command: %q", string(desktopData))
	}
	if !strings.Contains(string(desktopData), "StartupWMClass=flow") {
		t.Fatalf("desktop entry missing StartupWMClass=flow: %q", string(desktopData))
	}
	// Icon= must point to the 256x256 absolute path so GNOME resolves it immediately.
	iconPath256 := filepath.Join(homePath, ".local", "share", "icons", "hicolor", "256x256", "apps", "flow.png")
	expectedIconField := "Icon=" + iconPath256
	if !strings.Contains(string(desktopData), expectedIconField) {
		t.Fatalf("desktop entry missing absolute Icon path: %q", string(desktopData))
	}
}

func TestWriteLinuxDesktopIntegrationResizesIconPerSize(t *testing.T) {
	t.Parallel()

	homePath := t.TempDir()
	iconPNG := makeTestIconPNG(t)

	if err := writeLinuxDesktopIntegration(homePath, "/tmp/flow", iconPNG); err != nil {
		t.Fatalf("writeLinuxDesktopIntegration() error = %v", err)
	}

	// Each icon file must decode to the matching square dimensions.
	cases := []struct {
		dir  string
		side int
	}{
		{"32x32", 32},
		{"48x48", 48},
		{"64x64", 64},
		{"128x128", 128},
		{"256x256", 256},
		{"512x512", 512},
	}

	for _, tc := range cases {
		iconPath := filepath.Join(homePath, ".local", "share", "icons", "hicolor", tc.dir, "apps", "flow.png")
		data, err := os.ReadFile(iconPath)
		if err != nil {
			t.Fatalf("read %s icon: %v", tc.dir, err)
		}
		img, err := png.Decode(bytes.NewReader(data))
		if err != nil {
			t.Fatalf("decode %s icon PNG: %v", tc.dir, err)
		}
		b := img.Bounds()
		if b.Dx() != tc.side || b.Dy() != tc.side {
			t.Fatalf("%s icon: expected %dx%d, got %dx%d", tc.dir, tc.side, tc.side, b.Dx(), b.Dy())
		}
	}
}

func TestWriteLinuxDesktopIntegrationEscapesSpacesInExecPath(t *testing.T) {
	t.Parallel()

	homePath := t.TempDir()
	executablePath := "/tmp/Flow Desktop/flow"

	if err := writeLinuxDesktopIntegration(homePath, executablePath, makeTestIconPNG(t)); err != nil {
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
