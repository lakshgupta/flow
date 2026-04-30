package index

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/lex/flow/internal/markdown"
	_ "modernc.org/sqlite"
)

const schemaSQL = `
CREATE TABLE documents (
	id TEXT PRIMARY KEY,
	type TEXT NOT NULL,
	feature_slug TEXT NOT NULL,
	graph TEXT NOT NULL,
	title TEXT NOT NULL,
	description_text TEXT NOT NULL,
	path TEXT NOT NULL UNIQUE,
	body_text TEXT NOT NULL,
	tags_json TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	task_status TEXT NOT NULL,
	command_name TEXT NOT NULL,
	command_run TEXT NOT NULL
);

CREATE INDEX documents_type_graph_idx ON documents(type, graph);
CREATE INDEX documents_feature_type_idx ON documents(feature_slug, type);

CREATE TABLE graph_nodes (
	graph_path TEXT PRIMARY KEY,
	display_name TEXT NOT NULL,
	direct_count INTEGER NOT NULL,
	total_count INTEGER NOT NULL,
	has_children INTEGER NOT NULL
);

CREATE INDEX graph_nodes_total_count_idx ON graph_nodes(total_count, graph_path);

CREATE TABLE hard_dependencies (
	document_id TEXT NOT NULL,
	depends_on_id TEXT NOT NULL,
	PRIMARY KEY (document_id, depends_on_id)
);

CREATE TABLE soft_references (
	document_id TEXT NOT NULL,
	reference_id TEXT NOT NULL,
	PRIMARY KEY (document_id, reference_id)
);

CREATE TABLE note_links (
	left_note_id TEXT NOT NULL,
	right_note_id TEXT NOT NULL,
	PRIMARY KEY (left_note_id, right_note_id)
);

CREATE TABLE command_lookup (
	short_name TEXT NOT NULL,
	document_id TEXT NOT NULL,
	graph TEXT NOT NULL,
	run TEXT NOT NULL,
	PRIMARY KEY (short_name, document_id)
);

CREATE INDEX command_lookup_short_name_idx ON command_lookup(short_name);

CREATE TABLE command_env (
	document_id TEXT NOT NULL,
	env_key TEXT NOT NULL,
	env_value TEXT NOT NULL,
	PRIMARY KEY (document_id, env_key)
);

CREATE TABLE edges (
	id TEXT PRIMARY KEY,
	graph TEXT NOT NULL,
	from_id TEXT NOT NULL,
	to_id TEXT NOT NULL,
	label TEXT NOT NULL,
	body TEXT NOT NULL,
	path TEXT NOT NULL UNIQUE
);

CREATE UNIQUE INDEX edges_from_to_idx ON edges(graph, from_id, to_id);

CREATE TABLE graph_layout_positions (
	graph_path TEXT NOT NULL,
	document_id TEXT NOT NULL,
	x REAL NOT NULL,
	y REAL NOT NULL,
	updated_at TEXT NOT NULL,
	PRIMARY KEY (graph_path, document_id)
);

CREATE INDEX graph_layout_positions_graph_idx ON graph_layout_positions(graph_path, document_id);

CREATE TABLE graph_layout_viewports (
	graph_path TEXT NOT NULL PRIMARY KEY,
	x REAL NOT NULL,
	y REAL NOT NULL,
	zoom REAL NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX graph_layout_viewports_graph_idx ON graph_layout_viewports(graph_path);
`

type indexedDocument struct {
	relativePath string
	featureSlug  string
	graphPath    string
	document     markdown.Document
}

// GraphNode summarizes one graph node derived into the SQLite index.
type GraphNode struct {
	GraphPath   string
	DisplayName string
	DirectCount int
	TotalCount  int
	HasChildren bool
}

