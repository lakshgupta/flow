package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
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
	Root workspace.Root
	Stop func() error
}

type workspaceResponse struct {
	Scope         workspace.Scope `json:"scope"`
	WorkspacePath string          `json:"workspacePath"`
	FlowPath      string          `json:"flowPath"`
	ConfigPath    string          `json:"configPath"`
	IndexPath     string          `json:"indexPath"`
	GUIPort       int             `json:"guiPort"`
}

type graphItem struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Path  string `json:"path"`
}

type graphListResponse struct {
	Type            string                 `json:"type"`
	AvailableGraphs []string               `json:"availableGraphs"`
	GraphItems      map[string][]graphItem `json:"graphItems"`
}

type documentResponse struct {
	ID             string            `json:"id"`
	Type           string            `json:"type"`
	FeatureSlug    string            `json:"featureSlug"`
	Graph          string            `json:"graph"`
	Title          string            `json:"title"`
	Path           string            `json:"path"`
	Tags           []string          `json:"tags,omitempty"`
	CreatedAt      string            `json:"createdAt,omitempty"`
	UpdatedAt      string            `json:"updatedAt,omitempty"`
	Body           string            `json:"body"`
	Status         string            `json:"status,omitempty"`
	DependsOn      []string          `json:"dependsOn,omitempty"`
	References     []string          `json:"references,omitempty"`
	Name           string            `json:"name,omitempty"`
	Env            map[string]string `json:"env,omitempty"`
	Run            string            `json:"run,omitempty"`
	RelatedNoteIDs []string          `json:"relatedNoteIds,omitempty"`
}

type errorResponse struct {
	Error string `json:"error"`
}

type createDocumentRequest struct {
	Type        string            `json:"type"`
	FeatureSlug string            `json:"featureSlug"`
	FileName    string            `json:"fileName"`
	ID          string            `json:"id"`
	Graph       string            `json:"graph"`
	Title       string            `json:"title"`
	Tags        []string          `json:"tags"`
	CreatedAt   string            `json:"createdAt"`
	UpdatedAt   string            `json:"updatedAt"`
	Body        string            `json:"body"`
	Status      string            `json:"status"`
	DependsOn   []string          `json:"dependsOn"`
	References  []string          `json:"references"`
	Name        string            `json:"name"`
	Env         map[string]string `json:"env"`
	Run         string            `json:"run"`
}

type updateDocumentRequest struct {
	ID         *string            `json:"id"`
	Graph      *string            `json:"graph"`
	Title      *string            `json:"title"`
	Tags       *[]string          `json:"tags"`
	CreatedAt  *string            `json:"createdAt"`
	UpdatedAt  *string            `json:"updatedAt"`
	Body       *string            `json:"body"`
	Status     *string            `json:"status"`
	DependsOn  *[]string          `json:"dependsOn"`
	References *[]string          `json:"references"`
	Name       *string            `json:"name"`
	Env        *map[string]string `json:"env"`
	Run        *string            `json:"run"`
}

type deleteDocumentResponse struct {
	Deleted bool   `json:"deleted"`
	ID      string `json:"id"`
	Path    string `json:"path"`
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
	case request.URL.Path == "/api/workspace" && request.Method == http.MethodGet:
		handler.handleWorkspace(writer, request)
	case request.URL.Path == "/api/layers/tasks" && request.Method == http.MethodGet:
		handler.handleTaskLayers(writer, request)
	case request.URL.Path == "/api/layers/commands" && request.Method == http.MethodGet:
		handler.handleCommandLayers(writer, request)
	case request.URL.Path == "/api/notes/graph" && request.Method == http.MethodGet:
		handler.handleNoteGraph(writer, request)
	case request.URL.Path == "/api/search" && request.Method == http.MethodGet:
		handler.handleSearch(writer, request)
	case request.URL.Path == "/api/gui/stop" && request.Method == http.MethodPost:
		handler.handleGUIStop(writer, request)
	case strings.HasPrefix(request.URL.Path, "/api/graphs/") && request.Method == http.MethodGet:
		handler.handleGraphs(writer, request)
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
		Tags:        payload.Tags,
		CreatedAt:   payload.CreatedAt,
		UpdatedAt:   payload.UpdatedAt,
		Body:        payload.Body,
		Status:      payload.Status,
		DependsOn:   payload.DependsOn,
		References:  payload.References,
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

	writeJSON(writer, http.StatusOK, workspaceResponse{
		Scope:         handler.options.Root.Scope,
		WorkspacePath: handler.options.Root.WorkspacePath,
		FlowPath:      handler.options.Root.FlowPath,
		ConfigPath:    handler.options.Root.ConfigPath,
		IndexPath:     handler.options.Root.IndexPath,
		GUIPort:       workspaceConfig.GUI.Port,
	})
}

