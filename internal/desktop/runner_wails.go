//go:build wails

package desktop

import (
	"context"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/lex/flow/internal/httpapi"
)

// runDesktopMode is the Wails runtime entrypoint compiled in when the binary is
// built with the "wails" tag. It reuses the existing httpapi.NewMux handler as
// the Wails asset server so the React frontend works without modification — all
// HTTP API calls are served by the same handler used in server mode.
func runDesktopMode(runtimeContext RuntimeContext) error {
	app := NewApp(runtimeContext.Backend)

	// Build the HTTP handler that serves both the embedded frontend assets and
	// the /api/* routes. This is identical to what the server mode uses, which
	// means the React app runs without any code changes in the desktop window.
	apiHandler, err := httpapi.NewMux(httpapi.Options{
		Root:              runtimeContext.Root,
		LaunchScope:       runtimeContext.Root.Scope,
		GlobalLocatorPath: runtimeContext.GlobalLocatorPath,
		// Stop quits the Wails window from within the HTTP API (e.g. when the
		// user selects a different workspace and the app needs to restart).
		Stop: func() error {
			if app.ctx != nil {
				wailsruntime.Quit(app.ctx)
			}
			return nil
		},
	})
	if err != nil {
		return err
	}

	return wails.Run(&options.App{
		Title:     "Flow",
		Width:     1280,
		Height:    800,
		MinWidth:  800,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			// The httpapi handler serves both the SPA assets and /api/* routes,
			// so Wails acts purely as the window host.
			Handler: apiHandler,
		},
		// OnStartup stores the Wails context so the App can emit events back to
		// the frontend once the window is ready.
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
		},
		// Bind exposes App methods to the frontend via the Wails JS bridge.
		// The React app currently uses HTTP calls exclusively, but binding App
		// here future-proofs for native Wails RPC if needed.
		Bind: []interface{}{&app},
		Linux: &linux.Options{
			// OnDemand avoids GPU driver issues on headless CI while still
			// using hardware acceleration on real desktops.
			WebviewGpuPolicy: linux.WebviewGpuPolicyOnDemand,
		},
	})
}
