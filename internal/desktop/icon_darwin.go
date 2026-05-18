//go:build darwin

package desktop

import _ "embed"

// macOSWindowIconPNG embeds the app icon used for macOS window and dock.
// The source image is frontend/src/assets/flow_logo_macos.png.
//
//go:embed assets/flow_logo_macos.png
var macOSWindowIconPNG []byte

// linuxWindowIcon returns nil on macOS; the Wails framework and system
// bundle (Info.plist/.icns) handle macOS window and dock icons natively.
func linuxWindowIcon() []byte {
	return nil
}
