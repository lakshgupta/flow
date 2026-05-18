//go:build !wails

package desktop

import "fmt"

// runDesktopMode is the default non-Wails implementation.
// It keeps desktop mode explicit until Wails runtime wiring is added.
func runDesktopMode(runtimeContext RuntimeContext) error {
	return fmt.Errorf("desktop mode scaffold is enabled for %s scope at %s, but Wails integration is not wired yet", scopeLabel(runtimeContext.Root.Scope), runtimeContext.Root.WorkspacePath)
}
