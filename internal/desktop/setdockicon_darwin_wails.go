//go:build darwin && wails

package desktop

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework AppKit

#import <AppKit/AppKit.h>

void setApplicationDockIcon(void* iconData, int iconDataLength) {
	if (iconData == NULL || iconDataLength <= 0) return;
	@autoreleasepool {
		NSData *data = [NSData dataWithBytes:iconData length:(NSUInteger)iconDataLength];
		NSImage *image = [[NSImage alloc] initWithData:data];
		if (image != nil) {
			[[NSApplication sharedApplication] setApplicationIconImage:image];
		}
	}
}
*/
import "C"
import "unsafe"

// applyMacOSDockIcon sets the macOS Dock and window-list icon from the
// embedded PNG. This is necessary when the app runs as a raw binary (outside
// a .app bundle), because macOS normally reads the icon from the bundle's
// Info.plist / .icns file. Calling setApplicationIconImage: overrides the
// system default at runtime on any launch method.
func applyMacOSDockIcon() {
	if len(macOSWindowIconPNG) == 0 {
		return
	}
	C.setApplicationDockIcon(unsafe.Pointer(&macOSWindowIconPNG[0]), C.int(len(macOSWindowIconPNG)))
}
