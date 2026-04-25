package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/lex/flow/internal/config"
	"github.com/lex/flow/internal/graph"
	"github.com/lex/flow/internal/index"
	"github.com/lex/flow/internal/markdown"
	"github.com/lex/flow/internal/workspace"
)

func TestNewMuxServesWorkspaceAndReadQueryAPIs(t *testing.T) {
	t.Parallel()

	root := createHTTPAPITestWorkspace(t)
	stopCalled := false
	handler, err := NewMux(Options{
		Root: root,
		Stop: func() error {
			stopCalled = true
			return nil
		},
	})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	workspaceResponse := performJSONRequest[workspaceResponse](t, handler, http.MethodGet, "/api/workspace")
	if workspaceResponse.WorkspacePath != root.WorkspacePath {
		t.Fatalf("workspaceResponse.WorkspacePath = %q, want %q", workspaceResponse.WorkspacePath, root.WorkspacePath)
	}
	if workspaceResponse.GUIPort != 4812 {
		t.Fatalf("workspaceResponse.GUIPort = %d, want 4812", workspaceResponse.GUIPort)
	}
	if workspaceResponse.HomePath != "data/home.md" {
		t.Fatalf("workspaceResponse.HomePath = %q, want data/home.md", workspaceResponse.HomePath)
	}

	graphCanvas := performJSONRequest[graph.GraphCanvasView](t, handler, http.MethodGet, "/api/graph-canvas?graph=release")
	if graphCanvas.SelectedGraph != "release" {
		t.Fatalf("graphCanvas.SelectedGraph = %q, want release", graphCanvas.SelectedGraph)
	}
	if len(graphCanvas.Nodes) != 1 || graphCanvas.Nodes[0].ID != "cmd-1" {
		t.Fatalf("graphCanvas.Nodes = %#v, want release command node", graphCanvas.Nodes)
	}

	layoutUpdate := performJSONRequestWithBody[graphLayoutResponse](t, handler, http.MethodPut, "/api/graph-layout", map[string]any{
		"graph": "release",
		"positions": []map[string]any{{
			"documentId": "cmd-1",
			"x":          512,
			"y":          224,
		}},
	})
	if layoutUpdate.Graph != "release" || len(layoutUpdate.Positions) != 1 {
		t.Fatalf("layoutUpdate = %#v, want release update payload", layoutUpdate)
	}
	graphCanvas = performJSONRequest[graph.GraphCanvasView](t, handler, http.MethodGet, "/api/graph-canvas?graph=release")
	if !graphCanvas.Nodes[0].PositionPersisted || graphCanvas.Nodes[0].Position.X != 512 || graphCanvas.Nodes[0].Position.Y != 224 {
		t.Fatalf("graphCanvas.Nodes[0] = %#v, want persisted release layout", graphCanvas.Nodes[0])
	}

	document := performJSONRequest[documentResponse](t, handler, http.MethodGet, "/api/documents/note-1")
	if document.ID != "note-1" {
		t.Fatalf("document.ID = %q, want note-1", document.ID)
	}
	if len(document.RelatedNoteIDs) != 1 || document.RelatedNoteIDs[0] != "note-2" {
		t.Fatalf("document.RelatedNoteIDs = %#v, want [note-2]", document.RelatedNoteIDs)
	}

	results := performJSONRequest[[]index.SearchResult](t, handler, http.MethodGet, "/api/search?q=parser")
	if len(results) != 1 || results[0].ID != "task-1" {
		t.Fatalf("search results = %#v, want task-1 match", results)
	}

	stopResponse := performJSONRequest[map[string]bool](t, handler, http.MethodPost, "/api/gui/stop")
	if !stopCalled {
		t.Fatal("stop callback was not called")
	}
	if !stopResponse["stopping"] {
		t.Fatalf("stopResponse = %#v, want stopping=true", stopResponse)
	}
}

func TestNewMuxServesHomeAndGraphTreeAPIs(t *testing.T) {
	t.Parallel()

	root := createGraphTreeHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	workspaceResponse := performJSONRequest[workspaceResponse](t, handler, http.MethodGet, "/api/workspace")
	if workspaceResponse.PanelWidths.LeftRatio != 0.31 || workspaceResponse.PanelWidths.RightRatio != 0.22 || workspaceResponse.PanelWidths.DocumentTOCRatio != config.DefaultDocumentTOCRatio {
		t.Fatalf("workspaceResponse.PanelWidths = %#v, want 0.31/0.22/default toc", workspaceResponse.PanelWidths)
	}

	home := performJSONRequest[homeResponse](t, handler, http.MethodGet, "/api/home")
	if home.ID != "home" || home.Type != "home" || home.Path != "data/home.md" {
		t.Fatalf("home = %#v", home)
	}
	if home.Body != "# Home\n" {
		t.Fatalf("home.Body = %q, want default home body", home.Body)
	}
	if home.Description != "" {
		t.Fatalf("home.Description = %q, want empty", home.Description)
	}

	graphTree := performJSONRequest[graphTreeResponse](t, handler, http.MethodGet, "/api/graphs")
	if graphTree.Home.Path != "data/home.md" {
		t.Fatalf("graphTree.Home = %#v", graphTree.Home)
	}
	if len(graphTree.Graphs) != 2 {
		t.Fatalf("len(graphTree.Graphs) = %d, want 2", len(graphTree.Graphs))
	}

	if graphTree.Graphs[0].GraphPath != "execution" || graphTree.Graphs[0].DirectCount != 1 || graphTree.Graphs[0].TotalCount != 2 || !graphTree.Graphs[0].HasChildren {
		t.Fatalf("graphTree.Graphs[0] = %#v", graphTree.Graphs[0])
	}
	if graphTree.Graphs[0].CountLabel != "1 direct / 2 total" {
		t.Fatalf("graphTree.Graphs[0].CountLabel = %q", graphTree.Graphs[0].CountLabel)
	}
	if len(graphTree.Graphs[0].Files) != 1 || graphTree.Graphs[0].Files[0].ID != "task-1" || graphTree.Graphs[0].Files[0].FileName != "build.md" {
		t.Fatalf("graphTree.Graphs[0].Files = %#v, want execution/build.md task", graphTree.Graphs[0].Files)
	}

	if graphTree.Graphs[1].GraphPath != "execution/parser" || graphTree.Graphs[1].DirectCount != 1 || graphTree.Graphs[1].TotalCount != 1 || graphTree.Graphs[1].HasChildren {
		t.Fatalf("graphTree.Graphs[1] = %#v", graphTree.Graphs[1])
	}
	if len(graphTree.Graphs[1].Files) != 1 || graphTree.Graphs[1].Files[0].ID != "cmd-1" || graphTree.Graphs[1].Files[0].FileName != "parse.md" {
		t.Fatalf("graphTree.Graphs[1].Files = %#v, want execution/parser/parse.md command", graphTree.Graphs[1].Files)
	}

	results := performJSONRequest[[]index.SearchResult](t, handler, http.MethodGet, "/api/search?q=home")
	if len(results) != 1 {
		t.Fatalf("len(results) = %d, want 1", len(results))
	}
	if results[0].ID != "home" || results[0].Type != "home" {
		t.Fatalf("results[0] = %#v, want home search result", results[0])
	}
	if results[0].Description != "" {
		t.Fatalf("results[0].Description = %q, want empty", results[0].Description)
	}

	document := performJSONRequest[documentResponse](t, handler, http.MethodGet, "/api/documents/task-1")
	if document.Description != "Build graph task" {
		t.Fatalf("document.Description = %q, want Build graph task", document.Description)
	}
}