// Rebuild recreates the derived index file without touching Markdown sources.
// When flowPaths[0] is provided, documents under .flow/data are reindexed into SQLite.
func Rebuild(indexPath string, flowPaths ...string) error {
	preservedLayouts, _ := loadExistingGraphLayoutPositions(indexPath)
	preservedViewports, _ := loadExistingGraphLayoutViewports(indexPath)

	if err := os.MkdirAll(filepath.Dir(indexPath), 0o755); err != nil {
		return fmt.Errorf("create index directory: %w", err)
	}

	if err := os.Remove(indexPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("reset index file: %w", err)
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	transaction, err := database.Begin()
	if err != nil {
		return fmt.Errorf("begin rebuild transaction: %w", err)
	}
	defer transaction.Rollback()

	if _, err := transaction.Exec(schemaSQL); err != nil {
		return fmt.Errorf("create index schema: %w", err)
	}

	if len(flowPaths) > 0 && flowPaths[0] != "" {
		documents, err := collectDocuments(flowPaths[0])
		if err != nil {
			return err
		}

		documentKindsByID := make(map[string]markdown.DocumentType, len(documents))
		for _, document := range documents {
			if id, documentType, ok := indexedDocumentIdentity(document.document); ok {
				documentKindsByID[id] = documentType
			}
		}

		inlineReferenceIDsByDocument := make(map[string][]string, len(documents))
		workspaceDocuments := make([]markdown.WorkspaceDocument, 0, len(documents))
		for _, document := range documents {
			workspaceDocuments = append(workspaceDocuments, markdown.WorkspaceDocument{
				Path:     document.relativePath,
				Document: document.document,
			})
		}
		for _, item := range workspaceDocuments {
			resolved, err := markdown.ResolveInlineReferences(workspaceDocuments, item)
			if err != nil {
				return fmt.Errorf("resolve inline references: %w", err)
			}
			documentID, _, ok := indexedDocumentIdentity(item.Document)
			if !ok {
				continue
			}
			ids := make([]string, 0, len(resolved))
			for _, reference := range resolved {
				ids = append(ids, reference.Target.ID)
			}
			inlineReferenceIDsByDocument[documentID] = ids
		}

		for _, document := range documents {
			if err := insertDocument(transaction, document, documentKindsByID, inlineReferenceIDsByDocument); err != nil {
				return err
			}
		}

		if err := insertGraphProjection(transaction, documents, flowPaths[0]); err != nil {
			return err
		}

		if err := reinsertPreservedGraphLayoutPositions(transaction, documents, preservedLayouts); err != nil {
			return err
		}

		if err := reinsertPreservedGraphLayoutViewports(transaction, documents, preservedViewports); err != nil {
			return err
		}
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit rebuild transaction: %w", err)
	}

	return nil
}

func reinsertPreservedGraphLayoutPositions(transaction *sql.Tx, documents []indexedDocument, preserved []GraphLayoutPosition) error {
	if len(preserved) == 0 {
		return nil
	}

	allowed := make(map[string]struct{}, len(documents))
	for _, document := range documents {
		id, _, ok := indexedDocumentIdentity(document.document)
		if !ok || document.graphPath == "" {
			continue
		}

		allowed[graphLayoutKey(document.graphPath, id)] = struct{}{}
	}

	for _, position := range preserved {
		if _, ok := allowed[graphLayoutKey(position.GraphPath, position.DocumentID)]; !ok {
			continue
		}

		if err := insertGraphLayoutPosition(transaction, position); err != nil {
			return err
		}
	}

	return nil
}

func reinsertPreservedGraphLayoutViewports(transaction *sql.Tx, documents []indexedDocument, preserved []GraphLayoutViewport) error {
	if len(preserved) == 0 {
		return nil
	}

	allowedGraphs := make(map[string]struct{}, len(documents))
	for _, document := range documents {
		if document.graphPath == "" {
			continue
		}
		allowedGraphs[document.graphPath] = struct{}{}
	}

	for _, viewport := range preserved {
		if _, ok := allowedGraphs[viewport.GraphPath]; !ok {
			continue
		}

		normalized, err := normalizeGraphLayoutViewport(viewport)
		if err != nil {
			return err
		}

		if _, err := transaction.Exec(
			`INSERT INTO graph_layout_viewports (graph_path, x, y, zoom, updated_at) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(graph_path) DO UPDATE SET x = excluded.x, y = excluded.y, zoom = excluded.zoom, updated_at = excluded.updated_at`,
			normalized.GraphPath,
			normalized.X,
			normalized.Y,
			normalized.Zoom,
			normalized.UpdatedAt,
		); err != nil {
			return fmt.Errorf("write preserved graph layout viewport for %q: %w", normalized.GraphPath, err)
		}
	}

	return nil
}

func collectDocuments(flowPath string) ([]indexedDocument, error) {
	dataPath := filepath.Join(flowPath, "data")
	if _, err := os.Stat(dataPath); err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}

		return nil, fmt.Errorf("stat data directory: %w", err)
	}

	documents := []indexedDocument{}
	if err := collectHomeDocument(flowPath, filepath.Join(dataPath, "home.md"), &documents); err != nil {
		return nil, err
	}

	graphsPath := filepath.Join(dataPath, "content")
	if _, err := os.Stat(graphsPath); err != nil {
		if os.IsNotExist(err) {
			return documents, nil
		}

		return nil, fmt.Errorf("stat graphs directory: %w", err)
	}

	err := filepath.WalkDir(graphsPath, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if entry.IsDir() || filepath.Ext(path) != ".md" {
			return nil
		}

		return appendIndexedDocument(flowPath, path, &documents)
	})
	if err != nil {
		return nil, fmt.Errorf("scan markdown documents: %w", err)
	}

	validationTargets := make([]markdown.WorkspaceDocument, 0, len(documents))
	for _, document := range documents {
		validationTargets = append(validationTargets, markdown.WorkspaceDocument{
			Path:     document.relativePath,
			Document: document.document,
		})
	}

	if err := markdown.ValidateWorkspaceDocuments(validationTargets); err != nil {
		return nil, fmt.Errorf("validate markdown documents: %w", err)
	}

	for index := range documents {
		normalizedDocument, err := markdown.NormalizeWorkspaceDocument(markdown.WorkspaceDocument{
			Path:     documents[index].relativePath,
			Document: documents[index].document,
		})
		if err != nil {
			return nil, fmt.Errorf("normalize markdown document: %w", err)
		}

		documents[index].document = normalizedDocument.Document
		documents[index].featureSlug = featureSlugFromGraphPath(graphPathForDocument(documents[index].relativePath, normalizedDocument.Document))
		documents[index].graphPath = graphPathForDocument(documents[index].relativePath, normalizedDocument.Document)
	}

	return documents, nil
}

