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
		SELECT id, type, feature_slug, graph, title, path, body_text
		FROM documents
		WHERE lower(id) LIKE ?
			OR lower(type) LIKE ?
			OR lower(feature_slug) LIKE ?
			OR lower(graph) LIKE ?
			OR lower(title) LIKE ?
			OR lower(path) LIKE ?
			OR lower(body_text) LIKE ?
		ORDER BY
			CASE WHEN lower(title) = ? THEN 0 ELSE 1 END,
			CASE WHEN lower(id) = ? THEN 0 ELSE 1 END,
			CASE WHEN lower(title) LIKE ? THEN 0 ELSE 1 END,
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
		normalizedQuery,
		normalizedQuery,
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
