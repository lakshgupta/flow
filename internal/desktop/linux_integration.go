package desktop

import (
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"strings"
)

const linuxDesktopEntryBody = `[Desktop Entry]
Version=1.0
Type=Application
Name=Flow
Comment=Flow workspace tool
Exec=%s --mode desktop
Icon=flow
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
	iconsDir := filepath.Join(homePath, ".local", "share", "icons", "hicolor", "1024x1024", "apps")
	desktopPath := filepath.Join(applicationsDir, "flow.desktop")
	iconPath := filepath.Join(iconsDir, "flow.png")

	if err := os.MkdirAll(applicationsDir, 0o755); err != nil {
		return err
	}
	if err := os.MkdirAll(iconsDir, 0o755); err != nil {
		return err
	}

	execValue := strings.ReplaceAll(executablePath, " ", `\ `)
	desktopData := fmt.Sprintf(linuxDesktopEntryBody, execValue)

	if err := os.WriteFile(desktopPath, []byte(desktopData), 0o644); err != nil {
		return err
	}

	if err := os.WriteFile(iconPath, iconPNG, 0o644); err != nil {
		return err
	}

	return nil
}