func (handler *apiHandler) handleGraphs(writer http.ResponseWriter, request *http.Request) {
	graphType := strings.TrimPrefix(request.URL.Path, "/api/graphs/")
	documents, err := workspace.LoadDocuments(handler.options.Root.FlowPath)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	response, err := buildGraphListResponse(graphType, documents)
	if err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, response)
}

func (handler *apiHandler) handleTaskLayers(writer http.ResponseWriter, _ *http.Request) {
	documents, err := workspace.LoadDocuments(handler.options.Root.FlowPath)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	view, err := graph.BuildTaskLayerView(documents)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, view)
}

func (handler *apiHandler) handleCommandLayers(writer http.ResponseWriter, request *http.Request) {
	documents, err := workspace.LoadDocuments(handler.options.Root.FlowPath)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	selectedGraph := strings.TrimSpace(request.URL.Query().Get("graph"))
	if selectedGraph == "" {
		selectedGraph = firstCommandGraph(documents)
	}

	if selectedGraph == "" {
		writeJSON(writer, http.StatusOK, graph.CommandLayerView{})
		return
	}

	view, err := graph.BuildCommandLayerView(documents, selectedGraph)
	if err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, view)
}

func (handler *apiHandler) handleNoteGraph(writer http.ResponseWriter, _ *http.Request) {
	documents, err := workspace.LoadDocuments(handler.options.Root.FlowPath)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	view, err := graph.BuildNoteGraphView(documents)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, view)
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
		response, ok, err := buildDocumentResponse(item, noteView)
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
		ID:         payload.ID,
		Graph:      payload.Graph,
		Title:      payload.Title,
		Tags:       payload.Tags,
		CreatedAt:  payload.CreatedAt,
		UpdatedAt:  payload.UpdatedAt,
		Body:       payload.Body,
		Status:     payload.Status,
		DependsOn:  payload.DependsOn,
		References: payload.References,
		Name:       payload.Name,
		Env:        payload.Env,
		Run:        payload.Run,
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

