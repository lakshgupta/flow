package desktop

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
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

// UploadFile saves uploaded file content to the workspace and returns the
// public URL. When documentPath is provided the file is stored alongside the
// note's Markdown file so images stay co-located with the document that
// references them. Without it the file lands in data/uploads/.
func (backend Backend) UploadFile(fileName string, content []byte, documentPath string) (string, error) {
	return backend.writeUploadedFile(fileName, content, documentPath)
}

// UploadFileFromLocalPath reads a file from a local file:// URI and saves it to
// the workspace, returning the public URL. This handles drag-and-drop on Linux
// where WebKitGTK places file URIs in text/uri-list instead of populating
// dataTransfer.files.
func (backend Backend) UploadFileFromLocalPath(localURI string, documentPath string) (string, error) {
	uri := strings.TrimSpace(localURI)
	if uri == "" {
		return "", fmt.Errorf("empty local URI")
	}

	parsedURI, parseErr := url.Parse(uri)
	if parseErr != nil {
		return "", fmt.Errorf("parse local URI %q: %w", uri, parseErr)
	}
	if parsedURI.Scheme != "file" {
		return "", fmt.Errorf("unsupported URI scheme %q", parsedURI.Scheme)
	}

	// Decode URL-encoded characters (spaces as %20, etc.).
	// Use EscapedPath() to get the raw form and avoid double-unescaping
	// because url.Parse already unescapes Path during parsing.
	filePath, decodeErr := url.PathUnescape(parsedURI.EscapedPath())
	if decodeErr != nil {
		return "", fmt.Errorf("decode local URI path %q: %w", parsedURI.EscapedPath(), decodeErr)
	}

	content, readErr := os.ReadFile(filePath)
	if readErr != nil {
		return "", fmt.Errorf("read local file %q: %w", filePath, readErr)
	}

	fileName := filepath.Base(filePath)

	return backend.writeUploadedFile(fileName, content, documentPath)
}

// GraphFileNoteResponse mirrors the HTTP API's document response for graph file notes.
type GraphFileNoteResponse struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Graph    string `json:"graph"`
	Title    string `json:"title"`
	Path     string `json:"path"`
	FileName string `json:"fileName"`
}

// CreateGraphFileNoteFromPath reads a file from a local file:// URI, saves it
// to the graph directory, and creates a note document with the file embedded.
// This is the desktop-app equivalent of the HTTP POST /api/graphs/{name}/files
// endpoint, working around the Wails asset server's inability to handle
// multipart form data.
func (backend Backend) CreateGraphFileNoteFromPath(localURI string, graphPath string) (GraphFileNoteResponse, error) {
	uri := strings.TrimSpace(localURI)
	if uri == "" {
		return GraphFileNoteResponse{}, fmt.Errorf("empty local URI")
	}

	parsedURI, parseErr := url.Parse(uri)
	if parseErr != nil {
		return GraphFileNoteResponse{}, fmt.Errorf("parse local URI %q: %w", uri, parseErr)
	}
	if parsedURI.Scheme != "file" {
		return GraphFileNoteResponse{}, fmt.Errorf("unsupported URI scheme %q", parsedURI.Scheme)
	}

	filePath, decodeErr := url.PathUnescape(parsedURI.EscapedPath())
	if decodeErr != nil {
		return GraphFileNoteResponse{}, fmt.Errorf("decode local URI path %q: %w", parsedURI.EscapedPath(), decodeErr)
	}

	content, readErr := os.ReadFile(filePath)
	if readErr != nil {
		return GraphFileNoteResponse{}, fmt.Errorf("read local file %q: %w", filePath, readErr)
	}

	originalFileName := filepath.Base(filePath)
	if originalFileName == "" || originalFileName == "." {
		return GraphFileNoteResponse{}, fmt.Errorf("invalid file name")
	}

	graphDir := filepath.Join(backend.root.GraphsPath, filepath.FromSlash(graphPath))
	if info, err := os.Stat(graphDir); err != nil || !info.IsDir() {
		return GraphFileNoteResponse{}, fmt.Errorf("graph %q not found", graphPath)
	}

	assetFileName := workspace.MakeUniqueFileName(graphDir, workspace.SanitizeAssetFileName(originalFileName))
	assetRelativePath := filepath.ToSlash(filepath.Join(workspace.DataDirName, workspace.GraphsDirName, filepath.FromSlash(graphPath), assetFileName))
	assetAbsolutePath := filepath.Join(backend.root.FlowPath, filepath.FromSlash(assetRelativePath))

	if err := os.MkdirAll(filepath.Dir(assetAbsolutePath), 0o755); err != nil {
		return GraphFileNoteResponse{}, fmt.Errorf("create file directory: %w", err)
	}
	if err := os.WriteFile(assetAbsolutePath, content, 0o644); err != nil {
		return GraphFileNoteResponse{}, fmt.Errorf("write file: %w", err)
	}

	assetURL := "/api/files?path=" + url.QueryEscape(assetRelativePath)
	extension := strings.ToLower(filepath.Ext(originalFileName))
	title := titleFromFileName(originalFileName)
	body := noteBodyForAsset(assetURL, title, extension)

	// Derive note slug from the asset file name (strip extension).
	slug := strings.TrimSuffix(assetFileName, filepath.Ext(assetFileName))
	noteID := filepath.ToSlash(filepath.Join(graphPath, slug))

	created, err := core.CreateDocument(core.CreateDocumentRequest{
		Type:        markdown.NoteType,
		FeatureSlug: graphPath,
		FileName:    slug,
		ID:          noteID,
		Graph:       graphPath,
		Title:       title,
		Body:        body,
	}, func(request core.CreateDocumentRequest) (markdown.WorkspaceDocument, error) {
		return workspace.CreateDocumentFromCoreRequest(backend.root, request)
	})
	if err != nil {
		return GraphFileNoteResponse{}, err
	}

	return GraphFileNoteResponse{
		ID:       noteID,
		Type:     string(created.Document.Kind()),
		Graph:    graphPath,
		Title:    title,
		Path:     created.Path,
		FileName: assetFileName,
	}, nil
}