func TestNewMuxUpdatesHomeAndReindexes(t *testing.T) {
	t.Parallel()

	root := createGraphTreeHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	updated := performJSONRequestWithBody[homeResponse](t, handler, http.MethodPut, "/api/home", map[string]any{
		"title":       "Workspace Home",
		"description": "Workspace overview",
		"body":        "# Workspace Home\n\nStart here.\n",
	})
	if updated.Title != "Workspace Home" {
		t.Fatalf("updated.Title = %q, want Workspace Home", updated.Title)
	}
	if updated.Description != "Workspace overview" {
		t.Fatalf("updated.Description = %q, want Workspace overview", updated.Description)
	}
	if updated.Body != "# Workspace Home\n\nStart here.\n" {
		t.Fatalf("updated.Body = %q, want updated body", updated.Body)
	}

	stored, err := os.ReadFile(root.HomePath)
	if err != nil {
		t.Fatalf("ReadFile(home) error = %v", err)
	}
	if !strings.Contains(string(stored), "type: home") || !strings.Contains(string(stored), "description: Workspace overview") {
		t.Fatalf("stored home markdown = %q, want canonical home frontmatter", string(stored))
	}

	results := performJSONRequest[[]index.SearchResult](t, handler, http.MethodGet, "/api/search?q=overview")
	if len(results) != 1 || results[0].ID != "home" {
		t.Fatalf("results = %#v, want reindexed home match", results)
	}
	if results[0].Description != "Workspace overview" {
		t.Fatalf("results[0].Description = %q, want Workspace overview", results[0].Description)
	}
}

func TestNewMuxServesCalendarDocumentsAcrossWorkspace(t *testing.T) {
	t.Parallel()

	root := createCalendarHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	documents := performJSONRequest[[]calendarDocumentResponse](t, handler, http.MethodGet, "/api/calendar-documents")
	if len(documents) != 3 {
		t.Fatalf("len(documents) = %d, want 3", len(documents))
	}

	byID := map[string]calendarDocumentResponse{}
	for _, document := range documents {
		byID[document.ID] = document
	}

	if byID["home"].Body != "## 2026-04-19\nHome planning\n" {
		t.Fatalf("home body = %q, want dated home content", byID["home"].Body)
	}
	if byID["home"].Graph != "" {
		t.Fatalf("home graph = %q, want empty graph", byID["home"].Graph)
	}
	if byID["note-1"].Graph != "execution" || byID["note-1"].Body != "## 2026-04-19\nExecution note\n" {
		t.Fatalf("note-1 = %#v, want execution dated note", byID["note-1"])
	}
	if byID["task-1"].Graph != "planning" || byID["task-1"].Body != "## 2026-04-20\nPlanning task\n" {
		t.Fatalf("task-1 = %#v, want planning dated task", byID["task-1"])
	}
}

func TestNewMuxUpdatesWorkspacePanelWidths(t *testing.T) {
	t.Parallel()

	root := createGraphTreeHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	updated := performJSONRequestWithBody[workspaceResponse](t, handler, http.MethodPut, "/api/workspace", map[string]any{
		"appearance": "dark",
		"panelWidths": map[string]any{
			"leftRatio":        0.27,
			"rightRatio":       0.21,
			"documentTOCRatio": 0.24,
		},
	})
	if updated.PanelWidths.LeftRatio != 0.27 || updated.PanelWidths.RightRatio != 0.21 || updated.PanelWidths.DocumentTOCRatio != 0.24 {
		t.Fatalf("updated.PanelWidths = %#v, want 0.27/0.21/0.24", updated.PanelWidths)
	}
	if updated.Appearance != "dark" {
		t.Fatalf("updated.Appearance = %q, want dark", updated.Appearance)
	}

	storedConfig, err := config.Read(root.ConfigPath)
	if err != nil {
		t.Fatalf("config.Read() error = %v", err)
	}
	if storedConfig.GUI.PanelWidths.LeftRatio != 0.27 || storedConfig.GUI.PanelWidths.RightRatio != 0.21 || storedConfig.GUI.PanelWidths.DocumentTOCRatio != 0.24 {
		t.Fatalf("storedConfig.GUI.PanelWidths = %#v, want 0.27/0.21/0.24", storedConfig.GUI.PanelWidths)
	}
	if storedConfig.GUI.Appearance != "dark" {
		t.Fatalf("storedConfig.GUI.Appearance = %q, want dark", storedConfig.GUI.Appearance)
	}
}