func insertDocument(transaction *sql.Tx, indexed indexedDocument, documentKindsByID map[string]markdown.DocumentType, inlineReferenceIDsByDocument map[string][]string) error {
	switch document := indexed.document.(type) {
	case markdown.HomeDocument:
		return insertHomeDocument(transaction, indexed.relativePath, indexed.featureSlug, document)
	case markdown.NoteDocument:
		return insertNoteDocument(transaction, indexed.relativePath, indexed.featureSlug, document, documentKindsByID, inlineReferenceIDsByDocument[document.Metadata.ID])
	case markdown.TaskDocument:
		return insertTaskDocument(transaction, indexed.relativePath, indexed.featureSlug, document, inlineReferenceIDsByDocument[document.Metadata.ID])
	case markdown.CommandDocument:
		return insertCommandDocument(transaction, indexed.relativePath, indexed.featureSlug, document, inlineReferenceIDsByDocument[document.Metadata.ID])
	default:
		return fmt.Errorf("unsupported parsed document type %T", indexed.document)
	}
}

func insertHomeDocument(transaction *sql.Tx, relativePath string, featureSlug string, document markdown.HomeDocument) error {
	return insertDocumentRow(transaction, document.Metadata, featureSlug, relativePath, document.Body, "", "", "")
}

func insertNoteDocument(transaction *sql.Tx, relativePath string, featureSlug string, document markdown.NoteDocument, documentKindsByID map[string]markdown.DocumentType, inlineReferenceIDs []string) error {
	if err := insertDocumentRow(transaction, document.Metadata.CommonFields, featureSlug, relativePath, document.Body, "", "", ""); err != nil {
		return err
	}

	for _, ref := range document.Metadata.Links {
		if documentKindsByID[ref.Node] == markdown.NoteType {
			if err := insertNoteLink(transaction, document.Metadata.ID, ref.Node); err != nil {
				return err
			}

			continue
		}

		if err := insertReference(transaction, document.Metadata.ID, ref.Node); err != nil {
			return err
		}
	}

	if err := insertReferences(transaction, document.Metadata.ID, inlineReferenceIDs); err != nil {
		return err
	}

	return nil
}

func insertTaskDocument(transaction *sql.Tx, relativePath string, featureSlug string, document markdown.TaskDocument, inlineReferenceIDs []string) error {
	if err := insertDocumentRow(transaction, document.Metadata.CommonFields, featureSlug, relativePath, document.Body, document.Metadata.Status, "", ""); err != nil {
		return err
	}

	if err := insertReferences(transaction, document.Metadata.ID, markdown.NodeLinkIDs(document.Metadata.Links)); err != nil {
		return err
	}

	return insertReferences(transaction, document.Metadata.ID, inlineReferenceIDs)
}

