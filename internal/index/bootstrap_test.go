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

	indexPath := filepath.Join(t.TempDir(), ".flow", "config", "flow.index")

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

	if err := database.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'graph_layout_positions'`).Scan(&count); err != nil {
		t.Fatalf("QueryRow(graph_layout_positions) error = %v", err)
	}

	if count != 1 {
		t.Fatalf("graph_layout_positions table count = %d, want 1", count)
	}

	if err := database.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'graph_layout_viewports'`).Scan(&count); err != nil {
		t.Fatalf("QueryRow(graph_layout_viewports) error = %v", err)
	}

	if count != 1 {
		t.Fatalf("graph_layout_viewports table count = %d, want 1", count)
	}

	if err := database.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'workspace_gui_settings'`).Scan(&count); err != nil {
		t.Fatalf("QueryRow(workspace_gui_settings) error = %v", err)
	}

	if count != 1 {
		t.Fatalf("workspace_gui_settings table count = %d, want 1", count)
	}

	if err := database.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'workspace_graph_directory_colors'`).Scan(&count); err != nil {
		t.Fatalf("QueryRow(workspace_graph_directory_colors) error = %v", err)
	}

	if count != 1 {
		t.Fatalf("workspace_graph_directory_colors table count = %d, want 1", count)
	}
}

func TestRebuildIndexesMarkdownDocuments(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "home.md"), "# Home\n\nWorkspace landing page.\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "knowledge", "architecture.md"), "---\nid: note-1\ntype: note\ngraph: wrong\ntitle: Architecture\nlinks:\n  - task-1\n---\n\nNote body\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "planning", "foundation.md"), "---\nid: task-0\ntype: task\ngraph: wrong\ntitle: Foundation\nstatus: Ready\n---\n\nFoundation body\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "execution", "parser.md"), "---\nid: task-1\ntype: task\ngraph: stale\ntitle: Build parser\nstatus: Ready\nlinks:\n  - note-1\n---\n\nTask body\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "release", "prepare.md"), "---\nid: cmd-0\ntype: command\ngraph: old\ntitle: Prepare\nname: prepare\nrun: ./prepare.sh\n---\n\nPrepare body\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "release", "build.md"), "---\nid: cmd-1\ntype: command\ngraph: release\ntitle: Build\nname: build\nlinks:\n  - note-1\nenv:\n  GOOS: linux\n  GOARCH: amd64\nrun: go build ./cmd/flow\n---\n\nCommand body\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	defer database.Close()

	assertQueryCount(t, database, `SELECT COUNT(*) FROM documents`, 6)
	assertQueryCount(t, database, `SELECT COUNT(*) FROM hard_dependencies`, 0)
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

	if graph != "demo/execution" {
		t.Fatalf("graph = %q, want demo/execution", graph)
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

	var homeType string
	var homeTitle string
	var homeDescription string
	var homeBody string
	if err := database.QueryRow(`SELECT type, title, description_text, body_text FROM documents WHERE id = 'home'`).Scan(&homeType, &homeTitle, &homeDescription, &homeBody); err != nil {
		t.Fatalf("QueryRow(home document) error = %v", err)
	}

	if homeType != "home" {
		t.Fatalf("homeType = %q, want home", homeType)
	}

	if homeTitle != "Home" {
		t.Fatalf("homeTitle = %q, want Home", homeTitle)
	}

	if homeDescription != "" {
		t.Fatalf("homeDescription = %q, want empty", homeDescription)
	}

	if homeBody != "# Home\n\nWorkspace landing page.\n" {
		t.Fatalf("homeBody = %q, want home markdown body", homeBody)
	}
}

func TestRebuildIndexesHomeFrontmatterDescription(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "home.md"), "---\nid: \ntype: home\ntitle: \ndescription: Workspace overview\n---\n\n# Home\n\nOverview body.\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	defer database.Close()

	var id string
	var title string
	var description string
	if err := database.QueryRow(`SELECT id, title, description_text FROM documents WHERE type = 'home'`).Scan(&id, &title, &description); err != nil {
		t.Fatalf("QueryRow(home frontmatter) error = %v", err)
	}

	if id != "home" {
		t.Fatalf("id = %q, want home", id)
	}

	if title != "Home" {
		t.Fatalf("title = %q, want Home", title)
	}

	if description != "Workspace overview" {
		t.Fatalf("description = %q, want Workspace overview", description)
	}
}