func TestNewMuxGraphTreeRebuildsMissingIndex(t *testing.T) {
	t.Parallel()

	root := createGraphTreeHTTPAPITestWorkspace(t)
	if err := os.Remove(root.IndexPath); err != nil {
		t.Fatalf("Remove(index) error = %v", err)
	}

	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	graphTree := performJSONRequest[graphTreeResponse](t, handler, http.MethodGet, "/api/graphs")
	if len(graphTree.Graphs) != 2 {
		t.Fatalf("len(graphTree.Graphs) = %d, want 2", len(graphTree.Graphs))
	}
	if _, err := os.Stat(root.IndexPath); err != nil {
		t.Fatalf("Stat(index) error = %v", err)
	}
}

func TestNewMuxRejectsUnknownOrInvalidAPIRequests(t *testing.T) {
	t.Parallel()

	root := createHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	assertStatus(t, handler, http.MethodGet, "/api/graph-canvas", http.StatusBadRequest)
	assertStatus(t, handler, http.MethodGet, "/api/graph-canvas?graph=missing", http.StatusBadRequest)
	assertStatusWithBody(t, handler, http.MethodPut, "/api/graph-layout", map[string]any{"graph": "", "positions": []map[string]any{{"documentId": "cmd-1", "x": 1, "y": 2}}}, http.StatusBadRequest)
	assertStatusWithBody(t, handler, http.MethodPut, "/api/graph-layout", map[string]any{"graph": "release", "positions": []map[string]any{}}, http.StatusBadRequest)
	assertStatusWithBody(t, handler, http.MethodPut, "/api/graph-layout", map[string]any{"graph": "release", "positions": []map[string]any{{"documentId": "missing", "x": 1, "y": 2}}}, http.StatusBadRequest)
	assertStatus(t, handler, http.MethodGet, "/api/search", http.StatusBadRequest)
	assertStatus(t, handler, http.MethodGet, "/api/search?limit=bad", http.StatusBadRequest)
	assertStatus(t, handler, http.MethodGet, "/api/documents/missing", http.StatusNotFound)
	assertStatusWithBody(t, handler, http.MethodPost, "/api/documents", map[string]any{"type": "task"}, http.StatusBadRequest)
	assertStatusWithBody(t, handler, http.MethodPut, "/api/documents/missing", map[string]any{"title": "Updated"}, http.StatusNotFound)
	assertStatus(t, handler, http.MethodDelete, "/api/documents/missing", http.StatusNotFound)
	assertStatus(t, handler, http.MethodPost, "/api/gui/stop", http.StatusNotImplemented)
	assertStatus(t, handler, http.MethodGet, "/api/unknown", http.StatusNotFound)
}

func TestNewMuxSearchRebuildsMissingIndex(t *testing.T) {
	t.Parallel()

	root := createHTTPAPITestWorkspaceWithoutIndex(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	results := performJSONRequest[[]index.SearchResult](t, handler, http.MethodGet, "/api/search?q=parser")
	if len(results) != 1 || results[0].ID != "task-1" {
		t.Fatalf("search results = %#v, want task-1 match", results)
	}

	if _, err := os.Stat(root.IndexPath); err != nil {
		t.Fatalf("Stat(index) error = %v", err)
	}
}

func TestNewMuxMutatesDocumentsAndReindexes(t *testing.T) {
	t.Parallel()

	root := createHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	created := performJSONRequestWithBody[documentResponse](t, handler, http.MethodPost, "/api/documents", map[string]any{
		"type":        "task",
		"featureSlug": "demo",
		"fileName":    "publish",
		"id":          "task-2",
		"graph":       "release",
		"title":       "Publish release",
		"status":      "todo",
		"dependsOn":   []string{"task-1"},
		"links":       []map[string]any{{"node": "note-1"}},
		"body":        "Publish task body\n",
	})
	if created.ID != "task-2" || created.Path != "data/content/release/publish.md" {
		t.Fatalf("created = %#v", created)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "release", "publish.md")); err != nil {
		t.Fatalf("Stat(created file) error = %v", err)
	}

	updated := performJSONRequestWithBody[documentResponse](t, handler, http.MethodPut, "/api/documents/task-2", map[string]any{
		"title":  "Publish release build",
		"status": "done",
		"body":   "Updated publish task body\n",
	})
	if updated.Title != "Publish release build" || updated.Status != "done" {
		t.Fatalf("updated = %#v", updated)
	}

	renamed := performJSONRequestWithBody[documentResponse](t, handler, http.MethodPut, "/api/documents/task-2", map[string]any{
		"fileName": "publish-release",
	})
	if renamed.Path != "data/content/release/publish-release.md" {
		t.Fatalf("renamed = %#v", renamed)
	}

	results := performJSONRequest[[]index.SearchResult](t, handler, http.MethodGet, "/api/search?q=publish")
	if len(results) != 1 || results[0].ID != "task-2" {
		t.Fatalf("search results = %#v, want task-2 match", results)
	}

	deleted := performJSONRequest[deleteDocumentResponse](t, handler, http.MethodDelete, "/api/documents/task-2")
	if !deleted.Deleted || deleted.ID != "task-2" {
		t.Fatalf("deleted = %#v", deleted)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "release", "publish-release.md")); !os.IsNotExist(err) {
		t.Fatalf("Stat(deleted file) error = %v, want not exist", err)
	}

	assertStatus(t, handler, http.MethodGet, "/api/documents/task-2", http.StatusNotFound)
	results = performJSONRequest[[]index.SearchResult](t, handler, http.MethodGet, "/api/search?q=publish")
	if len(results) != 0 {
		t.Fatalf("search results = %#v, want empty after delete", results)
	}
}

