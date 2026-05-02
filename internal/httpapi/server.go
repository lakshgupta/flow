package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"

	"github.com/lex/flow/internal/config"
	"github.com/lex/flow/internal/graph"
	"github.com/lex/flow/internal/index"
	"github.com/lex/flow/internal/markdown"
	"github.com/lex/flow/internal/workspace"
)

// Options configures the embedded GUI HTTP handler.
type Options struct {
	Root              workspace.Root
	LaunchScope       workspace.Scope
	GlobalLocatorPath string
	Stop              func() error
}

type workspaceChoiceResponse struct {
	Scope         workspace.Scope `json:"scope"`
	WorkspacePath string          `json:"workspacePath"`
}

type workspaceResponse struct {
	Scope                     workspace.Scope           `json:"scope"`
	WorkspacePath             string                    `json:"workspacePath"`
	FlowPath                  string                    `json:"flowPath"`
	ConfigPath                string                    `json:"configPath"`
	IndexPath                 string                    `json:"indexPath"`
	HomePath                  string                    `json:"homePath"`
	GUIPort                   int                       `json:"guiPort"`
	Appearance                string                    `json:"appearance"`
	PanelWidths               panelWidths               `json:"panelWidths"`
	Workspaces                []workspaceChoiceResponse `json:"workspaces,omitempty"`
	WorkspaceSelectionEnabled bool                      `json:"workspaceSelectionEnabled"`
}

type panelWidths struct {
	LeftRatio        float64 `json:"leftRatio"`
	RightRatio       float64 `json:"rightRatio"`
	DocumentTOCRatio float64 `json:"documentTOCRatio"`
}

type updatePanelWidthsRequest struct {
	LeftRatio        *float64 `json:"leftRatio"`
	RightRatio       *float64 `json:"rightRatio"`
	DocumentTOCRatio *float64 `json:"documentTOCRatio"`
}

type homeResponse struct {
	ID               string                    `json:"id"`
	Type             string                    `json:"type"`
	Title            string                    `json:"title"`
	Description      string                    `json:"description"`
	Path             string                    `json:"path"`
	Body             string                    `json:"body"`
	InlineReferences []inlineReferenceResponse `json:"inlineReferences,omitempty"`
}

type calendarDocumentResponse struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	Graph string `json:"graph"`
	Title string `json:"title"`
	Path  string `json:"path"`
	Body  string `json:"body"`
}

type graphTreeNodeResponse struct {
	GraphPath   string                  `json:"graphPath"`
	DisplayName string                  `json:"displayName"`
	DirectCount int                     `json:"directCount"`
	TotalCount  int                     `json:"totalCount"`
	HasChildren bool                    `json:"hasChildren"`
	CountLabel  string                  `json:"countLabel"`
	Color       string                  `json:"color,omitempty"`
	Files       []graphTreeFileResponse `json:"files"`
}

type graphTreeFileResponse struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Title    string `json:"title"`
	Path     string `json:"path"`
	FileName string `json:"fileName"`
}

type graphTreeResponse struct {
	Home   homeResponse            `json:"home"`
	Graphs []graphTreeNodeResponse `json:"graphs"`
}

type graphCanvasResponse struct {
	SelectedGraph   string                         `json:"selectedGraph"`
	AvailableGraphs []string                       `json:"availableGraphs"`
	LayerGuidance   graph.GraphCanvasLayerGuidance `json:"layerGuidance"`
	Nodes           []graph.GraphCanvasNode        `json:"nodes"`
	Edges           []graph.GraphCanvasEdge        `json:"edges"`
	Viewport        *graphLayoutViewportRequest    `json:"viewport,omitempty"`
}

type graphLayoutViewportRequest struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Zoom float64 `json:"zoom"`
}