// titleFromFileName converts a file name to a title-cased display name.
func titleFromFileName(name string) string {
	base := strings.TrimSuffix(filepath.Base(name), filepath.Ext(name))
	base = strings.ReplaceAll(base, "_", " ")
	base = strings.ReplaceAll(base, "-", " ")
	base = strings.TrimSpace(base)
	if base == "" {
		return "Untitled File"
	}

	words := strings.Fields(strings.ToLower(base))
	for index, word := range words {
		if word == "" {
			continue
		}
		words[index] = strings.ToUpper(word[:1]) + word[1:]
	}

	return strings.Join(words, " ")
}

// noteBodyForAsset returns the markdown body for a note that embeds a file.
func noteBodyForAsset(assetURL string, title string, extension string) string {
	lowerExt := strings.ToLower(extension)
	if lowerExt == ".png" || lowerExt == ".jpg" || lowerExt == ".jpeg" ||
		lowerExt == ".gif" || lowerExt == ".webp" || lowerExt == ".svg" || lowerExt == ".bmp" {
		return fmt.Sprintf("![%s](%s)\n", title, assetURL)
	}
	return fmt.Sprintf("[%s](%s)\n", title, assetURL)
}

// writeUploadedFile persists file content to the workspace asset directory and
// returns the public URL. It is shared by UploadFile and UploadFileFromLocalPath.
func (backend Backend) writeUploadedFile(fileName string, content []byte, documentPath string) (string, error) {
	if err := workspace.ValidateFileName(fileName); err != nil {
		return "", err
	}

	assetDir, assetRelativeDir, dirErr := workspace.ResolveAssetDir(backend.root.FlowPath, documentPath)
	if dirErr != nil {
		return "", dirErr
	}

	if err := os.MkdirAll(assetDir, 0o755); err != nil {
		return "", fmt.Errorf("create asset directory: %w", err)
	}

	assetFileName := workspace.MakeUniqueFileName(assetDir, workspace.SanitizeAssetFileName(fileName))
	assetAbsolutePath := filepath.Join(assetDir, assetFileName)

	if err := os.WriteFile(assetAbsolutePath, content, 0o644); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}

	assetRelativePath := filepath.Join(assetRelativeDir, assetFileName)
	return workspace.BuildAssetURL(assetRelativePath), nil
}
