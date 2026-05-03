package graph

import (
	"fmt"
	"net/url"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/lex/flow/internal/markdown"
)

const (
	graphCanvasOriginX             = 140.0
	graphCanvasOriginY             = 120.0
	graphCanvasLayerColumnSpacing  = 320.0
	graphCanvasNodeRowSpacing      = 190.0
	graphCanvasMagneticThresholdPx = 18.0
)

// GraphCanvasPosition stores the x/y coordinates used by the graph canvas.
type GraphCanvasPosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// GraphCanvasLayerGuide marks one seeded vertical layer band that the UI can use for subtle drag guidance.
type GraphCanvasLayerGuide struct {
	Layer int     `json:"layer"`
	X     float64 `json:"x"`
}

// GraphCanvasLayerGuidance exposes the seeded layer bands and magnetic snap threshold for the canvas.
type GraphCanvasLayerGuidance struct {
	MagneticThresholdPx float64                 `json:"magneticThresholdPx"`
	Guides              []GraphCanvasLayerGuide `json:"guides"`
}

// GraphCanvasNode holds the metadata needed to render one canvas node.
type GraphCanvasNode struct {
	ID                string              `json:"id"`
	Type              string              `json:"type"`
	Shape             string              `json:"shape,omitempty"`
	FeatureSlug       string              `json:"featureSlug"`
	Graph             string              `json:"graph"`
	Title             string              `json:"title"`
	Description       string              `json:"description"`
	Path              string              `json:"path"`
	Tags              []string            `json:"tags,omitempty"`
	CreatedAt         string              `json:"createdAt,omitempty"`
	UpdatedAt         string              `json:"updatedAt,omitempty"`
	PreviewKind       string              `json:"previewKind,omitempty"`
	PreviewURL        string              `json:"previewURL,omitempty"`
	PreviewName       string              `json:"previewName,omitempty"`
	PreviewAssetCount int                 `json:"previewAssetCount,omitempty"`
	Position          GraphCanvasPosition `json:"position"`
	PositionPersisted bool                `json:"positionPersisted"`
	links             []markdown.NodeLink
	references        []graphCanvasReference
	orderIndex        int
}

var markdownImageTargetPattern = regexp.MustCompile(`!\[[^\]]*\]\(([^)]+)\)`)
var markdownLinkTargetPattern = regexp.MustCompile(`\[[^\]]+\]\(([^)]+)\)`)

type graphCanvasReference struct {
	TargetID string
	Context  string
}

// GraphCanvasEdge stores one projected relationship between two visible canvas nodes.
type GraphCanvasEdge struct {
	ID            string   `json:"id"`
	Source        string   `json:"source"`
	Target        string   `json:"target"`
	Kind          string   `json:"kind"`
	Context       string   `json:"context,omitempty"`
	Relationships []string `json:"relationships,omitempty"`
}

// GraphCanvasView is the unified graph payload consumed by the canvas surface.
type GraphCanvasView struct {
	SelectedGraph   string                   `json:"selectedGraph"`
	AvailableGraphs []string                 `json:"availableGraphs"`
	LayerGuidance   GraphCanvasLayerGuidance `json:"layerGuidance"`
	Nodes           []GraphCanvasNode        `json:"nodes"`
	Edges           []GraphCanvasEdge        `json:"edges"`
}