func (handler *apiHandler) handleSearch(writer http.ResponseWriter, request *http.Request) {
	query := strings.TrimSpace(request.URL.Query().Get("q"))
	if query == "" {
		query = strings.TrimSpace(request.URL.Query().Get("query"))
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

	results, err := index.SearchWorkspace(handler.options.Root.IndexPath, handler.options.Root.FlowPath, query, limit)
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

func buildGraphListResponse(graphType string, documents []markdown.WorkspaceDocument) (graphListResponse, error) {
	response := graphListResponse{Type: graphType, GraphItems: map[string][]graphItem{}}

	switch graphType {
	case string(markdown.NoteType):
		view, err := graph.BuildNoteGraphView(documents)
		if err != nil {
			return graphListResponse{}, err
		}

		response.AvailableGraphs = view.AvailableGraphs
		for graphName, noteIDs := range view.GraphNotes {
			items := make([]graphItem, 0, len(noteIDs))
			for _, noteID := range noteIDs {
				node := view.Nodes[noteID]
				items = append(items, graphItem{ID: node.ID, Title: node.Title, Path: node.Path})
			}
			response.GraphItems[graphName] = items
		}
	case string(markdown.TaskType):
		view, err := graph.BuildTaskLayerView(documents)
		if err != nil {
			return graphListResponse{}, err
		}

		response.AvailableGraphs = sortedTaskGraphs(view)
		for _, node := range view.Tasks {
			response.GraphItems[node.Graph] = append(response.GraphItems[node.Graph], graphItem{ID: node.ID, Title: node.Title, Path: node.Path})
		}
	case string(markdown.CommandType):
		response.AvailableGraphs = sortedCommandGraphs(documents)
		for _, item := range documents {
			commandDocument, ok := item.Document.(markdown.CommandDocument)
			if !ok {
				continue
			}

			response.GraphItems[commandDocument.Metadata.Graph] = append(response.GraphItems[commandDocument.Metadata.Graph], graphItem{
				ID:    commandDocument.Metadata.ID,
				Title: commandDocument.Metadata.Title,
				Path:  item.Path,
			})
		}
	default:
		return graphListResponse{}, fmt.Errorf("unsupported graph type %q", graphType)
	}

	for graphName, items := range response.GraphItems {
		sort.Slice(items, func(left int, right int) bool {
			if items[left].Title != items[right].Title {
				return items[left].Title < items[right].Title
			}

			return items[left].ID < items[right].ID
		})
		response.GraphItems[graphName] = items
	}

	return response, nil
}

func buildDocumentResponse(item markdown.WorkspaceDocument, noteView graph.NoteGraphView) (documentResponse, bool, error) {
	switch document := item.Document.(type) {
	case markdown.NoteDocument:
		featureSlug, err := featureSlugFromPath(item.Path)
		if err != nil {
			return documentResponse{}, false, err
		}

		node := noteView.Nodes[document.Metadata.ID]
		return documentResponse{
			ID:             document.Metadata.ID,
			Type:           string(document.Metadata.Type),
			FeatureSlug:    featureSlug,
			Graph:          document.Metadata.Graph,
			Title:          document.Metadata.Title,
			Path:           item.Path,
			Tags:           cloneStrings(document.Metadata.Tags),
			CreatedAt:      document.Metadata.CreatedAt,
			UpdatedAt:      document.Metadata.UpdatedAt,
			Body:           document.Body,
			References:     cloneStrings(document.Metadata.References),
			RelatedNoteIDs: cloneStrings(node.RelatedNoteIDs),
		}, true, nil
	case markdown.TaskDocument:
		featureSlug, err := featureSlugFromPath(item.Path)
		if err != nil {
			return documentResponse{}, false, err
		}

		return documentResponse{
			ID:          document.Metadata.ID,
			Type:        string(document.Metadata.Type),
			FeatureSlug: featureSlug,
			Graph:       document.Metadata.Graph,
			Title:       document.Metadata.Title,
			Path:        item.Path,
			Tags:        cloneStrings(document.Metadata.Tags),
			CreatedAt:   document.Metadata.CreatedAt,
			UpdatedAt:   document.Metadata.UpdatedAt,
			Body:        document.Body,
			Status:      document.Metadata.Status,
			DependsOn:   cloneStrings(document.Metadata.DependsOn),
			References:  cloneStrings(document.Metadata.References),
		}, true, nil
	case markdown.CommandDocument:
		featureSlug, err := featureSlugFromPath(item.Path)
		if err != nil {
			return documentResponse{}, false, err
		}

		return documentResponse{
			ID:          document.Metadata.ID,
			Type:        string(document.Metadata.Type),
			FeatureSlug: featureSlug,
			Graph:       document.Metadata.Graph,
			Title:       document.Metadata.Title,
			Path:        item.Path,
			Tags:        cloneStrings(document.Metadata.Tags),
			CreatedAt:   document.Metadata.CreatedAt,
			UpdatedAt:   document.Metadata.UpdatedAt,
			Body:        document.Body,
			DependsOn:   cloneStrings(document.Metadata.DependsOn),
			References:  cloneStrings(document.Metadata.References),
			Name:        document.Metadata.Name,
			Env:         cloneMap(document.Metadata.Env),
			Run:         document.Metadata.Run,
		}, true, nil
	default:
		return documentResponse{}, false, nil
	}
}

func firstCommandGraph(documents []markdown.WorkspaceDocument) string {
	graphs := sortedCommandGraphs(documents)
	if len(graphs) == 0 {
		return ""
	}

	return graphs[0]
}

func sortedCommandGraphs(documents []markdown.WorkspaceDocument) []string {
	seen := map[string]struct{}{}
	graphs := []string{}
	for _, item := range documents {
		commandDocument, ok := item.Document.(markdown.CommandDocument)
		if !ok {
			continue
		}

		if _, ok := seen[commandDocument.Metadata.Graph]; ok {
			continue
		}

		seen[commandDocument.Metadata.Graph] = struct{}{}
		graphs = append(graphs, commandDocument.Metadata.Graph)
	}

	sort.Strings(graphs)
	return graphs
}

func sortedTaskGraphs(view graph.TaskLayerView) []string {
	seen := map[string]struct{}{}
	graphs := []string{}
	for _, task := range view.Tasks {
		if _, ok := seen[task.Graph]; ok {
			continue
		}

		seen[task.Graph] = struct{}{}
		graphs = append(graphs, task.Graph)
	}

	sort.Strings(graphs)
	return graphs
}

func featureSlugFromPath(path string) (string, error) {
	parts := strings.Split(path, "/")
	if len(parts) < 4 || parts[0] != "features" {
		return "", fmt.Errorf("document path %q is not in canonical features/<slug>/... layout", path)
	}

	return parts[1], nil
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
		response, ok, err := buildDocumentResponse(item, noteView)
		if err != nil {
			return documentResponse{}, err
		}
		if ok && response.ID == documentID {
			return response, nil
		}
	}

	return documentResponse{}, workspace.DocumentNotFoundError{Selector: documentID}
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

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
