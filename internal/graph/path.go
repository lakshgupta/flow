package graph

import (
	"fmt"
	"slices"
	"strings"

	"github.com/lex/flow/internal/markdown"
)

// PathNode describes one node on a shortest-path result.
type PathNode struct {
	ID     string `json:"id"`
	Type   string `json:"type"`
	Graph  string `json:"graph"`
	Title  string `json:"title"`
	Status string `json:"status,omitempty"`
}

// PathEdge describes one hop on a shortest-path result.
type PathEdge struct {
	Kind    string `json:"kind"`
	From    string `json:"from"`
	To      string `json:"to"`
	Context string `json:"context,omitempty"`
}

// ShortestPathResult is the outcome of a shortest-path search.
type ShortestPathResult struct {
	From     string     `json:"from"`
	To       string     `json:"to"`
	Found    bool       `json:"found"`
	Directed bool       `json:"directed"`
	Distance int        `json:"distance"`
	Nodes    []PathNode `json:"nodes"`
	Edges    []PathEdge `json:"edges"`
}

// FindShortestPath runs a breadth-first search over the workspace graph built
// from declared frontmatter links and resolved inline references. When directed
// is false, edges are traversed in both directions so paths can connect nodes
// regardless of edge orientation (useful for "what connects X to Y" discovery).
func FindShortestPath(documents []markdown.WorkspaceDocument, fromID string, toID string, directed bool) (ShortestPathResult, error) {
	fromID = strings.TrimSpace(fromID)
	toID = strings.TrimSpace(toID)
	if fromID == "" || toID == "" {
		return ShortestPathResult{}, fmt.Errorf("shortest path requires both --from and --to")
	}

	nodesByID, err := pathNodesByID(documents)
	if err != nil {
		return ShortestPathResult{}, err
	}
	if _, ok := nodesByID[fromID]; !ok {
		return ShortestPathResult{}, fmt.Errorf("node %q not found", fromID)
	}
	if _, ok := nodesByID[toID]; !ok {
		return ShortestPathResult{}, fmt.Errorf("node %q not found", toID)
	}

	if fromID == toID {
		return ShortestPathResult{
			From:     fromID,
			To:       toID,
			Found:    true,
			Directed: directed,
			Nodes:    []PathNode{nodesByID[fromID]},
		}, nil
	}

	adjacency, edgesByPair, err := buildPathAdjacency(documents, nodesByID)
	if err != nil {
		return ShortestPathResult{}, err
	}

	return breadthFirstShortestPath(nodesByID, adjacency, edgesByPair, fromID, toID, directed), nil
}

func pathNodesByID(documents []markdown.WorkspaceDocument) (map[string]PathNode, error) {
	nodesByID := make(map[string]PathNode, len(documents))
	for _, item := range documents {
		document := item.Document
		if document.Kind() == markdown.HomeType {
			continue
		}

		id := strings.TrimSpace(document.ID())
		if id == "" {
			continue
		}

		node := PathNode{
			ID:    id,
			Type:  string(document.Kind()),
			Graph: document.Graph(),
			Title: document.Title(),
		}
		if taskDocument, ok := document.(markdown.TaskDocument); ok {
			node.Status = taskDocument.Metadata.Status
		}
		nodesByID[id] = node
	}
	return nodesByID, nil
}

type pathAdjacencyEdge struct {
	kind    string
	context string
}