// BuildGraphCanvasView computes the canvas payload for one selected graph scope.
// Persisted positions are keyed by document id within the selected graph canvas scope.
func BuildGraphCanvasView(documents []markdown.WorkspaceDocument, selectedGraph string, persistedPositions map[string]GraphCanvasPosition) (GraphCanvasView, error) {
	trimmedSelectedGraph := strings.TrimSpace(selectedGraph)
	if trimmedSelectedGraph == "" {
		return GraphCanvasView{}, fmt.Errorf("selected graph must not be empty")
	}

	availableGraphs := collectAvailableGraphScopes(documents)
	if len(availableGraphs) == 0 {
		return GraphCanvasView{}, fmt.Errorf("selected graph %q does not exist", trimmedSelectedGraph)
	}
	if !slices.Contains(availableGraphs, trimmedSelectedGraph) {
		return GraphCanvasView{}, fmt.Errorf("selected graph %q does not exist", trimmedSelectedGraph)
	}

	nodesByID := map[string]GraphCanvasNode{}
	allNodesByID := map[string]GraphCanvasNode{}
	orderedIDs := []string{}
	visibleDocuments := make([]markdown.WorkspaceDocument, 0)

	for _, item := range documents {
		node, graphPath, ok, err := buildGraphCanvasNode(item)
		if err != nil {
			return GraphCanvasView{}, err
		}
		if !ok {
			continue
		}

		allNodesByID[node.ID] = node
		if !graphScopeContains(trimmedSelectedGraph, graphPath) {
			continue
		}

		node.orderIndex = len(orderedIDs)
		nodesByID[node.ID] = node
		orderedIDs = append(orderedIDs, node.ID)
		visibleDocuments = append(visibleDocuments, item)
	}

	for _, item := range visibleDocuments {
		sourceID, sourceGraph, ok := graphCanvasDocumentIdentity(item.Document)
		if !ok {
			continue
		}

		sourceNode, ok := nodesByID[sourceID]
		if !ok {
			continue
		}

		resolved, err := markdown.ResolveInlineReferences(documents, item)
		if err != nil {
			return GraphCanvasView{}, fmt.Errorf("resolve graph canvas references for %s: %w", sourceID, err)
		}

		for _, reference := range resolved {
			targetNode, ok := allNodesByID[reference.Target.ID]
			if !ok {
				targetNode = buildGraphCanvasReferenceNode(reference.Target)
				allNodesByID[targetNode.ID] = targetNode
			}

			if targetNode.Graph != sourceGraph {
				targetNode.Shape = "circle"
			}

			if _, exists := nodesByID[targetNode.ID]; !exists {
				targetNode.orderIndex = len(orderedIDs)
				nodesByID[targetNode.ID] = targetNode
				orderedIDs = append(orderedIDs, targetNode.ID)
			} else {
				nodesByID[targetNode.ID] = targetNode
			}
			allNodesByID[targetNode.ID] = targetNode

			sourceNode.references = appendGraphCanvasReference(sourceNode.references, targetNode.ID, reference.Target.Breadcrumb)
		}

		nodesByID[sourceID] = sourceNode
	}

	seedPlan := seedGraphCanvasPositions(nodesByID, orderedIDs)
	for _, id := range orderedIDs {
		node := nodesByID[id]
		if position, ok := persistedPositions[id]; ok {
			node.Position = position
			node.PositionPersisted = true
		} else {
			node.Position = seedPlan.Positions[id]
		}
		nodesByID[id] = node
	}

	nodes := make([]GraphCanvasNode, 0, len(orderedIDs))
	for _, id := range orderedIDs {
		nodes = append(nodes, nodesByID[id])
	}
	sortGraphCanvasNodes(nodes)

	edges := buildGraphCanvasEdges(nodesByID)

	return GraphCanvasView{
		SelectedGraph:   trimmedSelectedGraph,
		AvailableGraphs: availableGraphs,
		LayerGuidance:   seedPlan.Guidance,
		Nodes:           nodes,
		Edges:           edges,
	}, nil
}

func graphCanvasDocumentIdentity(document markdown.Document) (string, string, bool) {
	switch value := document.(type) {
	case markdown.NoteDocument:
		return value.Metadata.ID, value.Metadata.Graph, true
	case markdown.TaskDocument:
		return value.Metadata.ID, value.Metadata.Graph, true
	case markdown.CommandDocument:
		return value.Metadata.ID, value.Metadata.Graph, true
	default:
		return "", "", false
	}
}

func buildGraphCanvasReferenceNode(target markdown.ReferenceTarget) GraphCanvasNode {
	featureSlug := strings.TrimSpace(target.Graph)
	if parts := strings.Split(featureSlug, "/"); len(parts) > 0 && parts[0] != "" {
		featureSlug = parts[0]
	}

	return GraphCanvasNode{
		ID:          target.ID,
		Type:        string(target.Type),
		FeatureSlug: featureSlug,
		Graph:       target.Graph,
		Title:       target.Title,
		Description: "",
		Path:        target.Path,
	}
}

