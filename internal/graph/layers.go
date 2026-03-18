package graph

import (
	"fmt"
	"slices"
	"strings"

	"github.com/lex/flow/internal/markdown"
)

// TaskNode holds the task metadata needed by layered task views.
type TaskNode struct {
	ID          string   `json:"id"`
	FeatureSlug string   `json:"featureSlug"`
	Graph       string   `json:"graph"`
	Title       string   `json:"title"`
	Status      string   `json:"status"`
	Path        string   `json:"path"`
	Tags        []string `json:"tags,omitempty"`
	CreatedAt   string   `json:"createdAt,omitempty"`
	UpdatedAt   string   `json:"updatedAt,omitempty"`
	DependsOn   []string `json:"dependsOn,omitempty"`
	References  []string `json:"references,omitempty"`
	Layer       int      `json:"layer"`
}

// TaskLayer groups tasks that can be shown together in the same dependency layer.
type TaskLayer struct {
	Index int        `json:"index"`
	Tasks []TaskNode `json:"tasks"`
}

// TaskLayerView is the computed layered representation for all tasks in a workspace.
type TaskLayerView struct {
	Layers []TaskLayer         `json:"layers"`
	Tasks  map[string]TaskNode `json:"tasks"`
}

// NoteNode holds note metadata together with graph-oriented note relationships.
type NoteNode struct {
	ID             string   `json:"id"`
	FeatureSlug    string   `json:"featureSlug"`
	Graph          string   `json:"graph"`
	Title          string   `json:"title"`
	Path           string   `json:"path"`
	Tags           []string `json:"tags,omitempty"`
	CreatedAt      string   `json:"createdAt,omitempty"`
	UpdatedAt      string   `json:"updatedAt,omitempty"`
	References     []string `json:"references,omitempty"`
	RelatedNoteIDs []string `json:"relatedNoteIds,omitempty"`
}

// NoteEdge stores one canonical bidirectional relationship between two notes.
type NoteEdge struct {
	LeftNoteID  string `json:"leftNoteID"`
	RightNoteID string `json:"rightNoteID"`
}

// NoteGraphView is the note relationship projection for all notes in a workspace.
type NoteGraphView struct {
	AvailableGraphs []string            `json:"availableGraphs"`
	GraphNotes      map[string][]string `json:"graphNotes"`
	Nodes           map[string]NoteNode `json:"nodes"`
	Edges           []NoteEdge          `json:"edges"`
}

// DependencyEdge stores one same-type hard-dependency edge from dependency to dependent.
type DependencyEdge struct {
	FromID string
	ToID   string
}

// BoundaryDirection identifies how hidden external nodes relate to the focused snapshot.
type BoundaryDirection string

const (
	BoundaryDependencies BoundaryDirection = "dependencies"
	BoundaryDependents   BoundaryDirection = "dependents"
)

// BoundaryMarker summarizes hidden external nodes until the caller expands them.
type BoundaryMarker struct {
	ID        string
	Direction BoundaryDirection
	Graph     string
	Count     int
	NodeIDs   []string
}

// BoundaryConnection connects a collapsed boundary marker back to visible nodes.
type BoundaryConnection struct {
	BoundaryID string
	NodeID     string
}

// TaskFocusedGraphSnapshot holds a focused dependency view for one task graph.
type TaskFocusedGraphSnapshot struct {
	SelectedGraph       string
	AvailableGraphs     []string
	ExpandedBoundaryIDs []string
	Nodes               map[string]TaskNode
	Edges               []DependencyEdge
	BoundaryMarkers     []BoundaryMarker
	BoundaryConnections []BoundaryConnection
}

// CommandFocusedGraphSnapshot holds a focused dependency view for one command graph.
type CommandFocusedGraphSnapshot struct {
	SelectedGraph       string
	AvailableGraphs     []string
	ExpandedBoundaryIDs []string
	Nodes               map[string]CommandNode
	Edges               []DependencyEdge
	BoundaryMarkers     []BoundaryMarker
	BoundaryConnections []BoundaryConnection
}

// CommandNode holds the command metadata needed by layered command views.
type CommandNode struct {
	ID          string            `json:"id"`
	FeatureSlug string            `json:"featureSlug"`
	Graph       string            `json:"graph"`
	Title       string            `json:"title"`
	Path        string            `json:"path"`
	Tags        []string          `json:"tags,omitempty"`
	CreatedAt   string            `json:"createdAt,omitempty"`
	UpdatedAt   string            `json:"updatedAt,omitempty"`
	DependsOn   []string          `json:"dependsOn,omitempty"`
	References  []string          `json:"references,omitempty"`
	Name        string            `json:"name"`
	Run         string            `json:"run"`
	Env         map[string]string `json:"env,omitempty"`
	Layer       int               `json:"layer"`
}