func TestNewMuxRenamesGraphsAndReindexes(t *testing.T) {
	t.Parallel()

	root := createHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	renamed := performJSONRequestWithBody[createGraphResponse](t, handler, http.MethodPatch, "/api/graphs/execution", map[string]any{
		"name": "delivery/execution",
	})
	if renamed.Name != "delivery/execution" {
		t.Fatalf("renamed = %#v", renamed)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "delivery", "execution", "parser.md")); err != nil {
		t.Fatalf("Stat(renamed graph file) error = %v", err)
	}
	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "content", "execution")); !os.IsNotExist(err) {
		t.Fatalf("Stat(old graph directory) error = %v, want not exist", err)
	}

	tree := performJSONRequest[graphTreeResponse](t, handler, http.MethodGet, "/api/graphs")
	paths := make([]string, 0, len(tree.Graphs))
	for _, node := range tree.Graphs {
		paths = append(paths, node.GraphPath)
	}
	if !slices.Contains(paths, "delivery/execution") {
		t.Fatalf("graph paths = %#v, want delivery/execution", paths)
	}
}

func TestNewMuxDeleteNoteCleansUpReferences(t *testing.T) {
	t.Parallel()

	root := createHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	deleted := performJSONRequest[deleteDocumentResponse](t, handler, http.MethodDelete, "/api/documents/note-1")
	if !deleted.Deleted || deleted.ID != "note-1" {
		t.Fatalf("deleted = %#v", deleted)
	}

	followUp := performJSONRequest[documentResponse](t, handler, http.MethodGet, "/api/documents/note-2")
	if len(followUp.Links) != 0 {
		t.Fatalf("followUp.Links = %#v, want empty", followUp.Links)
	}
	if len(followUp.RelatedNoteIDs) != 0 {
		t.Fatalf("followUp.RelatedNoteIDs = %#v, want empty", followUp.RelatedNoteIDs)
	}

	task := performJSONRequest[documentResponse](t, handler, http.MethodGet, "/api/documents/task-1")
	if len(task.Links) != 0 {
		t.Fatalf("task.Links = %#v, want empty", task.Links)
	}

	assertStatus(t, handler, http.MethodGet, "/api/documents/note-1", http.StatusNotFound)
	results := performJSONRequest[[]index.SearchResult](t, handler, http.MethodGet, "/api/search?q=architecture")
	for _, result := range results {
		if result.ID == "note-1" {
			t.Fatalf("search results still include deleted note: %#v", results)
		}
	}
}

func TestNewMuxServesEmbeddedIndexHTML(t *testing.T) {
	t.Parallel()

	handler, err := NewMux(Options{})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}

	if body := recorder.Body.String(); body == "" || !containsRootDiv(body) {
		t.Fatalf("body = %q, want embedded index html", body)
	}
}

func TestNewMuxUsesFrontendJSONFieldNamesForGraphViews(t *testing.T) {
	t.Parallel()

	root := createHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	graphCanvasPayload := performRawRequest(t, handler, http.MethodGet, "/api/graph-canvas?graph=release")
	assertJSONHasPath(t, graphCanvasPayload, "selectedGraph")
	assertJSONHasPath(t, graphCanvasPayload, "layerGuidance.magneticThresholdPx")
	assertJSONHasPath(t, graphCanvasPayload, "layerGuidance.guides.0.x")
	assertJSONHasPath(t, graphCanvasPayload, "nodes.0.position.x")
	assertJSONHasPath(t, graphCanvasPayload, "nodes.0.positionPersisted")
	assertJSONHasPath(t, graphCanvasPayload, "edges")

	graphLayoutPayload := performRawRequestWithBody(t, handler, http.MethodPut, "/api/graph-layout", map[string]any{
		"graph": "release",
		"positions": []map[string]any{{
			"documentId": "cmd-1",
			"x":          440,
			"y":          180,
		}},
	})
	assertJSONHasPath(t, graphLayoutPayload, "graph")
	assertJSONHasPath(t, graphLayoutPayload, "positions.0.documentId")
	assertJSONHasPath(t, graphLayoutPayload, "positions.0.x")

	workspacePayload := performRawRequest(t, handler, http.MethodGet, "/api/workspace")
	assertJSONHasPath(t, workspacePayload, "panelWidths.leftRatio")
	assertJSONHasPath(t, workspacePayload, "panelWidths.rightRatio")
	assertJSONHasPath(t, workspacePayload, "panelWidths.documentTOCRatio")

	searchPayload := performRawRequestArray(t, handler, http.MethodGet, "/api/search?q=parser")
	assertJSONArrayHasPath(t, searchPayload, 0, "id")
	assertJSONArrayHasPath(t, searchPayload, 0, "type")
	assertJSONArrayHasPath(t, searchPayload, 0, "description")
	assertJSONArrayHasPath(t, searchPayload, 0, "featureSlug")
	assertJSONArrayHasPath(t, searchPayload, 0, "snippet")

	assertJSONMissingPath(t, graphCanvasPayload, "SelectedGraph")
	assertJSONMissingPath(t, workspacePayload, "PanelWidths")
	assertJSONArrayMissingPath(t, searchPayload, 0, "Type")
	assertJSONArrayMissingPath(t, searchPayload, 0, "FeatureSlug")
}

