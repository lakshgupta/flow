package core

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/lex/flow/internal/graph"
	"github.com/lex/flow/internal/markdown"
)

// RoadmapFeature summarizes one feature sub-graph within the roadmap view.
type RoadmapFeature struct {
	Slug          string   `json:"slug"`
	Status        string   `json:"status"`
	TotalTasks    int      `json:"totalTasks"`
	DoneTasks     int      `json:"doneTasks"`
	ReadyTasks    int      `json:"readyTasks"`
	RunningTasks  int      `json:"runningTasks"`
	BlockedTasks  int      `json:"blockedTasks"`
	ReadinessGaps []string `json:"readinessGaps,omitempty"`
}

// RoadmapDependency describes one depends-on predecessor of a ready task.
type RoadmapDependency struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

// RoadmapPacket is the self-contained execution context for one task: a cold
// agent session needs nothing beyond this to implement it.
type RoadmapPacket struct {
	TaskID       string              `json:"taskId"`
	Title        string              `json:"title"`
	Graph        string              `json:"graph"`
	Path         string              `json:"path"`
	Layer        int                 `json:"layer"`
	Status       string              `json:"status"`
	Session      string              `json:"session,omitempty"`
	SessionAt    string              `json:"sessionAt,omitempty"`
	Description  string              `json:"description,omitempty"`
	Tags         []string            `json:"tags,omitempty"`
	Body         string              `json:"body"`
	Dependencies []RoadmapDependency `json:"dependencies,omitempty"`
	ReadinessGap []string            `json:"readinessGaps,omitempty"`
}

// RoadmapView aggregates per-feature progress and the next-ready queue.
type RoadmapView struct {
	Features  []RoadmapFeature `json:"features"`
	NextReady []RoadmapPacket  `json:"nextReady"`
}

// DefaultClaimStaleness is how long a Running claim may sit untouched before
// other sessions may surface resume/revert/handoff for it.
const DefaultClaimStaleness = 4 * time.Hour

// acceptanceCriteriaMarker is the planning-convention marker for a task body
// that carries acceptance criteria.
const acceptanceCriteriaMarker = "acceptance criteria"

// roadmapFeatureSlug derives the feature identity from a task's graph path:
// the sub-graph directory under the development root (for example
// "development/20260822-002-FEAT-x" → "20260822-002-FEAT-x").
func roadmapFeatureSlug(graphPath string) string {
	parts := strings.Split(graphPath, "/")
	if len(parts) >= 2 {
		return parts[1]
	}
	return parts[0]
}

