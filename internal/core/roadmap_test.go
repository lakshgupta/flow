package core

import (
	"strings"
	"testing"
	"time"

	"github.com/lex/flow/internal/markdown"
)

func roadmapTestDocuments() []markdown.WorkspaceDocument {
	task := func(id, graph, file, status, body string) markdown.WorkspaceDocument {
		document := markdown.TaskDocument{
			Metadata: markdown.TaskMetadata{
				CommonFields: markdown.CommonFields{
					ID: id, Type: markdown.TaskType, Graph: graph, Title: "Task " + id,
				},
				Status: status,
			},
			Body: body,
		}
		return markdown.WorkspaceDocument{Path: "data/content/" + graph + "/" + file + ".md", Document: document}
	}

	alphaOne := task("dev/a1", "development/a-feature", "one", "Ready", "## Acceptance Criteria\n- works")
	alphaTwo := task("dev/a2", "development/a-feature", "two", "Ready", "no criteria here")
	betaOne := task("dev/b1", "development/b-feature", "one", "Ready", "## Acceptance Criteria\n- ok")
	doneTask := task("dev/c1", "development/c-feature", "one", "Done", "## Acceptance Criteria\n- done")

	return []markdown.WorkspaceDocument{alphaOne, alphaTwo, betaOne, doneTask}
}

func TestBuildRoadmapViewGroupsFeaturesAndLayers(t *testing.T) {
	documents := roadmapTestDocuments()

	view, err := BuildRoadmapView(documents)
	if err != nil {
		t.Fatalf("BuildRoadmapView() error = %v", err)
	}

	if len(view.Features) != 3 {
		t.Fatalf("len(view.Features) = %d, want 3; got %#v", len(view.Features), view.Features)
	}

	var aFeature *RoadmapFeature
	var cFeature *RoadmapFeature
	for index := range view.Features {
		switch view.Features[index].Slug {
		case "a-feature":
			aFeature = &view.Features[index]
		case "c-feature":
			cFeature = &view.Features[index]
		}
	}

	if aFeature == nil || cFeature == nil {
		t.Fatalf("missing expected features; got %#v", view.Features)
	}

	if aFeature.TotalTasks != 2 || aFeature.DoneTasks != 0 {
		t.Fatalf("a-feature progress wrong: %#v", aFeature)
	}
	if aFeature.Status != "Open" {
		t.Fatalf("a-feature status = %q, want Open", aFeature.Status)
	}
	if cFeature.Status != "Completed" {
		t.Fatalf("c-feature status = %q, want Completed", cFeature.Status)
	}

	foundGap := false
	for _, gap := range aFeature.ReadinessGaps {
		if strings.Contains(gap, "dev/a2 missing acceptance criteria") {
			foundGap = true
		}
	}
	if !foundGap {
		t.Fatalf("expected missing-criteria gap for dev/a2; gaps = %v", aFeature.ReadinessGaps)
	}
}

func TestBuildRoadmapViewSurfacesOpenQuestions(t *testing.T) {
	note := markdown.NoteDocument{Metadata: markdown.NoteMetadata{
		CommonFields: markdown.CommonFields{
			ID: "design/q1", Type: markdown.NoteType, Graph: "development/a-feature",
			Title: "Do we retry?", Tags: []string{"question"},
		},
		Links: []markdown.NodeLink{{Node: "dev/a1"}},
	}}
	documents := append(roadmapTestDocuments(), markdown.WorkspaceDocument{
		Path:     "data/content/development/a-feature/q1.md",
		Document: note,
	})

	view, err := BuildRoadmapView(documents)
	if err != nil {
		t.Fatalf("BuildRoadmapView() error = %v", err)
	}

	foundQuestion := false
	for _, feature := range view.Features {
		if feature.Slug != "a-feature" {
			continue
		}
		for _, gap := range feature.ReadinessGaps {
			if strings.Contains(gap, "open question: Do we retry?") {
				foundQuestion = true
			}
		}
	}
	if !foundQuestion {
		t.Fatal("expected open question gap for a-feature")
	}
}

func TestNextReadyOrdersByLayerThenUpdatedAt(t *testing.T) {
	documents := roadmapTestDocuments()
	// Give dev/a2 an explicit dependency on dev/b1 to force layers.
	for index := range documents {
		item := documents[index]
		taskDoc, ok := item.Document.(markdown.TaskDocument)
		if !ok || taskDoc.Metadata.ID != "dev/a2" {
			continue
		}
		taskDoc.Metadata.Links = []markdown.NodeLink{{Node: "dev/b1"}}
		documents[index].Document = taskDoc
	}

	view, err := BuildRoadmapView(documents)
	if err != nil {
		t.Fatalf("BuildRoadmapView() error = %v", err)
	}

	// With the dependency: layer 0 = dev/a1 + dev/b1; dev/c1 is Done.
	if len(view.NextReady) != 2 {
		t.Fatalf("expected 2 ready tasks; got %d", len(view.NextReady))
	}
	if view.NextReady[0].Layer != 0 {
		t.Fatalf("first ready packet layer = %d, want 0", view.NextReady[0].Layer)
	}
	for _, packet := range view.NextReady {
		if packet.Session != "" {
			continue
		}
	}
	first := view.NextReady[0]
	if first.Layer > view.NextReady[len(view.NextReady)-1].Layer {
		t.Fatal("next-ready queue is not layer ordered")
	}
}

func TestSelectClaimCandidateSkipsClaimed(t *testing.T) {
	documents := roadmapTestDocuments()
	view, err := BuildRoadmapView(documents)
	if err != nil {
		t.Fatalf("BuildRoadmapView() error = %v", err)
	}

	if len(view.NextReady) == 0 {
		t.Fatal("expected ready packets")
	}
	view.NextReady[0].Session = "someone"

	candidate := SelectClaimCandidate(view)
	if candidate == nil {
		t.Fatal("expected an unclaimed candidate")
	}
	if candidate.Session != "" {
		t.Fatalf("candidate claimed: %s", candidate.Session)
	}

	for index := range view.NextReady {
		view.NextReady[index].Session = "x"
	}
	if SelectClaimCandidate(view) != nil {
		t.Fatal("SelectClaimCandidate should return nil when all ready tasks are claimed")
	}
}

func TestClaimIsStale(t *testing.T) {
	now := time.Now().UTC()

	if stale, _ := ClaimIsStale("", now, DefaultClaimStaleness); stale {
		t.Fatal("empty timestamp must not be stale")
	}
	fresh := now.Add(-time.Hour).Format(time.RFC3339)
	if stale, _ := ClaimIsStale(fresh, now, DefaultClaimStaleness); stale {
		t.Fatal("1h-old claim must not be stale at 4h threshold")
	}
	old := now.Add(-5 * time.Hour).Format(time.RFC3339)
	stale, err := ClaimIsStale(old, now, DefaultClaimStaleness)
	if err != nil || !stale {
		t.Fatalf("5h-old claim should be stale; stale=%v err=%v", stale, err)
	}
	if _, err := ClaimIsStale("not-a-timestamp", now, DefaultClaimStaleness); err == nil {
		t.Fatal("unparsable timestamp should error")
	}
}
