//go:build darwin && !wails

package desktop

// applyMacOSDockIcon is a no-op in non-Wails (server-mode) darwin builds.
// The real implementation lives in setdockicon_darwin_wails.go and is compiled
// only when the "wails" build tag is present.
func applyMacOSDockIcon() {}
