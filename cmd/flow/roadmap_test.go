package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lex/flow/internal/markdown"
)

func seedRoadmapWorkspaceForTest(t *testing.T) string {
	t.Helper()
	rootDir := t.TempDir()

	writeTask := func(graph, file, id, status, body string) {
		writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "content", graph, file+".md"), markdown.TaskDocument{
			Metadata: markdown.TaskMetadata{
				CommonFields: markdown.CommonFields{
					ID: id, Type: markdown.TaskType, Graph: graph, Title: "Task " + id,
					Description: "desc for " + id,
				},
				Status: status,
			},
			Body: body,
		})
	}

	writeTask("development/20260822-001-FEAT-alpha", "one", "dev/alpha/one", "Ready", "# Task\n\n## Acceptance Criteria\n- works")
	writeTask("development/20260822-001-FEAT-alpha", "two", "dev/alpha/two", "Done", "## Acceptance Criteria\n- ok")
	writeTask("development/20260822-002-FEAT-beta", "one", "dev/beta/one", "Ready", "no criteria")

	return rootDir
}

func TestFlowRoadmapSummaryReportsFeaturesAndGaps(t *testing.T) {
	rootDir := seedRoadmapWorkspaceForTest(t)

	stdout, stderr := runForTest(t, []string{"roadmap"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}
	if !strings.Contains(stdout, "2 features") {
		t.Fatalf("stdout missing feature count, got %q", stdout)
	}
	if !strings.Contains(stdout, "20260822-001-FEAT-alpha") || !strings.Contains(stdout, "In Progress") {
		t.Fatalf("stdout missing alpha feature line, got %q", stdout)
	}
	if !strings.Contains(stdout, "gap: task dev/beta/one missing acceptance criteria") {
		t.Fatalf("stdout missing readiness gap, got %q", stdout)
	}
	if !strings.Contains(stdout, "next ready:") || !strings.Contains(stdout, "dev/alpha/one") {
		t.Fatalf("stdout missing next-ready queue, got %q", stdout)
	}
}

func TestFlowRoadmapNextPrintsExecutionPacket(t *testing.T) {
	rootDir := seedRoadmapWorkspaceForTest(t)

	stdout, stderr := runForTest(t, []string{"roadmap", "--next", "--graph", "20260822-001-FEAT-alpha"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}
	if !strings.Contains(stdout, "task:    dev/alpha/one") {
		t.Fatalf("stdout missing packet header, got %q", stdout)
	}
	if !strings.Contains(stdout, "Acceptance Criteria") {
		t.Fatalf("stdout missing packet body, got %q", stdout)
	}
}

func TestFlowRoadmapClaimStampsSessionAndRunning(t *testing.T) {
	rootDir := seedRoadmapWorkspaceForTest(t)

	stdout, stderr := runForTest(t, []string{"roadmap", "--claim", "--session", "agent-a"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}
	if !strings.Contains(stdout, "claimed dev/alpha/one") {
		t.Fatalf("stdout missing claim confirmation, got %q", stdout)
	}

	data, err := os.ReadFile(filepath.Join(rootDir, ".flow", "data", "content", "development", "20260822-001-FEAT-alpha", "one.md"))
	if err != nil {
		t.Fatalf("read claimed task file: %v", err)
	}
	content := string(data)
	if !strings.Contains(content, "status: Running") || !strings.Contains(content, "session: agent-a") {
		t.Fatalf("claimed task file missing Running/session stamp:\n%s", content)
	}
	if !strings.Contains(content, "session-at:") {
		t.Fatalf("claimed task file missing session-at:\n%s", content)
	}

	// Second claim takes the other feature's ready task (alpha is claimed).
	stdout, stderr = runForTest(t, []string{"roadmap", "--claim", "--session", "agent-b"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}
	if !strings.Contains(stdout, "claimed dev/beta/one") {
		t.Fatalf("second claim should take beta; got %q", stdout)
	}
}

func TestFlowRoadmapJSONOutput(t *testing.T) {
	rootDir := seedRoadmapWorkspaceForTest(t)

	stdout, stderr := runForTest(t, []string{"roadmap", "--json"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}
	if !strings.Contains(stdout, `"slug": "20260822-001-FEAT-alpha"`) && !strings.Contains(stdout, `"slug":"20260822-001-FEAT-alpha"`) {
		t.Fatalf("json output missing feature slug, got %q", stdout)
	}
	if !strings.Contains(stdout, `"taskId"`) && !strings.Contains(stdout, `"nextReady"`) {
		t.Fatalf("json output missing nextReady queue, got %q", stdout)
	}
}