func appendGraphCanvasReference(references []graphCanvasReference, targetID string, context string) []graphCanvasReference {
	for _, reference := range references {
		if reference.TargetID == targetID {
			return references
		}
	}

	return append(references, graphCanvasReference{TargetID: targetID, Context: context})
}

type graphCanvasSeedPlan struct {
	Positions map[string]GraphCanvasPosition
	Guidance  GraphCanvasLayerGuidance
}

func buildGraphCanvasNode(item markdown.WorkspaceDocument) (GraphCanvasNode, string, bool, error) {
	featureSlug, graphPath, ok, err := canvasPathMetadata(item.Path)
	if err != nil {
		return GraphCanvasNode{}, "", false, err
	}
	if !ok {
		return GraphCanvasNode{}, "", false, nil
	}

	switch document := item.Document.(type) {
	case markdown.NoteDocument:
		previewKind, previewURL, previewName, previewAssetCount := extractCanvasPreview(document.Body)
		return GraphCanvasNode{
			ID:                document.Metadata.ID,
			Type:              string(document.Metadata.Type),
			FeatureSlug:       featureSlug,
			Graph:             graphPath,
			Title:             document.Metadata.Title,
			Description:       document.Metadata.Description,
			Path:              item.Path,
			Tags:              cloneStrings(document.Metadata.Tags),
			CreatedAt:         document.Metadata.CreatedAt,
			UpdatedAt:         document.Metadata.UpdatedAt,
			PreviewKind:       previewKind,
			PreviewURL:        previewURL,
			PreviewName:       previewName,
			PreviewAssetCount: previewAssetCount,
			links:             cloneNodeLinks(document.Metadata.Links),
		}, graphPath, true, nil
	case markdown.TaskDocument:
		previewKind, previewURL, previewName, previewAssetCount := extractCanvasPreview(document.Body)
		return GraphCanvasNode{
			ID:                document.Metadata.ID,
			Type:              string(document.Metadata.Type),
			FeatureSlug:       featureSlug,
			Graph:             graphPath,
			Title:             document.Metadata.Title,
			Description:       document.Metadata.Description,
			Path:              item.Path,
			Tags:              cloneStrings(document.Metadata.Tags),
			CreatedAt:         document.Metadata.CreatedAt,
			UpdatedAt:         document.Metadata.UpdatedAt,
			PreviewKind:       previewKind,
			PreviewURL:        previewURL,
			PreviewName:       previewName,
			PreviewAssetCount: previewAssetCount,
			links:             cloneNodeLinks(document.Metadata.Links),
		}, graphPath, true, nil
	case markdown.CommandDocument:
		return GraphCanvasNode{
			ID:          document.Metadata.ID,
			Type:        string(document.Metadata.Type),
			FeatureSlug: featureSlug,
			Graph:       graphPath,
			Title:       document.Metadata.Title,
			Description: document.Metadata.Description,
			Path:        item.Path,
			Tags:        cloneStrings(document.Metadata.Tags),
			CreatedAt:   document.Metadata.CreatedAt,
			UpdatedAt:   document.Metadata.UpdatedAt,
			links:       cloneNodeLinks(document.Metadata.Links),
		}, graphPath, true, nil
	default:
		return GraphCanvasNode{}, "", false, nil
	}
}

type canvasPreviewCandidate struct {
	target string
	path   string
	kind   string
	name   string
}

