package index

import (
	"path/filepath"
	"testing"

	"github.com/lex/flow/internal/markdown"
)

func writeEdgeViolationFixture(t *testing.T) (string, string) {
	t.Helper()

	flowPath := filepath.Join(t.TempDir(), ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "note.md"),
		"---\nid: note-a\ntype: note\ngraph: demo\ntitle: Alpha\n---\n\nAlpha body\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "task.md"),
		"---\nid: task-a\ntype: task\ngraph: demo\ntitle: Task\nstatus: Ready\nlinks:\n  - node: note-a\n    relationships:\n      - depends-on\n---\n\nTask body\n")

	return indexPath, flowPath
}

func TestRebuildPersistsGraphEdgeViolations(t *testing.T) {
	t.Parallel()

	indexPath, flowPath := writeEdgeViolationFixture(t)
	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	violations, err := ReadGraphEdgeViolations(indexPath)
	if err != nil {
		t.Fatalf("ReadGraphEdgeViolations() error = %v", err)
	}
	if len(violations) != 1 {
		t.Fatalf("len(violations) = %d, want 1", len(violations))
	}

	violation := violations[0]
	if violation.Path != "data/content/demo/task.md" || violation.Graph != "demo" {
		t.Fatalf("violation path/graph = %q/%q, want data/content/demo/task.md/demo", violation.Path, violation.Graph)
	}
	if violation.FromID != "task-a" || violation.FromType != markdown.TaskType || violation.ToID != "note-a" || violation.ToType != markdown.NoteType {
		t.Fatalf("violation endpoints = from %q (%s) to %q (%s), want task-a(task)->note-a(note)",
			violation.FromID, violation.FromType, violation.ToID, violation.ToType)
	}
	if violation.Relationship != "depends-on" || violation.Severity != markdown.EdgeTypeSeverityWarning {
		t.Fatalf("violation relationship/severity = %q/%q, want depends-on/warning", violation.Relationship, violation.Severity)
	}
	if len(violation.FixTags) != 1 || violation.FixTags[0] != "relates-to" {
		t.Fatalf("violation fixTags = %#v, want [relates-to]", violation.FixTags)
	}
	if violation.Message == "" {
		t.Fatal("violation message = empty, want explanation")
	}
}

func TestRebuildReplacesStaleGraphEdgeViolations(t *testing.T) {
	t.Parallel()

	indexPath, flowPath := writeEdgeViolationFixture(t)
	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	// Fix the offending relationship, then rebuild: the persisted list must
	// reflect the fresh state rather than accumulating stale rows.
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "task.md"),
		"---\nid: task-a\ntype: task\ngraph: demo\ntitle: Task\nstatus: Ready\nlinks:\n  - node: note-a\n    relationships:\n      - relates-to\n---\n\nTask body\n")
	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild(second) error = %v", err)
	}

	violations, err := ReadGraphEdgeViolations(indexPath)
	if err != nil {
		t.Fatalf("ReadGraphEdgeViolations() error = %v", err)
	}
	if len(violations) != 0 {
		t.Fatalf("len(violations) = %d, want 0 after fix", len(violations))
	}
}

func TestRebuildWithoutFlowPathLeavesViolationsEmpty(t *testing.T) {
	t.Parallel()

	indexPath, flowPath := writeEdgeViolationFixture(t)
	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	// Rebuild without a flow path recreates the schema but indexes no documents,
	// so the violations table must be empty rather than stale.
	if err := Rebuild(indexPath); err != nil {
		t.Fatalf("Rebuild(no flow path) error = %v", err)
	}

	violations, err := ReadGraphEdgeViolations(indexPath)
	if err != nil {
		t.Fatalf("ReadGraphEdgeViolations() error = %v", err)
	}
	if len(violations) != 0 {
		t.Fatalf("len(violations) = %d, want 0", len(violations))
	}
}

func TestRebuildToleratesDuplicateRelationshipTags(t *testing.T) {
	t.Parallel()

	flowPath := filepath.Join(t.TempDir(), ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "note.md"),
		"---\nid: note-a\ntype: note\ngraph: demo\ntitle: Alpha\n---\n\nAlpha body\n")
	// Hand-written frontmatter listing the same relationship twice produces
	// identical violations; the rebuild must stay non-fatal (advisory check).
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "task.md"),
		"---\nid: task-a\ntype: task\ngraph: demo\ntitle: Task\nstatus: Ready\nlinks:\n  - node: note-a\n    relationships:\n      - depends-on\n      - depends-on\n---\n\nTask body\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v, want duplicate violations to be non-fatal", err)
	}

	violations, err := ReadGraphEdgeViolations(indexPath)
	if err != nil {
		t.Fatalf("ReadGraphEdgeViolations() error = %v", err)
	}
	if len(violations) != 1 {
		t.Fatalf("len(violations) = %d, want 1 (duplicates deduped)", len(violations))
	}
}

func TestReadGraphEdgeViolationsWorkspaceRebuildsMissingIndex(t *testing.T) {
	t.Parallel()

	indexPath, flowPath := writeEdgeViolationFixture(t)

	violations, err := ReadGraphEdgeViolationsWorkspace(indexPath, flowPath)
	if err != nil {
		t.Fatalf("ReadGraphEdgeViolationsWorkspace() error = %v", err)
	}
	if len(violations) != 1 {
		t.Fatalf("len(violations) = %d, want 1 after implicit rebuild", len(violations))
	}
}
