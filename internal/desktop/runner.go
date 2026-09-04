package desktop

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/lex/flow/internal/httpapi"
	"github.com/lex/flow/internal/logging"
	"github.com/lex/flow/internal/workspace"
)

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

	// Desktop runs have no parent process redirecting stdout/stderr, so file
	// logging is the only durable trail: daily files under .flow/logs with
	// 15-day retention. Failures are non-fatal (best-effort logging).
	stopLogging, logErr := logging.Setup(guiLogsPath(runtimeContext.Root))
	if logErr != nil {
		fmt.Printf("flow desktop: warning: file logging unavailable: %v\n", logErr)
	} else {
		defer stopLogging()
	}

	err = runDesktopMode(runtimeContext)
	if err != nil && strings.Contains(err.Error(), "Wails integration is not wired yet") {
		// Fallback for CLI-only builds (go build without -tags wails): serve the
		// embedded frontend via the standard HTTP handler so `flow desktop`
		// remains usable as a browser service. This keeps the release archive
		// usable on hosts without webkit/wails and fixes the scaffold error
		// reported for `flow -g desktop`.
		fmt.Printf("flow desktop: Wails not compiled in (%s scope at %s) — falling back to browser service\n", scopeLabel(runtimeContext.Root.Scope), runtimeContext.Root.WorkspacePath)
		handler, handlerErr := httpapi.NewMux(httpapi.Options{
			Root:              runtimeContext.Root,
			LaunchScope:       runtimeContext.Root.Scope,
			GlobalLocatorPath: runtimeContext.GlobalLocatorPath,
		})
		if handlerErr != nil {
			return fmt.Errorf("prepare desktop fallback handler: %w", handlerErr)
		}
		workspaceConfig, cfgErr := workspace.ReadOrDefaultConfig(runtimeContext.Root.ConfigPath)
		if cfgErr != nil {
			return fmt.Errorf("read workspace config: %w", cfgErr)
		}
		addr := fmt.Sprintf("127.0.0.1:%d", workspaceConfig.GUI.Port)
		fmt.Printf("flow desktop fallback: serving %s workspace at http://%s\n", runtimeContext.Root.Scope, addr)
		return http.ListenAndServe(addr, handler)
	}

	return err
}

// guiLogsPath returns the workspace logs directory used by both service and
// desktop surfaces.
func guiLogsPath(root workspace.Root) string {
	return filepath.Join(root.FlowPath, "logs")
}

func scopeLabel(scope workspace.Scope) string {
	if scope == workspace.GlobalScope {
		return "global"
	}

	return "local"
}
