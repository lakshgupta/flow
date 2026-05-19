package desktop

import (
	"bytes"
	"fmt"
	"image"
	"image/png"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strings"

	"golang.org/x/image/draw"
)

// linuxDesktopEntryBody is the template for the freedesktop .desktop entry.
// Icon uses an absolute path so GNOME can resolve it immediately without
// waiting for gtk-update-icon-cache to register the themed name.
const linuxDesktopEntryBody = `[Desktop Entry]
Version=1.0
Type=Application
Name=Flow
Comment=Flow workspace tool
Exec=%s --mode desktop
Icon=%s
Terminal=false
Categories=Productivity;Development;
StartupWMClass=flow
`

func ensureLinuxDesktopIntegration(iconPNG []byte) error {
	homePath, err := os.UserHomeDir()
	if err != nil || strings.TrimSpace(homePath) == "" {
		currentUser, userErr := user.Current()
		if userErr != nil || strings.TrimSpace(currentUser.HomeDir) == "" {
			if err != nil {
				return err
			}
			return userErr
		}
		homePath = currentUser.HomeDir
	}

	executablePath, err := os.Executable()
	if err != nil {
		return err
	}

	return writeLinuxDesktopIntegration(homePath, executablePath, iconPNG)
}

func writeLinuxDesktopIntegration(homePath string, executablePath string, iconPNG []byte) error {
	if strings.TrimSpace(homePath) == "" {
		return fmt.Errorf("home path is required")
	}
	if strings.TrimSpace(executablePath) == "" {
		return fmt.Errorf("executable path is required")
	}
	if len(iconPNG) == 0 {
		return fmt.Errorf("icon is required")
	}

	applicationsDir := filepath.Join(homePath, ".local", "share", "applications")

	// Write the icon at every standard hicolor size. Providing size-specific
	// images prevents the desktop environment from upscaling a large PNG for
	// small display sizes (title bar, app switcher, panel), which can make the
	// icon appear blurry or tiny. Using CatmullRom downscaling keeps edges
	// crisp at each target resolution.
	//
	// freedesktop hicolor theme standard sizes (pixels):
	iconSizes := []struct {
		name string // hicolor directory name, e.g. "48x48"
		px   int    // pixel dimension of the square output
	}{
		{"32x32", 32},
		{"48x48", 48},
		{"64x64", 64},
		{"128x128", 128},
		{"256x256", 256},
		{"512x512", 512},
	}
	var primaryIconPath string // absolute path used in Icon= (256x256 entry)

	// Decode the source PNG once; all size variants are derived from it.
	srcImg, decErr := png.Decode(bytes.NewReader(iconPNG))
	if decErr != nil {
		// Non-fatal: fall back to writing the raw bytes without resizing.
		srcImg = nil
	}

	for _, sz := range iconSizes {
		iconsDir := filepath.Join(homePath, ".local", "share", "icons", "hicolor", sz.name, "apps")
		if err := os.MkdirAll(iconsDir, 0o755); err != nil {
			return err
		}
		iconPath := filepath.Join(iconsDir, "flow.png")

		var iconData []byte
		if srcImg != nil {
			resized, resizeErr := resizePNG(srcImg, sz.px)
			if resizeErr != nil {
				iconData = iconPNG // fall back to full-res bytes
			} else {
				iconData = resized
			}
		} else {
			iconData = iconPNG
		}

		if err := os.WriteFile(iconPath, iconData, 0o644); err != nil {
			return err
		}
		if sz.name == "256x256" {
			primaryIconPath = iconPath
		}
	}

	desktopPath := filepath.Join(applicationsDir, "flow.desktop")

	if err := os.MkdirAll(applicationsDir, 0o755); err != nil {
		return err
	}

	// Use an absolute path for Icon= so GNOME resolves it immediately without
	// requiring a gtk-update-icon-cache run. This is fully supported by the
	// freedesktop spec and takes effect as soon as the .desktop file is written.
	execValue := strings.ReplaceAll(executablePath, " ", `\ `)
	desktopData := fmt.Sprintf(linuxDesktopEntryBody, execValue, primaryIconPath)

	if err := os.WriteFile(desktopPath, []byte(desktopData), 0o644); err != nil {
		return err
	}

	// Refresh caches best-effort so the themed name "flow" also resolves for
	// launchers that use icon-theme lookup rather than the absolute path.
	_ = exec.Command("gtk-update-icon-cache", "-qtf",
		filepath.Join(homePath, ".local", "share", "icons", "hicolor")).Run()
	_ = exec.Command("update-desktop-database", "-q", applicationsDir).Run()

	return nil
}

// resizePNG scales src to a square image with the given pixel side length and
// returns the PNG-encoded bytes. CatmullRom interpolation is used for
// high-quality downscaling (similar to Lanczos; available in
// golang.org/x/image/draw without any C dependencies).
func resizePNG(src image.Image, side int) ([]byte, error) {
	dst := image.NewRGBA(image.Rect(0, 0, side, side))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
	var buf bytes.Buffer
	if err := png.Encode(&buf, dst); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
