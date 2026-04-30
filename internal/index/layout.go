package index

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

// GraphLayoutPosition stores a persisted graph node position for one workspace graph.
type GraphLayoutPosition struct {
	GraphPath  string
	DocumentID string
	X          float64
	Y          float64
	UpdatedAt  string
}

// GraphLayoutViewport stores a persisted graph canvas viewport for one workspace graph.
type GraphLayoutViewport struct {
	GraphPath string
	X         float64
	Y         float64
	Zoom      float64
	UpdatedAt string
}

// ReadGraphLayoutPositions returns persisted layout rows for one graph path.
func ReadGraphLayoutPositions(indexPath string, graphPath string) ([]GraphLayoutPosition, error) {
	trimmedGraphPath := strings.TrimSpace(graphPath)
	if trimmedGraphPath == "" {
		return nil, fmt.Errorf("graph path must not be empty")
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return nil, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	if err := ensureGraphLayoutSchema(database); err != nil {
		return nil, err
	}

	rows, err := database.Query(`SELECT graph_path, document_id, x, y, updated_at FROM graph_layout_positions WHERE graph_path = ? ORDER BY document_id`, trimmedGraphPath)
	if err != nil {
		return nil, fmt.Errorf("query graph layout positions: %w", err)
	}
	defer rows.Close()

	positions := []GraphLayoutPosition{}
	for rows.Next() {
		var position GraphLayoutPosition
		if err := rows.Scan(&position.GraphPath, &position.DocumentID, &position.X, &position.Y, &position.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan graph layout position: %w", err)
		}
		positions = append(positions, position)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate graph layout positions: %w", err)
	}

	return positions, nil
}

// WriteGraphLayoutPositions upserts persisted layout rows for one or more graph nodes.
func WriteGraphLayoutPositions(indexPath string, positions []GraphLayoutPosition) error {
	if len(positions) == 0 {
		return nil
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	if err := ensureGraphLayoutSchema(database); err != nil {
		return err
	}

	transaction, err := database.Begin()
	if err != nil {
		return fmt.Errorf("begin graph layout transaction: %w", err)
	}
	defer transaction.Rollback()

	for _, position := range positions {
		normalized, err := normalizeGraphLayoutPosition(position)
		if err != nil {
			return err
		}

		if err := insertGraphLayoutPosition(transaction, normalized); err != nil {
			return err
		}
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit graph layout transaction: %w", err)
	}

	return nil
}

func loadExistingGraphLayoutPositions(indexPath string) ([]GraphLayoutPosition, error) {
	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return nil, err
	}
	defer database.Close()

	if !hasGraphLayoutTable(database) {
		return nil, nil
	}

	rows, err := database.Query(`SELECT graph_path, document_id, x, y, updated_at FROM graph_layout_positions ORDER BY graph_path, document_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	positions := []GraphLayoutPosition{}
	for rows.Next() {
		var position GraphLayoutPosition
		if err := rows.Scan(&position.GraphPath, &position.DocumentID, &position.X, &position.Y, &position.UpdatedAt); err != nil {
			return nil, err
		}
		positions = append(positions, position)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return positions, nil
}

// ReadGraphLayoutViewport returns a persisted canvas viewport for one graph path.
func ReadGraphLayoutViewport(indexPath string, graphPath string) (GraphLayoutViewport, bool, error) {
	trimmedGraphPath := strings.TrimSpace(graphPath)
	if trimmedGraphPath == "" {
		return GraphLayoutViewport{}, false, fmt.Errorf("graph path must not be empty")
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return GraphLayoutViewport{}, false, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	if err := ensureGraphLayoutSchema(database); err != nil {
		return GraphLayoutViewport{}, false, err
	}

	var viewport GraphLayoutViewport
	err = database.QueryRow(`SELECT graph_path, x, y, zoom, updated_at FROM graph_layout_viewports WHERE graph_path = ?`, trimmedGraphPath).
		Scan(&viewport.GraphPath, &viewport.X, &viewport.Y, &viewport.Zoom, &viewport.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return GraphLayoutViewport{}, false, nil
		}

		return GraphLayoutViewport{}, false, fmt.Errorf("query graph layout viewport: %w", err)
	}

	return viewport, true, nil
}

// WriteGraphLayoutViewport upserts one persisted canvas viewport for a graph.
func WriteGraphLayoutViewport(indexPath string, viewport GraphLayoutViewport) error {
	normalized, err := normalizeGraphLayoutViewport(viewport)
	if err != nil {
		return err
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	if err := ensureGraphLayoutSchema(database); err != nil {
		return err
	}

	if _, err := database.Exec(
		`INSERT INTO graph_layout_viewports (graph_path, x, y, zoom, updated_at) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(graph_path) DO UPDATE SET x = excluded.x, y = excluded.y, zoom = excluded.zoom, updated_at = excluded.updated_at`,
		normalized.GraphPath,
		normalized.X,
		normalized.Y,
		normalized.Zoom,
		normalized.UpdatedAt,
	); err != nil {
		return fmt.Errorf("write graph layout viewport for %q: %w", normalized.GraphPath, err)
	}

	return nil
}

func loadExistingGraphLayoutViewports(indexPath string) ([]GraphLayoutViewport, error) {
	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return nil, err
	}
	defer database.Close()

	if !hasGraphLayoutViewportTable(database) {
		return nil, nil
	}

	rows, err := database.Query(`SELECT graph_path, x, y, zoom, updated_at FROM graph_layout_viewports ORDER BY graph_path`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	viewports := []GraphLayoutViewport{}
	for rows.Next() {
		var viewport GraphLayoutViewport
		if err := rows.Scan(&viewport.GraphPath, &viewport.X, &viewport.Y, &viewport.Zoom, &viewport.UpdatedAt); err != nil {
			return nil, err
		}
		viewports = append(viewports, viewport)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return viewports, nil
}

func ensureGraphLayoutSchema(database *sql.DB) error {
	if _, err := database.Exec(`
		CREATE TABLE IF NOT EXISTS graph_layout_positions (
			graph_path TEXT NOT NULL,
			document_id TEXT NOT NULL,
			x REAL NOT NULL,
			y REAL NOT NULL,
			updated_at TEXT NOT NULL,
			PRIMARY KEY (graph_path, document_id)
		);
	`); err != nil {
		return fmt.Errorf("ensure graph layout table: %w", err)
	}

	if _, err := database.Exec(`CREATE INDEX IF NOT EXISTS graph_layout_positions_graph_idx ON graph_layout_positions(graph_path, document_id)`); err != nil {
		return fmt.Errorf("ensure graph layout index: %w", err)
	}

	if _, err := database.Exec(`
		CREATE TABLE IF NOT EXISTS graph_layout_viewports (
			graph_path TEXT NOT NULL PRIMARY KEY,
			x REAL NOT NULL,
			y REAL NOT NULL,
			zoom REAL NOT NULL,
			updated_at TEXT NOT NULL
		);
	`); err != nil {
		return fmt.Errorf("ensure graph layout viewport table: %w", err)
	}

	if _, err := database.Exec(`CREATE INDEX IF NOT EXISTS graph_layout_viewports_graph_idx ON graph_layout_viewports(graph_path)`); err != nil {
		return fmt.Errorf("ensure graph layout viewport index: %w", err)
	}

	return nil
}

func hasGraphLayoutTable(database *sql.DB) bool {
	var count int
	if err := database.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'graph_layout_positions'`).Scan(&count); err != nil {
		return false
	}

	return count == 1
}

func hasGraphLayoutViewportTable(database *sql.DB) bool {
	var count int
	if err := database.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'graph_layout_viewports'`).Scan(&count); err != nil {
		return false
	}

	return count == 1
}

func normalizeGraphLayoutPosition(position GraphLayoutPosition) (GraphLayoutPosition, error) {
	position.GraphPath = strings.TrimSpace(position.GraphPath)
	position.DocumentID = strings.TrimSpace(position.DocumentID)
	position.UpdatedAt = strings.TrimSpace(position.UpdatedAt)

	if position.GraphPath == "" {
		return GraphLayoutPosition{}, fmt.Errorf("graph path must not be empty")
	}

	if position.DocumentID == "" {
		return GraphLayoutPosition{}, fmt.Errorf("document id must not be empty")
	}

	if position.UpdatedAt == "" {
		position.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}

	return position, nil
}

func normalizeGraphLayoutViewport(viewport GraphLayoutViewport) (GraphLayoutViewport, error) {
	viewport.GraphPath = strings.TrimSpace(viewport.GraphPath)
	viewport.UpdatedAt = strings.TrimSpace(viewport.UpdatedAt)

	if viewport.GraphPath == "" {
		return GraphLayoutViewport{}, fmt.Errorf("graph path must not be empty")
	}

	if viewport.Zoom <= 0 {
		return GraphLayoutViewport{}, fmt.Errorf("zoom must be greater than zero")
	}

	if viewport.UpdatedAt == "" {
		viewport.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}

	return viewport, nil
}

func insertGraphLayoutPosition(transaction *sql.Tx, position GraphLayoutPosition) error {
	if _, err := transaction.Exec(
		`INSERT INTO graph_layout_positions (graph_path, document_id, x, y, updated_at) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(graph_path, document_id) DO UPDATE SET x = excluded.x, y = excluded.y, updated_at = excluded.updated_at`,
		position.GraphPath,
		position.DocumentID,
		position.X,
		position.Y,
		position.UpdatedAt,
	); err != nil {
		return fmt.Errorf("write graph layout position for %q in %q: %w", position.DocumentID, position.GraphPath, err)
	}

	return nil
}

func graphLayoutKey(graphPath string, documentID string) string {
	return graphPath + "\x00" + documentID
}
