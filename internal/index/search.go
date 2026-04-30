package index

import (
	"database/sql"
	"fmt"
	"os"
	"strings"

	_ "modernc.org/sqlite"
)

// SearchResult holds one indexed document match.
type SearchResult struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Description string `json:"description"`
	// FeatureSlug is a legacy compatibility field derived from the first graph segment.
	FeatureSlug string `json:"featureSlug"`
	Graph       string `json:"graph"`
	Title       string `json:"title"`
	Path        string `json:"path"`
	Snippet     string `json:"snippet"`
}

// SearchWorkspace queries the workspace index and rebuilds it first when the derived
// index file is missing.
func SearchWorkspace(indexPath string, flowPath string, query string, limit int) ([]SearchResult, error) {
	if strings.TrimSpace(query) == "" {
		return Search(indexPath, query, limit)
	}

	if err := ensureIndexExists(indexPath, flowPath); err != nil {
		return nil, err
	}

	return Search(indexPath, query, limit)
}

// ReadGraphNodesWorkspace returns graph projection nodes, rebuilding the index first when needed.
func ReadGraphNodesWorkspace(indexPath string, flowPath string) ([]GraphNode, error) {
	if err := ensureIndexExists(indexPath, flowPath); err != nil {
		return nil, err
	}

	return ReadGraphNodes(indexPath)
}

// ReadGraphLayoutPositionsWorkspace returns persisted graph layout rows, rebuilding the index first when needed.
func ReadGraphLayoutPositionsWorkspace(indexPath string, flowPath string, graphPath string) ([]GraphLayoutPosition, error) {
	if err := ensureIndexExists(indexPath, flowPath); err != nil {
		return nil, err
	}

	return ReadGraphLayoutPositions(indexPath, graphPath)
}

// WriteGraphLayoutPositionsWorkspace writes persisted graph layout rows, rebuilding the index first when needed.
func WriteGraphLayoutPositionsWorkspace(indexPath string, flowPath string, positions []GraphLayoutPosition) error {
	if len(positions) == 0 {
		return nil
	}

	if err := ensureIndexExists(indexPath, flowPath); err != nil {
		return err
	}

	return WriteGraphLayoutPositions(indexPath, positions)
}

// ReadGraphLayoutViewportWorkspace returns persisted graph viewport row, rebuilding the index first when needed.
func ReadGraphLayoutViewportWorkspace(indexPath string, flowPath string, graphPath string) (GraphLayoutViewport, bool, error) {
	if err := ensureIndexExists(indexPath, flowPath); err != nil {
		return GraphLayoutViewport{}, false, err
	}

	return ReadGraphLayoutViewport(indexPath, graphPath)
}

// WriteGraphLayoutViewportWorkspace writes a persisted graph viewport row, rebuilding the index first when needed.
func WriteGraphLayoutViewportWorkspace(indexPath string, flowPath string, viewport GraphLayoutViewport) error {
	if err := ensureIndexExists(indexPath, flowPath); err != nil {
		return err
	}

	return WriteGraphLayoutViewport(indexPath, viewport)
}

// Search queries the derived SQLite index for document metadata and body text matches.
func Search(indexPath string, query string, limit int) ([]SearchResult, error) {
	trimmedQuery := strings.TrimSpace(query)
	if trimmedQuery == "" {
		return nil, fmt.Errorf("search query must not be empty")
	}

	if limit <= 0 {
		limit = 10
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return nil, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	normalizedQuery := strings.ToLower(trimmedQuery)
	likeQuery := "%" + normalizedQuery + "%"

	rows, err := database.Query(`
		SELECT id, type, feature_slug, graph, title, description_text, path, body_text
		FROM documents
		WHERE lower(id) LIKE ?
			OR lower(type) LIKE ?
			OR lower(feature_slug) LIKE ?
			OR lower(graph) LIKE ?
			OR lower(title) LIKE ?
			OR lower(description_text) LIKE ?
			OR lower(path) LIKE ?
			OR lower(body_text) LIKE ?
		ORDER BY
			CASE WHEN lower(title) = ? THEN 0 ELSE 1 END,
			CASE WHEN lower(id) = ? THEN 0 ELSE 1 END,
			CASE WHEN lower(title) LIKE ? THEN 0 ELSE 1 END,
			CASE WHEN lower(description_text) LIKE ? THEN 0 ELSE 1 END,
			CASE WHEN lower(id) LIKE ? THEN 0 ELSE 1 END,
			CASE WHEN lower(path) LIKE ? THEN 0 ELSE 1 END,
			CASE WHEN lower(body_text) LIKE ? THEN 1 ELSE 0 END,
			title,
			path
		LIMIT ?`,
		likeQuery,
		likeQuery,
		likeQuery,
		likeQuery,
		likeQuery,
		likeQuery,
		likeQuery,
		likeQuery,
		normalizedQuery,
		normalizedQuery,
		likeQuery,
		likeQuery,
		likeQuery,
		likeQuery,
		likeQuery,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("query search index: %w", err)
	}
	defer rows.Close()

	results := []SearchResult{}
	for rows.Next() {
		var result SearchResult
		var bodyText string
		if err := rows.Scan(
			&result.ID,
			&result.Type,
			&result.FeatureSlug,
			&result.Graph,
			&result.Title,
			&result.Description,
			&result.Path,
			&bodyText,
		); err != nil {
			return nil, fmt.Errorf("scan search result: %w", err)
		}

		result.Snippet = searchSnippet(bodyText, trimmedQuery)
		results = append(results, result)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate search results: %w", err)
	}

	return results, nil
}

func ensureIndexExists(indexPath string, flowPath string) error {
	if _, err := os.Stat(indexPath); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("stat index file: %w", err)
	}

	if err := Rebuild(indexPath, flowPath); err != nil {
		return fmt.Errorf("rebuild missing index: %w", err)
	}

	return nil
}

