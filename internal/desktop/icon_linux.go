//go:build linux

package desktop

import _ "embed"

// linuxWindowIconPNG embeds the app icon used for Linux window managers and taskbars.
// The source image is frontend/src/assets/flow_logo_linux.png.
// GNOME/Wayland resolves taskbar icons from .desktop metadata and embedded icons.
//
//go:embed assets/flow_logo_linux.png
var linuxWindowIconPNG []byte

func linuxWindowIcon() []byte {
	return linuxWindowIconPNG
}
