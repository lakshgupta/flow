//go:build windows

package desktop

// linuxWindowIcon returns nil on Windows; the Wails framework and system
// bundle handle Windows window/taskbar icons via the executable manifest and resources.
func linuxWindowIcon() []byte {
	return nil
}