func insertCommandDocument(transaction *sql.Tx, relativePath string, featureSlug string, document markdown.CommandDocument, inlineReferenceIDs []string) error {
	if err := insertDocumentRow(transaction, document.Metadata.CommonFields, featureSlug, relativePath, document.Body, "", document.Metadata.Name, document.Metadata.Run); err != nil {
		return err
	}

	if err := insertReferences(transaction, document.Metadata.ID, markdown.NodeLinkIDs(document.Metadata.Links)); err != nil {
		return err
	}

	if err := insertReferences(transaction, document.Metadata.ID, inlineReferenceIDs); err != nil {
		return err
	}

	if document.Metadata.Name != "" {
		if _, err := transaction.Exec(
			`INSERT INTO command_lookup (short_name, document_id, graph, run) VALUES (?, ?, ?, ?)`,
			document.Metadata.Name,
			document.Metadata.ID,
			document.Metadata.Graph,
			document.Metadata.Run,
		); err != nil {
			return fmt.Errorf("insert command lookup for %q: %w", document.Metadata.ID, err)
		}
	}

	if len(document.Metadata.Env) == 0 {
		return nil
	}

	keys := make([]string, 0, len(document.Metadata.Env))
	for key := range document.Metadata.Env {
		keys = append(keys, key)
	}
	slices.Sort(keys)

	for _, key := range keys {
		if _, err := transaction.Exec(
			`INSERT INTO command_env (document_id, env_key, env_value) VALUES (?, ?, ?)`,
			document.Metadata.ID,
			key,
			document.Metadata.Env[key],
		); err != nil {
			return fmt.Errorf("insert command env for %q: %w", document.Metadata.ID, err)
		}
	}

	return nil
}