// BuildRoadmapView computes per-feature progress and the next-ready execution
// queue from workspace documents. Feature slugs are the first path segment
// under the development root; ordering comes from graph.BuildTaskLayerView.
func BuildRoadmapView(documents []markdown.WorkspaceDocument) (RoadmapView, error) {
	layerView, err := graph.BuildTaskLayerView(documents)
	if err != nil {
		return RoadmapView{}, err
	}

	taskBody := map[string]string{}
	openQuestions := map[string][]string{} // question note title -> linked task ids
	for _, item := range documents {
		switch value := item.Document.(type) {
		case markdown.TaskDocument:
			taskBody[value.Metadata.ID] = value.Body
		case markdown.NoteDocument:
			hasQuestionTag := false
			for _, tag := range value.Metadata.Tags {
				if strings.EqualFold(tag, "question") {
					hasQuestionTag = true
					break
				}
			}
			if !hasQuestionTag {
				continue
			}
			targets := markdown.NodeLinkIDs(value.Metadata.Links)
			openQuestions[value.Metadata.Title] = targets
		}
	}

	featureOrder := []string{}
	features := map[string]*RoadmapFeature{}
	gapSet := map[string]map[string]struct{}{}
	addGap := func(slug string, gap string) {
		if gapSet[slug] == nil {
			gapSet[slug] = map[string]struct{}{}
		}
		gapSet[slug][gap] = struct{}{}
	}

	// Layer index by task id for dependency-aware ordering.
	packetLayer := map[string]int{}
	dependenciesByTask := map[string][]RoadmapDependency{}
	for id, node := range layerView.Tasks {
		packetLayer[id] = node.Layer
	}
	for _, item := range documents {
		taskDocument, ok := item.Document.(markdown.TaskDocument)
		if !ok {
			continue
		}
		for _, link := range taskDocument.Metadata.Links {
			target, exists := layerView.Tasks[link.Node]
			if !exists {
				continue
			}
			dependenciesByTask[taskDocument.Metadata.ID] = append(dependenciesByTask[taskDocument.Metadata.ID], RoadmapDependency{
				ID:     link.Node,
				Status: target.Status,
			})
		}
	}

	for _, layer := range layerView.Layers {
		for _, node := range layer.Tasks {
			slug := roadmapFeatureSlug(node.Graph)
			if _, exists := features[slug]; !exists {
				features[slug] = &RoadmapFeature{Slug: slug, Status: "Open"}
				featureOrder = append(featureOrder, slug)
			}
			feature := features[slug]
			feature.TotalTasks++

			switch node.Status {
			case "Done", "Success":
				feature.DoneTasks++
			case "Failed", "Interrupted":
				feature.BlockedTasks++
			case "Running":
				feature.RunningTasks++
			case "Ready":
				if hasUnfinishedPredecessor(node.ID, dependenciesByTask, layerView.Tasks) {
					feature.BlockedTasks++
				} else {
					feature.ReadyTasks++
				}
			}

			body := strings.ToLower(taskBody[node.ID])
			if !strings.Contains(body, acceptanceCriteriaMarker) {
				addGap(slug, fmt.Sprintf("task %s missing acceptance criteria", node.ID))
			}
		}
	}

	for title, targets := range openQuestions {
		for _, target := range targets {
			node, exists := layerView.Tasks[target]
			if !exists {
				continue
			}
			addGap(roadmapFeatureSlug(node.Graph), "open question: "+title)
		}
	}

	sort.Strings(featureOrder)
	view := RoadmapView{Features: make([]RoadmapFeature, 0, len(featureOrder))}
	for _, slug := range featureOrder {
		feature := features[slug]
		switch {
		case feature.DoneTasks == feature.TotalTasks:
			feature.Status = "Completed"
		case feature.DoneTasks > 0 || feature.RunningTasks > 0:
			feature.Status = "In Progress"
		default:
			feature.Status = "Open"
		}
		for gap := range gapSet[slug] {
			feature.ReadinessGaps = append(feature.ReadinessGaps, gap)
		}
		sort.Strings(feature.ReadinessGaps)
		view.Features = append(view.Features, *feature)
	}

	view.NextReady = selectNextReady(documents, layerView, dependenciesByTask, packetLayer)
	return view, nil
}

func hasUnfinishedPredecessor(taskID string, dependenciesByTask map[string][]RoadmapDependency, tasks map[string]graph.TaskNode) bool {
	for _, dependency := range dependenciesByTask[taskID] {
		predecessor, exists := tasks[dependency.ID]
		if !exists {
			continue
		}
		// Done/Success are terminal-success states; anything else blocks.
		if predecessor.Status == "Done" || predecessor.Status == "Success" {
			continue
		}
		return true
	}
	return false
}

// SelectClaimCandidate returns the first unclaimed next-ready packet, or nil
// when every ready task is claimed or none exist.
func SelectClaimCandidate(view RoadmapView) *RoadmapPacket {
	for index := range view.NextReady {
		if view.NextReady[index].Session == "" {
			return &view.NextReady[index]
		}
	}
	return nil
}

// ClaimIsStale reports whether a claim older than threshold should be surfaced
// as stale (resume/revert/handoff) rather than blocking others.
func ClaimIsStale(sessionAt string, now time.Time, threshold time.Duration) (bool, error) {
	if strings.TrimSpace(sessionAt) == "" {
		return false, nil
	}
	claimedAt, err := time.Parse(time.RFC3339, sessionAt)
	if err != nil {
		return false, fmt.Errorf("parse session-at timestamp: %w", err)
	}
	return now.Sub(claimedAt) >= threshold, nil
}