func buildPathAdjacency(documents []markdown.WorkspaceDocument, nodesByID map[string]PathNode) (map[string][]string, map[string]map[string]pathAdjacencyEdge, error) {
	adjacency := make(map[string][]string, len(nodesByID))
	edgesByPair := make(map[string]map[string]pathAdjacencyEdge)

	for _, item := range documents {
		document := item.Document
		if document.Kind() == markdown.HomeType {
			continue
		}

		sourceID := strings.TrimSpace(document.ID())
		if _, ok := nodesByID[sourceID]; !ok {
			continue
		}

		// Declared hard links from frontmatter.
		for _, link := range document.Links() {
			targetID := strings.TrimSpace(link.Node)
			if _, ok := nodesByID[targetID]; !ok {
				continue
			}
			addPathEdge(adjacency, edgesByPair, sourceID, targetID, "link", link.Context)
		}

		// Resolved inline references from the document body.
		resolved, err := markdown.ResolveInlineReferences(documents, item)
		if err != nil {
			return nil, nil, fmt.Errorf("resolve graph path references for %s: %w", sourceID, err)
		}
		for _, reference := range resolved {
			targetID := strings.TrimSpace(reference.Target.ID)
			if _, ok := nodesByID[targetID]; !ok {
				continue
			}
			addPathEdge(adjacency, edgesByPair, sourceID, targetID, "reference", reference.Target.Breadcrumb)
		}
	}

	return adjacency, edgesByPair, nil
}

func addPathEdge(adjacency map[string][]string, edgesByPair map[string]map[string]pathAdjacencyEdge, from string, to string, kind string, context string) {
	if !slices.Contains(adjacency[from], to) {
		adjacency[from] = append(adjacency[from], to)
	}
	if edgesByPair[from] == nil {
		edgesByPair[from] = map[string]pathAdjacencyEdge{}
	}
	if _, exists := edgesByPair[from][to]; !exists {
		edgesByPair[from][to] = pathAdjacencyEdge{kind: kind, context: context}
	}
}

func breadthFirstShortestPath(nodesByID map[string]PathNode, adjacency map[string][]string, edgesByPair map[string]map[string]pathAdjacencyEdge, fromID string, toID string, directed bool) ShortestPathResult {
	type visit struct {
		parent string
		edge   pathAdjacencyEdge
	}

	visited := map[string]visit{fromID: {}}
	queue := []string{fromID}
	found := false

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		neighbors := append([]string(nil), adjacency[current]...)
		if !directed {
			// Add reverse-direction neighbors: nodes whose declared edges point at current.
			for candidateID, targets := range adjacency {
				if _, ok := visited[candidateID]; ok {
					continue
				}
				if slices.Contains(targets, current) {
					neighbors = append(neighbors, candidateID)
				}
			}
		}

		for _, next := range neighbors {
			if _, ok := visited[next]; ok {
				continue
			}

			edge := pathAdjacencyEdge{}
			if candidate, ok := edgesByPair[current][next]; ok {
				edge = candidate
			} else if !directed {
				if candidate, ok := edgesByPair[next][current]; ok {
					edge = candidate
				}
			}

			visited[next] = visit{parent: current, edge: edge}
			if next == toID {
				found = true
				queue = nil
				break
			}
			queue = append(queue, next)
		}
	}

	if !found {
		return ShortestPathResult{From: fromID, To: toID, Directed: directed, Nodes: []PathNode{}, Edges: []PathEdge{}}
	}

	// Reconstruct the path from toID back to fromID, then reverse it.
	var nodeIDs []string
	for current := toID; ; {
		nodeIDs = append(nodeIDs, current)
		if current == fromID {
			break
		}
		current = visited[current].parent
	}
	slices.Reverse(nodeIDs)

	nodes := make([]PathNode, 0, len(nodeIDs))
	for _, id := range nodeIDs {
		nodes = append(nodes, nodesByID[id])
	}

	edges := make([]PathEdge, 0, len(nodeIDs)-1)
	for index := 0; index < len(nodeIDs)-1; index++ {
		from := nodeIDs[index]
		to := nodeIDs[index+1]
		// Use the edge recorded when `to` was discovered so reverse traversals
		// keep the declared edge's kind (link/reference) instead of "reverse".
		edge := visited[to].edge
		kind := edge.kind
		if kind == "" {
			kind = "reverse"
		}
		edges = append(edges, PathEdge{Kind: kind, From: from, To: to, Context: edge.context})
	}

	return ShortestPathResult{
		From:     fromID,
		To:       toID,
		Found:    true,
		Directed: directed,
		Distance: len(nodeIDs) - 1,
		Nodes:    nodes,
		Edges:    edges,
	}
}
