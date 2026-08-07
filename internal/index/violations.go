package index

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/lex/flow/internal/markdown"
)

// insertGraphEdgeViolations replaces the persisted edge-type validation results
// inside an open rebuild transaction. Violations are fully derived from the
// workspace Markdown, so every rebuild clears the previous rows and writes the
// current list; stale rows cannot survive document changes.
func insertGraphEdgeViolations(transaction *sql.Tx, violations []markdown.EdgeTypeViolation) error {
	if _, err := transaction.Exec(`DELETE FROM graph_edge_violations`); err != nil {
		return fmt.Errorf("clear graph edge violations: %w", err)
	}

	for _, violation := range violations {
		fixTagsJSON, err := json.Marshal(violation.FixTags)
		if err != nil {
			return fmt.Errorf("serialize fix tags for %s: %w", violation.Path, err)
		}

		// OR IGNORE: a link with a duplicated relationship tag (e.g.
		// relationships: [depends-on, depends-on] in hand-written frontmatter)
		// yields identical violations. Validation is advisory, so the rebuild
		// must never fail on such rows — the first insert wins and duplicates
		// are dropped.
		if _, err := transaction.Exec(
			`INSERT OR IGNORE INTO graph_edge_violations (path, graph, from_id, from_type, to_id, to_type, relationship, severity, message, fix_tags_json)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			violation.Path,
			violation.Graph,
			violation.FromID,
			string(violation.FromType),
			violation.ToID,
			string(violation.ToType),
			violation.Relationship,
			string(violation.Severity),
			violation.Message,
			string(fixTagsJSON),
		); err != nil {
			return fmt.Errorf("insert graph edge violation for %s: %w", violation.Path, err)
		}
	}

	return nil
}

// ReadGraphEdgeViolations returns the persisted edge-type validation results for
// the whole workspace, ordered deterministically so API responses are stable.
func ReadGraphEdgeViolations(indexPath string) ([]markdown.EdgeTypeViolation, error) {
	database, err := openIndexDB(indexPath)
	if err != nil {
		return nil, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	rows, err := database.Query(`SELECT path, graph, from_id, from_type, to_id, to_type, relationship, severity, message, fix_tags_json
		FROM graph_edge_violations ORDER BY path, from_id, to_id, relationship`)
	if err != nil {
		return nil, fmt.Errorf("query graph edge violations: %w", err)
	}
	defer rows.Close()

	violations := []markdown.EdgeTypeViolation{}
	for rows.Next() {
		var violation markdown.EdgeTypeViolation
		var fromType string
		var toType string
		var severity string
		var fixTagsJSON string
		if err := rows.Scan(&violation.Path, &violation.Graph, &violation.FromID, &fromType, &violation.ToID, &toType, &violation.Relationship, &severity, &violation.Message, &fixTagsJSON); err != nil {
			return nil, fmt.Errorf("scan graph edge violation: %w", err)
		}

		violation.FromType = markdown.DocumentType(fromType)
		violation.ToType = markdown.DocumentType(toType)
		violation.Severity = markdown.EdgeTypeSeverity(severity)
		if strings.TrimSpace(fixTagsJSON) != "" {
			var fixTags []string
			if err := json.Unmarshal([]byte(fixTagsJSON), &fixTags); err != nil {
				return nil, fmt.Errorf("decode fix tags for %s: %w", violation.Path, err)
			}
			violation.FixTags = fixTags
		}

		violations = append(violations, violation)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate graph edge violations: %w", err)
	}

	return violations, nil
}

// ReadGraphEdgeViolationsWorkspace returns persisted violations, rebuilding a
// missing index first (mirroring the other Read*Workspace helpers).
func ReadGraphEdgeViolationsWorkspace(indexPath string, flowPath string) ([]markdown.EdgeTypeViolation, error) {
	if err := ensureIndexExists(indexPath, flowPath); err != nil {
		return nil, err
	}

	return ReadGraphEdgeViolations(indexPath)
}