func extractCanvasPreview(body string) (string, string, string, int) {
	candidates := make([]canvasPreviewCandidate, 0)
	seenPaths := make(map[string]struct{})
	for _, match := range markdownImageTargetPattern.FindAllStringSubmatch(body, -1) {
		target := strings.TrimSpace(match[1])
		assetPath := canvasAssetPathFromTarget(target)
		if assetPath == "" {
			continue
		}

		name := filepath.Base(assetPath)
		if isImageFileExtension(filepath.Ext(name)) {
			candidates = append(candidates, canvasPreviewCandidate{target: target, path: assetPath, kind: "image", name: name})
			seenPaths[assetPath] = struct{}{}
		}
	}

	for _, match := range markdownLinkTargetPattern.FindAllStringSubmatch(body, -1) {
		target := strings.TrimSpace(match[1])
		assetPath := canvasAssetPathFromTarget(target)
		if assetPath == "" {
			continue
		}

		name := filepath.Base(assetPath)
		extension := strings.ToLower(filepath.Ext(name))
		kind := "file"
		if isImageFileExtension(extension) {
			kind = "image"
		} else if extension == ".pdf" {
			kind = "pdf"
		}

		candidates = append(candidates, canvasPreviewCandidate{target: target, path: assetPath, kind: kind, name: name})
		seenPaths[assetPath] = struct{}{}
	}

	if len(candidates) == 0 {
		return "", "", "", 0
	}

	first := candidates[0]
	return first.kind, first.target, first.name, len(seenPaths)
}

func canvasAssetPathFromTarget(target string) string {
	if !strings.HasPrefix(target, "/api/files?") {
		return ""
	}

	parsed, err := url.Parse(target)
	if err != nil {
		return ""
	}

	pathValue := strings.TrimSpace(parsed.Query().Get("path"))
	if pathValue == "" {
		return ""
	}

	decoded, err := url.QueryUnescape(pathValue)
	if err != nil {
		return ""
	}

	return decoded
}

func isImageFileExtension(ext string) bool {
	switch strings.ToLower(ext) {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp":
		return true
	default:
		return false
	}
}

func canvasPathMetadata(path string) (string, string, bool, error) {
	graphPath, ok, err := markdown.GraphPathFromWorkspacePath(path)
	if err != nil {
		return "", "", false, err
	}
	if !ok {
		return "", "", false, nil
	}

	parts := strings.Split(graphPath, "/")
	return parts[0], graphPath, true, nil
}

func collectAvailableGraphScopes(documents []markdown.WorkspaceDocument) []string {
	seen := map[string]struct{}{}
	graphs := []string{}

	for _, item := range documents {
		_, graphPath, ok, err := canvasPathMetadata(item.Path)
		if err != nil || !ok {
			continue
		}

		parts := strings.Split(graphPath, "/")
		for index := range parts {
			scope := strings.Join(parts[:index+1], "/")
			if _, ok := seen[scope]; ok {
				continue
			}

			seen[scope] = struct{}{}
			graphs = append(graphs, scope)
		}
	}

	slices.Sort(graphs)
	return graphs
}

func graphScopeContains(selectedGraph string, graphPath string) bool {
	return graphPath == selectedGraph || strings.HasPrefix(graphPath, selectedGraph+"/")
}

func seedGraphCanvasPositions(nodesByID map[string]GraphCanvasNode, orderedIDs []string) graphCanvasSeedPlan {
	adjacency, indegree := buildGraphCanvasAdjacency(nodesByID)
	layerByID, layerCount := buildGraphCanvasLayerPlan(nodesByID, orderedIDs, adjacency, indegree)
	byLayer := map[int][]string{}

	for _, id := range orderedIDs {
		layer := layerByID[id]
		byLayer[layer] = append(byLayer[layer], id)
	}

	positions := make(map[string]GraphCanvasPosition, len(orderedIDs))
	guides := make([]GraphCanvasLayerGuide, 0, layerCount)
	for layer := 0; layer < layerCount; layer++ {
		ids := byLayer[layer]
		slices.SortFunc(ids, func(left string, right string) int {
			return compareGraphCanvasSeedOrder(nodesByID[left], nodesByID[right])
		})

		guideX := graphCanvasOriginX + float64(layer)*graphCanvasLayerColumnSpacing
		guides = append(guides, GraphCanvasLayerGuide{Layer: layer, X: guideX})
		for row, id := range ids {
			positions[id] = GraphCanvasPosition{
				X: guideX,
				Y: graphCanvasOriginY + float64(row)*graphCanvasNodeRowSpacing,
			}
		}
	}

	return graphCanvasSeedPlan{
		Positions: positions,
		Guidance: GraphCanvasLayerGuidance{
			MagneticThresholdPx: graphCanvasMagneticThresholdPx,
			Guides:              guides,
		},
	}
}