// BuildRoadmapPacket returns the full execution packet for one task id from
// the workspace documents, including dependency statuses.
func BuildRoadmapPacket(documents []markdown.WorkspaceDocument, taskID string) (RoadmapPacket, error) {
	layerView, err := graph.BuildTaskLayerView(documents)
	if err != nil {
		return RoadmapPacket{}, err
	}
	node, exists := layerView.Tasks[taskID]
	if !exists {
		return RoadmapPacket{}, fmt.Errorf("task %q not found", taskID)
	}

	packet := RoadmapPacket{
		TaskID: node.ID,
		Title:  node.Title,
		Graph:  node.Graph,
		Path:   node.Path,
		Layer:  node.Layer,
		Status: node.Status,
		Tags:   node.Tags,
	}

	for _, item := range documents {
		switch value := item.Document.(type) {
		case markdown.TaskDocument:
			if value.Metadata.ID != taskID {
				continue
			}
			packet.Body = value.Body
			packet.Session = value.Metadata.Session
			packet.SessionAt = value.Metadata.SessionAt
			packet.Description = value.Metadata.Description
		case markdown.NoteDocument:
			if strings.EqualFold(value.Metadata.Graph, node.Graph) &&
				strings.Contains(strings.ToLower(value.Title()), strings.ToLower(designNoteTitleFragment(node))) {
				packet.ReadinessGap = append(packet.ReadinessGap, "design-note-excerpt: "+firstLines(value.BodyContent(), 12))
			}
		}
	}

	for _, link := range node.Links {
		if predecessor, ok := layerView.Tasks[link]; ok {
			packet.Dependencies = append(packet.Dependencies, RoadmapDependency{ID: link, Status: predecessor.Status})
		}
	}
	return packet, nil
}

func designNoteTitleFragment(node graph.TaskNode) string {
	parts := strings.Split(node.Graph, "/")
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}

func firstLines(text string, count int) string {
	lines := strings.Split(strings.TrimSpace(text), "\n")
	if len(lines) > count {
		lines = lines[:count]
	}
	return strings.Join(lines, "\n")
}

func selectNextReady(documents []markdown.WorkspaceDocument, layerView graph.TaskLayerView, dependenciesByTask map[string][]RoadmapDependency, packetLayer map[string]int) []RoadmapPacket {
	candidates := make([]graph.TaskNode, 0, 16)
	for _, node := range layerView.Tasks {
		if node.Status != "Ready" {
			continue
		}
		if hasUnfinishedPredecessor(node.ID, dependenciesByTask, layerView.Tasks) {
			continue
		}
		candidates = append(candidates, node)
	}

	sort.Slice(candidates, func(left int, right int) bool {
		if candidates[left].Layer != candidates[right].Layer {
			return candidates[left].Layer < candidates[right].Layer
		}
		if candidates[left].UpdatedAt != candidates[right].UpdatedAt {
			return candidates[left].UpdatedAt < candidates[right].UpdatedAt
		}
		return candidates[left].ID < candidates[right].ID
	})

	packets := make([]RoadmapPacket, 0, len(candidates))
	documentsByID := map[string]markdown.WorkspaceDocument{}
	for _, item := range documents {
		documentsByID[item.Document.ID()] = item
	}

	for _, candidate := range candidates {
		item, exists := documentsByID[candidate.ID]
		if !exists {
			continue
		}
		taskDocument := item.Document.(markdown.TaskDocument)
		packet := RoadmapPacket{
			TaskID:      candidate.ID,
			Title:       candidate.Title,
			Graph:       candidate.Graph,
			Path:        candidate.Path,
			Layer:       packetLayer[candidate.ID],
			Status:      candidate.Status,
			Session:     taskDocument.Metadata.Session,
			SessionAt:   taskDocument.Metadata.SessionAt,
			Description: taskDocument.Metadata.Description,
			Tags:        candidate.Tags,
			Body:        taskDocument.Body,
		}
		for _, dependency := range dependenciesByTask[candidate.ID] {
			packet.Dependencies = append(packet.Dependencies, dependency)
		}
		packets = append(packets, packet)
	}
	return packets
}
