package desktop

import (
	"fmt"
	"slices"
	"strings"

	"github.com/lex/flow/internal/config"
	"github.com/lex/flow/internal/core"
	"github.com/lex/flow/internal/graph"
	"github.com/lex/flow/internal/index"
	"github.com/lex/flow/internal/markdown"
	"github.com/lex/flow/internal/workspace"
)

// Backend exposes transport-agnostic workspace mutations that a future Wails
// adapter can bind without depending on HTTP handlers.
type Backend struct {
	root workspace.Root
}

// GraphCanvasSnapshot carries the canvas payload together with the persisted
// viewport so a desktop client can restore its editing state in one call.
type GraphCanvasSnapshot struct {
	View     graph.GraphCanvasView      `json:"view"`
	Viewport *index.GraphLayoutViewport `json:"viewport,omitempty"`
}

// GraphTreeNode mirrors the graph tree data needed by the desktop surface.
type GraphTreeNode struct {
	GraphPath      string                `json:"graphPath"`
	DisplayName    string                `json:"displayName"`
	DirectCount    int                   `json:"directCount"`
	TotalCount     int                   `json:"totalCount"`
	HasChildren    bool                  `json:"hasChildren"`
	CountLabel     string                `json:"countLabel"`
	Color          string                `json:"color,omitempty"`
	CanvasDisabled bool                  `json:"canvasDisabled,omitempty"`
	Files          []index.GraphTreeFile `json:"files"`
}

// GraphTreeSnapshot carries the home document and graph tree entries for the
// desktop sidebar and graph browser.
type GraphTreeSnapshot struct {
	Home   markdown.HomeDocument `json:"home"`
	Graphs []GraphTreeNode        `json:"graphs"`
}

// NewBackend constructs the canonical desktop backend for one resolved
// workspace.
func NewBackend(root workspace.Root) Backend {
	return Backend{root: root}
}

// WorkspaceConfig returns the workspace GUI settings, using the default
// configuration when the config file is missing.
func (backend Backend) WorkspaceConfig() (config.Workspace, error) {
	return workspace.ReadOrDefaultConfig(backend.root.ConfigPath)
}

// Documents loads the current workspace documents for read-only desktop views.
func (backend Backend) Documents() ([]markdown.WorkspaceDocument, error) {
	documents, _, err := workspace.LoadDocumentsBestEffort(backend.root.FlowPath)
	return documents, err
}

// Search queries the shared workspace index using the same behavior as CLI and HTTP.
func (backend Backend) Search(query string, limit int) ([]index.SearchResult, error) {
	return index.SearchWorkspace(backend.root.IndexPath, backend.root.FlowPath, query, limit)
}

// NodeView loads one node projection for desktop inspection panes.
func (backend Backend) NodeView(id string, graphPath string) (index.NodeView, error) {
	return index.ReadNodeViewWorkspace(backend.root.IndexPath, backend.root.FlowPath, id, graphPath)
}

// GraphCanvas loads one graph canvas payload and its persisted viewport.
func (backend Backend) GraphCanvas(selectedGraph string) (GraphCanvasSnapshot, error) {
	documents, _, err := workspace.LoadDocumentsBestEffort(backend.root.FlowPath)
	if err != nil {
		return GraphCanvasSnapshot{}, err
	}

	layoutPositions, err := index.ReadGraphLayoutPositionsWorkspace(backend.root.IndexPath, backend.root.FlowPath, selectedGraph)
	if err != nil {
		return GraphCanvasSnapshot{}, err
	}

	persistedLayouts := make(map[string]graph.GraphCanvasNodeLayout, len(layoutPositions))
	for _, position := range layoutPositions {
		persistedLayouts[position.DocumentID] = graph.GraphCanvasNodeLayout{
			Position: graph.GraphCanvasPosition{X: position.X, Y: position.Y},
			Width:    position.Width,
			Height:   position.Height,
			ZIndex:   position.ZIndex,
		}
	}

	view, err := graph.BuildGraphCanvasView(documents, selectedGraph, persistedLayouts)
	if err != nil {
		return GraphCanvasSnapshot{}, err
	}

	viewport, hasViewport, err := index.ReadGraphLayoutViewportWorkspace(backend.root.IndexPath, backend.root.FlowPath, selectedGraph)
	if err != nil {
		return GraphCanvasSnapshot{}, err
	}

	snapshot := GraphCanvasSnapshot{View: view}
	if hasViewport {
		snapshot.Viewport = &viewport
	}

	return snapshot, nil
}