func buildGraphCanvasAdjacency(nodesByID map[string]GraphCanvasNode) (map[string][]string, map[string]int) {
	adjacency := make(map[string][]string, len(nodesByID))
	indegree := make(map[string]int, len(nodesByID))
	edgeSeen := map[string]struct{}{}

	for id := range nodesByID {
		indegree[id] = 0
	}

	for _, node := range nodesByID {
		for _, link := range node.links {
			if _, ok := nodesByID[link.Node]; !ok {
				continue
			}

			edgeID := graphCanvasEdgeID("link", node.ID, link.Node)
			if _, ok := edgeSeen[edgeID]; ok {
				continue
			}

			edgeSeen[edgeID] = struct{}{}
			adjacency[node.ID] = append(adjacency[node.ID], link.Node)
			indegree[link.Node]++
		}

		for _, reference := range node.references {
			if _, ok := nodesByID[reference.TargetID]; !ok {
				continue
			}

			edgeID := graphCanvasEdgeID("reference", node.ID, reference.TargetID)
			if _, ok := edgeSeen[edgeID]; ok {
				continue
			}

			edgeSeen[edgeID] = struct{}{}
			adjacency[node.ID] = append(adjacency[node.ID], reference.TargetID)
			indegree[reference.TargetID]++
		}
	}

	for id, targets := range adjacency {
		slices.SortFunc(targets, func(left string, right string) int {
			return compareGraphCanvasSeedOrder(nodesByID[left], nodesByID[right])
		})
		adjacency[id] = targets
	}

	return adjacency, indegree
}

func buildGraphCanvasLayerPlan(nodesByID map[string]GraphCanvasNode, orderedIDs []string, adjacency map[string][]string, indegree map[string]int) (map[string]int, int) {
	unresolved := make(map[string]struct{}, len(orderedIDs))
	ready := make([]string, 0, len(orderedIDs))
	layerByID := make(map[string]int, len(orderedIDs))

	for _, id := range orderedIDs {
		unresolved[id] = struct{}{}
		if indegree[id] == 0 {
			ready = append(ready, id)
		}
	}
	slices.SortFunc(ready, func(left string, right string) int {
		return compareGraphCanvasSeedOrder(nodesByID[left], nodesByID[right])
	})

	layer := 0
	for len(unresolved) > 0 {
		if len(ready) == 0 {
			cycleBreaker := earliestGraphCanvasSeedNode(nodesByID, unresolved)
			ready = append(ready, cycleBreaker)
		}

		current := append([]string(nil), ready...)
		slices.SortFunc(current, func(left string, right string) int {
			return compareGraphCanvasSeedOrder(nodesByID[left], nodesByID[right])
		})

		nextReady := map[string]struct{}{}
		processedAny := false
		for _, id := range current {
			if _, ok := unresolved[id]; !ok {
				continue
			}

			processedAny = true
			delete(unresolved, id)
			layerByID[id] = layer

			for _, targetID := range adjacency[id] {
				if indegree[targetID] > 0 {
					indegree[targetID]--
				}
				if indegree[targetID] == 0 {
					nextReady[targetID] = struct{}{}
				}
			}
		}

		if !processedAny {
			break
		}

		ready = ready[:0]
		for id := range nextReady {
			if _, ok := unresolved[id]; ok {
				ready = append(ready, id)
			}
		}
		slices.SortFunc(ready, func(left string, right string) int {
			return compareGraphCanvasSeedOrder(nodesByID[left], nodesByID[right])
		})
		layer++
	}

	return layerByID, layer
}

func earliestGraphCanvasSeedNode(nodesByID map[string]GraphCanvasNode, unresolved map[string]struct{}) string {
	ids := make([]string, 0, len(unresolved))
	for id := range unresolved {
		ids = append(ids, id)
	}
	slices.SortFunc(ids, func(left string, right string) int {
		return compareGraphCanvasSeedOrder(nodesByID[left], nodesByID[right])
	})
	return ids[0]
}