// EnsureIndexExists rebuilds the index when it is missing.
func EnsureIndexExists(indexPath string, flowPath string) error {
	return ensureIndexExists(indexPath, flowPath)
}

func searchSnippet(bodyText string, query string) string {
	normalizedBody := strings.Join(strings.Fields(bodyText), " ")
	if normalizedBody == "" {
		return ""
	}

	lowerBody := strings.ToLower(normalizedBody)
	lowerQuery := strings.ToLower(query)
	matchIndex := strings.Index(lowerBody, lowerQuery)
	if matchIndex < 0 {
		if len(normalizedBody) <= 120 {
			return normalizedBody
		}

		return normalizedBody[:120] + "..."
	}

	start := matchIndex - 36
	if start < 0 {
		start = 0
	}

	end := matchIndex + len(query) + 48
	if end > len(normalizedBody) {
		end = len(normalizedBody)
	}

	snippet := normalizedBody[start:end]
	if start > 0 {
		snippet = "..." + snippet
	}
	if end < len(normalizedBody) {
		snippet += "..."
	}

	return snippet
}

// EdgeRow holds one edge record from the index.
type EdgeRow struct {
	ID     string
	Graph  string
	FromID string
	ToID   string
	Label  string
	Body   string
	Path   string
}

// ReadEdgesByGraph returns all edge rows for a given graph.
func ReadEdgesByGraph(indexPath string, graph string) ([]EdgeRow, error) {
	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return nil, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	rows, err := database.Query(
		`SELECT id, graph, from_id, to_id, label, body, path FROM edges WHERE graph = ? ORDER BY id`,
		graph,
	)
	if err != nil {
		return nil, fmt.Errorf("query edges: %w", err)
	}
	defer rows.Close()

	return scanEdgeRows(rows)
}

// ReadEdgesByEndpoint returns all edge rows where from_id or to_id equals the given document ID.
func ReadEdgesByEndpoint(indexPath string, documentID string) ([]EdgeRow, error) {
	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return nil, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	rows, err := database.Query(
		`SELECT id, graph, from_id, to_id, label, body, path FROM edges WHERE from_id = ? OR to_id = ? ORDER BY id`,
		documentID,
		documentID,
	)
	if err != nil {
		return nil, fmt.Errorf("query edges by endpoint: %w", err)
	}
	defer rows.Close()

	return scanEdgeRows(rows)
}

// ReadEdgeByID returns a single edge row by ID.
func ReadEdgeByID(indexPath string, edgeID string) (EdgeRow, bool, error) {
	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return EdgeRow{}, false, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	var row EdgeRow
	err = database.QueryRow(
		`SELECT id, graph, from_id, to_id, label, body, path FROM edges WHERE id = ?`,
		edgeID,
	).Scan(&row.ID, &row.Graph, &row.FromID, &row.ToID, &row.Label, &row.Body, &row.Path)
	if err == sql.ErrNoRows {
		return EdgeRow{}, false, nil
	}
	if err != nil {
		return EdgeRow{}, false, fmt.Errorf("query edge by id: %w", err)
	}

	return row, true, nil
}

// EdgeExistsByEndpoints returns true when an edge with the given (graph, from, to) already exists.
func EdgeExistsByEndpoints(indexPath string, graph string, fromID string, toID string) (bool, error) {
	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return false, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	var count int
	err = database.QueryRow(
		`SELECT COUNT(*) FROM edges WHERE graph = ? AND from_id = ? AND to_id = ?`,
		graph,
		fromID,
		toID,
	).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check edge existence: %w", err)
	}

	return count > 0, nil
}

func scanEdgeRows(rows *sql.Rows) ([]EdgeRow, error) {
	var results []EdgeRow
	for rows.Next() {
		var row EdgeRow
		if err := rows.Scan(&row.ID, &row.Graph, &row.FromID, &row.ToID, &row.Label, &row.Body, &row.Path); err != nil {
			return nil, fmt.Errorf("scan edge row: %w", err)
		}
		results = append(results, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate edge rows: %w", err)
	}
	return results, nil
}