func TestRebuildBuildsGraphProjectionWithDirectAndTotalCounts(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "execution", "build.md"), "---\nid: task-1\ntype: task\ngraph: bad\ntitle: Build\nstatus: Ready\n---\n\nBuild\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "execution", "parser", "parse.md"), "---\nid: task-2\ntype: task\ngraph: bad\ntitle: Parse\nstatus: Ready\n---\n\nParse\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "execution", "parser", "release.md"), "---\nid: cmd-1\ntype: command\ngraph: bad\ntitle: Release\nname: release\nrun: ./release.sh\n---\n\nRelease\n")
	if err := os.MkdirAll(filepath.Join(flowPath, "data", "content", "empty", "nested"), 0o755); err != nil {
		t.Fatalf("MkdirAll(empty nested) error = %v", err)
	}

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	nodes, err := ReadGraphNodes(indexPath)
	if err != nil {
		t.Fatalf("ReadGraphNodes() error = %v", err)
	}

	if len(nodes) != 4 {
		t.Fatalf("len(nodes) = %d, want 4", len(nodes))
	}

	if nodes[0].GraphPath != "empty" || nodes[0].DirectCount != 0 || nodes[0].TotalCount != 0 || !nodes[0].HasChildren {
		t.Fatalf("nodes[0] (empty) = %#v", nodes[0])
	}

	if nodes[1].GraphPath != "empty/nested" || nodes[1].DirectCount != 0 || nodes[1].TotalCount != 0 || nodes[1].HasChildren {
		t.Fatalf("nodes[1] (empty/nested) = %#v", nodes[1])
	}

	if nodes[2].GraphPath != "execution" || nodes[2].DirectCount != 1 || nodes[2].TotalCount != 3 || !nodes[2].HasChildren {
		t.Fatalf("nodes[2] = %#v", nodes[2])
	}

	if nodes[3].GraphPath != "execution/parser" || nodes[3].DirectCount != 2 || nodes[3].TotalCount != 2 || nodes[3].HasChildren {
		t.Fatalf("nodes[3] = %#v", nodes[3])
	}
	if nodes[3].DisplayName != "parser" {
		t.Fatalf("nodes[3].DisplayName = %q, want parser", nodes[3].DisplayName)
	}
}

func TestRebuildAllowsCrossTypeTaskReference(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "release", "build.md"), "---\nid: cmd-1\ntype: command\ngraph: release\ntitle: Build\nname: build\nrun: go build ./cmd/flow\n---\n\nBuild\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "parser.md"), "---\nid: task-1\ntype: task\ngraph: execution\ntitle: Build parser\nstatus: Ready\nlinks:\n  - cmd-1\n---\n\nTask body\n")

	err := Rebuild(indexPath, flowPath)
	if err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}
}

func TestRebuildRejectsDuplicateCommandShortName(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "release", "build.md"), "---\nid: cmd-1\ntype: command\ngraph: release\ntitle: Build\nname: build\nrun: go build ./cmd/flow\n---\n\nBuild\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "build.md"), "---\nid: cmd-2\ntype: command\ngraph: demo\ntitle: Build again\nname: build\nrun: go test ./...\n---\n\nBuild\n")

	err := Rebuild(indexPath, flowPath)
	if err == nil {
		t.Fatal("Rebuild() error = nil, want duplicate command short name validation error")
	}
}

func TestRebuildStoresBidirectionalNoteLinksOnce(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "alpha.md"), "---\nid: note-1\ntype: note\ngraph: notes\ntitle: Alpha\nlinks:\n  - note-2\n  - task-1\n---\n\nAlpha\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "beta.md"), "---\nid: note-2\ntype: note\ngraph: notes\ntitle: Beta\nlinks:\n  - note-1\n---\n\nBeta\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "task.md"), "---\nid: task-1\ntype: task\ngraph: execution\ntitle: Task\nstatus: Ready\n---\n\nTask\n")

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