// CommandLayer groups commands that can be shown together in the same dependency layer.
type CommandLayer struct {
	Index    int           `json:"index"`
	Commands []CommandNode `json:"commands"`
}

// CommandLayerView is the graph-scoped layered representation for commands.
type CommandLayerView struct {
	SelectedGraph   string                 `json:"selectedGraph"`
	AvailableGraphs []string               `json:"availableGraphs"`
	GraphCommands   map[string][]string    `json:"graphCommands"`
	Layers          []CommandLayer         `json:"layers"`
	Commands        map[string]CommandNode `json:"commands"`
}

// BuildTaskLayerView computes task layers from workspace documents.
func BuildTaskLayerView(documents []markdown.WorkspaceDocument) (TaskLayerView, error) {
	taskNodes := map[string]TaskNode{}
	adjacency := map[string][]string{}
	indegree := map[string]int{}

	for _, item := range documents {
		taskDocument, ok := item.Document.(markdown.TaskDocument)
		if !ok {
			continue
		}

		featureSlug, err := taskFeatureSlug(item.Path)
		if err != nil {
			return TaskLayerView{}, err
		}

		taskNodes[taskDocument.Metadata.ID] = TaskNode{
			ID:          taskDocument.Metadata.ID,
			FeatureSlug: featureSlug,
			Graph:       taskDocument.Metadata.Graph,
			Title:       taskDocument.Metadata.Title,
			Status:      taskDocument.Metadata.Status,
			Path:        item.Path,
			Tags:        cloneStrings(taskDocument.Metadata.Tags),
			CreatedAt:   taskDocument.Metadata.CreatedAt,
			UpdatedAt:   taskDocument.Metadata.UpdatedAt,
			DependsOn:   cloneStrings(taskDocument.Metadata.DependsOn),
			References:  cloneStrings(taskDocument.Metadata.References),
		}
		indegree[taskDocument.Metadata.ID] = len(taskDocument.Metadata.DependsOn)
	}

	for _, node := range taskNodes {
		for _, dependencyID := range node.DependsOn {
			if _, exists := taskNodes[dependencyID]; !exists {
				return TaskLayerView{}, fmt.Errorf("task %q depends on missing task %q", node.ID, dependencyID)
			}

			adjacency[dependencyID] = append(adjacency[dependencyID], node.ID)
		}
	}

	readyIDs := make([]string, 0, len(taskNodes))
	for id, count := range indegree {
		if count == 0 {
			readyIDs = append(readyIDs, id)
		}
	}
	sortTaskIDs(readyIDs, taskNodes)

	layers := []TaskLayer{}
	resolvedCount := 0
	currentLayer := 0

	for len(readyIDs) > 0 {
		layerIDs := append([]string(nil), readyIDs...)
		layerTasks := make([]TaskNode, 0, len(layerIDs))
		nextReadySet := map[string]struct{}{}

		for _, id := range layerIDs {
			node := taskNodes[id]
			node.Layer = currentLayer
			taskNodes[id] = node
			layerTasks = append(layerTasks, node)
			resolvedCount++

			for _, dependentID := range adjacency[id] {
				indegree[dependentID]--
				if indegree[dependentID] == 0 {
					nextReadySet[dependentID] = struct{}{}
				}
			}
		}

		layers = append(layers, TaskLayer{Index: currentLayer, Tasks: layerTasks})
		currentLayer++

		readyIDs = readyIDs[:0]
		for id := range nextReadySet {
			readyIDs = append(readyIDs, id)
		}
		sortTaskIDs(readyIDs, taskNodes)
	}

	if resolvedCount != len(taskNodes) {
		unresolved := make([]string, 0, len(taskNodes)-resolvedCount)
		for id, count := range indegree {
			if count > 0 {
				unresolved = append(unresolved, id)
			}
		}
		slices.Sort(unresolved)
		return TaskLayerView{}, fmt.Errorf("task dependency cycle detected among %s", strings.Join(unresolved, ", "))
	}

	return TaskLayerView{Layers: layers, Tasks: taskNodes}, nil
}

