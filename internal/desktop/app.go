package desktop

import (
	"context"

	"github.com/lex/flow/internal/config"
	"github.com/lex/flow/internal/core"
	"github.com/lex/flow/internal/index"
	"github.com/lex/flow/internal/markdown"
)

// App is the Wails-facing application facade. It deliberately stays thin and
// delegates all behavior to the shared backend so the UI layer can bind a
// stable object without duplicating transport logic.
type App struct {
	backend Backend

	// ctx is the Wails runtime context, set by startup() when the window is
	// ready. It is used to emit events back to the frontend.
	ctx context.Context //nolint:containedctx
}

// NewApp constructs a desktop app facade around the shared backend.
func NewApp(backend Backend) App {
	return App{backend: backend}
}

// startup is called by the Wails runtime after the window is ready. The
// context enables the App to emit events to the frontend via the Wails
// runtime API (e.g. runtime.EventsEmit).
func (app *App) startup(ctx context.Context) {
	app.ctx = ctx
}

// WorkspaceConfig returns the current workspace GUI configuration.
func (app *App) WorkspaceConfig() (config.Workspace, error) {
	return app.backend.WorkspaceConfig()
}

// Documents returns the workspace documents used by sidebar and list views.
func (app *App) Documents() ([]markdown.WorkspaceDocument, error) {
	return app.backend.Documents()
}

// Search delegates to the shared backend search query.
func (app *App) Search(query string, limit int) ([]index.SearchResult, error) {
	return app.backend.Search(query, limit)
}

// NodeView returns one node projection for the current workspace.
func (app *App) NodeView(id string, graphPath string) (index.NodeView, error) {
	return app.backend.NodeView(id, graphPath)
}

// GraphCanvas returns the selected graph canvas snapshot used by the main
// desktop editing surface.
func (app *App) GraphCanvas(selectedGraph string) (GraphCanvasSnapshot, error) {
	return app.backend.GraphCanvas(selectedGraph)
}

// GraphTree returns the sidebar tree snapshot used by the desktop workspace
// browser.
func (app *App) GraphTree() (GraphTreeSnapshot, error) {
	return app.backend.GraphTree()
}

// CreateDocument delegates document creation to the shared backend.
func (app *App) CreateDocument(request core.CreateDocumentRequest) (markdown.WorkspaceDocument, error) {
	return app.backend.CreateDocument(request)
}

// UpdateDocument delegates document updates to the shared backend.
func (app *App) UpdateDocument(request core.UpdateDocumentRequest) (markdown.WorkspaceDocument, error) {
	return app.backend.UpdateDocument(request)
}

// DeleteDocument delegates document deletion to the shared backend.
func (app *App) DeleteDocument(request core.DeleteDocumentRequest) (string, error) {
	return app.backend.DeleteDocument(request)
}