func TestNewMuxServesGraphCanvasScopeWithPersistedAndSeededPositions(t *testing.T) {
	t.Parallel()

	root := createGraphCanvasHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	view := performJSONRequest[graph.GraphCanvasView](t, handler, http.MethodGet, "/api/graph-canvas?graph=execution")
	if view.SelectedGraph != "execution" {
		t.Fatalf("view.SelectedGraph = %q, want execution", view.SelectedGraph)
	}

	if len(view.Nodes) != 4 {
		t.Fatalf("len(view.Nodes) = %d, want 4", len(view.Nodes))
	}
	if view.LayerGuidance.MagneticThresholdPx != 18 {
		t.Fatalf("view.LayerGuidance.MagneticThresholdPx = %v, want 18", view.LayerGuidance.MagneticThresholdPx)
	}

	note := graphCanvasNodeByID(t, view.Nodes, "note-1")
	if !note.PositionPersisted || note.Position.X != 640 || note.Position.Y != 180 {
		t.Fatalf("note = %#v, want persisted 640/180", note)
	}

	command := graphCanvasNodeByID(t, view.Nodes, "cmd-1")
	if command.Graph != "execution/parser" {
		t.Fatalf("command.Graph = %q, want execution/parser", command.Graph)
	}
	if command.PositionPersisted {
		t.Fatal("command.PositionPersisted = true, want false")
	}
	if command.Position.X != 780 || command.Position.Y != 120 {
		t.Fatalf("command.Position = %#v, want layer-2 seeded position", command.Position)
	}

	task := graphCanvasNodeByID(t, view.Nodes, "task-1")
	if task.Position.X != 140 || task.Position.Y != 120 {
		t.Fatalf("task.Position = %#v, want layer-0 seeded position", task.Position)
	}

	if len(view.Edges) != 3 {
		t.Fatalf("len(view.Edges) = %d, want 3", len(view.Edges))
	}
	assertGraphCanvasEdgeIDs(t, view.Edges, []string{
		"link:note-1:cmd-1",
		"link:task-1:note-1",
		"link:note-2:note-1",
	})
}

func TestNewMuxGraphCanvasRebuildsMissingIndex(t *testing.T) {
	t.Parallel()

	root := createGraphCanvasHTTPAPITestWorkspace(t)
	if err := os.Remove(root.IndexPath); err != nil {
		t.Fatalf("Remove(index) error = %v", err)
	}

	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	view := performJSONRequest[graph.GraphCanvasView](t, handler, http.MethodGet, "/api/graph-canvas?graph=execution")
	if len(view.Nodes) != 4 {
		t.Fatalf("len(view.Nodes) = %d, want 4", len(view.Nodes))
	}
	if _, err := os.Stat(root.IndexPath); err != nil {
		t.Fatalf("Stat(index) error = %v", err)
	}
	if graphCanvasNodeByID(t, view.Nodes, "note-1").PositionPersisted {
		t.Fatal("note position remained persisted after index rebuild, want seeded fallback")
	}
}

func TestNewMuxGraphLayoutRebuildsMissingIndexAndPersistsPositions(t *testing.T) {
	t.Parallel()

	root := createGraphCanvasHTTPAPITestWorkspace(t)
	if err := os.Remove(root.IndexPath); err != nil {
		t.Fatalf("Remove(index) error = %v", err)
	}

	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	updated := performJSONRequestWithBody[graphLayoutResponse](t, handler, http.MethodPut, "/api/graph-layout", map[string]any{
		"graph": "execution",
		"positions": []map[string]any{{
			"documentId": "note-1",
			"x":          702,
			"y":          206,
		}},
	})
	if updated.Graph != "execution" || len(updated.Positions) != 1 {
		t.Fatalf("updated = %#v, want execution graph layout response", updated)
	}
	if _, err := os.Stat(root.IndexPath); err != nil {
		t.Fatalf("Stat(index) error = %v", err)
	}

	view := performJSONRequest[graph.GraphCanvasView](t, handler, http.MethodGet, "/api/graph-canvas?graph=execution")
	note := graphCanvasNodeByID(t, view.Nodes, "note-1")
	if !note.PositionPersisted || note.Position.X != 702 || note.Position.Y != 206 {
		t.Fatalf("note = %#v, want rebuilt index plus persisted layout", note)
	}
}

func TestNewMuxCreateDocumentAddsCanvasNodeForNewGraph(t *testing.T) {
	t.Parallel()

	root := createGraphCanvasHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	created := performJSONRequestWithBody[documentResponse](t, handler, http.MethodPost, "/api/documents", map[string]any{
		"type":        "note",
		"featureSlug": "execution",
		"fileName":    "first-note",
		"id":          "note-new",
		"graph":       "execution/empty",
		"title":       "First Note",
		"links":       []string{},
		"body":        "First note body\n",
	})
	if created.ID != "note-new" || created.Graph != "execution/empty" {
		t.Fatalf("created = %#v, want note-new in execution/empty", created)
	}

	view := performJSONRequest[graph.GraphCanvasView](t, handler, http.MethodGet, "/api/graph-canvas?graph=execution/empty")
	if view.SelectedGraph != "execution/empty" {
		t.Fatalf("view.SelectedGraph = %q, want execution/empty", view.SelectedGraph)
	}
	if len(view.Nodes) != 1 {
		t.Fatalf("len(view.Nodes) = %d, want 1", len(view.Nodes))
	}

	node := graphCanvasNodeByID(t, view.Nodes, "note-new")
	if node.PositionPersisted {
		t.Fatal("node.PositionPersisted = true, want false for seeded first placement")
	}
	if node.Position.X != 140 || node.Position.Y != 120 {
		t.Fatalf("node.Position = %#v, want seeded first-node position", node.Position)
	}
	if len(view.LayerGuidance.Guides) != 1 || view.LayerGuidance.Guides[0].X != 140 {
		t.Fatalf("view.LayerGuidance.Guides = %#v, want single layer-0 guide", view.LayerGuidance.Guides)
	}

	graphTree := performJSONRequest[graphTreeResponse](t, handler, http.MethodGet, "/api/graphs")
	if !slices.ContainsFunc(graphTree.Graphs, func(node graphTreeNodeResponse) bool {
		return node.GraphPath == "execution/empty" && node.TotalCount == 1
	}) {
		t.Fatalf("graphTree.Graphs = %#v, want execution/empty with one document", graphTree.Graphs)
	}
}