// BuildCommandLayerView computes command layers for one selected graph while still honoring
// cross-graph same-type dependencies during layer assignment.
func BuildCommandLayerView(documents []markdown.WorkspaceDocument, selectedGraph string) (CommandLayerView, error) {
	if strings.TrimSpace(selectedGraph) == "" {
		return CommandLayerView{}, fmt.Errorf("selected command graph must not be empty")
	}

	commandNodes := map[string]CommandNode{}
	adjacency := map[string][]string{}
	indegree := map[string]int{}
	graphCommands := map[string][]string{}

	for _, item := range documents {
		commandDocument, ok := item.Document.(markdown.CommandDocument)
		if !ok {
			continue
		}

		featureSlug, err := commandFeatureSlug(item.Path)
		if err != nil {
			return CommandLayerView{}, err
		}

		commandNodes[commandDocument.Metadata.ID] = CommandNode{
			ID:          commandDocument.Metadata.ID,
			FeatureSlug: featureSlug,
			Graph:       commandDocument.Metadata.Graph,
			Title:       commandDocument.Metadata.Title,
			Path:        item.Path,
			Tags:        cloneStrings(commandDocument.Metadata.Tags),
			CreatedAt:   commandDocument.Metadata.CreatedAt,
			UpdatedAt:   commandDocument.Metadata.UpdatedAt,
			DependsOn:   cloneStrings(commandDocument.Metadata.DependsOn),
			References:  cloneStrings(commandDocument.Metadata.References),
			Name:        commandDocument.Metadata.Name,
			Run:         commandDocument.Metadata.Run,
			Env:         cloneStringMap(commandDocument.Metadata.Env),
		}
		indegree[commandDocument.Metadata.ID] = len(commandDocument.Metadata.DependsOn)
		graphCommands[commandDocument.Metadata.Graph] = append(graphCommands[commandDocument.Metadata.Graph], commandDocument.Metadata.ID)
	}

	if len(graphCommands[selectedGraph]) == 0 {
		return CommandLayerView{}, fmt.Errorf("selected command graph %q does not exist", selectedGraph)
	}

	for _, node := range commandNodes {
		for _, dependencyID := range node.DependsOn {
			if _, exists := commandNodes[dependencyID]; !exists {
				return CommandLayerView{}, fmt.Errorf("command %q depends on missing command %q", node.ID, dependencyID)
			}

			adjacency[dependencyID] = append(adjacency[dependencyID], node.ID)
		}
	}

	readyIDs := make([]string, 0, len(commandNodes))
	for id, count := range indegree {
		if count == 0 {
			readyIDs = append(readyIDs, id)
		}
	}
	sortCommandIDs(readyIDs, commandNodes)

	availableGraphs := make([]string, 0, len(graphCommands))
	for graphName := range graphCommands {
		availableGraphs = append(availableGraphs, graphName)
	}
	slices.Sort(availableGraphs)
	for graphName, ids := range graphCommands {
		sortCommandIDs(ids, commandNodes)
		graphCommands[graphName] = ids
	}

	layers := []CommandLayer{}
	resolvedCount := 0
	currentLayer := 0

	for len(readyIDs) > 0 {
		layerIDs := append([]string(nil), readyIDs...)
		layerCommands := []CommandNode{}
		nextReadySet := map[string]struct{}{}

		for _, id := range layerIDs {
			node := commandNodes[id]
			node.Layer = currentLayer
			commandNodes[id] = node
			resolvedCount++

			if node.Graph == selectedGraph {
				layerCommands = append(layerCommands, node)
			}

			for _, dependentID := range adjacency[id] {
				indegree[dependentID]--
				if indegree[dependentID] == 0 {
					nextReadySet[dependentID] = struct{}{}
				}
			}
		}

		if len(layerCommands) > 0 {
			layers = append(layers, CommandLayer{Index: currentLayer, Commands: layerCommands})
		}
		currentLayer++

		readyIDs = readyIDs[:0]
		for id := range nextReadySet {
			readyIDs = append(readyIDs, id)
		}
		sortCommandIDs(readyIDs, commandNodes)
	}

	if resolvedCount != len(commandNodes) {
		unresolved := make([]string, 0, len(commandNodes)-resolvedCount)
		for id, count := range indegree {
			if count > 0 {
				unresolved = append(unresolved, id)
			}
		}
		slices.Sort(unresolved)
		return CommandLayerView{}, fmt.Errorf("command dependency cycle detected among %s", strings.Join(unresolved, ", "))
	}

	return CommandLayerView{
		SelectedGraph:   selectedGraph,
		AvailableGraphs: availableGraphs,
		GraphCommands:   graphCommands,
		Layers:          layers,
		Commands:        commandNodes,
	}, nil
}