type graphLayoutPositionRequest struct {
	DocumentID string  `json:"documentId"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
}

type graphLayoutRequest struct {
	Graph     string                       `json:"graph"`
	Positions []graphLayoutPositionRequest `json:"positions"`
	Viewport  *graphLayoutViewportRequest  `json:"viewport,omitempty"`
}

type graphLayoutResponse struct {
	Graph     string                       `json:"graph"`
	Positions []graphLayoutPositionRequest `json:"positions"`
	Viewport  *graphLayoutViewportRequest  `json:"viewport,omitempty"`
}

type documentResponse struct {
	ID               string                    `json:"id"`
	Type             string                    `json:"type"`
	FeatureSlug      string                    `json:"featureSlug"`
	Graph            string                    `json:"graph"`
	Title            string                    `json:"title"`
	Description      string                    `json:"description"`
	Path             string                    `json:"path"`
	Tags             []string                  `json:"tags,omitempty"`
	CreatedAt        string                    `json:"createdAt,omitempty"`
	UpdatedAt        string                    `json:"updatedAt,omitempty"`
	Body             string                    `json:"body"`
	Status           string                    `json:"status,omitempty"`
	Links            []nodeReferenceResponse   `json:"links,omitempty"`
	Name             string                    `json:"name,omitempty"`
	Env              map[string]string         `json:"env,omitempty"`
	Run              string                    `json:"run,omitempty"`
	RelatedNoteIDs   []string                  `json:"relatedNoteIds,omitempty"`
	InlineReferences []inlineReferenceResponse `json:"inlineReferences,omitempty"`
}

type inlineReferenceResponse struct {
	Token            string `json:"token"`
	Raw              string `json:"raw"`
	TargetID         string `json:"targetId"`
	TargetType       string `json:"targetType"`
	TargetGraph      string `json:"targetGraph"`
	TargetTitle      string `json:"targetTitle"`
	TargetPath       string `json:"targetPath"`
	TargetBreadcrumb string `json:"targetBreadcrumb"`
}

type referenceTargetResponse struct {
	ID         string `json:"id"`
	Type       string `json:"type"`
	Graph      string `json:"graph"`
	Title      string `json:"title"`
	Path       string `json:"path"`
	Breadcrumb string `json:"breadcrumb"`
}

type errorResponse struct {
	Error string `json:"error"`
}

type createDocumentRequest struct {
	Type        string                  `json:"type"`
	FeatureSlug string                  `json:"featureSlug"`
	FileName    string                  `json:"fileName"`
	ID          string                  `json:"id"`
	Graph       string                  `json:"graph"`
	Title       string                  `json:"title"`
	Description string                  `json:"description"`
	Tags        []string                `json:"tags"`
	CreatedAt   string                  `json:"createdAt"`
	UpdatedAt   string                  `json:"updatedAt"`
	Body        string                  `json:"body"`
	Status      string                  `json:"status"`
	Links       []nodeReferenceResponse `json:"links"`
	Name        string                  `json:"name"`
	Env         map[string]string       `json:"env"`
	Run         string                  `json:"run"`
}

type updateDocumentRequest struct {
	ID          *string                  `json:"id"`
	Graph       *string                  `json:"graph"`
	FileName    *string                  `json:"fileName"`
	Title       *string                  `json:"title"`
	Description *string                  `json:"description"`
	Tags        *[]string                `json:"tags"`
	CreatedAt   *string                  `json:"createdAt"`
	UpdatedAt   *string                  `json:"updatedAt"`
	Body        *string                  `json:"body"`
	Status      *string                  `json:"status"`
	Links       *[]nodeReferenceResponse `json:"links"`
	Name        *string                  `json:"name"`
	Env         *map[string]string       `json:"env"`
	Run         *string                  `json:"run"`
}

type updateHomeRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Body        *string `json:"body"`
}

type updateWorkspaceRequest struct {
	Appearance  *string                   `json:"appearance"`
	PanelWidths *updatePanelWidthsRequest `json:"panelWidths"`
}

type selectWorkspaceRequest struct {
	WorkspacePath string `json:"workspacePath"`
}

type createGraphRequest struct {
	Name string `json:"name"`
}

type createGraphFilesResponse struct {
	Created []documentResponse       `json:"created"`
	Failed  []createGraphFileFailure `json:"failed,omitempty"`
}

type createGraphFileFailure struct {
	File  string `json:"file"`
	Error string `json:"error"`
}

type renameGraphRequest struct {
	Name string `json:"name"`
}

type createGraphResponse struct {
	Name string `json:"name"`
}

type updateGraphColorRequest struct {
	Color string `json:"color"`
}

type updateGraphColorResponse struct {
	Name  string `json:"name"`
	Color string `json:"color,omitempty"`
}

type deleteDocumentResponse struct {
	Deleted bool   `json:"deleted"`
	ID      string `json:"id"`
	Path    string `json:"path"`
}

type deleteGraphResponse struct {
	Deleted bool   `json:"deleted"`
	Name    string `json:"name"`
}

type rebuildIndexResponse struct {
	Rebuilt bool `json:"rebuilt"`
}

type mergeDocumentsRequest struct {
	DocumentIDs []string `json:"documentIds"`
}

type nodeReferenceResponse struct {
	Node          string   `json:"node"`
	Context       string   `json:"context,omitempty"`
	Relationships []string `json:"relationships,omitempty"`
}

type addReferenceRequest struct {
	FromID        string   `json:"fromId"`
	ToID          string   `json:"toId"`
	Context       string   `json:"context"`
	Relationships []string `json:"relationships,omitempty"`
}

type removeReferenceRequest struct {
	FromID string `json:"fromId"`
	ToID   string `json:"toId"`
}

type updateReferenceContextRequest struct {
	FromID        string   `json:"fromId"`
	ToID          string   `json:"toId"`
	Context       string   `json:"context"`
	Relationships []string `json:"relationships,omitempty"`
}

// NewMux returns an HTTP handler backed by embedded frontend assets and read/query APIs.
func NewMux(options Options) (http.Handler, error) {
	assets, err := staticFS()
	if err != nil {
		return nil, err
	}

	api := &apiHandler{options: options}
	staticHandler := http.FileServer(http.FS(assets))

	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if strings.HasPrefix(request.URL.Path, "/api/") {
			api.ServeHTTP(writer, request)
			return
		}

		staticHandler.ServeHTTP(writer, request)
	}), nil
}

type apiHandler struct {
	options Options
}

func (handler *apiHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	switch {
	case request.URL.Path == "/api/documents" && request.Method == http.MethodPost:
		handler.handleCreateDocument(writer, request)
	case request.URL.Path == "/api/links" && request.Method == http.MethodPost:
		handler.handleAddReference(writer, request)
	case request.URL.Path == "/api/links" && request.Method == http.MethodPatch:
		handler.handleUpdateReferenceContext(writer, request)
	case request.URL.Path == "/api/links" && request.Method == http.MethodDelete:
		handler.handleRemoveReference(writer, request)
	case request.URL.Path == "/api/documents/merge" && request.Method == http.MethodPost:
		handler.handleMergeDocuments(writer, request)
	case request.URL.Path == "/api/home" && request.Method == http.MethodGet:
		handler.handleHome(writer, request)
	case request.URL.Path == "/api/home" && request.Method == http.MethodPut:
		handler.handleUpdateHome(writer, request)
	case request.URL.Path == "/api/calendar-documents" && request.Method == http.MethodGet:
		handler.handleCalendarDocuments(writer, request)
	case request.URL.Path == "/api/workspace" && request.Method == http.MethodPut:
		handler.handleUpdateWorkspace(writer, request)
	case request.URL.Path == "/api/workspace/select" && request.Method == http.MethodPut:
		handler.handleSelectWorkspace(writer, request)
	case request.URL.Path == "/api/graphs" && request.Method == http.MethodGet:
		handler.handleGraphTree(writer, request)
	case request.URL.Path == "/api/graphs" && request.Method == http.MethodPost:
		handler.handleCreateGraph(writer, request)
	case strings.HasPrefix(request.URL.Path, "/api/graphs/") && strings.HasSuffix(request.URL.Path, "/files") && request.Method == http.MethodPost:
		handler.handleCreateGraphFiles(writer, request)
	case strings.HasPrefix(request.URL.Path, "/api/graphs/") && strings.HasSuffix(request.URL.Path, "/color") && request.Method == http.MethodPut:
		handler.handleUpdateGraphColor(writer, request)
	case strings.HasPrefix(request.URL.Path, "/api/graphs/") && request.Method == http.MethodPatch:
		handler.handleRenameGraph(writer, request)
	case strings.HasPrefix(request.URL.Path, "/api/graphs/") && request.Method == http.MethodDelete:
		handler.handleDeleteGraph(writer, request)
	case request.URL.Path == "/api/graph-canvas" && request.Method == http.MethodGet:
		handler.handleGraphCanvas(writer, request)
	case request.URL.Path == "/api/graph-layout" && request.Method == http.MethodPut:
		handler.handleGraphLayout(writer, request)
	case request.URL.Path == "/api/workspace" && request.Method == http.MethodGet:
		handler.handleWorkspace(writer, request)
	case request.URL.Path == "/api/index/rebuild" && request.Method == http.MethodPost:
		handler.handleRebuildIndex(writer, request)
	case request.URL.Path == "/api/search" && request.Method == http.MethodGet:
		handler.handleSearch(writer, request)
	case request.URL.Path == "/api/reference-targets" && request.Method == http.MethodGet:
		handler.handleReferenceTargets(writer, request)
	case request.URL.Path == "/api/files" && request.Method == http.MethodGet:
		handler.handleWorkspaceFile(writer, request)
	case request.URL.Path == "/api/gui/stop" && request.Method == http.MethodPost:
		handler.handleGUIStop(writer, request)
	case request.URL.Path == "/api/node-view" && request.Method == http.MethodGet:
		handler.handleNodeView(writer, request)
	case strings.HasPrefix(request.URL.Path, "/api/documents/") && request.Method == http.MethodPut:
		handler.handleUpdateDocument(writer, request)
	case strings.HasPrefix(request.URL.Path, "/api/documents/") && request.Method == http.MethodDelete:
		handler.handleDeleteDocument(writer, request)
	case strings.HasPrefix(request.URL.Path, "/api/documents/") && request.Method == http.MethodGet:
		handler.handleDocument(writer, request)
	default:
		writeError(writer, http.StatusNotFound, "endpoint not found")
	}
}

func (handler *apiHandler) handleCreateDocument(writer http.ResponseWriter, request *http.Request) {
	var payload createDocumentRequest
	if err := decodeJSONRequest(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	documentType := markdown.DocumentType(strings.TrimSpace(payload.Type))
	workspaceDocument, err := workspace.CreateDocument(handler.options.Root, workspace.CreateDocumentInput{
		Type:        documentType,
		FeatureSlug: strings.TrimSpace(payload.FeatureSlug),
		FileName:    strings.TrimSpace(payload.FileName),
		ID:          strings.TrimSpace(payload.ID),
		Graph:       strings.TrimSpace(payload.Graph),
		Title:       payload.Title,
		Description: payload.Description,
		Tags:        payload.Tags,
		CreatedAt:   payload.CreatedAt,
		UpdatedAt:   payload.UpdatedAt,
		Body:        payload.Body,
		Status:      payload.Status,
		Links:       nodeLinksFromPayload(payload.Links),
		Name:        payload.Name,
		Env:         payload.Env,
		Run:         payload.Run,
	})
	if err != nil {
		writeMutationError(writer, err)
		return
	}

	response, err := loadDocumentResponse(handler.options.Root, documentIDForResponse(workspaceDocument.Document))
	if err != nil {
		writeMutationError(writer, err)
		return
	}

	writeJSON(writer, http.StatusCreated, response)
}

func (handler *apiHandler) handleWorkspace(writer http.ResponseWriter, _ *http.Request) {
	workspaceConfig, err := readWorkspaceConfig(handler.options.Root)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	if err := syncWorkspaceGUIStateToIndex(handler.options.Root, workspaceConfig); err != nil {
		// Keep workspace reads available even when index synchronization fails.
	}

	writeJSON(writer, http.StatusOK, workspaceResponse{
		Scope:         handler.options.Root.Scope,
		WorkspacePath: handler.options.Root.WorkspacePath,
		FlowPath:      handler.options.Root.FlowPath,
		ConfigPath:    handler.options.Root.ConfigPath,
		IndexPath:     handler.options.Root.IndexPath,
		HomePath:      filepath.ToSlash(filepath.Join(workspace.DataDirName, workspace.HomeFileName)),
		GUIPort:       workspaceConfig.GUI.Port,
		Appearance:    workspaceConfig.GUI.Appearance,
		PanelWidths: panelWidths{
			LeftRatio:        workspaceConfig.GUI.PanelWidths.LeftRatio,
			RightRatio:       workspaceConfig.GUI.PanelWidths.RightRatio,
			DocumentTOCRatio: workspaceConfig.GUI.PanelWidths.DocumentTOCRatio,
		},
		Workspaces:                workspaceChoicesForResponse(handler.options.Root, handler.options.GlobalLocatorPath),
		WorkspaceSelectionEnabled: workspaceSelectionEnabled(handler.options),
	})
}

func (handler *apiHandler) handleSelectWorkspace(writer http.ResponseWriter, request *http.Request) {
	if !workspaceSelectionEnabled(handler.options) {
		writeError(writer, http.StatusForbidden, "workspace selection is disabled for this GUI session")
		return
	}

	var payload selectWorkspaceRequest
	if err := decodeJSONRequest(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	selectedPath := strings.TrimSpace(payload.WorkspacePath)
	if selectedPath == "" {
		writeError(writer, http.StatusBadRequest, "workspacePath must not be empty")
		return
	}

	choices := workspaceChoicesForResponse(handler.options.Root, handler.options.GlobalLocatorPath)
	selectedScope := workspace.LocalScope
	matched := false
	for _, choice := range choices {
		if choice.WorkspacePath == selectedPath {
			selectedScope = choice.Scope
			matched = true
			break
		}
	}

	if !matched {
		writeError(writer, http.StatusBadRequest, "workspace is not tracked")
		return
	}

	resolved, err := workspace.ResolveLocal(selectedPath)
	if err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}
	resolved.Scope = selectedScope

	if info, statErr := os.Stat(resolved.FlowPath); statErr != nil || !info.IsDir() {
		writeError(writer, http.StatusBadRequest, "selected workspace is not initialized")
		return
	}

	handler.options.Root = resolved
	handler.handleWorkspace(writer, request)
}

func workspaceSelectionEnabled(options Options) bool {
	launchScope := options.LaunchScope
	if launchScope == "" {
		launchScope = options.Root.Scope
	}

	return launchScope == workspace.GlobalScope
}

func workspaceChoicesForResponse(current workspace.Root, locatorPath string) []workspaceChoiceResponse {
	choices := []workspaceChoiceResponse{{Scope: current.Scope, WorkspacePath: current.WorkspacePath}}

	if strings.TrimSpace(locatorPath) == "" {
		return choices
	}

	locator, err := workspace.ReadGlobalLocator(locatorPath)
	if err != nil {
		return choices
	}

	seen := map[string]struct{}{current.WorkspacePath: {}}
	appendChoice := func(scope workspace.Scope, pathValue string) {
		if strings.TrimSpace(pathValue) == "" {
			return
		}
		if _, exists := seen[pathValue]; exists {
			return
		}
		seen[pathValue] = struct{}{}
		choices = append(choices, workspaceChoiceResponse{Scope: scope, WorkspacePath: pathValue})
	}

	appendChoice(workspace.GlobalScope, locator.WorkspacePath)
	for _, localPath := range locator.LocalWorkspaces {
		appendChoice(workspace.LocalScope, localPath)
	}

	return choices
}

func (handler *apiHandler) handleUpdateWorkspace(writer http.ResponseWriter, request *http.Request) {
	var payload updateWorkspaceRequest
	if err := decodeJSONRequest(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	workspaceConfig, err := readWorkspaceConfig(handler.options.Root)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	if payload.PanelWidths != nil {
		if payload.PanelWidths.LeftRatio != nil {
			workspaceConfig.GUI.PanelWidths.LeftRatio = *payload.PanelWidths.LeftRatio
		}
		if payload.PanelWidths.RightRatio != nil {
			workspaceConfig.GUI.PanelWidths.RightRatio = *payload.PanelWidths.RightRatio
		}
		if payload.PanelWidths.DocumentTOCRatio != nil {
			workspaceConfig.GUI.PanelWidths.DocumentTOCRatio = *payload.PanelWidths.DocumentTOCRatio
		}
	}
	if payload.Appearance != nil {
		workspaceConfig.GUI.Appearance = strings.TrimSpace(*payload.Appearance)
	}

	if err := config.Write(handler.options.Root.ConfigPath, workspaceConfig); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	handler.handleWorkspace(writer, request)
}

func (handler *apiHandler) handleRebuildIndex(writer http.ResponseWriter, _ *http.Request) {
	if err := index.Rebuild(handler.options.Root.IndexPath, handler.options.Root.FlowPath); err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, rebuildIndexResponse{Rebuilt: true})
}

func (handler *apiHandler) handleHome(writer http.ResponseWriter, _ *http.Request) {
	home, err := loadHomeResponse(handler.options.Root)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, home)
}

func (handler *apiHandler) handleUpdateHome(writer http.ResponseWriter, request *http.Request) {
	var payload updateHomeRequest
	if err := decodeJSONRequest(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	if err := writeHomeDocument(handler.options.Root, payload); err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	home, err := loadHomeResponse(handler.options.Root)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, home)
}

func (handler *apiHandler) handleCalendarDocuments(writer http.ResponseWriter, _ *http.Request) {
	documents, err := loadCalendarDocumentResponses(handler.options.Root)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, documents)
}

func (handler *apiHandler) handleCreateGraph(writer http.ResponseWriter, request *http.Request) {
	var payload createGraphRequest
	if err := decodeJSONRequest(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	if err := workspace.CreateGraph(handler.options.Root, workspace.CreateGraphInput{Name: payload.Name}); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	if err := index.Rebuild(handler.options.Root.IndexPath, handler.options.Root.FlowPath); err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(writer, http.StatusCreated, createGraphResponse{Name: payload.Name})
}

func (handler *apiHandler) handleCreateGraphFiles(writer http.ResponseWriter, request *http.Request) {
	graphName, ok := graphNameFromGraphFilesRequestPath(request.URL.Path)
	if !ok {
		writeError(writer, http.StatusBadRequest, "graph name must not be empty")
		return
	}

	graphDir := filepath.Join(handler.options.Root.GraphsPath, filepath.FromSlash(graphName))
	if info, err := os.Stat(graphDir); err != nil || !info.IsDir() {
		writeError(writer, http.StatusNotFound, fmt.Sprintf("graph %q not found", graphName))
		return
	}

	if err := request.ParseMultipartForm(128 << 20); err != nil {
		writeError(writer, http.StatusBadRequest, fmt.Sprintf("parse multipart form: %v", err))
		return
	}

	fileHeaders := request.MultipartForm.File["files"]
	if len(fileHeaders) == 0 {
		for _, entries := range request.MultipartForm.File {
			fileHeaders = append(fileHeaders, entries...)
		}
	}

	if len(fileHeaders) == 0 {
		writeError(writer, http.StatusBadRequest, "no files were provided")
		return
	}

	response := createGraphFilesResponse{Created: make([]documentResponse, 0, len(fileHeaders))}
	for _, header := range fileHeaders {
		created, err := handler.createGraphFileNote(graphName, header)
		if err != nil {
			response.Failed = append(response.Failed, createGraphFileFailure{File: header.Filename, Error: err.Error()})
			continue
		}

		response.Created = append(response.Created, created)
	}

	if len(response.Created) == 0 {
		writeJSON(writer, http.StatusBadRequest, response)
		return
	}

	writeJSON(writer, http.StatusCreated, response)
}

func (handler *apiHandler) createGraphFileNote(graphName string, header *multipart.FileHeader) (documentResponse, error) {
	originalFileName := filepath.Base(strings.TrimSpace(header.Filename))
	if originalFileName == "" || originalFileName == "." {
		return documentResponse{}, fmt.Errorf("invalid file name")
	}

	assetFileName := makeUniqueFileName(handler.options.Root, graphName, sanitizeAssetFileName(originalFileName))
	assetRelativePath := filepath.ToSlash(filepath.Join(workspace.DataDirName, workspace.GraphsDirName, filepath.FromSlash(graphName), assetFileName))
	assetAbsolutePath := filepath.Join(handler.options.Root.FlowPath, filepath.FromSlash(assetRelativePath))

	if err := os.MkdirAll(filepath.Dir(assetAbsolutePath), 0o755); err != nil {
		return documentResponse{}, fmt.Errorf("create file directory: %w", err)
	}

	source, err := header.Open()
	if err != nil {
		return documentResponse{}, fmt.Errorf("open uploaded file: %w", err)
	}
	defer source.Close()

	target, err := os.Create(assetAbsolutePath)
	if err != nil {
		return documentResponse{}, fmt.Errorf("create workspace file: %w", err)
	}
	if _, err := io.Copy(target, source); err != nil {
		_ = target.Close()
		return documentResponse{}, fmt.Errorf("write workspace file: %w", err)
	}
	if err := target.Close(); err != nil {
		return documentResponse{}, fmt.Errorf("close workspace file: %w", err)
	}

	noteSlug := makeUniqueNoteSlug(handler.options.Root, graphName, strings.TrimSuffix(assetFileName, filepath.Ext(assetFileName)))
	title := titleFromFileName(originalFileName)
	assetURL := "/api/files?path=" + url.QueryEscape(assetRelativePath)
	body := noteBodyForAsset(assetURL, title, filepath.Ext(assetFileName))

	createdDocument, err := workspace.CreateDocument(handler.options.Root, workspace.CreateDocumentInput{
		Type:        markdown.NoteType,
		FeatureSlug: graphName,
		FileName:    noteSlug,
		ID:          filepath.ToSlash(filepath.Join(graphName, noteSlug)),
		Graph:       graphName,
		Title:       title,
		Description: "",
		Body:        body,
	})
	if err != nil {
		return documentResponse{}, err
	}

	return loadDocumentResponse(handler.options.Root, documentIDForResponse(createdDocument.Document))
}

func (handler *apiHandler) handleWorkspaceFile(writer http.ResponseWriter, request *http.Request) {
	pathValue := strings.TrimSpace(request.URL.Query().Get("path"))
	if pathValue == "" {
		writeError(writer, http.StatusBadRequest, "path must not be empty")
		return
	}

	cleaned := filepath.Clean(filepath.FromSlash(pathValue))
	if cleaned == "." || strings.HasPrefix(cleaned, "..") {
		writeError(writer, http.StatusBadRequest, "path is invalid")
		return
	}

	absolutePath := filepath.Join(handler.options.Root.FlowPath, cleaned)
	relativeToFlow, err := filepath.Rel(handler.options.Root.FlowPath, absolutePath)
	if err != nil || strings.HasPrefix(relativeToFlow, "..") {
		writeError(writer, http.StatusBadRequest, "path is invalid")
		return
	}

	if _, err := os.Stat(absolutePath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			writeError(writer, http.StatusNotFound, "file not found")
			return
		}
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	if contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(absolutePath))); contentType != "" {
		writer.Header().Set("Content-Type", contentType)
	}
	http.ServeFile(writer, request, absolutePath)
}

func (handler *apiHandler) handleGraphTree(writer http.ResponseWriter, _ *http.Request) {
	nodes, err := index.ReadGraphNodesWorkspace(handler.options.Root.IndexPath, handler.options.Root.FlowPath)
	if err != nil {
		// Keep the GUI tree route responsive even when index projection data is unavailable.
		nodes = nil
	}

	documents, err := workspace.LoadDocuments(handler.options.Root.FlowPath)
	if err != nil {
		// Best-effort: a single malformed document should not blank the entire GUI shell.
		documents = nil
	}

	home, err := loadHomeResponse(handler.options.Root)
	if err != nil {
		home = homeResponse{ID: "home", Type: "home", Title: "Home", Path: filepath.ToSlash(filepath.Join(workspace.DataDirName, workspace.HomeFileName))}
	}

	filesByGraph := make(map[string][]graphTreeFileResponse)
	for _, item := range documents {
		graphPath, ok, err := markdown.GraphPathFromWorkspacePath(item.Path)
		if err != nil {
			writeError(writer, http.StatusInternalServerError, err.Error())
			return
		}
		if !ok {
			continue
		}

		file, ok := graphTreeFileFromWorkspaceDocument(item)
		if !ok {
			continue
		}

		filesByGraph[graphPath] = append(filesByGraph[graphPath], file)
	}

	for graphPath := range filesByGraph {
		slices.SortFunc(filesByGraph[graphPath], func(left graphTreeFileResponse, right graphTreeFileResponse) int {
			return strings.Compare(left.FileName, right.FileName)
		})
	}

	response := graphTreeResponse{Home: home, Graphs: make([]graphTreeNodeResponse, 0, len(nodes))}
	graphDirectoryColors := map[string]string{}
	if colors, colorErr := pruneWorkspaceGraphDirectoryColors(handler.options.Root, nodes); colorErr == nil {
		graphDirectoryColors = colors
	}
	if len(nodes) > 0 {
		for _, node := range nodes {
			response.Graphs = append(response.Graphs, graphTreeNodeResponse{
				GraphPath:   node.GraphPath,
				DisplayName: node.DisplayName,
				DirectCount: node.DirectCount,
				TotalCount:  node.TotalCount,
				HasChildren: node.HasChildren,
				CountLabel:  fmt.Sprintf("%d direct / %d total", node.DirectCount, node.TotalCount),
				Color:       graphDirectoryColors[node.GraphPath],
				Files:       filesByGraph[node.GraphPath],
			})
		}
	} else if len(filesByGraph) > 0 {
		graphPaths := make([]string, 0, len(filesByGraph))
		for graphPath := range filesByGraph {
			graphPaths = append(graphPaths, graphPath)
		}
		slices.Sort(graphPaths)

		for _, graphPath := range graphPaths {
			directCount := len(filesByGraph[graphPath])
			response.Graphs = append(response.Graphs, graphTreeNodeResponse{
				GraphPath:   graphPath,
				DisplayName: graphPath,
				DirectCount: directCount,
				TotalCount:  directCount,
				HasChildren: false,
				CountLabel:  fmt.Sprintf("%d direct / %d total", directCount, directCount),
				Files:       filesByGraph[graphPath],
			})
		}
	}

	writeJSON(writer, http.StatusOK, response)
}

func pruneWorkspaceGraphDirectoryColors(root workspace.Root, nodes []index.GraphNode) (map[string]string, error) {
	workspaceConfig, err := readWorkspaceConfig(root)
	if err != nil {
		return nil, err
	}

	if len(workspaceConfig.GUI.GraphDirectoryColors) == 0 {
		return map[string]string{}, nil
	}

	validGraphPaths := make(map[string]struct{}, len(nodes))
	for _, node := range nodes {
		validGraphPaths[node.GraphPath] = struct{}{}
	}

	nextColors := make(map[string]string, len(workspaceConfig.GUI.GraphDirectoryColors))
	changed := false
	for graphPath, color := range workspaceConfig.GUI.GraphDirectoryColors {
		if _, ok := validGraphPaths[graphPath]; !ok {
			changed = true
			continue
		}
		nextColors[graphPath] = color
	}

	if !changed {
		return workspaceConfig.GUI.GraphDirectoryColors, nil
	}

	workspaceConfig.GUI.GraphDirectoryColors = nextColors
	if err := config.Write(root.ConfigPath, workspaceConfig); err != nil {
		return nil, err
	}

	if err := syncWorkspaceGUIStateToIndex(root, workspaceConfig); err != nil {
		return nil, err
	}

	return nextColors, nil
}

func graphTreeFileFromWorkspaceDocument(item markdown.WorkspaceDocument) (graphTreeFileResponse, bool) {
	switch document := item.Document.(type) {
	case markdown.NoteDocument:
		return graphTreeFileResponse{
			ID:       document.Metadata.ID,
			Type:     string(document.Metadata.Type),
			Title:    document.Metadata.Title,
			Path:     item.Path,
			FileName: filepath.Base(item.Path),
		}, true
	case markdown.TaskDocument:
		return graphTreeFileResponse{
			ID:       document.Metadata.ID,
			Type:     string(document.Metadata.Type),
			Title:    document.Metadata.Title,
			Path:     item.Path,
			FileName: filepath.Base(item.Path),
		}, true
	case markdown.CommandDocument:
		return graphTreeFileResponse{
			ID:       document.Metadata.ID,
			Type:     string(document.Metadata.Type),
			Title:    document.Metadata.Title,
			Path:     item.Path,
			FileName: filepath.Base(item.Path),
		}, true
	default:
		return graphTreeFileResponse{}, false
	}
}

func (handler *apiHandler) handleGraphCanvas(writer http.ResponseWriter, request *http.Request) {
	selectedGraph := strings.TrimSpace(request.URL.Query().Get("graph"))
	if selectedGraph == "" {
		writeError(writer, http.StatusBadRequest, "graph query parameter must not be empty")
		return
	}

	documents, err := workspace.LoadDocuments(handler.options.Root.FlowPath)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	layoutPositions, err := index.ReadGraphLayoutPositionsWorkspace(handler.options.Root.IndexPath, handler.options.Root.FlowPath, selectedGraph)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "must not be empty") {
			status = http.StatusBadRequest
		}

		writeError(writer, status, err.Error())
		return
	}

	persistedPositions := make(map[string]graph.GraphCanvasPosition, len(layoutPositions))
	for _, position := range layoutPositions {
		persistedPositions[position.DocumentID] = graph.GraphCanvasPosition{X: position.X, Y: position.Y}
	}

	viewport, hasViewport, err := index.ReadGraphLayoutViewportWorkspace(handler.options.Root.IndexPath, handler.options.Root.FlowPath, selectedGraph)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "must not be empty") {
			status = http.StatusBadRequest
		}

		writeError(writer, status, err.Error())
		return
	}

	view, err := graph.BuildGraphCanvasView(documents, selectedGraph, persistedPositions)
	if err != nil {
		// If the graph exists as an empty directory (no documents yet), return an empty canvas
		// rather than an error so the frontend can show create actions.
		nodes, nodeErr := index.ReadGraphNodesWorkspace(handler.options.Root.IndexPath, handler.options.Root.FlowPath)
		if nodeErr == nil {
			for _, node := range nodes {
				if node.GraphPath == selectedGraph {
					response := graphCanvasResponse{
						SelectedGraph:   selectedGraph,
						AvailableGraphs: []string{selectedGraph},
						Nodes:           []graph.GraphCanvasNode{},
						Edges:           []graph.GraphCanvasEdge{},
					}
					if hasViewport {
						response.Viewport = &graphLayoutViewportRequest{X: viewport.X, Y: viewport.Y, Zoom: viewport.Zoom}
					}
					writeJSON(writer, http.StatusOK, response)
					return
				}
			}
		}
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	response := graphCanvasResponse{
		SelectedGraph:   view.SelectedGraph,
		AvailableGraphs: view.AvailableGraphs,
		LayerGuidance:   view.LayerGuidance,
		Nodes:           view.Nodes,
		Edges:           view.Edges,
	}
	if hasViewport {
		response.Viewport = &graphLayoutViewportRequest{X: viewport.X, Y: viewport.Y, Zoom: viewport.Zoom}
	}

	writeJSON(writer, http.StatusOK, response)
}

func (handler *apiHandler) handleGraphLayout(writer http.ResponseWriter, request *http.Request) {
	var payload graphLayoutRequest
	if err := decodeJSONRequest(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	selectedGraph := strings.TrimSpace(payload.Graph)
	if selectedGraph == "" {
		writeError(writer, http.StatusBadRequest, "graph must not be empty")
		return
	}
	if len(payload.Positions) == 0 && payload.Viewport == nil {
		writeError(writer, http.StatusBadRequest, "positions and viewport must not both be empty")
		return
	}

	documents, err := workspace.LoadDocuments(handler.options.Root.FlowPath)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	view, err := graph.BuildGraphCanvasView(documents, selectedGraph, nil)
	if err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	visibleDocumentIDs := make(map[string]struct{}, len(view.Nodes))
	for _, node := range view.Nodes {
		visibleDocumentIDs[node.ID] = struct{}{}
	}

	positions := make([]index.GraphLayoutPosition, 0, len(payload.Positions))
	responsePositions := make([]graphLayoutPositionRequest, 0, len(payload.Positions))
	for _, position := range payload.Positions {
		documentID := strings.TrimSpace(position.DocumentID)
		if documentID == "" {
			writeError(writer, http.StatusBadRequest, "documentId must not be empty")
			return
		}

		if _, ok := visibleDocumentIDs[documentID]; !ok {
			writeError(writer, http.StatusBadRequest, fmt.Sprintf("document %q is not visible in graph %q", documentID, selectedGraph))
			return
		}

		positions = append(positions, index.GraphLayoutPosition{
			GraphPath:  selectedGraph,
			DocumentID: documentID,
			X:          position.X,
			Y:          position.Y,
		})
		responsePositions = append(responsePositions, graphLayoutPositionRequest{
			DocumentID: documentID,
			X:          position.X,
			Y:          position.Y,
		})
	}

	if err := index.WriteGraphLayoutPositionsWorkspace(handler.options.Root.IndexPath, handler.options.Root.FlowPath, positions); err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	var responseViewport *graphLayoutViewportRequest
	if payload.Viewport != nil {
		viewport := index.GraphLayoutViewport{
			GraphPath: selectedGraph,
			X:         payload.Viewport.X,
			Y:         payload.Viewport.Y,
			Zoom:      payload.Viewport.Zoom,
		}
		if err := index.WriteGraphLayoutViewportWorkspace(handler.options.Root.IndexPath, handler.options.Root.FlowPath, viewport); err != nil {
			if strings.Contains(err.Error(), "zoom must be greater than zero") {
				writeError(writer, http.StatusBadRequest, err.Error())
				return
			}
			writeError(writer, http.StatusInternalServerError, err.Error())
			return
		}

		responseViewport = &graphLayoutViewportRequest{X: viewport.X, Y: viewport.Y, Zoom: viewport.Zoom}
	}

	writeJSON(writer, http.StatusOK, graphLayoutResponse{Graph: selectedGraph, Positions: responsePositions, Viewport: responseViewport})
}

func (handler *apiHandler) handleDocument(writer http.ResponseWriter, request *http.Request) {
	documentID := strings.TrimPrefix(request.URL.Path, "/api/documents/")
	if strings.TrimSpace(documentID) == "" {
		writeError(writer, http.StatusBadRequest, "document id must not be empty")
		return
	}

	documents, err := workspace.LoadDocuments(handler.options.Root.FlowPath)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	noteView, err := graph.BuildNoteGraphView(documents)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	for _, item := range documents {
		response, ok, err := buildDocumentResponse(item, noteView, documents)
		if err != nil {
			writeError(writer, http.StatusInternalServerError, err.Error())
			return
		}

		if ok && response.ID == documentID {
			writeJSON(writer, http.StatusOK, response)
			return
		}
	}

	writeError(writer, http.StatusNotFound, fmt.Sprintf("document %q not found", documentID))
}

func (handler *apiHandler) handleUpdateDocument(writer http.ResponseWriter, request *http.Request) {
	documentID := strings.TrimPrefix(request.URL.Path, "/api/documents/")
	if strings.TrimSpace(documentID) == "" {
		writeError(writer, http.StatusBadRequest, "document id must not be empty")
		return
	}

	var payload updateDocumentRequest
	if err := decodeJSONRequest(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	workspaceDocument, err := workspace.UpdateDocumentByID(handler.options.Root, documentID, workspace.DocumentPatch{
		ID:          payload.ID,
		Graph:       payload.Graph,
		FileName:    payload.FileName,
		Title:       payload.Title,
		Description: payload.Description,
		Tags:        payload.Tags,
		CreatedAt:   payload.CreatedAt,
		UpdatedAt:   payload.UpdatedAt,
		Body:        payload.Body,
		Status:      payload.Status,
		Links:       nodeLinksPatchFromPayload(payload.Links),
		Name:        payload.Name,
		Env:         payload.Env,
		Run:         payload.Run,
	})
	if err != nil {
		writeMutationError(writer, err)
		return
	}

	response, err := loadDocumentResponse(handler.options.Root, documentIDForResponse(workspaceDocument.Document))
	if err != nil {
		writeMutationError(writer, err)
		return
	}

	writeJSON(writer, http.StatusOK, response)
}

func (handler *apiHandler) handleRenameGraph(writer http.ResponseWriter, request *http.Request) {
	graphName, ok := graphNameFromGraphRequestPath(request.URL.Path)
	if !ok {
		writeError(writer, http.StatusBadRequest, "graph name must not be empty")
		return
	}

	if strings.TrimSpace(graphName) == "" {
		writeError(writer, http.StatusBadRequest, "graph name must not be empty")
		return
	}

	var payload renameGraphRequest
	if err := decodeJSONRequest(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}
	payload.Name = strings.TrimSpace(payload.Name)

	if err := workspace.RenameGraph(handler.options.Root, graphName, payload.Name); err != nil {
		writeMutationError(writer, err)
		return
	}

	if err := remapGraphDirectoryColors(handler.options.Root, graphName, payload.Name); err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, createGraphResponse{Name: payload.Name})
}

func (handler *apiHandler) handleDeleteGraph(writer http.ResponseWriter, request *http.Request) {
	graphName, ok := graphNameFromGraphRequestPath(request.URL.Path)
	if !ok {
		writeError(writer, http.StatusBadRequest, "graph name must not be empty")
		return
	}

	if strings.TrimSpace(graphName) == "" {
		writeError(writer, http.StatusBadRequest, "graph name must not be empty")
		return
	}

	if err := workspace.DeleteGraph(handler.options.Root, graphName); err != nil {
		writeMutationError(writer, err)
		return
	}

	if err := deleteGraphDirectoryColors(handler.options.Root, graphName); err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, deleteGraphResponse{Deleted: true, Name: graphName})
}

func (handler *apiHandler) handleUpdateGraphColor(writer http.ResponseWriter, request *http.Request) {
	graphName, ok := graphNameFromGraphColorRequestPath(request.URL.Path)
	if !ok {
		writeError(writer, http.StatusBadRequest, "graph name must not be empty")
		return
	}

	graphDir := filepath.Join(handler.options.Root.GraphsPath, filepath.FromSlash(graphName))
	if _, err := os.Stat(graphDir); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			writeError(writer, http.StatusNotFound, fmt.Sprintf("graph %q not found", graphName))
			return
		}
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	var payload updateGraphColorRequest
	if err := decodeJSONRequest(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	workspaceConfig, err := readWorkspaceConfig(handler.options.Root)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	color := strings.TrimSpace(payload.Color)
	if color == "" {
		if len(workspaceConfig.GUI.GraphDirectoryColors) > 0 {
			delete(workspaceConfig.GUI.GraphDirectoryColors, graphName)
		}
	} else {
		if workspaceConfig.GUI.GraphDirectoryColors == nil {
			workspaceConfig.GUI.GraphDirectoryColors = map[string]string{}
		}
		workspaceConfig.GUI.GraphDirectoryColors[graphName] = color
	}

	if err := config.Write(handler.options.Root.ConfigPath, workspaceConfig); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	if err := syncWorkspaceGUIStateToIndex(handler.options.Root, workspaceConfig); err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, updateGraphColorResponse{Name: graphName, Color: workspaceConfig.GUI.GraphDirectoryColors[graphName]})
}

func (handler *apiHandler) handleDeleteDocument(writer http.ResponseWriter, request *http.Request) {
	documentID := strings.TrimPrefix(request.URL.Path, "/api/documents/")
	if strings.TrimSpace(documentID) == "" {
		writeError(writer, http.StatusBadRequest, "document id must not be empty")
		return
	}

	relativePath, err := workspace.DeleteDocumentByID(handler.options.Root, documentID)
	if err != nil {
		writeMutationError(writer, err)
		return
	}

	writeJSON(writer, http.StatusOK, deleteDocumentResponse{Deleted: true, ID: strings.TrimSpace(documentID), Path: relativePath})
}

func (handler *apiHandler) handleMergeDocuments(writer http.ResponseWriter, request *http.Request) {
	var payload mergeDocumentsRequest
	if err := decodeJSONRequest(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	merged, err := workspace.MergeDocuments(handler.options.Root, workspace.MergeDocumentsInput{
		DocumentIDs: payload.DocumentIDs,
	})
	if err != nil {
		writeMutationError(writer, err)
		return
	}

	response, err := loadDocumentResponse(handler.options.Root, documentIDForResponse(merged.Document))
	if err != nil {
		writeMutationError(writer, err)
		return
	}

	writeJSON(writer, http.StatusOK, response)
}

func (handler *apiHandler) handleAddReference(writer http.ResponseWriter, request *http.Request) {
	var payload addReferenceRequest
	if err := decodeJSONRequest(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	if err := workspace.AddLink(handler.options.Root, payload.FromID, payload.ToID, payload.Context, normalizeRelationshipPayload(payload.Relationships)); err != nil {
		writeMutationError(writer, err)
		return
	}

	response, err := loadDocumentResponse(handler.options.Root, payload.FromID)
	if err != nil {
		writeMutationError(writer, err)
		return
	}

	writeJSON(writer, http.StatusOK, response)
}

func (handler *apiHandler) handleRemoveReference(writer http.ResponseWriter, request *http.Request) {
	var payload removeReferenceRequest
	if err := decodeJSONRequest(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	if err := workspace.RemoveLink(handler.options.Root, payload.FromID, payload.ToID); err != nil {
		writeMutationError(writer, err)
		return
	}

	response, err := loadDocumentResponse(handler.options.Root, payload.FromID)
	if err != nil {
		writeMutationError(writer, err)
		return
	}

	writeJSON(writer, http.StatusOK, response)
}

func (handler *apiHandler) handleUpdateReferenceContext(writer http.ResponseWriter, request *http.Request) {
	var payload updateReferenceContextRequest
	if err := decodeJSONRequest(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	if err := workspace.UpdateLinkContext(handler.options.Root, payload.FromID, payload.ToID, payload.Context, normalizeRelationshipPayload(payload.Relationships)); err != nil {
		writeMutationError(writer, err)
		return
	}

	response, err := loadDocumentResponse(handler.options.Root, payload.FromID)
	if err != nil {
		writeMutationError(writer, err)
		return
	}

	writeJSON(writer, http.StatusOK, response)
}

func (handler *apiHandler) handleSearch(writer http.ResponseWriter, request *http.Request) {
	anyQuery := strings.TrimSpace(request.URL.Query().Get("q"))
	if anyQuery == "" {
		anyQuery = strings.TrimSpace(request.URL.Query().Get("query"))
	}

	filters := index.SearchFilters{
		Any:         anyQuery,
		Tag:         strings.TrimSpace(request.URL.Query().Get("tag")),
		Title:       strings.TrimSpace(request.URL.Query().Get("title")),
		Description: strings.TrimSpace(request.URL.Query().Get("description")),
		Content:     strings.TrimSpace(request.URL.Query().Get("content")),
	}

	limit := 10
	if rawLimit := strings.TrimSpace(request.URL.Query().Get("limit")); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil {
			writeError(writer, http.StatusBadRequest, "limit must be an integer")
			return
		}

		limit = parsedLimit
	}

	results, err := index.SearchWorkspaceWithFilters(handler.options.Root.IndexPath, handler.options.Root.FlowPath, filters, limit)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "must not be empty") {
			status = http.StatusBadRequest
		}

		writeError(writer, status, err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, results)
}

func (handler *apiHandler) handleReferenceTargets(writer http.ResponseWriter, request *http.Request) {
	query := strings.TrimSpace(request.URL.Query().Get("q"))
	if query == "" {
		query = strings.TrimSpace(request.URL.Query().Get("query"))
	}

	limit := 8
	if rawLimit := strings.TrimSpace(request.URL.Query().Get("limit")); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil {
			writeError(writer, http.StatusBadRequest, "limit must be an integer")
			return
		}
		limit = parsedLimit
	}

	documents, err := workspace.LoadDocuments(handler.options.Root.FlowPath)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	targets, err := markdown.LookupReferenceTargets(documents, query, strings.TrimSpace(request.URL.Query().Get("graph")), limit)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "must not be empty") {
			status = http.StatusBadRequest
		}
		writeError(writer, status, err.Error())
		return
	}

	responses := make([]referenceTargetResponse, len(targets))
	for index, target := range targets {
		responses[index] = referenceTargetResponse{
			ID:         target.ID,
			Type:       string(target.Type),
			Graph:      target.Graph,
			Title:      target.Title,
			Path:       target.Path,
			Breadcrumb: target.Breadcrumb,
		}
	}

	writeJSON(writer, http.StatusOK, responses)
}

func (handler *apiHandler) handleNodeView(writer http.ResponseWriter, request *http.Request) {
	id := strings.TrimSpace(request.URL.Query().Get("id"))
	graph := strings.TrimSpace(request.URL.Query().Get("graph"))

	view, err := index.ReadNodeViewWorkspace(handler.options.Root.IndexPath, handler.options.Root.FlowPath, id, graph)
	if err != nil {
		switch {
		case strings.Contains(err.Error(), "must not be empty"):
			writeError(writer, http.StatusBadRequest, err.Error())
		case strings.Contains(err.Error(), "not found"):
			writeError(writer, http.StatusNotFound, err.Error())
		default:
			writeError(writer, http.StatusInternalServerError, err.Error())
		}
		return
	}

	writeJSON(writer, http.StatusOK, view)
}

func (handler *apiHandler) handleGUIStop(writer http.ResponseWriter, _ *http.Request) {
	if handler.options.Stop == nil {
		writeError(writer, http.StatusNotImplemented, "gui stop is not available")
		return
	}

	if err := handler.options.Stop(); err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(writer, http.StatusAccepted, map[string]bool{"stopping": true})
}

func readWorkspaceConfig(root workspace.Root) (config.Workspace, error) {
	workspaceConfig, err := config.Read(root.ConfigPath)
	if err == nil {
		return workspaceConfig, nil
	}

	if config.IsNotFound(err) {
		return config.DefaultWorkspace(), nil
	}

	return config.Workspace{}, err
}

func workspaceConfigGraphColors(root workspace.Root) map[string]string {
	workspaceConfig, err := readWorkspaceConfig(root)
	if err != nil {
		return map[string]string{}
	}
	if workspaceConfig.GUI.GraphDirectoryColors == nil {
		return map[string]string{}
	}

	return workspaceConfig.GUI.GraphDirectoryColors
}

func graphNameFromGraphRequestPath(path string) (string, bool) {
	graphNameRaw := strings.TrimPrefix(path, "/api/graphs/")
	if graphNameRaw == "" {
		return "", false
	}

	decoded, err := url.PathUnescape(graphNameRaw)
	if err != nil {
		return "", false
	}

	return strings.TrimSpace(decoded), strings.TrimSpace(decoded) != ""
}

func graphNameFromGraphColorRequestPath(path string) (string, bool) {
	if !strings.HasSuffix(path, "/color") {
		return "", false
	}

	trimmed := strings.TrimSuffix(path, "/color")
	return graphNameFromGraphRequestPath(trimmed)
}

func graphNameFromGraphFilesRequestPath(path string) (string, bool) {
	if !strings.HasSuffix(path, "/files") {
		return "", false
	}

	trimmed := strings.TrimSuffix(path, "/files")
	return graphNameFromGraphRequestPath(trimmed)
}

func sanitizeAssetFileName(name string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "file.bin"
	}

	base := filepath.Base(trimmed)
	extension := strings.ToLower(filepath.Ext(base))
	stem := strings.TrimSuffix(base, filepath.Ext(base))
	stem = strings.ToLower(stem)
	builder := strings.Builder{}
	for _, r := range stem {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			builder.WriteRune(r)
		case r == '-' || r == '_':
			builder.WriteRune(r)
		case r == ' ' || r == '.':
			builder.WriteRune('-')
		}
	}

	cleanStem := strings.Trim(builder.String(), "-_")
	if cleanStem == "" {
		cleanStem = "file"
	}

	if extension == "" {
		extension = ".bin"
	}
	return cleanStem + extension
}

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

func noteBodyForAsset(assetURL string, title string, extension string) string {
	lowerExt := strings.ToLower(extension)
	if isImageExtension(lowerExt) {
		return fmt.Sprintf("![%s](%s)\n", title, assetURL)
	}

	if lowerExt == ".pdf" {
		return fmt.Sprintf("[%s](%s)\n", title, assetURL)
	}

	return fmt.Sprintf("[%s](%s)\n", title, assetURL)
}

func isImageExtension(extension string) bool {
	switch strings.ToLower(extension) {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp":
		return true
	default:
		return false
	}
}

func makeUniqueFileName(root workspace.Root, graphPath string, candidate string) string {
	base := strings.TrimSuffix(candidate, filepath.Ext(candidate))
	ext := strings.ToLower(filepath.Ext(candidate))
	if base == "" {
		base = "file"
	}
	if ext == "" {
		ext = ".bin"
	}

	for index := 0; ; index++ {
		name := base + ext
		if index > 0 {
			name = fmt.Sprintf("%s-%d%s", base, index+1, ext)
		}

		relativePath := filepath.Join(workspace.DataDirName, workspace.GraphsDirName, filepath.FromSlash(graphPath), name)
		absolutePath := filepath.Join(root.FlowPath, relativePath)
		if _, err := os.Stat(absolutePath); errors.Is(err, os.ErrNotExist) {
			return name
		}
	}
}

func makeUniqueNoteSlug(root workspace.Root, graphPath string, candidate string) string {
	base := strings.TrimSpace(candidate)
	if base == "" {
		base = "file-note"
	}

	for index := 0; ; index++ {
		slug := base
		if index > 0 {
			slug = fmt.Sprintf("%s-%d", base, index+1)
		}

		relativePath, err := markdown.RelativeGraphDocumentPath(graphPath, slug+".md")
		if err != nil {
			return "file-note"
		}
		absolutePath := filepath.Join(root.FlowPath, filepath.FromSlash(relativePath))
		if _, err := os.Stat(absolutePath); errors.Is(err, os.ErrNotExist) {
			return slug
		}
	}
}

func remapGraphDirectoryColors(root workspace.Root, currentGraph string, nextGraph string) error {
	workspaceConfig, err := readWorkspaceConfig(root)
	if err != nil {
		return err
	}

	if len(workspaceConfig.GUI.GraphDirectoryColors) == 0 {
		return nil
	}

	nextColors := make(map[string]string, len(workspaceConfig.GUI.GraphDirectoryColors))
	for graphPath, color := range workspaceConfig.GUI.GraphDirectoryColors {
		remapped := graphPath
		if graphPath == currentGraph {
			remapped = nextGraph
		} else if strings.HasPrefix(graphPath, currentGraph+"/") {
			remapped = nextGraph + strings.TrimPrefix(graphPath, currentGraph)
		}
		nextColors[remapped] = color
	}

	workspaceConfig.GUI.GraphDirectoryColors = nextColors
	if err := config.Write(root.ConfigPath, workspaceConfig); err != nil {
		return err
	}

	if err := syncWorkspaceGUIStateToIndex(root, workspaceConfig); err != nil {
		return err
	}

	return nil
}

func deleteGraphDirectoryColors(root workspace.Root, graphName string) error {
	workspaceConfig, err := readWorkspaceConfig(root)
	if err != nil {
		return err
	}

	if len(workspaceConfig.GUI.GraphDirectoryColors) == 0 {
		return nil
	}

	nextColors := make(map[string]string, len(workspaceConfig.GUI.GraphDirectoryColors))
	for graphPath, color := range workspaceConfig.GUI.GraphDirectoryColors {
		if graphPath == graphName || strings.HasPrefix(graphPath, graphName+"/") {
			continue
		}
		nextColors[graphPath] = color
	}

	workspaceConfig.GUI.GraphDirectoryColors = nextColors
	if err := config.Write(root.ConfigPath, workspaceConfig); err != nil {
		return err
	}

	if err := syncWorkspaceGUIStateToIndex(root, workspaceConfig); err != nil {
		return err
	}

	return nil
}

func syncWorkspaceGUIStateToIndex(root workspace.Root, workspaceConfig config.Workspace) error {
	if strings.TrimSpace(root.IndexPath) == "" || strings.TrimSpace(root.FlowPath) == "" {
		return nil
	}

	if err := index.WriteWorkspaceGUISettingsWorkspace(root.IndexPath, root.FlowPath, index.WorkspaceGUISettings{
		Appearance:      workspaceConfig.GUI.Appearance,
		PanelLeftRatio:  workspaceConfig.GUI.PanelWidths.LeftRatio,
		PanelRightRatio: workspaceConfig.GUI.PanelWidths.RightRatio,
		PanelTOCRatio:   workspaceConfig.GUI.PanelWidths.DocumentTOCRatio,
	}); err != nil {
		return err
	}

	return index.ReplaceWorkspaceGraphDirectoryColorsWorkspace(root.IndexPath, root.FlowPath, workspaceConfig.GUI.GraphDirectoryColors)
}

func buildDocumentResponse(item markdown.WorkspaceDocument, noteView graph.NoteGraphView, documents []markdown.WorkspaceDocument) (documentResponse, bool, error) {
	inlineReferences, err := resolveInlineReferenceResponses(documents, item)
	if err != nil {
		return documentResponse{}, false, err
	}

	switch document := item.Document.(type) {
	case markdown.NoteDocument:
		featureSlug, err := featureSlugFromPath(item.Path)
		if err != nil {
			return documentResponse{}, false, err
		}

		node := noteView.Nodes[document.Metadata.ID]
		return documentResponse{
			ID:               document.Metadata.ID,
			Type:             string(document.Metadata.Type),
			FeatureSlug:      featureSlug,
			Graph:            document.Metadata.Graph,
			Title:            document.Metadata.Title,
			Description:      document.Metadata.Description,
			Path:             item.Path,
			Tags:             cloneStrings(document.Metadata.Tags),
			CreatedAt:        document.Metadata.CreatedAt,
			UpdatedAt:        document.Metadata.UpdatedAt,
			Body:             document.Body,
			Links:            convertLinks(document.Metadata.Links),
			RelatedNoteIDs:   cloneStrings(node.RelatedNoteIDs),
			InlineReferences: inlineReferences,
		}, true, nil
	case markdown.TaskDocument:
		featureSlug, err := featureSlugFromPath(item.Path)
		if err != nil {
			return documentResponse{}, false, err
		}

		return documentResponse{
			ID:               document.Metadata.ID,
			Type:             string(document.Metadata.Type),
			FeatureSlug:      featureSlug,
			Graph:            document.Metadata.Graph,
			Title:            document.Metadata.Title,
			Description:      document.Metadata.Description,
			Path:             item.Path,
			Tags:             cloneStrings(document.Metadata.Tags),
			CreatedAt:        document.Metadata.CreatedAt,
			UpdatedAt:        document.Metadata.UpdatedAt,
			Body:             document.Body,
			Status:           document.Metadata.Status,
			Links:            convertLinks(document.Metadata.Links),
			InlineReferences: inlineReferences,
		}, true, nil
	case markdown.CommandDocument:
		featureSlug, err := featureSlugFromPath(item.Path)
		if err != nil {
			return documentResponse{}, false, err
		}

		return documentResponse{
			ID:               document.Metadata.ID,
			Type:             string(document.Metadata.Type),
			FeatureSlug:      featureSlug,
			Graph:            document.Metadata.Graph,
			Title:            document.Metadata.Title,
			Description:      document.Metadata.Description,
			Path:             item.Path,
			Tags:             cloneStrings(document.Metadata.Tags),
			CreatedAt:        document.Metadata.CreatedAt,
			UpdatedAt:        document.Metadata.UpdatedAt,
			Body:             document.Body,
			Links:            convertLinks(document.Metadata.Links),
			Name:             document.Metadata.Name,
			Env:              cloneMap(document.Metadata.Env),
			Run:              document.Metadata.Run,
			InlineReferences: inlineReferences,
		}, true, nil
	default:
		return documentResponse{}, false, nil
	}
}

func featureSlugFromPath(path string) (string, error) {
	graphPath, ok, err := markdown.GraphPathFromWorkspacePath(path)
	if err != nil {
		return "", err
	}
	if ok {
		parts := strings.Split(graphPath, "/")
		return parts[0], nil
	}

	if path == filepath.ToSlash(filepath.Join(workspace.DataDirName, workspace.HomeFileName)) {
		return "", nil
	}

	return "", fmt.Errorf("document path %q is not in canonical data/content/<graph-path>/<file>.md layout", path)
}

func convertLinks(links []markdown.NodeLink) []nodeReferenceResponse {
	if len(links) == 0 {
		return nil
	}

	result := make([]nodeReferenceResponse, len(links))
	for i, link := range links {
		result[i] = nodeReferenceResponse{
			Node:          link.Node,
			Context:       link.Context,
			Relationships: cloneStrings(link.Relationships),
		}
	}

	return result
}

func nodeLinksFromPayload(links []nodeReferenceResponse) []markdown.NodeLink {
	if len(links) == 0 {
		return nil
	}

	result := make([]markdown.NodeLink, len(links))
	for i, link := range links {
		result[i] = markdown.NodeLink{
			Node:          link.Node,
			Context:       link.Context,
			Relationships: normalizeRelationshipPayload(link.Relationships),
		}
	}

	return result
}

func normalizeRelationshipPayload(relationships []string) []string {
	if len(relationships) == 0 {
		return nil
	}

	seen := map[string]struct{}{}
	result := make([]string, 0, len(relationships))

	appendUnique := func(value string) {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return
		}

		key := strings.ToLower(trimmed)
		if _, ok := seen[key]; ok {
			return
		}

		seen[key] = struct{}{}
		result = append(result, trimmed)
	}

	for _, relationship := range relationships {
		appendUnique(relationship)
	}

	if len(result) == 0 {
		return nil
	}

	return result
}

func nodeLinksPatchFromPayload(links *[]nodeReferenceResponse) *[]markdown.NodeLink {
	if links == nil {
		return nil
	}

	converted := nodeLinksFromPayload(*links)
	return &converted
}

func cloneStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	cloned := make([]string, len(values))
	copy(cloned, values)
	return cloned
}

func cloneMap(values map[string]string) map[string]string {
	if len(values) == 0 {
		return nil
	}

	cloned := make(map[string]string, len(values))
	for key, value := range values {
		cloned[key] = value
	}

	return cloned
}

func writeJSON(writer http.ResponseWriter, statusCode int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(statusCode)
	_ = json.NewEncoder(writer).Encode(value)
}

func writeError(writer http.ResponseWriter, statusCode int, message string) {
	writeJSON(writer, statusCode, errorResponse{Error: message})
}

func writeMutationError(writer http.ResponseWriter, err error) {
	var invalidMutation workspace.InvalidMutationError
	var documentNotFound workspace.DocumentNotFoundError

	switch {
	case errors.As(err, &invalidMutation):
		writeError(writer, http.StatusBadRequest, err.Error())
	case errors.As(err, &documentNotFound):
		writeError(writer, http.StatusNotFound, err.Error())
	default:
		writeError(writer, http.StatusInternalServerError, err.Error())
	}
}

func decodeJSONRequest(request *http.Request, destination any) error {
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return fmt.Errorf("decode json body: %w", err)
	}

	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		if err == nil {
			return fmt.Errorf("decode json body: unexpected trailing data")
		}
		return fmt.Errorf("decode json body: %w", err)
	}

	return nil
}

func loadDocumentResponse(root workspace.Root, documentID string) (documentResponse, error) {
	documents, err := workspace.LoadDocuments(root.FlowPath)
	if err != nil {
		return documentResponse{}, err
	}

	noteView, err := graph.BuildNoteGraphView(documents)
	if err != nil {
		return documentResponse{}, err
	}

	for _, item := range documents {
		response, ok, err := buildDocumentResponse(item, noteView, documents)
		if err != nil {
			return documentResponse{}, err
		}
		if ok && response.ID == documentID {
			return response, nil
		}
	}

	return documentResponse{}, workspace.DocumentNotFoundError{Selector: documentID}
}

func resolveInlineReferenceResponses(documents []markdown.WorkspaceDocument, item markdown.WorkspaceDocument) ([]inlineReferenceResponse, error) {
	resolved, err := markdown.ResolveInlineReferences(documents, item)
	if err != nil {
		return nil, err
	}
	if len(resolved) == 0 {
		return nil, nil
	}

	responses := make([]inlineReferenceResponse, len(resolved))
	for index, reference := range resolved {
		responses[index] = inlineReferenceResponse{
			Token:            reference.Token,
			Raw:              reference.Raw,
			TargetID:         reference.Target.ID,
			TargetType:       string(reference.Target.Type),
			TargetGraph:      reference.Target.Graph,
			TargetTitle:      reference.Target.Title,
			TargetPath:       reference.Target.Path,
			TargetBreadcrumb: reference.Target.Breadcrumb,
		}
	}

	return responses, nil
}

func loadCalendarDocumentResponses(root workspace.Root) ([]calendarDocumentResponse, error) {
	documents, err := workspace.LoadDocuments(root.FlowPath)
	if err != nil {
		return nil, err
	}

	responses := make([]calendarDocumentResponse, 0, len(documents))
	for _, item := range documents {
		response, ok := buildCalendarDocumentResponse(item)
		if ok {
			responses = append(responses, response)
		}
	}

	slices.SortFunc(responses, func(left, right calendarDocumentResponse) int {
		return strings.Compare(left.Path, right.Path)
	})

	return responses, nil
}

func buildCalendarDocumentResponse(item markdown.WorkspaceDocument) (calendarDocumentResponse, bool) {
	switch document := item.Document.(type) {
	case markdown.HomeDocument:
		title := strings.TrimSpace(document.Metadata.Title)
		if title == "" {
			title = deriveHomeTitle(document.Body)
		}

		return calendarDocumentResponse{
			ID:    "home",
			Type:  string(markdown.HomeType),
			Graph: "",
			Title: title,
			Path:  item.Path,
			Body:  normalizeMarkdownText(document.Body),
		}, true
	case markdown.NoteDocument:
		return calendarDocumentResponse{
			ID:    document.Metadata.ID,
			Type:  string(document.Metadata.Type),
			Graph: document.Metadata.Graph,
			Title: document.Metadata.Title,
			Path:  item.Path,
			Body:  document.Body,
		}, true
	case markdown.TaskDocument:
		return calendarDocumentResponse{
			ID:    document.Metadata.ID,
			Type:  string(document.Metadata.Type),
			Graph: document.Metadata.Graph,
			Title: document.Metadata.Title,
			Path:  item.Path,
			Body:  document.Body,
		}, true
	case markdown.CommandDocument:
		return calendarDocumentResponse{
			ID:    document.Metadata.ID,
			Type:  string(document.Metadata.Type),
			Graph: document.Metadata.Graph,
			Title: document.Metadata.Title,
			Path:  item.Path,
			Body:  document.Body,
		}, true
	default:
		return calendarDocumentResponse{}, false
	}
}

func documentIDForResponse(document markdown.Document) string {
	switch value := document.(type) {
	case markdown.NoteDocument:
		return value.Metadata.ID
	case markdown.TaskDocument:
		return value.Metadata.ID
	case markdown.CommandDocument:
		return value.Metadata.ID
	default:
		return ""
	}
}

func loadHomeResponse(root workspace.Root) (homeResponse, error) {
	relativePath := filepath.ToSlash(filepath.Join(workspace.DataDirName, workspace.HomeFileName))
	data, err := os.ReadFile(root.HomePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return homeResponse{ID: "home", Type: "home", Title: "Home", Description: "", Path: relativePath, Body: ""}, nil
		}
		return homeResponse{}, fmt.Errorf("read home document: %w", err)
	}

	home, err := parseHomeResponse(data)
	if err != nil {
		return homeResponse{}, fmt.Errorf("parse home document: %w", err)
	}

	home.Path = relativePath

	documents, err := workspace.LoadDocuments(root.FlowPath)
	if err != nil {
		return homeResponse{}, fmt.Errorf("load workspace documents: %w", err)
	}

	var homeItem *markdown.WorkspaceDocument
	for _, item := range documents {
		if filepath.ToSlash(item.Path) != relativePath {
			continue
		}
		copyItem := item
		homeItem = &copyItem
		break
	}

	if homeItem == nil {
		synthesized, normalizeErr := markdown.NormalizeWorkspaceDocument(markdown.WorkspaceDocument{
			Path: relativePath,
			Document: markdown.HomeDocument{
				Metadata: markdown.CommonFields{
					ID:          home.ID,
					Type:        markdown.HomeType,
					Title:       home.Title,
					Description: home.Description,
				},
				Body: home.Body,
			},
		})
		if normalizeErr != nil {
			return homeResponse{}, fmt.Errorf("normalize synthetic home document: %w", normalizeErr)
		}
		homeItem = &synthesized
	}

	inlineReferences, err := resolveInlineReferenceResponses(documents, *homeItem)
	if err != nil {
		return homeResponse{}, fmt.Errorf("resolve home inline references: %w", err)
	}
	home.InlineReferences = inlineReferences

	return home, nil
}

func parseHomeResponse(data []byte) (homeResponse, error) {
	if !looksLikeFlowDocument(data) {
		body := normalizeMarkdownText(string(data))
		return homeResponse{
			ID:          "home",
			Type:        string(markdown.HomeType),
			Title:       deriveHomeTitle(body),
			Description: "",
			Body:        body,
		}, nil
	}

	document, err := markdown.ParseDocument([]byte(normalizeMarkdownText(string(data))))
	if err != nil {
		return homeResponse{}, err
	}

	homeDocument, ok := document.(markdown.HomeDocument)
	if !ok {
		return homeResponse{}, fmt.Errorf("home.md must use type %q", markdown.HomeType)
	}

	id := strings.TrimSpace(homeDocument.Metadata.ID)
	if id == "" {
		id = "home"
	}
	title := strings.TrimSpace(homeDocument.Metadata.Title)
	if title == "" {
		title = deriveHomeTitle(homeDocument.Body)
	}

	return homeResponse{
		ID:          id,
		Type:        string(markdown.HomeType),
		Title:       title,
		Description: homeDocument.Metadata.Description,
		Body:        normalizeMarkdownText(homeDocument.Body),
	}, nil
}

func writeHomeDocument(root workspace.Root, payload updateHomeRequest) error {
	title := "Home"
	if payload.Title != nil && strings.TrimSpace(*payload.Title) != "" {
		title = *payload.Title
	}

	description := ""
	if payload.Description != nil {
		description = *payload.Description
	}

	body := ""
	if payload.Body != nil {
		body = normalizeMarkdownText(*payload.Body)
	}

	data, err := markdown.SerializeDocument(markdown.HomeDocument{
		Metadata: markdown.CommonFields{
			ID:          "home",
			Type:        markdown.HomeType,
			Title:       title,
			Description: description,
		},
		Body: body,
	})
	if err != nil {
		return fmt.Errorf("serialize home document: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(root.HomePath), 0o755); err != nil {
		return fmt.Errorf("create home directory: %w", err)
	}

	if err := os.WriteFile(root.HomePath, data, 0o644); err != nil {
		return fmt.Errorf("write home document: %w", err)
	}

	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		return fmt.Errorf("rebuild index: %w", err)
	}

	return nil
}

func looksLikeFlowDocument(data []byte) bool {
	return strings.HasPrefix(normalizeMarkdownText(string(data)), "---\n")
}

func normalizeMarkdownText(value string) string {
	return strings.ReplaceAll(value, "\r\n", "\n")
}

func deriveHomeTitle(body string) string {
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "# ") {
			return strings.TrimSpace(strings.TrimPrefix(trimmed, "# "))
		}
	}

	return "Home"
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