func insertDocumentRow(transaction *sql.Tx, fields markdown.CommonFields, featureSlug string, relativePath string, body string, taskStatus string, commandName string, commandRun string) error {
	if fields.ID == "" {
		return fmt.Errorf("document at %q is missing id", relativePath)
	}

	tagsJSON, err := json.Marshal(fields.Tags)
	if err != nil {
		return fmt.Errorf("serialize tags for %q: %w", fields.ID, err)
	}

	if _, err := transaction.Exec(
		`INSERT INTO documents (id, type, feature_slug, graph, title, description_text, path, body_text, tags_json, created_at, updated_at, task_status, command_name, command_run)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		fields.ID,
		string(fields.Type),
		featureSlug,
		fields.Graph,
		fields.Title,
		fields.Description,
		relativePath,
		body,
		string(tagsJSON),
		fields.CreatedAt,
		fields.UpdatedAt,
		taskStatus,
		commandName,
		commandRun,
	); err != nil {
		return fmt.Errorf("insert document %q: %w", fields.ID, err)
	}

	return nil
}

// collectGraphDirPaths returns all subdirectory paths under graphsPath as
// slash-separated paths relative to graphsPath (e.g. "arch" or "projects/backend").
func collectGraphDirPaths(graphsPath string) []string {
	var paths []string
	if _, err := os.Stat(graphsPath); err != nil {
		return paths
	}
	_ = filepath.WalkDir(graphsPath, func(path string, entry os.DirEntry, err error) error {
		if err != nil || !entry.IsDir() || path == graphsPath {
			return nil
		}
		rel, relErr := filepath.Rel(graphsPath, path)
		if relErr != nil {
			return nil
		}
		paths = append(paths, filepath.ToSlash(rel))
		return nil
	})
	return paths
}

func insertGraphProjection(transaction *sql.Tx, documents []indexedDocument, flowPath string) error {
	nodes := buildGraphProjection(documents)

	// Include empty directories so newly created graphs appear without needing content.
	if flowPath != "" {
		graphsPath := filepath.Join(flowPath, "data", "content")
		dirPaths := collectGraphDirPaths(graphsPath)
		existing := make(map[string]bool, len(nodes))
		for _, node := range nodes {
			existing[node.GraphPath] = true
		}
		for _, dirPath := range dirPaths {
			if existing[dirPath] {
				continue
			}
			parts := strings.Split(dirPath, "/")
			nodes = append(nodes, GraphNode{
				GraphPath:   dirPath,
				DisplayName: parts[len(parts)-1],
				DirectCount: 0,
				TotalCount:  0,
				HasChildren: false,
			})
		}
		// Recompute HasChildren now that the full set of paths is known.
		pathSet := make(map[string]bool, len(nodes))
		for _, node := range nodes {
			pathSet[node.GraphPath] = true
		}
		for i, node := range nodes {
			prefix := node.GraphPath + "/"
			for p := range pathSet {
				if strings.HasPrefix(p, prefix) {
					nodes[i].HasChildren = true
					break
				}
			}
		}
		slices.SortFunc(nodes, func(a, b GraphNode) int {
			return strings.Compare(a.GraphPath, b.GraphPath)
		})
	}

	for _, node := range nodes {
		hasChildrenValue := 0
		if node.HasChildren {
			hasChildrenValue = 1
		}

		if _, err := transaction.Exec(
			`INSERT INTO graph_nodes (graph_path, display_name, direct_count, total_count, has_children) VALUES (?, ?, ?, ?, ?)`,
			node.GraphPath,
			node.DisplayName,
			node.DirectCount,
			node.TotalCount,
			hasChildrenValue,
		); err != nil {
			return fmt.Errorf("insert graph node %q: %w", node.GraphPath, err)
		}
	}

	return nil
}

func buildGraphProjection(documents []indexedDocument) []GraphNode {
	directCounts := map[string]int{}
	totalCounts := map[string]int{}
	children := map[string]map[string]bool{}

	for _, document := range documents {
		if document.graphPath == "" {
			continue
		}

		directCounts[document.graphPath]++
		segments := strings.Split(document.graphPath, "/")
		for index := range segments {
			nodePath := strings.Join(segments[:index+1], "/")
			totalCounts[nodePath]++
			if index > 0 {
				parentPath := strings.Join(segments[:index], "/")
				if children[parentPath] == nil {
					children[parentPath] = map[string]bool{}
				}
				children[parentPath][nodePath] = true
			}
		}
	}

	paths := make([]string, 0, len(totalCounts))
	for path := range totalCounts {
		if totalCounts[path] > 0 {
			paths = append(paths, path)
		}
	}
	slices.Sort(paths)

	nodes := make([]GraphNode, 0, len(paths))
	for _, path := range paths {
		parts := strings.Split(path, "/")
		nodes = append(nodes, GraphNode{
			GraphPath:   path,
			DisplayName: parts[len(parts)-1],
			DirectCount: directCounts[path],
			TotalCount:  totalCounts[path],
			HasChildren: len(children[path]) > 0,
		})
	}

	return nodes
}

// ReadGraphNodes returns the graph projection derived in the SQLite index.
func ReadGraphNodes(indexPath string) ([]GraphNode, error) {
	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return nil, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	rows, err := database.Query(`SELECT graph_path, display_name, direct_count, total_count, has_children FROM graph_nodes ORDER BY graph_path`)
	if err != nil {
		return nil, fmt.Errorf("query graph nodes: %w", err)
	}
	defer rows.Close()

	nodes := []GraphNode{}
	for rows.Next() {
		var node GraphNode
		var hasChildrenValue int
		if err := rows.Scan(&node.GraphPath, &node.DisplayName, &node.DirectCount, &node.TotalCount, &hasChildrenValue); err != nil {
			return nil, fmt.Errorf("scan graph node: %w", err)
		}
		node.HasChildren = hasChildrenValue != 0
		nodes = append(nodes, node)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate graph nodes: %w", err)
	}

	return nodes, nil
}

func collectHomeDocument(flowPath string, homePath string, documents *[]indexedDocument) error {
	data, err := os.ReadFile(homePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}

		return fmt.Errorf("read markdown document %s: %w", homePath, err)
	}

	document, err := parseHomeIndexedDocument(data)
	if err != nil {
		return fmt.Errorf("parse home document %s: %w", homePath, err)
	}

	relativePath, err := filepath.Rel(flowPath, homePath)
	if err != nil {
		return fmt.Errorf("resolve relative document path %s: %w", homePath, err)
	}

	*documents = append(*documents, indexedDocument{
		relativePath: filepath.ToSlash(relativePath),
		document:     document,
	})

	return nil
}

func appendIndexedDocument(flowPath string, path string, documents *[]indexedDocument) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read markdown document %s: %w", path, err)
	}

	document, err := markdown.ParseDocument(data)
	if err != nil {
		// Skip files with unsupported document types (e.g., legacy edge files).
		if strings.Contains(err.Error(), "unsupported document type") {
			return nil
		}
		return fmt.Errorf("parse markdown document %s: %w", path, err)
	}

	relativePath, err := filepath.Rel(flowPath, path)
	if err != nil {
		return fmt.Errorf("resolve relative document path %s: %w", path, err)
	}

	normalizedPath := filepath.ToSlash(relativePath)
	graphPath := graphPathForDocument(normalizedPath, document)
	*documents = append(*documents, indexedDocument{
		relativePath: normalizedPath,
		featureSlug:  featureSlugFromGraphPath(graphPath),
		graphPath:    graphPath,
		document:     document,
	})

	return nil
}

func graphPathForDocument(relativePath string, document markdown.Document) string {
	if graphPath, ok, err := markdown.GraphPathFromWorkspacePath(relativePath); err == nil && ok {
		return graphPath
	}

	switch value := document.(type) {
	case markdown.NoteDocument:
		return value.Metadata.Graph
	case markdown.TaskDocument:
		return value.Metadata.Graph
	case markdown.CommandDocument:
		return value.Metadata.Graph
	default:
		return ""
	}
}

func featureSlugFromGraphPath(graphPath string) string {
	graphPath = strings.TrimSpace(graphPath)
	if graphPath == "" {
		return ""
	}

	parts := strings.Split(graphPath, "/")
	return parts[0]
}

func looksLikeFlowDocument(data []byte) bool {
	normalized := strings.ReplaceAll(string(data), "\r\n", "\n")
	return strings.HasPrefix(normalized, "---\n")
}

func parseHomeIndexedDocument(data []byte) (markdown.HomeDocument, error) {
	normalized := strings.ReplaceAll(string(data), "\r\n", "\n")
	if looksLikeFlowDocument(data) {
		document, err := markdown.ParseDocument([]byte(normalized))
		if err != nil {
			return markdown.HomeDocument{}, err
		}

		homeDocument, ok := document.(markdown.HomeDocument)
		if !ok {
			return markdown.HomeDocument{}, fmt.Errorf("home.md must use type %q", markdown.HomeType)
		}

		if strings.TrimSpace(homeDocument.Metadata.ID) == "" {
			homeDocument.Metadata.ID = "home"
		}
		if strings.TrimSpace(homeDocument.Metadata.Title) == "" {
			homeDocument.Metadata.Title = deriveHomeTitle(homeDocument.Body)
		}
		if homeDocument.Metadata.Type == "" {
			homeDocument.Metadata.Type = markdown.HomeType
		}

		return homeDocument, nil
	}

	return markdown.HomeDocument{
		Metadata: markdown.CommonFields{
			ID:    "home",
			Type:  markdown.HomeType,
			Title: deriveHomeTitle(normalized),
		},
		Body: normalized,
	}, nil
}

func deriveHomeTitle(body string) string {
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "# ") {
			return strings.TrimSpace(strings.TrimPrefix(trimmed, "# "))
		}
	}

	return "Home"
}

func insertReferences(transaction *sql.Tx, documentID string, referenceIDs []string) error {
	seen := make(map[string]struct{}, len(referenceIDs))
	for _, referenceID := range referenceIDs {
		if _, ok := seen[referenceID]; ok {
			continue
		}
		seen[referenceID] = struct{}{}
		if err := insertReference(transaction, documentID, referenceID); err != nil {
			return err
		}
	}

	return nil
}

func insertReference(transaction *sql.Tx, documentID string, referenceID string) error {
	if _, err := transaction.Exec(
		`INSERT OR IGNORE INTO soft_references (document_id, reference_id) VALUES (?, ?)`,
		documentID,
		referenceID,
	); err != nil {
		return fmt.Errorf("insert reference for %q: %w", documentID, err)
	}

	return nil
}

func insertNoteLink(transaction *sql.Tx, leftNoteID string, rightNoteID string) error {
	leftNoteID, rightNoteID = canonicalNoteLink(leftNoteID, rightNoteID)

	if _, err := transaction.Exec(
		`INSERT OR IGNORE INTO note_links (left_note_id, right_note_id) VALUES (?, ?)`,
		leftNoteID,
		rightNoteID,
	); err != nil {
		return fmt.Errorf("insert note link for %q: %w", leftNoteID, err)
	}

	return nil
}

func canonicalNoteLink(leftNoteID string, rightNoteID string) (string, string) {
	if leftNoteID <= rightNoteID {
		return leftNoteID, rightNoteID
	}

	return rightNoteID, leftNoteID
}

func indexedDocumentIdentity(document markdown.Document) (string, markdown.DocumentType, bool) {
	switch value := document.(type) {
	case markdown.HomeDocument:
		return value.Metadata.ID, value.Metadata.Type, true
	case markdown.NoteDocument:
		return value.Metadata.ID, value.Metadata.Type, true
	case markdown.TaskDocument:
		return value.Metadata.ID, value.Metadata.Type, true
	case markdown.CommandDocument:
		return value.Metadata.ID, value.Metadata.Type, true
	default:
		return "", "", false
	}
}