// BuildTaskFocusedGraphSnapshot computes a focused task dependency graph with collapsed external boundaries.
func BuildTaskFocusedGraphSnapshot(documents []markdown.WorkspaceDocument, selectedGraph string, expandedBoundaryIDs []string) (TaskFocusedGraphSnapshot, error) {
	nodes := map[string]TaskNode{}
	summaries := map[string]dependencySnapshotNode{}

	for _, item := range documents {
		taskDocument, ok := item.Document.(markdown.TaskDocument)
		if !ok {
			continue
		}

		featureSlug, err := taskFeatureSlug(item.Path)
		if err != nil {
			return TaskFocusedGraphSnapshot{}, err
		}

		node := TaskNode{
			ID:          taskDocument.Metadata.ID,
			FeatureSlug: featureSlug,
			Graph:       taskDocument.Metadata.Graph,
			Title:       taskDocument.Metadata.Title,
			Status:      taskDocument.Metadata.Status,
			Path:        item.Path,
			Tags:        cloneStrings(taskDocument.Metadata.Tags),
			CreatedAt:   taskDocument.Metadata.CreatedAt,
			UpdatedAt:   taskDocument.Metadata.UpdatedAt,
			DependsOn:   cloneStrings(taskDocument.Metadata.DependsOn),
			References:  cloneStrings(taskDocument.Metadata.References),
		}
		nodes[node.ID] = node
		summaries[node.ID] = dependencySnapshotNode{
			ID:        node.ID,
			Graph:     node.Graph,
			Title:     node.Title,
			DependsOn: cloneStrings(node.DependsOn),
		}
	}

	snapshot, err := buildFocusedDependencySnapshot(summaries, selectedGraph, expandedBoundaryIDs)
	if err != nil {
		return TaskFocusedGraphSnapshot{}, err
	}

	visibleNodes := make(map[string]TaskNode, len(snapshot.Nodes))
	for id := range snapshot.Nodes {
		visibleNodes[id] = nodes[id]
	}

	return TaskFocusedGraphSnapshot{
		SelectedGraph:       snapshot.SelectedGraph,
		AvailableGraphs:     snapshot.AvailableGraphs,
		ExpandedBoundaryIDs: snapshot.ExpandedBoundaryIDs,
		Nodes:               visibleNodes,
		Edges:               snapshot.Edges,
		BoundaryMarkers:     snapshot.BoundaryMarkers,
		BoundaryConnections: snapshot.BoundaryConnections,
	}, nil
}

// BuildCommandFocusedGraphSnapshot computes a focused command dependency graph with collapsed external boundaries.
func BuildCommandFocusedGraphSnapshot(documents []markdown.WorkspaceDocument, selectedGraph string, expandedBoundaryIDs []string) (CommandFocusedGraphSnapshot, error) {
	nodes := map[string]CommandNode{}
	summaries := map[string]dependencySnapshotNode{}

	for _, item := range documents {
		commandDocument, ok := item.Document.(markdown.CommandDocument)
		if !ok {
			continue
		}

		featureSlug, err := commandFeatureSlug(item.Path)
		if err != nil {
			return CommandFocusedGraphSnapshot{}, err
		}

		node := CommandNode{
			ID:          commandDocument.Metadata.ID,
			FeatureSlug: featureSlug,
			Graph:       commandDocument.Metadata.Graph,
			Title:       commandDocument.Metadata.Title,
			Path:        item.Path,
			Tags:        cloneStrings(commandDocument.Metadata.Tags),
			CreatedAt:   commandDocument.Metadata.CreatedAt,
			UpdatedAt:   commandDocument.Metadata.UpdatedAt,
			DependsOn:   cloneStrings(commandDocument.Metadata.DependsOn),
			References:  cloneStrings(commandDocument.Metadata.References),
			Name:        commandDocument.Metadata.Name,
			Run:         commandDocument.Metadata.Run,
			Env:         cloneStringMap(commandDocument.Metadata.Env),
		}
		nodes[node.ID] = node
		summaries[node.ID] = dependencySnapshotNode{
			ID:        node.ID,
			Graph:     node.Graph,
			Title:     node.Title,
			DependsOn: cloneStrings(node.DependsOn),
		}
	}

	snapshot, err := buildFocusedDependencySnapshot(summaries, selectedGraph, expandedBoundaryIDs)
	if err != nil {
		return CommandFocusedGraphSnapshot{}, err
	}

	visibleNodes := make(map[string]CommandNode, len(snapshot.Nodes))
	for id := range snapshot.Nodes {
		visibleNodes[id] = nodes[id]
	}

	return CommandFocusedGraphSnapshot{
		SelectedGraph:       snapshot.SelectedGraph,
		AvailableGraphs:     snapshot.AvailableGraphs,
		ExpandedBoundaryIDs: snapshot.ExpandedBoundaryIDs,
		Nodes:               visibleNodes,
		Edges:               snapshot.Edges,
		BoundaryMarkers:     snapshot.BoundaryMarkers,
		BoundaryConnections: snapshot.BoundaryConnections,
	}, nil
}

