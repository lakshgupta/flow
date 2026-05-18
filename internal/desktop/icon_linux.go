package desktop

import _ "embed"

// linuxWindowIconPNG embeds the app icon used for Linux desktop windows.
// The source image is copied from frontend/src/assets/flow_logo_linux.png.
//
//go:embed assets/flow_logo_linux.png
var linuxWindowIconPNG []byte

func linuxWindowIcon() []byte {
	return linuxWindowIconPNG
}
