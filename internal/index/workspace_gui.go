package index

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

// WorkspaceGUISettings stores GUI preferences persisted in the workspace index.
type WorkspaceGUISettings struct {
	Appearance      string
	PanelLeftRatio  float64
	PanelRightRatio float64
	PanelTOCRatio   float64
	UpdatedAt       string
}

// ReadWorkspaceGUISettings returns the singleton GUI settings row.
func ReadWorkspaceGUISettings(indexPath string) (WorkspaceGUISettings, bool, error) {
	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return WorkspaceGUISettings{}, false, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	if err := ensureWorkspaceGUISchema(database); err != nil {
		return WorkspaceGUISettings{}, false, err
	}

	var settings WorkspaceGUISettings
	err = database.QueryRow(`SELECT appearance, panel_left_ratio, panel_right_ratio, panel_document_toc_ratio, updated_at FROM workspace_gui_settings WHERE singleton_key = 1`).
		Scan(&settings.Appearance, &settings.PanelLeftRatio, &settings.PanelRightRatio, &settings.PanelTOCRatio, &settings.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return WorkspaceGUISettings{}, false, nil
		}
		return WorkspaceGUISettings{}, false, fmt.Errorf("query workspace gui settings: %w", err)
	}

	return settings, true, nil
}

// WriteWorkspaceGUISettings upserts the singleton GUI settings row.
func WriteWorkspaceGUISettings(indexPath string, settings WorkspaceGUISettings) error {
	normalized, err := normalizeWorkspaceGUISettings(settings)
	if err != nil {
		return err
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	if err := ensureWorkspaceGUISchema(database); err != nil {
		return err
	}

	if _, err := database.Exec(
		`INSERT INTO workspace_gui_settings (singleton_key, appearance, panel_left_ratio, panel_right_ratio, panel_document_toc_ratio, updated_at)
		 VALUES (1, ?, ?, ?, ?, ?)
		 ON CONFLICT(singleton_key) DO UPDATE
		 SET appearance = excluded.appearance,
		     panel_left_ratio = excluded.panel_left_ratio,
		     panel_right_ratio = excluded.panel_right_ratio,
		     panel_document_toc_ratio = excluded.panel_document_toc_ratio,
		     updated_at = excluded.updated_at`,
		normalized.Appearance,
		normalized.PanelLeftRatio,
		normalized.PanelRightRatio,
		normalized.PanelTOCRatio,
		normalized.UpdatedAt,
	); err != nil {
		return fmt.Errorf("write workspace gui settings: %w", err)
	}

	return nil
}

// ReadWorkspaceGraphDirectoryColors returns persisted graph directory colors keyed by graph path.
func ReadWorkspaceGraphDirectoryColors(indexPath string) (map[string]string, error) {
	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return nil, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	if err := ensureWorkspaceGUISchema(database); err != nil {
		return nil, err
	}

	rows, err := database.Query(`SELECT graph_path, color FROM workspace_graph_directory_colors ORDER BY graph_path`)
	if err != nil {
		return nil, fmt.Errorf("query workspace graph directory colors: %w", err)
	}
	defer rows.Close()

	colors := map[string]string{}
	for rows.Next() {
		var graphPath string
		var color string
		if err := rows.Scan(&graphPath, &color); err != nil {
			return nil, fmt.Errorf("scan workspace graph directory color: %w", err)
		}
		colors[graphPath] = color
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate workspace graph directory colors: %w", err)
	}

	return colors, nil
}

// ReplaceWorkspaceGraphDirectoryColors atomically replaces persisted graph directory colors.
func ReplaceWorkspaceGraphDirectoryColors(indexPath string, colors map[string]string) error {
	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	if err := ensureWorkspaceGUISchema(database); err != nil {
		return err
	}

	transaction, err := database.Begin()
	if err != nil {
		return fmt.Errorf("begin workspace graph directory colors transaction: %w", err)
	}
	defer transaction.Rollback()

	if err := replaceWorkspaceGraphDirectoryColors(transaction, colors); err != nil {
		return err
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit workspace graph directory colors transaction: %w", err)
	}

	return nil
}

func ensureWorkspaceGUISchema(database *sql.DB) error {
	if _, err := database.Exec(`
		CREATE TABLE IF NOT EXISTS workspace_gui_settings (
			singleton_key INTEGER NOT NULL PRIMARY KEY CHECK(singleton_key = 1),
			appearance TEXT NOT NULL,
			panel_left_ratio REAL NOT NULL,
			panel_right_ratio REAL NOT NULL,
			panel_document_toc_ratio REAL NOT NULL,
			updated_at TEXT NOT NULL
		);
	`); err != nil {
		return fmt.Errorf("ensure workspace gui settings table: %w", err)
	}

	if _, err := database.Exec(`
		CREATE TABLE IF NOT EXISTS workspace_graph_directory_colors (
			graph_path TEXT NOT NULL PRIMARY KEY,
			color TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
	`); err != nil {
		return fmt.Errorf("ensure workspace graph directory colors table: %w", err)
	}

	return nil
}

func loadExistingWorkspaceGUISettings(indexPath string) (WorkspaceGUISettings, bool, error) {
	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return WorkspaceGUISettings{}, false, err
	}
	defer database.Close()

	if !hasWorkspaceGUISettingsTable(database) {
		return WorkspaceGUISettings{}, false, nil
	}

	var settings WorkspaceGUISettings
	err = database.QueryRow(`SELECT appearance, panel_left_ratio, panel_right_ratio, panel_document_toc_ratio, updated_at FROM workspace_gui_settings WHERE singleton_key = 1`).
		Scan(&settings.Appearance, &settings.PanelLeftRatio, &settings.PanelRightRatio, &settings.PanelTOCRatio, &settings.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return WorkspaceGUISettings{}, false, nil
		}
		return WorkspaceGUISettings{}, false, err
	}

	return settings, true, nil
}