// GraphTree loads the sidebar tree and home document used by the desktop
// workspace browser.
func (backend Backend) GraphTree() (GraphTreeSnapshot, error) {
	nodes, err := index.ReadGraphNodesWorkspace(backend.root.IndexPath, backend.root.FlowPath)
	if err != nil {
		nodes = nil
	}

	files, err := index.ReadGraphTreeFilesWorkspace(backend.root.IndexPath, backend.root.FlowPath)
	if err != nil {
		files = nil
	}

	documents, _, err := workspace.LoadDocumentsBestEffort(backend.root.FlowPath)
	if err != nil {
		return GraphTreeSnapshot{}, err
	}

	home := markdown.HomeDocument{}
	for _, item := range documents {
		if document, ok := item.Document.(markdown.HomeDocument); ok {
			home = document
			break
		}
	}
	if home.Metadata.Type == "" && home.Metadata.Title == "" && home.Body == "" {
		home = markdown.HomeDocument{
			Metadata: markdown.CommonFields{ID: "home", Type: markdown.HomeType, Title: "Home"},
		}
	}

	filesByGraph := make(map[string][]index.GraphTreeFile)
	for _, file := range files {
		if strings.TrimSpace(file.Graph) == "" {
			continue
		}
		filesByGraph[file.Graph] = append(filesByGraph[file.Graph], file)
	}

	for graphPath := range filesByGraph {
		slices.SortFunc(filesByGraph[graphPath], func(left index.GraphTreeFile, right index.GraphTreeFile) int {
			return strings.Compare(left.FileName, right.FileName)
		})
	}

	workspaceConfig, err := workspace.ReadOrDefaultConfig(backend.root.ConfigPath)
	if err != nil {
		return GraphTreeSnapshot{}, err
	}

	result := GraphTreeSnapshot{Home: home, Graphs: make([]GraphTreeNode, 0, len(nodes))}
	graphDirectoryColors := workspaceConfig.GUI.GraphDirectoryColors
	graphCanvasEnabled := workspaceConfig.GUI.GraphCanvasEnabled
	if len(nodes) > 0 {
		for _, node := range nodes {
			result.Graphs = append(result.Graphs, GraphTreeNode{
				GraphPath:      node.GraphPath,
				DisplayName:    node.DisplayName,
				DirectCount:    node.DirectCount,
				TotalCount:     node.TotalCount,
				HasChildren:    node.HasChildren,
				CountLabel:     fmt.Sprintf("%d direct / %d total", node.DirectCount, node.TotalCount),
				Color:          graphDirectoryColors[node.GraphPath],
				CanvasDisabled: !graphCanvasEnabled[node.GraphPath],
				Files:          filesByGraph[node.GraphPath],
			})
		}
		return result, nil
	}

	if len(filesByGraph) == 0 {
		return result, nil
	}

	graphPaths := make([]string, 0, len(filesByGraph))
	for graphPath := range filesByGraph {
		graphPaths = append(graphPaths, graphPath)
	}
	slices.Sort(graphPaths)

	for _, graphPath := range graphPaths {
		directCount := len(filesByGraph[graphPath])
		result.Graphs = append(result.Graphs, GraphTreeNode{
			GraphPath:      graphPath,
			DisplayName:    graphPath,
			DirectCount:    directCount,
			TotalCount:     directCount,
			HasChildren:    false,
			CountLabel:     fmt.Sprintf("%d direct / %d total", directCount, directCount),
			Color:          graphDirectoryColors[graphPath],
			CanvasDisabled: !graphCanvasEnabled[graphPath],
			Files:          filesByGraph[graphPath],
		})
	}

	return result, nil
}

// CreateDocument runs the shared create workflow against canonical workspace
// storage.
func (backend Backend) CreateDocument(request core.CreateDocumentRequest) (markdown.WorkspaceDocument, error) {
	return core.CreateDocument(request, func(request core.CreateDocumentRequest) (markdown.WorkspaceDocument, error) {
		return workspace.CreateDocumentFromCoreRequest(backend.root, request)
	})
}

// UpdateDocument runs the shared update workflow against canonical workspace
// storage.
func (backend Backend) UpdateDocument(request core.UpdateDocumentRequest) (markdown.WorkspaceDocument, error) {
	return core.UpdateDocument(request, func(documentID string, patch core.UpdateDocumentPatch) (markdown.WorkspaceDocument, error) {
		return workspace.UpdateDocumentByIDFromCorePatch(backend.root, documentID, patch)
	})
}

// DeleteDocument runs the shared delete workflow against canonical workspace
// storage.
func (backend Backend) DeleteDocument(request core.DeleteDocumentRequest) (string, error) {
	return core.DeleteDocument(request, func(documentID string) (string, error) {
		return workspace.DeleteDocumentByID(backend.root, documentID)
	})
}