func TestGraphLayoutPositionsRoundTrip(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "alpha.md"), "---\nid: note-1\ntype: note\ngraph: demo\ntitle: Alpha\n---\n\nAlpha\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	if err := WriteGraphLayoutPositions(indexPath, []GraphLayoutPosition{{
		GraphPath:  "demo",
		DocumentID: "note-1",
		X:          120.5,
		Y:          340.25,
	}}); err != nil {
		t.Fatalf("WriteGraphLayoutPositions() error = %v", err)
	}

	positions, err := ReadGraphLayoutPositions(indexPath, "demo")
	if err != nil {
		t.Fatalf("ReadGraphLayoutPositions() error = %v", err)
	}

	if len(positions) != 1 {
		t.Fatalf("len(positions) = %d, want 1", len(positions))
	}

	if positions[0].GraphPath != "demo" || positions[0].DocumentID != "note-1" {
		t.Fatalf("positions[0] = %#v", positions[0])
	}

	if positions[0].X != 120.5 || positions[0].Y != 340.25 {
		t.Fatalf("positions[0] coordinates = (%v, %v), want (120.5, 340.25)", positions[0].X, positions[0].Y)
	}

	if positions[0].UpdatedAt == "" {
		t.Fatal("positions[0].UpdatedAt = empty, want timestamp")
	}
}

func TestGraphLayoutViewportRoundTrip(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "demo", "alpha.md"), "---\nid: note-1\ntype: note\ngraph: demo\ntitle: Alpha\n---\n\nAlpha\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	if err := WriteGraphLayoutViewport(indexPath, GraphLayoutViewport{GraphPath: "demo", X: -220.5, Y: 84.25, Zoom: 1.3}); err != nil {
		t.Fatalf("WriteGraphLayoutViewport() error = %v", err)
	}

	viewport, found, err := ReadGraphLayoutViewport(indexPath, "demo")
	if err != nil {
		t.Fatalf("ReadGraphLayoutViewport() error = %v", err)
	}
	if !found {
		t.Fatal("found = false, want true")
	}

	if viewport.GraphPath != "demo" {
		t.Fatalf("viewport.GraphPath = %q, want demo", viewport.GraphPath)
	}

	if viewport.X != -220.5 || viewport.Y != 84.25 || viewport.Zoom != 1.3 {
		t.Fatalf("viewport = %#v, want -220.5/84.25/1.3", viewport)
	}

	if viewport.UpdatedAt == "" {
		t.Fatal("viewport.UpdatedAt = empty, want timestamp")
	}
}

func TestRebuildPreservesGraphLayoutPositionsForSurvivingDocuments(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")
	alphaPath := filepath.Join(flowPath, "data", "content", "demo", "alpha.md")
	betaPath := filepath.Join(flowPath, "data", "content", "demo", "beta.md")

	writeMarkdownDocument(t, alphaPath, "---\nid: note-1\ntype: note\ngraph: demo\ntitle: Alpha\n---\n\nAlpha\n")
	writeMarkdownDocument(t, betaPath, "---\nid: task-1\ntype: task\ngraph: demo\ntitle: Beta\nstatus: Ready\n---\n\nBeta\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() first error = %v", err)
	}

	if err := WriteGraphLayoutPositions(indexPath, []GraphLayoutPosition{
		{GraphPath: "demo", DocumentID: "note-1", X: 10, Y: 20, UpdatedAt: "2026-03-18T10:00:00Z"},
		{GraphPath: "demo", DocumentID: "task-1", X: 30, Y: 40, UpdatedAt: "2026-03-18T10:01:00Z"},
	}); err != nil {
		t.Fatalf("WriteGraphLayoutPositions() error = %v", err)
	}

	if err := os.Remove(betaPath); err != nil {
		t.Fatalf("Remove(betaPath) error = %v", err)
	}

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() second error = %v", err)
	}

	positions, err := ReadGraphLayoutPositions(indexPath, "demo")
	if err != nil {
		t.Fatalf("ReadGraphLayoutPositions() error = %v", err)
	}

	if len(positions) != 1 {
		t.Fatalf("len(positions) = %d, want 1", len(positions))
	}

	if positions[0].DocumentID != "note-1" || positions[0].X != 10 || positions[0].Y != 20 {
		t.Fatalf("positions[0] = %#v", positions[0])
	}

	if positions[0].UpdatedAt != "2026-03-18T10:00:00Z" {
		t.Fatalf("positions[0].UpdatedAt = %q, want preserved timestamp", positions[0].UpdatedAt)
	}
}

