package desktop

import "github.com/lex/flow/internal/workspace"

// Options contains runtime options for desktop mode startup.
type Options struct {
	// Global selects global workspace scope when true.
	Global bool
}

// RuntimeContext carries the resolved workspace and shared backend required by
// desktop runtime implementations.
type RuntimeContext struct {
	Root    workspace.Root
	Backend Backend

	// GlobalLocatorPath is the path to the global workspace locator file.
	// It is passed through to the HTTP API handler so workspace selection
	// features work correctly in the desktop window.
	GlobalLocatorPath string
}

// Run starts desktop mode using the build-tag selected implementation.
//
// - Default builds use the non-Wails stub.
// - Builds compiled with the "wails" tag can provide a desktop runtime.
func Run(options Options) error {
	runtimeContext, err := prepareRuntimeContext(options)
	if err != nil {
		return err
	}

	return runDesktopMode(runtimeContext)
}

func scopeLabel(scope workspace.Scope) string {
	if scope == workspace.GlobalScope {
		return "global"
	}

	return "local"
}