// BuildNoteGraphView computes the symmetric note graph from note references.
func BuildNoteGraphView(documents []markdown.WorkspaceDocument) (NoteGraphView, error) {
	noteNodes := map[string]NoteNode{}
	graphNotes := map[string][]string{}
	rawReferences := map[string][]string{}

	for _, item := range documents {
		noteDocument, ok := item.Document.(markdown.NoteDocument)
		if !ok {
			continue
		}

		featureSlug, err := noteFeatureSlug(item.Path)
		if err != nil {
			return NoteGraphView{}, err
		}

		noteNodes[noteDocument.Metadata.ID] = NoteNode{
			ID:          noteDocument.Metadata.ID,
			FeatureSlug: featureSlug,
			Graph:       noteDocument.Metadata.Graph,
			Title:       noteDocument.Metadata.Title,
			Path:        item.Path,
			Tags:        cloneStrings(noteDocument.Metadata.Tags),
			CreatedAt:   noteDocument.Metadata.CreatedAt,
			UpdatedAt:   noteDocument.Metadata.UpdatedAt,
			References:  cloneStrings(noteDocument.Metadata.References),
		}
		rawReferences[noteDocument.Metadata.ID] = cloneStrings(noteDocument.Metadata.References)
		graphNotes[noteDocument.Metadata.Graph] = append(graphNotes[noteDocument.Metadata.Graph], noteDocument.Metadata.ID)
	}

	availableGraphs := make([]string, 0, len(graphNotes))
	for graphName, ids := range graphNotes {
		availableGraphs = append(availableGraphs, graphName)
		sortNoteIDs(ids, noteNodes)
		graphNotes[graphName] = ids
	}
	slices.Sort(availableGraphs)

	edgeByKey := map[string]NoteEdge{}
	for noteID, references := range rawReferences {
		for _, referenceID := range references {
			if _, ok := noteNodes[referenceID]; !ok {
				continue
			}

			leftNoteID, rightNoteID := canonicalNotePair(noteID, referenceID)
			edgeKey := leftNoteID + "\x00" + rightNoteID
			edgeByKey[edgeKey] = NoteEdge{LeftNoteID: leftNoteID, RightNoteID: rightNoteID}
		}
	}

	edgeKeys := make([]string, 0, len(edgeByKey))
	for edgeKey := range edgeByKey {
		edgeKeys = append(edgeKeys, edgeKey)
	}
	slices.SortFunc(edgeKeys, func(left string, right string) int {
		leftEdge := edgeByKey[left]
		rightEdge := edgeByKey[right]

		if leftNode, rightNode := noteNodes[leftEdge.LeftNoteID], noteNodes[rightEdge.LeftNoteID]; leftNode.Graph != rightNode.Graph {
			return strings.Compare(leftNode.Graph, rightNode.Graph)
		} else if leftNode.Title != rightNode.Title {
			return strings.Compare(leftNode.Title, rightNode.Title)
		}

		if leftNode, rightNode := noteNodes[leftEdge.RightNoteID], noteNodes[rightEdge.RightNoteID]; leftNode.Graph != rightNode.Graph {
			return strings.Compare(leftNode.Graph, rightNode.Graph)
		} else if leftNode.Title != rightNode.Title {
			return strings.Compare(leftNode.Title, rightNode.Title)
		}

		return strings.Compare(left, right)
	})

	edges := make([]NoteEdge, 0, len(edgeKeys))
	for _, edgeKey := range edgeKeys {
		edge := edgeByKey[edgeKey]
		edges = append(edges, edge)

		leftNode := noteNodes[edge.LeftNoteID]
		leftNode.RelatedNoteIDs = append(leftNode.RelatedNoteIDs, edge.RightNoteID)
		noteNodes[edge.LeftNoteID] = leftNode

		if edge.LeftNoteID != edge.RightNoteID {
			rightNode := noteNodes[edge.RightNoteID]
			rightNode.RelatedNoteIDs = append(rightNode.RelatedNoteIDs, edge.LeftNoteID)
			noteNodes[edge.RightNoteID] = rightNode
		}
	}

	for noteID, node := range noteNodes {
		sortConnectedNoteIDs(node.RelatedNoteIDs, noteNodes)
		noteNodes[noteID] = node
	}

	return NoteGraphView{
		AvailableGraphs: availableGraphs,
		GraphNotes:      graphNotes,
		Nodes:           noteNodes,
		Edges:           edges,
	}, nil
}