func TestRebuildPreservesGraphLayoutViewportForSurvivingGraph(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")
	demoAlphaPath := filepath.Join(flowPath, "data", "content", "demo", "alpha.md")
	releaseBetaPath := filepath.Join(flowPath, "data", "content", "release", "beta.md")

	writeMarkdownDocument(t, demoAlphaPath, "---\nid: note-1\ntype: note\ngraph: demo\ntitle: Alpha\n---\n\nAlpha\n")
	writeMarkdownDocument(t, releaseBetaPath, "---\nid: note-2\ntype: note\ngraph: release\ntitle: Beta\n---\n\nBeta\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() first error = %v", err)
	}

	if err := WriteGraphLayoutViewport(indexPath, GraphLayoutViewport{GraphPath: "demo", X: -50, Y: 12, Zoom: 1.1, UpdatedAt: "2026-03-18T10:00:00Z"}); err != nil {
		t.Fatalf("WriteGraphLayoutViewport(demo) error = %v", err)
	}
	if err := WriteGraphLayoutViewport(indexPath, GraphLayoutViewport{GraphPath: "release", X: 10, Y: -8, Zoom: 0.9, UpdatedAt: "2026-03-18T10:01:00Z"}); err != nil {
		t.Fatalf("WriteGraphLayoutViewport(release) error = %v", err)
	}

	if err := os.Remove(releaseBetaPath); err != nil {
		t.Fatalf("Remove(releaseBetaPath) error = %v", err)
	}

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() second error = %v", err)
	}

	demoViewport, found, err := ReadGraphLayoutViewport(indexPath, "demo")
	if err != nil {
		t.Fatalf("ReadGraphLayoutViewport(demo) error = %v", err)
	}
	if !found {
		t.Fatal("demo viewport not found after rebuild")
	}
	if demoViewport.X != -50 || demoViewport.Y != 12 || demoViewport.Zoom != 1.1 {
		t.Fatalf("demoViewport = %#v, want preserved -50/12/1.1", demoViewport)
	}
	if demoViewport.UpdatedAt != "2026-03-18T10:00:00Z" {
		t.Fatalf("demoViewport.UpdatedAt = %q, want preserved timestamp", demoViewport.UpdatedAt)
	}

	if _, found, err := ReadGraphLayoutViewport(indexPath, "release"); err != nil {
		t.Fatalf("ReadGraphLayoutViewport(release) error = %v", err)
	} else if found {
		t.Fatal("release viewport found after release graph removal, want removed")
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

func TestRebuildSkipsLegacyEdgeFiles(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "proj", "note-a.md"),
		"---\nid: note-a\ntype: note\ngraph: proj\ntitle: Alpha\n---\n\nAlpha body\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "proj", "note-b.md"),
		"---\nid: note-b\ntype: note\ngraph: proj\ntitle: Beta\n---\n\nBeta body\n")
	// Legacy edge file: should be silently skipped.
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "proj", "note-a--note-b.md"),
		"---\nid: edge-1\ntype: edge\ngraph: proj\nfrom: note-a\nto: note-b\nlabel: enables\n---\n\nEdge description.\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	defer database.Close()

	// Only the two notes should be indexed; the legacy edge file is skipped.
	assertQueryCount(t, database, `SELECT COUNT(*) FROM documents WHERE type != 'home'`, 2)
	assertQueryCount(t, database, `SELECT COUNT(*) FROM edges`, 0)

	nodes, err := ReadGraphNodes(indexPath)
	if err != nil {
		t.Fatalf("ReadGraphNodes() error = %v", err)
	}
	if len(nodes) != 1 {
		t.Fatalf("len(nodes) = %d, want 1", len(nodes))
	}
	if nodes[0].DirectCount != 2 {
		t.Fatalf("nodes[0].DirectCount = %d, want 2", nodes[0].DirectCount)
	}
}

func TestRebuildIndexesInlineReferences(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	flowPath := filepath.Join(rootDir, ".flow")
	indexPath := filepath.Join(flowPath, "config", "flow.index")

	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "proj", "note-a.md"),
		"---\nid: note-a\ntype: note\ngraph: proj\ntitle: Alpha\n---\n\nAlpha body references [[proj > Beta]] for follow-up.\n")
	writeMarkdownDocument(t, filepath.Join(flowPath, "data", "content", "proj", "note-b.md"),
		"---\nid: note-b\ntype: note\ngraph: proj\ntitle: Beta\n---\n\nBeta body\n")

	if err := Rebuild(indexPath, flowPath); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	defer database.Close()

	assertQueryCount(t, database, `SELECT COUNT(*) FROM note_links`, 0)
	assertQueryCount(t, database, `SELECT COUNT(*) FROM soft_references`, 1)
}
