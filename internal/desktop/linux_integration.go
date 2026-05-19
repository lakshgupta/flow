package desktop

import (
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strings"
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

	// Write the icon into two standard hicolor sizes. 256x256 is the most
	// common size used by GNOME's icon-theme name resolver. 512x512 is
	// registered in the hicolor index for HiDPI (2× scaled) displays.
	// Both directories share the same high-resolution source PNG; the desktop
	// environment scales from whichever entry is the closest match.
	iconSizes := []string{"256x256", "512x512"}
	var primaryIconPath string // path used in Icon= (first / 256x256 entry)

	for i, size := range iconSizes {
		iconsDir := filepath.Join(homePath, ".local", "share", "icons", "hicolor", size, "apps")
		if err := os.MkdirAll(iconsDir, 0o755); err != nil {
			return err
		}
		iconPath := filepath.Join(iconsDir, "flow.png")
		if err := os.WriteFile(iconPath, iconPNG, 0o644); err != nil {
			return err
		}
		if i == 0 {
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
