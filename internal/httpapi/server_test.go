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

	noteGraphs := performJSONRequest[graphListResponse](t, handler, http.MethodGet, "/api/graphs/note")
	if len(noteGraphs.AvailableGraphs) != 1 || noteGraphs.AvailableGraphs[0] != "notes" {
		t.Fatalf("noteGraphs.AvailableGraphs = %#v, want [notes]", noteGraphs.AvailableGraphs)
	}
	if len(noteGraphs.GraphItems["notes"]) != 2 {
		t.Fatalf("len(noteGraphs.GraphItems[notes]) = %d, want 2", len(noteGraphs.GraphItems["notes"]))
	}

	taskLayers := performJSONRequest[graph.TaskLayerView](t, handler, http.MethodGet, "/api/layers/tasks")
	if len(taskLayers.Layers) != 2 {
		t.Fatalf("len(taskLayers.Layers) = %d, want 2", len(taskLayers.Layers))
	}
	if taskLayers.Layers[1].Tasks[0].ID != "task-1" {
		t.Fatalf("taskLayers.Layers[1].Tasks[0].ID = %q, want task-1", taskLayers.Layers[1].Tasks[0].ID)
	}

	commandLayers := performJSONRequest[graph.CommandLayerView](t, handler, http.MethodGet, "/api/layers/commands?graph=release")
	if commandLayers.SelectedGraph != "release" {
		t.Fatalf("commandLayers.SelectedGraph = %q, want release", commandLayers.SelectedGraph)
	}
	if len(commandLayers.Layers) != 1 {
		t.Fatalf("len(commandLayers.Layers) = %d, want 1", len(commandLayers.Layers))
	}

	noteGraph := performJSONRequest[graph.NoteGraphView](t, handler, http.MethodGet, "/api/notes/graph")
	if len(noteGraph.Edges) != 1 {
		t.Fatalf("len(noteGraph.Edges) = %d, want 1", len(noteGraph.Edges))
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
	if workspaceResponse.PanelWidths.LeftRatio != 0.31 || workspaceResponse.PanelWidths.RightRatio != 0.22 {
		t.Fatalf("workspaceResponse.PanelWidths = %#v, want 0.31/0.22", workspaceResponse.PanelWidths)
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

	if graphTree.Graphs[1].GraphPath != "execution/parser" || graphTree.Graphs[1].DirectCount != 1 || graphTree.Graphs[1].TotalCount != 1 || graphTree.Graphs[1].HasChildren {
		t.Fatalf("graphTree.Graphs[1] = %#v", graphTree.Graphs[1])
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

func TestNewMuxUpdatesWorkspacePanelWidths(t *testing.T) {
	t.Parallel()

	root := createGraphTreeHTTPAPITestWorkspace(t)
	handler, err := NewMux(Options{Root: root})
	if err != nil {
		t.Fatalf("NewMux() error = %v", err)
	}

	updated := performJSONRequestWithBody[workspaceResponse](t, handler, http.MethodPut, "/api/workspace", map[string]any{
		"panelWidths": map[string]any{
			"leftRatio":  0.27,
			"rightRatio": 0.21,
		},
	})
	if updated.PanelWidths.LeftRatio != 0.27 || updated.PanelWidths.RightRatio != 0.21 {
		t.Fatalf("updated.PanelWidths = %#v, want 0.27/0.21", updated.PanelWidths)
	}

	storedConfig, err := config.Read(root.ConfigPath)
	if err != nil {
		t.Fatalf("config.Read() error = %v", err)
	}
	if storedConfig.GUI.PanelWidths.LeftRatio != 0.27 || storedConfig.GUI.PanelWidths.RightRatio != 0.21 {
		t.Fatalf("storedConfig.GUI.PanelWidths = %#v, want 0.27/0.21", storedConfig.GUI.PanelWidths)
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

	assertStatus(t, handler, http.MethodGet, "/api/graphs/unknown", http.StatusBadRequest)
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
		"references":  []string{"note-1"},
		"body":        "Publish task body\n",
	})
	if created.ID != "task-2" || created.Path != "data/graphs/release/publish.md" {
		t.Fatalf("created = %#v", created)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "graphs", "release", "publish.md")); err != nil {
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

	results := performJSONRequest[[]index.SearchResult](t, handler, http.MethodGet, "/api/search?q=publish")
	if len(results) != 1 || results[0].ID != "task-2" {
		t.Fatalf("search results = %#v, want task-2 match", results)
	}

	deleted := performJSONRequest[deleteDocumentResponse](t, handler, http.MethodDelete, "/api/documents/task-2")
	if !deleted.Deleted || deleted.ID != "task-2" {
		t.Fatalf("deleted = %#v", deleted)
	}

	if _, err := os.Stat(filepath.Join(root.FlowPath, "data", "graphs", "release", "publish.md")); !os.IsNotExist(err) {
		t.Fatalf("Stat(deleted file) error = %v, want not exist", err)
	}

	assertStatus(t, handler, http.MethodGet, "/api/documents/task-2", http.StatusNotFound)
	results = performJSONRequest[[]index.SearchResult](t, handler, http.MethodGet, "/api/search?q=publish")
	if len(results) != 0 {
		t.Fatalf("search results = %#v, want empty after delete", results)
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
	if len(followUp.References) != 0 {
		t.Fatalf("followUp.References = %#v, want empty", followUp.References)
	}
	if len(followUp.RelatedNoteIDs) != 0 {
		t.Fatalf("followUp.RelatedNoteIDs = %#v, want empty", followUp.RelatedNoteIDs)
	}

	task := performJSONRequest[documentResponse](t, handler, http.MethodGet, "/api/documents/task-1")
	if len(task.References) != 0 {
		t.Fatalf("task.References = %#v, want empty", task.References)
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

	noteGraphPayload := performRawRequest(t, handler, http.MethodGet, "/api/notes/graph")
	assertJSONHasPath(t, noteGraphPayload, "availableGraphs")
	assertJSONHasPath(t, noteGraphPayload, "graphNotes")
	assertJSONHasPath(t, noteGraphPayload, "nodes.note-1.path")
	assertJSONHasPath(t, noteGraphPayload, "edges.0.leftNoteID")

	taskLayerPayload := performRawRequest(t, handler, http.MethodGet, "/api/layers/tasks")
	assertJSONHasPath(t, taskLayerPayload, "layers.0.tasks.0.path")
	assertJSONHasPath(t, taskLayerPayload, "tasks.task-1.featureSlug")

	commandLayerPayload := performRawRequest(t, handler, http.MethodGet, "/api/layers/commands?graph=release")
	assertJSONHasPath(t, commandLayerPayload, "selectedGraph")
	assertJSONHasPath(t, commandLayerPayload, "layers.0.commands.0.path")
	assertJSONHasPath(t, commandLayerPayload, "commands.cmd-1.run")

	workspacePayload := performRawRequest(t, handler, http.MethodGet, "/api/workspace")
	assertJSONHasPath(t, workspacePayload, "panelWidths.leftRatio")
	assertJSONHasPath(t, workspacePayload, "panelWidths.rightRatio")

	searchPayload := performRawRequestArray(t, handler, http.MethodGet, "/api/search?q=parser")
	assertJSONArrayHasPath(t, searchPayload, 0, "id")
	assertJSONArrayHasPath(t, searchPayload, 0, "type")
	assertJSONArrayHasPath(t, searchPayload, 0, "description")
	assertJSONArrayHasPath(t, searchPayload, 0, "featureSlug")
	assertJSONArrayHasPath(t, searchPayload, 0, "snippet")

	assertJSONMissingPath(t, noteGraphPayload, "Nodes")
	assertJSONMissingPath(t, workspacePayload, "PanelWidths")
	assertJSONMissingPath(t, taskLayerPayload, "Layers")
	assertJSONMissingPath(t, commandLayerPayload, "SelectedGraph")
	assertJSONArrayMissingPath(t, searchPayload, 0, "Type")
	assertJSONArrayMissingPath(t, searchPayload, 0, "FeatureSlug")
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

	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "graphs", "notes", "architecture.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "notes", Title: "Architecture"},
			References:   []string{"note-2", "task-1"},
		},
		Body: "Architecture body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "graphs", "notes", "follow-up.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-2", Type: markdown.NoteType, Graph: "notes", Title: "Follow Up"},
			References:   []string{"note-1"},
		},
		Body: "Follow up body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "graphs", "planning", "foundation.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-0", Type: markdown.TaskType, Graph: "planning", Title: "Foundation"},
			Status:       "todo",
		},
		Body: "Foundation body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "graphs", "execution", "parser.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "execution", Title: "Parser"},
			Status:       "doing",
			DependsOn:    []string{"task-0"},
			References:   []string{"note-1"},
		},
		Body: "Parser body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "graphs", "release", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "release", Title: "Build"},
			Name:         "build",
			References:   []string{"note-1"},
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

	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "graphs", "execution", "build.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "wrong", Title: "Build", Description: "Build graph task"},
			Status:       "todo",
		},
		Body: "Build body\n",
	})
	writeWorkspaceDocument(t, filepath.Join(root.FlowPath, "data", "graphs", "execution", "parser", "parse.md"), markdown.CommandDocument{
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