func loadExistingWorkspaceGraphDirectoryColors(indexPath string) (map[string]string, error) {
	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return nil, err
	}
	defer database.Close()

	if !hasWorkspaceGraphDirectoryColorsTable(database) {
		return map[string]string{}, nil
	}

	rows, err := database.Query(`SELECT graph_path, color FROM workspace_graph_directory_colors ORDER BY graph_path`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	colors := map[string]string{}
	for rows.Next() {
		var graphPath string
		var color string
		if err := rows.Scan(&graphPath, &color); err != nil {
			return nil, err
		}
		colors[graphPath] = color
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return colors, nil
}

func hasWorkspaceGUISettingsTable(database *sql.DB) bool {
	var count int
	if err := database.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'workspace_gui_settings'`).Scan(&count); err != nil {
		return false
	}

	return count == 1
}

func hasWorkspaceGraphDirectoryColorsTable(database *sql.DB) bool {
	var count int
	if err := database.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'workspace_graph_directory_colors'`).Scan(&count); err != nil {
		return false
	}

	return count == 1
}

func normalizeWorkspaceGUISettings(settings WorkspaceGUISettings) (WorkspaceGUISettings, error) {
	settings.Appearance = strings.TrimSpace(settings.Appearance)
	settings.UpdatedAt = strings.TrimSpace(settings.UpdatedAt)

	if settings.Appearance == "" {
		return WorkspaceGUISettings{}, fmt.Errorf("appearance must not be empty")
	}

	if settings.UpdatedAt == "" {
		settings.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}

	return settings, nil
}

func upsertWorkspaceGUISettings(transaction *sql.Tx, settings WorkspaceGUISettings) error {
	normalized, err := normalizeWorkspaceGUISettings(settings)
	if err != nil {
		return err
	}

	if _, err := transaction.Exec(
		`INSERT INTO workspace_gui_settings (singleton_key, appearance, panel_left_ratio, panel_right_ratio, panel_document_toc_ratio, updated_at)
		 VALUES (1, ?, ?, ?, ?, ?)
		 ON CONFLICT(singleton_key) DO UPDATE
		 SET appearance = excluded.appearance,
		     panel_left_ratio = excluded.panel_left_ratio,
		     panel_right_ratio = excluded.panel_right_ratio,
		     panel_document_toc_ratio = excluded.panel_document_toc_ratio,
		     updated_at = excluded.updated_at`,
		normalized.Appearance,
		normalized.PanelLeftRatio,
		normalized.PanelRightRatio,
		normalized.PanelTOCRatio,
		normalized.UpdatedAt,
	); err != nil {
		return fmt.Errorf("write workspace gui settings: %w", err)
	}

	return nil
}

func replaceWorkspaceGraphDirectoryColors(transaction *sql.Tx, colors map[string]string) error {
	if _, err := transaction.Exec(`DELETE FROM workspace_graph_directory_colors`); err != nil {
		return fmt.Errorf("clear workspace graph directory colors: %w", err)
	}

	for graphPath, color := range colors {
		trimmedGraphPath := strings.TrimSpace(graphPath)
		trimmedColor := strings.TrimSpace(color)
		if trimmedGraphPath == "" || trimmedColor == "" {
			continue
		}

		if _, err := transaction.Exec(
			`INSERT INTO workspace_graph_directory_colors (graph_path, color, updated_at) VALUES (?, ?, ?)`,
			trimmedGraphPath,
			trimmedColor,
			time.Now().UTC().Format(time.RFC3339Nano),
		); err != nil {
			return fmt.Errorf("write workspace graph directory color for %q: %w", trimmedGraphPath, err)
		}
	}

	return nil
}