func createHTTPAPITestWorkspace(t *testing.T) workspace.Root {
	t.Helper()

	rootDir := t.TempDir()
	root, err := workspace.ResolveLocal(rootDir)
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	if err := config.Write(root.ConfigPath, config.Workspace{GUI: config.GUI{Port: 4812, PanelWidths: config.PanelWidths{LeftRatio: 0.31, RightRatio: 0.22}}}); err != nil {
		t.Fatalf("config.Write() error = %v", err)
	}

	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "notes", "architecture.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "notes", Title: "Architecture"},
			References:   []markdown.NodeReference{{Node: "note-2"}, {Node: "task-1"}},
		},
		Body: "Architecture body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "notes", "follow-up.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-2", Type: markdown.NoteType, Graph: "notes", Title: "Follow Up"},
			References:   []markdown.NodeReference{{Node: "note-1"}},
		},
		Body: "Follow up body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "planning", "foundation.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-0", Type: markdown.TaskType, Graph: "planning", Title: "Foundation"},
			Status:       "todo",
		},
		Body: "Foundation body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "execution", "parser.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "execution", Title: "Parser"},
			Status:       "doing",
			DependsOn:    []string{"task-0"},
			References:   []markdown.NodeReference{{Node: "note-1"}},
		},
		Body: "Parser body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "release", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "release", Title: "Build"},
			Name:         "build",
			References:   []markdown.NodeReference{{Node: "note-1"}},
			Run:          "go build ./cmd/flow",
		},
		Body: "Build release binary\n",
	})

	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		t.Fatalf("index.Rebuild() error = %v", err)
	}

	return root
}

func createGraphTreeHTTPAPITestWorkspace(t *testing.T) workspace.Root {
	t.Helper()

	rootDir := t.TempDir()
	root, err := workspace.ResolveLocal(rootDir)
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	if err := config.Write(root.ConfigPath, config.Workspace{GUI: config.GUI{Port: 4812, PanelWidths: config.PanelWidths{LeftRatio: 0.31, RightRatio: 0.22}}}); err != nil {
		t.Fatalf("config.Write() error = %v", err)
	}
	if err := os.MkdirAll(filepath.Dir(root.HomePath), 0o755); err != nil {
		t.Fatalf("MkdirAll(home) error = %v", err)
	}
	if err := os.WriteFile(root.HomePath, []byte("# Home\n"), 0o644); err != nil {
		t.Fatalf("WriteFile(home) error = %v", err)
	}

	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "execution", "build.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "wrong", Title: "Build", Description: "Build graph task"},
			Status:       "todo",
		},
		Body: "Build body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "execution", "parser", "parse.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "wrong", Title: "Parse", Description: "Parse command"},
			Name:         "parse",
			Run:          "./parse.sh",
		},
		Body: "Parse body\n",
	})

	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		t.Fatalf("index.Rebuild() error = %v", err)
	}

	return root
}

func createHTTPAPITestWorkspaceWithoutIndex(t *testing.T) workspace.Root {
	t.Helper()

	root := createHTTPAPITestWorkspace(t)
	if err := os.Remove(root.IndexPath); err != nil {
		t.Fatalf("Remove(index) error = %v", err)
	}

	return root
}

func createCalendarHTTPAPITestWorkspace(t *testing.T) workspace.Root {
	t.Helper()

	rootDir := t.TempDir()
	root, err := workspace.ResolveLocal(rootDir)
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	if err := config.Write(root.ConfigPath, config.Workspace{GUI: config.GUI{Port: 4812, PanelWidths: config.PanelWidths{LeftRatio: 0.31, RightRatio: 0.22}}}); err != nil {
		t.Fatalf("config.Write() error = %v", err)
	}
	if err := os.MkdirAll(filepath.Dir(root.HomePath), 0o755); err != nil {
		t.Fatalf("MkdirAll(home) error = %v", err)
	}
	if err := os.WriteFile(root.HomePath, []byte("---\ntype: home\ntitle: Home\n---\n\n## 2026-04-19\nHome planning\n"), 0o644); err != nil {
		t.Fatalf("WriteFile(home) error = %v", err)
	}

	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "execution", "overview.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "execution", Title: "Overview"},
		},
		Body: "## 2026-04-19\nExecution note\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "planning", "task.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "planning", Title: "Task"},
			Status:       "todo",
		},
		Body: "## 2026-04-20\nPlanning task\n",
	})

	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		t.Fatalf("index.Rebuild() error = %v", err)
	}

	return root
}

func createGraphCanvasHTTPAPITestWorkspace(t *testing.T) workspace.Root {
	t.Helper()

	rootDir := t.TempDir()
	root, err := workspace.ResolveLocal(rootDir)
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	if err := config.Write(root.ConfigPath, config.Workspace{GUI: config.GUI{Port: 4812, PanelWidths: config.PanelWidths{LeftRatio: 0.31, RightRatio: 0.22}}}); err != nil {
		t.Fatalf("config.Write() error = %v", err)
	}

	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "planning", "foundation.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-0", Type: markdown.TaskType, Graph: "planning", Title: "Foundation"},
		},
		Body: "Foundation body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "execution", "overview.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "execution", Title: "Overview", Description: "Execution overview"},
			References:   []markdown.NodeReference{{Node: "cmd-1"}},
		},
		Body: "Overview body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "execution", "build.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "execution", Title: "Build"},
			DependsOn:    []string{"task-0"},
			References:   []markdown.NodeReference{{Node: "note-1"}},
		},
		Body: "Build body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "execution", "parser", "details.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-2", Type: markdown.NoteType, Graph: "execution/parser", Title: "Parser Details"},
			References:   []markdown.NodeReference{{Node: "note-1"}},
		},
		Body: "Parser details\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "execution", "parser", "run.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "execution/parser", Title: "Run Parser"},
			Name:         "parser",
			Run:          "./parser.sh",
		},
		Body: "Run parser\n",
	})

	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		t.Fatalf("index.Rebuild() error = %v", err)
	}

	if err := index.WriteGraphLayoutPositions(root.IndexPath, []index.GraphLayoutPosition{{
		GraphPath:  "execution",
		DocumentID: "note-1",
		X:          640,
		Y:          180,
	}}); err != nil {
		t.Fatalf("WriteGraphLayoutPositions() error = %v", err)
	}

	return root
}