type dependencySnapshotNode struct {
	ID        string
	Graph     string
	Title     string
	DependsOn []string
}

type focusedDependencySnapshot struct {
	SelectedGraph       string
	AvailableGraphs     []string
	ExpandedBoundaryIDs []string
	Nodes               map[string]struct{}
	Edges               []DependencyEdge
	BoundaryMarkers     []BoundaryMarker
	BoundaryConnections []BoundaryConnection
}

type boundaryMarkerBuilder struct {
	ID               string
	Direction        BoundaryDirection
	Graph            string
	HiddenNodeIDs    map[string]struct{}
	ConnectedNodeIDs map[string]struct{}
}

func buildFocusedDependencySnapshot(nodes map[string]dependencySnapshotNode, selectedGraph string, expandedBoundaryIDs []string) (focusedDependencySnapshot, error) {
	if strings.TrimSpace(selectedGraph) == "" {
		return focusedDependencySnapshot{}, fmt.Errorf("selected graph must not be empty")
	}

	availableGraphs := make([]string, 0)
	graphSeen := map[string]struct{}{}
	adjacency := map[string][]string{}
	reverseAdjacency := map[string][]string{}
	included := map[string]struct{}{}
	expanded := make(map[string]struct{}, len(expandedBoundaryIDs))

	for _, boundaryID := range expandedBoundaryIDs {
		expanded[boundaryID] = struct{}{}
	}

	for id, node := range nodes {
		if _, ok := graphSeen[node.Graph]; !ok {
			graphSeen[node.Graph] = struct{}{}
			availableGraphs = append(availableGraphs, node.Graph)
		}

		if node.Graph == selectedGraph {
			included[id] = struct{}{}
		}

		for _, dependencyID := range node.DependsOn {
			if _, ok := nodes[dependencyID]; !ok {
				return focusedDependencySnapshot{}, fmt.Errorf("%q depends on missing node %q", id, dependencyID)
			}

			adjacency[dependencyID] = append(adjacency[dependencyID], id)
			reverseAdjacency[id] = append(reverseAdjacency[id], dependencyID)
		}
	}

	if len(included) == 0 {
		return focusedDependencySnapshot{}, fmt.Errorf("selected graph %q does not exist", selectedGraph)
	}

	slices.Sort(availableGraphs)

	for {
		markers := collectBoundaryMarkers(nodes, included, reverseAdjacency, adjacency, selectedGraph)
		added := false

		for _, marker := range markers {
			if _, ok := expanded[marker.ID]; !ok {
				continue
			}

			for nodeID := range marker.HiddenNodeIDs {
				if _, ok := included[nodeID]; ok {
					continue
				}

				included[nodeID] = struct{}{}
				added = true
			}
		}

		if !added {
			break
		}
	}

	edges := make([]DependencyEdge, 0)
	for nodeID := range included {
		for _, dependencyID := range reverseAdjacency[nodeID] {
			if _, ok := included[dependencyID]; !ok {
				continue
			}

			edges = append(edges, DependencyEdge{FromID: dependencyID, ToID: nodeID})
		}
	}
	sortDependencyEdges(edges, nodes)

	markerBuilders := collectBoundaryMarkers(nodes, included, reverseAdjacency, adjacency, selectedGraph)
	markerIDs := make([]string, 0, len(markerBuilders))
	for markerID := range markerBuilders {
		markerIDs = append(markerIDs, markerID)
	}
	slices.SortFunc(markerIDs, func(left string, right string) int {
		leftMarker := markerBuilders[left]
		rightMarker := markerBuilders[right]

		if leftMarker.Direction != rightMarker.Direction {
			return strings.Compare(string(leftMarker.Direction), string(rightMarker.Direction))
		}
		if leftMarker.Graph != rightMarker.Graph {
			return strings.Compare(leftMarker.Graph, rightMarker.Graph)
		}

		return strings.Compare(left, right)
	})

	markers := make([]BoundaryMarker, 0, len(markerIDs))
	connections := make([]BoundaryConnection, 0)
	for _, markerID := range markerIDs {
		builder := markerBuilders[markerID]
		hiddenNodeIDs := mapKeys(builder.HiddenNodeIDs)
		sortDependencyNodeIDs(hiddenNodeIDs, nodes)
		markers = append(markers, BoundaryMarker{
			ID:        builder.ID,
			Direction: builder.Direction,
			Graph:     builder.Graph,
			Count:     len(hiddenNodeIDs),
			NodeIDs:   hiddenNodeIDs,
		})

		connectedNodeIDs := mapKeys(builder.ConnectedNodeIDs)
		sortDependencyNodeIDs(connectedNodeIDs, nodes)
		for _, nodeID := range connectedNodeIDs {
			connections = append(connections, BoundaryConnection{BoundaryID: builder.ID, NodeID: nodeID})
		}
	}

	return focusedDependencySnapshot{
		SelectedGraph:       selectedGraph,
		AvailableGraphs:     availableGraphs,
		ExpandedBoundaryIDs: cloneStrings(expandedBoundaryIDs),
		Nodes:               included,
		Edges:               edges,
		BoundaryMarkers:     markers,
		BoundaryConnections: connections,
	}, nil
}