func buildGraphCanvasEdges(nodesByID map[string]GraphCanvasNode) []GraphCanvasEdge {
	edgeByID := map[string]GraphCanvasEdge{}

	for _, node := range nodesByID {
		for _, link := range node.links {
			if _, ok := nodesByID[link.Node]; !ok {
				continue
			}

			edge := GraphCanvasEdge{
				ID:            graphCanvasEdgeID("link", node.ID, link.Node),
				Source:        node.ID,
				Target:        link.Node,
				Kind:          "link",
				Context:       link.Context,
				Relationships: slices.Clone(link.Relationships),
			}
			edgeByID[edge.ID] = edge
		}

		for _, reference := range node.references {
			if _, ok := nodesByID[reference.TargetID]; !ok {
				continue
			}

			edge := GraphCanvasEdge{
				ID:      graphCanvasEdgeID("reference", node.ID, reference.TargetID),
				Source:  node.ID,
				Target:  reference.TargetID,
				Kind:    "reference",
				Context: reference.Context,
			}
			edgeByID[edge.ID] = edge
		}
	}

	ids := make([]string, 0, len(edgeByID))
	for id := range edgeByID {
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return []GraphCanvasEdge{}
	}

	slices.SortFunc(ids, func(left string, right string) int {
		leftEdge := edgeByID[left]
		rightEdge := edgeByID[right]
		if leftEdge.Kind != rightEdge.Kind {
			return strings.Compare(leftEdge.Kind, rightEdge.Kind)
		}

		if compared := compareGraphCanvasNodes(nodesByID[leftEdge.Source], nodesByID[rightEdge.Source]); compared != 0 {
			return compared
		}

		if compared := compareGraphCanvasNodes(nodesByID[leftEdge.Target], nodesByID[rightEdge.Target]); compared != 0 {
			return compared
		}

		return strings.Compare(left, right)
	})

	edges := make([]GraphCanvasEdge, 0, len(ids))
	for _, id := range ids {
		edges = append(edges, edgeByID[id])
	}

	return edges
}

func graphCanvasEdgeID(kind string, source string, target string) string {
	return kind + ":" + source + ":" + target
}

func sortGraphCanvasNodes(nodes []GraphCanvasNode) {
	slices.SortFunc(nodes, compareGraphCanvasNodes)
}

func compareGraphCanvasNodes(left GraphCanvasNode, right GraphCanvasNode) int {
	if left.Graph != right.Graph {
		return strings.Compare(left.Graph, right.Graph)
	}
	if left.Type != right.Type {
		return strings.Compare(left.Type, right.Type)
	}
	if left.Title != right.Title {
		return strings.Compare(left.Title, right.Title)
	}
	if left.Path != right.Path {
		return strings.Compare(left.Path, right.Path)
	}
	if left.ID != right.ID {
		return strings.Compare(left.ID, right.ID)
	}

	return left.orderIndex - right.orderIndex
}

func compareGraphCanvasSeedOrder(left GraphCanvasNode, right GraphCanvasNode) int {
	if compared := compareGraphCanvasCreatedAt(left.CreatedAt, right.CreatedAt); compared != 0 {
		return compared
	}

	return compareGraphCanvasNodes(left, right)
}

func compareGraphCanvasCreatedAt(left string, right string) int {
	leftTime, leftOK := parseGraphCanvasTime(left)
	rightTime, rightOK := parseGraphCanvasTime(right)

	switch {
	case leftOK && rightOK:
		if leftTime.Before(rightTime) {
			return -1
		}
		if leftTime.After(rightTime) {
			return 1
		}
	case leftOK:
		return -1
	case rightOK:
		return 1
	}

	return strings.Compare(strings.TrimSpace(left), strings.TrimSpace(right))
}

func parseGraphCanvasTime(value string) (time.Time, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return time.Time{}, false
	}

	parsed, err := time.Parse(time.RFC3339Nano, trimmed)
	if err == nil {
		return parsed, true
	}

	parsed, err = time.Parse(time.RFC3339, trimmed)
	if err == nil {
		return parsed, true
	}

	return time.Time{}, false
}
