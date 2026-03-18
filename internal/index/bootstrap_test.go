package index

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"
)

func TestRebuildCreatesSchemaDatabase(t *testing.T) {
	t.Parallel()

	indexPath := filepath.Join(t.TempDir(), ".flow", "flow.index")

	if err := Rebuild(indexPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	defer database.Close()

	var count int
	if err := database.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'documents'`).Scan(&count); err != nil {
		t.Fatalf("QueryRow() error = %v", err)
	}

	if count != 1 {
		t.Fatalf("documents table count = %d, want 1", count)
	}
}

func TestRebuildIndexesMarkdownDocuments(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "features", "demo", "notes", "architecture.md"), "---\nid: note-1\ntype: note\ngraph: notes\ntitle: Architecture\nreferences:\n  - task-1\n---\n\nNote body\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "features", "demo", "tasks", "foundation.md"), "---\nid: task-0\ntype: task\ngraph: planning\ntitle: Foundation\nstatus: todo\n---\n\nFoundation body\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "features", "demo", "tasks", "parser.md"), "---\nid: task-1\ntype: task\ngraph: execution\ntitle: Build parser\nstatus: todo\ndependsOn:\n  - task-0\nreferences:\n  - note-1\n---\n\nTask body\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "features", "release", "commands", "prepare.md"), "---\nid: cmd-0\ntype: command\ngraph: release\ntitle: Prepare\nname: prepare\nrun: ./prepare.sh\n---\n\nPrepare body\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "features", "release", "commands", "build.md"), "---\nid: cmd-1\ntype: command\ngraph: release\ntitle: Build\nname: build\ndependsOn:\n  - cmd-0\nreferences:\n  - note-1\nenv:\n  GOOS: linux\n  GOARCH: amd64\nrun: go build ./cmd/flow\n---\n\nCommand body\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	defer database.Close()

	assertQueryCount(t, database, `SELECT COUNT(*) FROM documents`, 5)
	assertQueryCount(t, database, `SELECT COUNT(*) FROM hard_dependencies`, 2)
	assertQueryCount(t, database, `SELECT COUNT(*) FROM soft_references`, 3)
	assertQueryCount(t, database, `SELECT COUNT(*) FROM note_links`, 0)
	assertQueryCount(t, database, `SELECT COUNT(*) FROM command_env`, 2)
	assertQueryCount(t, database, `SELECT COUNT(*) FROM command_lookup`, 2)

	var featureSlug string
	var graph string
	var body string
	if err := database.QueryRow(`SELECT feature_slug, graph, body_text FROM documents WHERE id = 'task-1'`).Scan(&featureSlug, &graph, &body); err != nil {
		t.Fatalf("QueryRow(task document) error = %v", err)
	}

	if featureSlug != "demo" {
		t.Fatalf("featureSlug = %q, want demo", featureSlug)
	}

	if graph != "execution" {
		t.Fatalf("graph = %q, want execution", graph)
	}

	if body != "Task body\n" {
		t.Fatalf("body = %q, want Task body\\n", body)
	}

	var shortName string
	var run string
	if err := database.QueryRow(`SELECT short_name, run FROM command_lookup WHERE document_id = 'cmd-1'`).Scan(&shortName, &run); err != nil {
		t.Fatalf("QueryRow(command lookup) error = %v", err)
	}

	if shortName != "build" || run != "go build ./cmd/flow" {
		t.Fatalf("command lookup = %q %q", shortName, run)
	}
}

func TestRebuildRejectsCrossTypeTaskDependency(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "features", "release", "commands", "build.md"), "---\nid: cmd-1\ntype: command\ngraph: release\ntitle: Build\nname: build\nrun: go build ./cmd/flow\n---\n\nBuild\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "features", "demo", "tasks", "parser.md"), "---\nid: task-1\ntype: task\ngraph: execution\ntitle: Build parser\nstatus: todo\ndependsOn:\n  - cmd-1\n---\n\nTask body\n")

	err := Rebuild(indexPath, flowPath)
	if err == nil {
		t.Fatal("Rebuild() error = nil, want cross-type hard dependency validation error")
	}
}

func TestRebuildRejectsDuplicateCommandShortName(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "features", "release", "commands", "build.md"), "---\nid: cmd-1\ntype: command\ngraph: release\ntitle: Build\nname: build\nrun: go build ./cmd/flow\n---\n\nBuild\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "features", "demo", "commands", "build.md"), "---\nid: cmd-2\ntype: command\ngraph: demo\ntitle: Build again\nname: build\nrun: go test ./...\n---\n\nBuild\n")

	err := Rebuild(indexPath, flowPath)
	if err == nil {
		t.Fatal("Rebuild() error = nil, want duplicate command short name validation error")
	}
}

func TestRebuildStoresBidirectionalNoteLinksOnce(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "features", "demo", "notes", "alpha.md"), "---\nid: note-1\ntype: note\ngraph: notes\ntitle: Alpha\nreferences:\n  - note-2\n  - task-1\n---\n\nAlpha\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "features", "demo", "notes", "beta.md"), "---\nid: note-2\ntype: note\ngraph: notes\ntitle: Beta\nreferences:\n  - note-1\n---\n\nBeta\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "features", "demo", "tasks", "task.md"), "---\nid: task-1\ntype: task\ngraph: execution\ntitle: Task\nstatus: todo\n---\n\nTask\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	defer database.Close()

	assertQueryCount(t, database, `SELECT COUNT(*) FROM note_links`, 1)
	assertQueryCount(t, database, `SELECT COUNT(*) FROM soft_references`, 1)

	var leftNoteID string
	var rightNoteID string
	if err := database.QueryRow(`SELECT left_note_id, right_note_id FROM note_links`).Scan(&leftNoteID, &rightNoteID); err != nil {
		t.Fatalf("QueryRow(note link) error = %v", err)
	}

	if leftNoteID != "note-1" || rightNoteID != "note-2" {
		t.Fatalf("note link = %q %q, want note-1 note-2", leftNoteID, rightNoteID)
	}

	var documentID string
	var referenceID string
	if err := database.QueryRow(`SELECT document_id, reference_id FROM soft_references`).Scan(&documentID, &referenceID); err != nil {
		t.Fatalf("QueryRow(soft reference) error = %v", err)
	}

	if documentID != "note-1" || referenceID != "task-1" {
		t.Fatalf("soft reference = %q %q, want note-1 task-1", documentID, referenceID)
	}
}

func writeMarkdownDocument(t *testing.T, path string, content string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
}

func assertQueryCount(t *testing.T, database *sql.DB, query string, want int) {
	t.Helper()

	var got int
	if err := database.QueryRow(query).Scan(&got); err != nil {
		t.Fatalf("QueryRow(%q) error = %v", query, err)
	}

	if got != want {
		t.Fatalf("QueryRow(%q) = %d, want %d", query, got, want)
	}
}