func collectBoundaryMarkers(nodes map[string]dependencySnapshotNode, included map[string]struct{}, reverseAdjacency map[string][]string, adjacency map[string][]string, selectedGraph string) map[string]*boundaryMarkerBuilder {
	markers := map[string]*boundaryMarkerBuilder{}

	for nodeID := range included {
		for _, dependencyID := range reverseAdjacency[nodeID] {
			if _, ok := included[dependencyID]; ok {
				continue
			}

			dependency := nodes[dependencyID]
			markerID := boundaryMarkerID(selectedGraph, BoundaryDependencies, dependency.Graph)
			marker := ensureBoundaryMarker(markers, markerID, BoundaryDependencies, dependency.Graph)
			marker.HiddenNodeIDs[dependencyID] = struct{}{}
			marker.ConnectedNodeIDs[nodeID] = struct{}{}
		}

		for _, dependentID := range adjacency[nodeID] {
			if _, ok := included[dependentID]; ok {
				continue
			}

			dependent := nodes[dependentID]
			markerID := boundaryMarkerID(selectedGraph, BoundaryDependents, dependent.Graph)
			marker := ensureBoundaryMarker(markers, markerID, BoundaryDependents, dependent.Graph)
			marker.HiddenNodeIDs[dependentID] = struct{}{}
			marker.ConnectedNodeIDs[nodeID] = struct{}{}
		}
	}

	return markers
}

func ensureBoundaryMarker(markers map[string]*boundaryMarkerBuilder, markerID string, direction BoundaryDirection, graphName string) *boundaryMarkerBuilder {
	if marker, ok := markers[markerID]; ok {
		return marker
	}

	marker := &boundaryMarkerBuilder{
		ID:               markerID,
		Direction:        direction,
		Graph:            graphName,
		HiddenNodeIDs:    map[string]struct{}{},
		ConnectedNodeIDs: map[string]struct{}{},
	}
	markers[markerID] = marker
	return marker
}

func boundaryMarkerID(selectedGraph string, direction BoundaryDirection, graphName string) string {
	return string(direction) + ":" + selectedGraph + ":" + graphName
}

func taskFeatureSlug(path string) (string, error) {
	return featureSlugFromWorkspacePath(path, "task")
}

func noteFeatureSlug(path string) (string, error) {
	return featureSlugFromWorkspacePath(path, "note")
}

func commandFeatureSlug(path string) (string, error) {
	return featureSlugFromWorkspacePath(path, "command")
}