func graphCanvasNodeByID(t *testing.T, nodes []graph.GraphCanvasNode, id string) graph.GraphCanvasNode {
	t.Helper()

	for _, node := range nodes {
		if node.ID == id {
			return node
		}
	}

	t.Fatalf("graph canvas nodes missing %q in %#v", id, nodes)
	return graph.GraphCanvasNode{}
}

func assertGraphCanvasEdgeIDs(t *testing.T, edges []graph.GraphCanvasEdge, want []string) {
	t.Helper()

	got := make([]string, 0, len(edges))
	for _, edge := range edges {
		got = append(got, edge.ID)
	}

	if !slices.Equal(got, want) {
		t.Fatalf("edge ids = %#v, want %#v", got, want)
	}
}

func writeWorkspaceDocument(t *testing.T, path string, document markdown.Document) {
	t.Helper()

	data, err := markdown.SerializeDocument(document)
	if err != nil {
		t.Fatalf("SerializeDocument() error = %v", err)
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
}

func performJSONRequest[T any](t *testing.T, handler http.Handler, method string, path string) T {
	t.Helper()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, path, nil)
	handler.ServeHTTP(recorder, request)

	if recorder.Code < 200 || recorder.Code >= 300 {
		body, _ := io.ReadAll(recorder.Body)
		t.Fatalf("status = %d, want 2xx, body = %s", recorder.Code, string(body))
	}

	var value T
	if err := json.NewDecoder(recorder.Body).Decode(&value); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}

	return value
}

func performJSONRequestWithBody[T any](t *testing.T, handler http.Handler, method string, path string, body any) T {
	t.Helper()

	data, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, path, bytes.NewReader(data))
	request.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(recorder, request)

	if recorder.Code < 200 || recorder.Code >= 300 {
		responseBody, _ := io.ReadAll(recorder.Body)
		t.Fatalf("status = %d, want 2xx, body = %s", recorder.Code, string(responseBody))
	}

	var value T
	if err := json.NewDecoder(recorder.Body).Decode(&value); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}

	return value
}

func performRawRequest(t *testing.T, handler http.Handler, method string, path string) map[string]any {
	t.Helper()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, path, nil)
	handler.ServeHTTP(recorder, request)

	if recorder.Code < 200 || recorder.Code >= 300 {
		body, _ := io.ReadAll(recorder.Body)
		t.Fatalf("status = %d, want 2xx, body = %s", recorder.Code, string(body))
	}

	var payload map[string]any
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}

	return payload
}

func performRawRequestWithBody(t *testing.T, handler http.Handler, method string, path string, body any) map[string]any {
	t.Helper()

	data, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, path, bytes.NewReader(data))
	request.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(recorder, request)

	if recorder.Code < 200 || recorder.Code >= 300 {
		responseBody, _ := io.ReadAll(recorder.Body)
		t.Fatalf("status = %d, want 2xx, body = %s", recorder.Code, string(responseBody))
	}

	var value map[string]any
	if err := json.NewDecoder(recorder.Body).Decode(&value); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}

	return value
}

func performRawRequestArray(t *testing.T, handler http.Handler, method string, path string) []any {
	t.Helper()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, path, nil)
	handler.ServeHTTP(recorder, request)

	if recorder.Code < 200 || recorder.Code >= 300 {
		body, _ := io.ReadAll(recorder.Body)
		t.Fatalf("status = %d, want 2xx, body = %s", recorder.Code, string(body))
	}

	var payload []any
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}

	return payload
}

func assertStatus(t *testing.T, handler http.Handler, method string, path string, want int) {
	t.Helper()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, path, nil)
	handler.ServeHTTP(recorder, request)

	if recorder.Code != want {
		body, _ := io.ReadAll(recorder.Body)
		t.Fatalf("status(%s %s) = %d, want %d, body = %s", method, path, recorder.Code, want, string(body))
	}
}

func assertStatusWithBody(t *testing.T, handler http.Handler, method string, path string, body any, want int) {
	t.Helper()

	data, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, path, bytes.NewReader(data))
	request.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(recorder, request)

	if recorder.Code != want {
		responseBody, _ := io.ReadAll(recorder.Body)
		t.Fatalf("status(%s %s) = %d, want %d, body = %s", method, path, recorder.Code, want, string(responseBody))
	}
}

func containsRootDiv(body string) bool {
	return body != "" && (contains(body, `<div id="root"></div>`) || contains(body, `<div id="root"></div`))
}

func assertJSONHasPath(t *testing.T, payload map[string]any, path string) {
	t.Helper()

	if _, ok := lookupJSONPath(payload, path); !ok {
		t.Fatalf("json payload missing path %q in %#v", path, payload)
	}
}

func assertJSONMissingPath(t *testing.T, payload map[string]any, path string) {
	t.Helper()

	if value, ok := lookupJSONPath(payload, path); ok {
		t.Fatalf("json payload unexpectedly contains path %q with value %#v", path, value)
	}
}

func assertJSONArrayHasPath(t *testing.T, payload []any, index int, path string) {
	t.Helper()

	if index < 0 || index >= len(payload) {
		t.Fatalf("json array missing index %d in %#v", index, payload)
	}

	value, ok := payload[index].(map[string]any)
	if !ok {
		t.Fatalf("json array item %d is not an object: %#v", index, payload[index])
	}

	assertJSONHasPath(t, value, path)
}