func featureSlugFromWorkspacePath(path string, documentLabel string) (string, error) {
	graphPath, ok, err := markdown.GraphPathFromWorkspacePath(path)
	if err != nil {
		return "", err
	}
	if !ok {
		return "", fmt.Errorf("%s path %q is not in canonical data/graphs/<graph-path>/<file>.md layout", documentLabel, path)
	}

	parts := strings.Split(graphPath, "/")
	return parts[0], nil
}

func sortTaskIDs(ids []string, nodes map[string]TaskNode) {
	slices.SortFunc(ids, func(left string, right string) int {
		leftNode := nodes[left]
		rightNode := nodes[right]

		if leftNode.Graph != rightNode.Graph {
			return strings.Compare(leftNode.Graph, rightNode.Graph)
		}
		if leftNode.Title != rightNode.Title {
			return strings.Compare(leftNode.Title, rightNode.Title)
		}

		return strings.Compare(left, right)
	})
}

func sortCommandIDs(ids []string, nodes map[string]CommandNode) {
	slices.SortFunc(ids, func(left string, right string) int {
		leftNode := nodes[left]
		rightNode := nodes[right]

		if leftNode.Graph != rightNode.Graph {
			return strings.Compare(leftNode.Graph, rightNode.Graph)
		}
		if leftNode.Title != rightNode.Title {
			return strings.Compare(leftNode.Title, rightNode.Title)
		}

		return strings.Compare(left, right)
	})
}

func sortNoteIDs(ids []string, nodes map[string]NoteNode) {
	slices.SortFunc(ids, func(left string, right string) int {
		leftNode := nodes[left]
		rightNode := nodes[right]

		if leftNode.Graph != rightNode.Graph {
			return strings.Compare(leftNode.Graph, rightNode.Graph)
		}
		if leftNode.Title != rightNode.Title {
			return strings.Compare(leftNode.Title, rightNode.Title)
		}

		return strings.Compare(left, right)
	})
}

func sortConnectedNoteIDs(ids []string, nodes map[string]NoteNode) {
	slices.SortFunc(ids, func(left string, right string) int {
		leftNode := nodes[left]
		rightNode := nodes[right]

		if leftNode.Graph != rightNode.Graph {
			return strings.Compare(leftNode.Graph, rightNode.Graph)
		}
		if leftNode.Title != rightNode.Title {
			return strings.Compare(leftNode.Title, rightNode.Title)
		}

		return strings.Compare(left, right)
	})
}

func sortDependencyNodeIDs(ids []string, nodes map[string]dependencySnapshotNode) {
	slices.SortFunc(ids, func(left string, right string) int {
		leftNode := nodes[left]
		rightNode := nodes[right]

		if leftNode.Graph != rightNode.Graph {
			return strings.Compare(leftNode.Graph, rightNode.Graph)
		}
		if leftNode.Title != rightNode.Title {
			return strings.Compare(leftNode.Title, rightNode.Title)
		}

		return strings.Compare(left, right)
	})
}

func sortDependencyEdges(edges []DependencyEdge, nodes map[string]dependencySnapshotNode) {
	slices.SortFunc(edges, func(left DependencyEdge, right DependencyEdge) int {
		leftFrom := nodes[left.FromID]
		rightFrom := nodes[right.FromID]
		if leftFrom.Graph != rightFrom.Graph {
			return strings.Compare(leftFrom.Graph, rightFrom.Graph)
		}
		if leftFrom.Title != rightFrom.Title {
			return strings.Compare(leftFrom.Title, rightFrom.Title)
		}

		leftTo := nodes[left.ToID]
		rightTo := nodes[right.ToID]
		if leftTo.Graph != rightTo.Graph {
			return strings.Compare(leftTo.Graph, rightTo.Graph)
		}
		if leftTo.Title != rightTo.Title {
			return strings.Compare(leftTo.Title, rightTo.Title)
		}

		if left.FromID != right.FromID {
			return strings.Compare(left.FromID, right.FromID)
		}

		return strings.Compare(left.ToID, right.ToID)
	})
}

func mapKeys(values map[string]struct{}) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}

	return keys
}

func canonicalNotePair(left string, right string) (string, string) {
	if left <= right {
		return left, right
	}

	return right, left
}

func cloneStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	cloned := make([]string, len(values))
	copy(cloned, values)
	return cloned
}

func cloneStringMap(values map[string]string) map[string]string {
	if len(values) == 0 {
		return nil
	}

	cloned := make(map[string]string, len(values))
	for key, value := range values {
		cloned[key] = value
	}

	return cloned
}