func assertJSONArrayMissingPath(t *testing.T, payload []any, index int, path string) {
	t.Helper()

	if index < 0 || index >= len(payload) {
		t.Fatalf("json array missing index %d in %#v", index, payload)
	}

	value, ok := payload[index].(map[string]any)
	if !ok {
		t.Fatalf("json array item %d is not an object: %#v", index, payload[index])
	}

	assertJSONMissingPath(t, value, path)
}

func lookupJSONPath(value any, path string) (any, bool) {
	current := value
	for _, segment := range strings.Split(path, ".") {
		switch typed := current.(type) {
		case map[string]any:
			next, ok := typed[segment]
			if !ok {
				return nil, false
			}
			current = next
		case []any:
			index := -1
			for cursor := range typed {
				if fmt.Sprint(cursor) == segment {
					index = cursor
					break
				}
			}
			if index < 0 {
				return nil, false
			}
			current = typed[index]
		default:
			return nil, false
		}
	}

	return current, true
}

func contains(body string, needle string) bool {
	return len(body) >= len(needle) && (body == needle || ioContains(body, needle))
}

func ioContains(body string, needle string) bool {
	for index := 0; index+len(needle) <= len(body); index++ {
		if body[index:index+len(needle)] == needle {
			return true
		}
	}

	return false
}

// TestNewMuxLinksAPIAddsAndRemovesInlineReference tests POST /api/links and DELETE /api/links
func TestNewMuxReferencesAPIAddsAndRemovesInlineReference(t *testing.T) {
	t.Parallel()

	root := createReferencesAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	// Add a reference from note-1 to note-2 with context "informs"
	resp := performJSONRequestWithBody[documentResponse](t, handler, http.MethodPost, "/api/links", map[string]any{
		"fromId":  "note-1",
		"toId":    "note-2",
		"context": "informs",
	})
	found := false
	for _, ref := range resp.Links {
		if ref.Node == "note-2" && ref.Context == "informs" {
			found = true
		}
	}
	if !found {
		t.Fatalf("link to note-2 with context 'informs' not found in note-1: %#v", resp.Links)
	}

	// Remove the link
	resp2 := performJSONRequestWithBody[documentResponse](t, handler, http.MethodDelete, "/api/links", map[string]any{
		"fromId": "note-1",
		"toId":   "note-2",
	})
	for _, ref := range resp2.Links {
		if ref.Node == "note-2" {
			t.Fatalf("link to note-2 still present after removal: %#v", resp2.Links)
		}
	}

	// Add a link with empty context
	resp3 := performJSONRequestWithBody[documentResponse](t, handler, http.MethodPost, "/api/links", map[string]any{
		"fromId": "note-1",
		"toId":   "note-2",
	})
	found = false
	for _, ref := range resp3.Links {
		if ref.Node == "note-2" && ref.Context == "" {
			found = true
		}
	}
	if !found {
		t.Fatalf("link to note-2 with empty context not found in note-1: %#v", resp3.Links)
	}
}

// TestNewMuxReferencesAPIValidation tests validation for /api/links
func TestNewMuxReferencesAPIValidation(t *testing.T) {
	t.Parallel()

	root := createReferencesAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	// Missing fromId
	assertStatusWithBody(t, handler, http.MethodPost, "/api/links", map[string]any{"toId": "note-2"}, http.StatusBadRequest)
	// Missing toId
	assertStatusWithBody(t, handler, http.MethodPost, "/api/links", map[string]any{"fromId": "note-1"}, http.StatusBadRequest)
	// Remove with missing fromId
	assertStatusWithBody(t, handler, http.MethodDelete, "/api/links", map[string]any{"toId": "note-2"}, http.StatusBadRequest)
	// Remove with missing toId
	assertStatusWithBody(t, handler, http.MethodDelete, "/api/links", map[string]any{"fromId": "note-1"}, http.StatusBadRequest)
}

// createReferencesAPITestWorkspace creates a workspace with two notes for references API tests
func createReferencesAPITestWorkspace(t *testing.T) workspace.Root {
	t.Helper()

	rootDir := t.TempDir()
	root, err := workspace.ResolveLocal(rootDir)
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "execution", "overview.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "execution", Title: "Overview"},
		},
		Body: "Overview body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "content", "execution", "details.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-2", Type: markdown.NoteType, Graph: "execution", Title: "Details"},
		},
		Body: "Details body\n",
	})

	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		t.Fatalf("index.Rebuild() error = %v", err)
	}

	return root
}

func TestNewMuxNodeViewReturnsNodeForID(t *testing.T) {
	t.Parallel()

	root := createHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	view := performJSONRequest[index.NodeView](t, handler, http.MethodGet, "/api/node-view?id=note-1")
	if view.ID != "note-1" {
		t.Fatalf("view.ID = %q, want note-1", view.ID)
	}
	if view.Title != "Architecture" {
		t.Fatalf("view.Title = %q, want Architecture", view.Title)
	}
	if view.Role != "context" {
		t.Fatalf("view.Role = %q, want context", view.Role)
	}
}

func TestNewMuxNodeViewFiltersbyGraph(t *testing.T) {
	t.Parallel()

	root := createHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	view := performJSONRequest[index.NodeView](t, handler, http.MethodGet, "/api/node-view?id=note-1&graph=notes")
	if view.Graph != "notes" {
		t.Fatalf("view.Graph = %q, want notes", view.Graph)
	}
}

func TestNewMuxNodeViewMissingIDReturns400(t *testing.T) {
	t.Parallel()

	root := createHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	assertStatus(t, handler, http.MethodGet, "/api/node-view", http.StatusBadRequest)
}

func TestNewMuxNodeViewUnknownIDReturns404(t *testing.T) {
	t.Parallel()

	root := createHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	assertStatus(t, handler, http.MethodGet, "/api/node-view?id=does-not-exist", http.StatusNotFound)
}
