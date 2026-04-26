package index

import (
	"database/sql"
	"fmt"
	"strings"

	_ "modernc.org/sqlite"
)

// NodeView is a self-describing representation of a single graph node, including
// its outbound and inbound edges. It is consumed by external LLM agents traversing the graph.
type NodeView struct {
	ID            string     `json:"id"`
	Type          string     `json:"type"`
	Role          string     `json:"role"`
	Graph         string     `json:"graph"`
	Title         string     `json:"title"`
	Status        string     `json:"status,omitempty"`
	Body          string     `json:"body"`
	From          string     `json:"from,omitempty"`
	To            string     `json:"to,omitempty"`
	Links         []string   `json:"links,omitempty"`
	Run           string     `json:"run,omitempty"`
	OutboundEdges []EdgeView `json:"outboundEdges,omitempty"`
	InboundEdges  []EdgeView `json:"inboundEdges,omitempty"`
}

// EdgeView describes one directed edge connecting two nodes.
type EdgeView struct {
	ID    string `json:"id"`
	From  string `json:"from,omitempty"`
	To    string `json:"to,omitempty"`
	Label string `json:"label"`
	Body  string `json:"body"`
}

// NodeSummary is a compact representation of a node for use in neighbor lists.
type NodeSummary struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	Role  string `json:"role"`
	Graph string `json:"graph"`
	Title string `json:"title"`
}

// ReadNodeViewWorkspace reads a NodeView for the given ID (and optional graph filter),
// rebuilding the index first when it is missing.
func ReadNodeViewWorkspace(indexPath, flowPath, id, graph string) (NodeView, error) {
	if err := ensureIndexExists(indexPath, flowPath); err != nil {
		return NodeView{}, err
	}
	return ReadNodeView(indexPath, id, graph)
}

// ReadNodeView reads and assembles a NodeView from the index for the given document ID.
// When graph is non-empty it is used as an additional filter to disambiguate IDs.
// Edge documents (stored only in the edges table) are also supported.
func ReadNodeView(indexPath, id, graph string) (NodeView, error) {
	trimmedID := strings.TrimSpace(id)
	if trimmedID == "" {
		return NodeView{}, fmt.Errorf("node id must not be empty")
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return NodeView{}, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	trimmedGraph := strings.TrimSpace(graph)

	// Try the documents table first; edge documents fall back to the edges table.
	view, found, err := tryQueryNodeDocument(database, trimmedID, trimmedGraph)
	if err != nil {
		return NodeView{}, err
	}
	if !found {
		view, found, err = tryQueryEdgeAsNode(database, trimmedID, trimmedGraph)
		if err != nil {
			return NodeView{}, err
		}
		if !found {
			return NodeView{}, fmt.Errorf("node %q not found", trimmedID)
		}
		return view, nil
	}

	links, err := queryNodeReferences(database, trimmedID, view.Type)
	if err != nil {
		return NodeView{}, fmt.Errorf("query links: %w", err)
	}
	view.Links = links

	outbound, err := queryOutboundEdges(database, trimmedID, trimmedGraph)
	if err != nil {
		return NodeView{}, err
	}
	view.OutboundEdges = outbound

	inbound, err := queryInboundEdges(database, trimmedID, trimmedGraph)
	if err != nil {
		return NodeView{}, err
	}
	view.InboundEdges = inbound

	return view, nil
}

// ReadAllNodeViewsWorkspace returns NodeView entries for every document in the given graph.
func ReadAllNodeViewsWorkspace(indexPath, flowPath, graph string) ([]NodeView, error) {
	if err := ensureIndexExists(indexPath, flowPath); err != nil {
		return nil, err
	}
	return ReadAllNodeViews(indexPath, graph)
}

// ReadAllNodeViews returns NodeView entries for every document in the given graph.
func ReadAllNodeViews(indexPath, graph string) ([]NodeView, error) {
	trimmedGraph := strings.TrimSpace(graph)
	if trimmedGraph == "" {
		return nil, fmt.Errorf("graph must not be empty")
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return nil, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	return queryAllNodeViews(database, trimmedGraph)
}

// deriveRole maps a document type string to a human-readable role for agents.
// ReadNodeSummariesByIDs returns compact NodeSummary entries for a set of node IDs.
// IDs that do not exist in either the documents or edges table are silently skipped.
func ReadNodeSummariesByIDs(indexPath string, ids []string) ([]NodeSummary, error) {
	if len(ids) == 0 {
		return []NodeSummary{}, nil
	}

	database, err := sql.Open("sqlite", indexPath)
	if err != nil {
		return nil, fmt.Errorf("open index database: %w", err)
	}
	defer database.Close()

	seen := make(map[string]bool, len(ids))
	var summaries []NodeSummary

	for _, id := range ids {
		if seen[id] {
			continue
		}
		seen[id] = true

		var s NodeSummary
		err := database.QueryRow(
			`SELECT id, type, graph, title FROM documents WHERE id = ?`,
			id,
		).Scan(&s.ID, &s.Type, &s.Graph, &s.Title)
		if err == sql.ErrNoRows {
			// Try edges table.
			var label string
			edgeErr := database.QueryRow(
				`SELECT id, graph, label FROM edges WHERE id = ?`,
				id,
			).Scan(&s.ID, &s.Graph, &label)
			if edgeErr == sql.ErrNoRows {
				continue
			}
			if edgeErr != nil {
				return nil, fmt.Errorf("query edge summary: %w", edgeErr)
			}
			s.Type = "edge"
			s.Title = label
		} else if err != nil {
			return nil, fmt.Errorf("query node summary: %w", err)
		}
		s.Role = deriveRole(s.Type)
		summaries = append(summaries, s)
	}

	if summaries == nil {
		summaries = []NodeSummary{}
	}
	return summaries, nil
}

func deriveRole(docType string) string {
	switch docType {
	case "task":
		return "work"
	case "command":
		return "decision"
	default:
		// note, edge, home, unknown
		return "context"
	}
}

func tryQueryNodeDocument(db *sql.DB, id, graph string) (NodeView, bool, error) {
	var row NodeView
	var taskStatus, commandRun string

	var err error
	if graph != "" {
		err = db.QueryRow(
			`SELECT id, type, graph, title, body_text, task_status, command_run
			 FROM documents WHERE id = ? AND graph = ?`,
			id, graph,
		).Scan(&row.ID, &row.Type, &row.Graph, &row.Title, &row.Body, &taskStatus, &commandRun)
	} else {
		err = db.QueryRow(
			`SELECT id, type, graph, title, body_text, task_status, command_run
			 FROM documents WHERE id = ?`,
			id,
		).Scan(&row.ID, &row.Type, &row.Graph, &row.Title, &row.Body, &taskStatus, &commandRun)
	}

	if err == sql.ErrNoRows {
		return NodeView{}, false, nil
	}
	if err != nil {
		return NodeView{}, false, fmt.Errorf("query node document: %w", err)
	}

	row.Role = deriveRole(row.Type)
	if taskStatus != "" {
		row.Status = taskStatus
	}
	if commandRun != "" {
		row.Run = commandRun
	}

	return row, true, nil
}

// tryQueryEdgeAsNode loads an entry from the edges table and wraps it as a NodeView.
func tryQueryEdgeAsNode(db *sql.DB, id, graph string) (NodeView, bool, error) {
	var row NodeView
	row.Type = "edge"
	row.Role = "context"

	var err error
	if graph != "" {
		err = db.QueryRow(
			`SELECT id, graph, from_id, to_id, label, body FROM edges WHERE id = ? AND graph = ?`,
			id, graph,
		).Scan(&row.ID, &row.Graph, &row.From, &row.To, &row.Title, &row.Body)
	} else {
		err = db.QueryRow(
			`SELECT id, graph, from_id, to_id, label, body FROM edges WHERE id = ?`,
			id,
		).Scan(&row.ID, &row.Graph, &row.From, &row.To, &row.Title, &row.Body)
	}

	if err == sql.ErrNoRows {
		return NodeView{}, false, nil
	}
	if err != nil {
		return NodeView{}, false, fmt.Errorf("query edge document: %w", err)
	}

	return row, true, nil
}

func queryAllNodeViews(db *sql.DB, graph string) ([]NodeView, error) {
	rows, err := db.Query(
		`SELECT id, type, graph, title, body_text, task_status, command_run
		 FROM documents WHERE graph = ? ORDER BY title, id`,
		graph,
	)
	if err != nil {
		return nil, fmt.Errorf("query documents for graph: %w", err)
	}
	defer rows.Close()

	var views []NodeView
	for rows.Next() {
		var view NodeView
		var taskStatus, commandRun string
		if err := rows.Scan(&view.ID, &view.Type, &view.Graph, &view.Title, &view.Body, &taskStatus, &commandRun); err != nil {
			return nil, fmt.Errorf("scan document row: %w", err)
		}
		view.Role = deriveRole(view.Type)
		if taskStatus != "" {
			view.Status = taskStatus
		}
		if commandRun != "" {
			view.Run = commandRun
		}
		views = append(views, view)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate document rows: %w", err)
	}

	if views == nil {
		views = []NodeView{}
	}

	return views, nil
}

// queryNodeReferences returns the reference IDs this document points to.
// Notes may store note-to-note links in the note_links table; all other
// directed references are in soft_references.
func queryNodeReferences(db *sql.DB, id, docType string) ([]string, error) {
	softRefs, err := queryStringColumn(db,
		`SELECT reference_id FROM soft_references WHERE document_id = ? ORDER BY reference_id`,
		id,
	)
	if err != nil {
		return nil, err
	}

	if docType != "note" {
		return softRefs, nil
	}

	// For notes, also collect the other side of note_links entries.
	noteLinks, err := queryNoteLinks(db, id)
	if err != nil {
		return nil, err
	}

	if len(noteLinks) == 0 {
		return softRefs, nil
	}
	if len(softRefs) == 0 {
		return noteLinks, nil
	}

	seen := make(map[string]bool, len(softRefs)+len(noteLinks))
	result := make([]string, 0, len(softRefs)+len(noteLinks))
	for _, ref := range softRefs {
		if !seen[ref] {
			seen[ref] = true
			result = append(result, ref)
		}
	}
	for _, ref := range noteLinks {
		if !seen[ref] {
			seen[ref] = true
			result = append(result, ref)
		}
	}
	return result, nil
}

func queryNoteLinks(db *sql.DB, id string) ([]string, error) {
	rows, err := db.Query(
		`SELECT CASE WHEN left_note_id = ? THEN right_note_id ELSE left_note_id END
		 FROM note_links WHERE left_note_id = ? OR right_note_id = ?
		 ORDER BY 1`,
		id, id, id,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var values []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		values = append(values, v)
	}
	return values, rows.Err()
}

func queryStringColumn(db *sql.DB, query, arg string) ([]string, error) {
	rows, err := db.Query(query, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var values []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		values = append(values, v)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return values, nil
}

func queryOutboundEdges(db *sql.DB, fromID, graph string) ([]EdgeView, error) {
	var rows *sql.Rows
	var err error
	if graph != "" {
		rows, err = db.Query(
			`SELECT id, to_id, label, body FROM edges WHERE from_id = ? AND graph = ? ORDER BY id`,
			fromID, graph,
		)
	} else {
		rows, err = db.Query(
			`SELECT id, to_id, label, body FROM edges WHERE from_id = ? ORDER BY id`,
			fromID,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("query outbound edges: %w", err)
	}
	defer rows.Close()

	var edges []EdgeView
	for rows.Next() {
		var ev EdgeView
		ev.From = fromID
		if err := rows.Scan(&ev.ID, &ev.To, &ev.Label, &ev.Body); err != nil {
			return nil, fmt.Errorf("scan edge view: %w", err)
		}
		edges = append(edges, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate edge views: %w", err)
	}
	return edges, nil
}

func queryInboundEdges(db *sql.DB, toID, graph string) ([]EdgeView, error) {
	var rows *sql.Rows
	var err error
	if graph != "" {
		rows, err = db.Query(
			`SELECT id, from_id, label, body FROM edges WHERE to_id = ? AND graph = ? ORDER BY id`,
			toID, graph,
		)
	} else {
		rows, err = db.Query(
			`SELECT id, from_id, label, body FROM edges WHERE to_id = ? ORDER BY id`,
			toID,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("query inbound edges: %w", err)
	}
	defer rows.Close()

	var edges []EdgeView
	for rows.Next() {
		var ev EdgeView
		ev.To = toID
		if err := rows.Scan(&ev.ID, &ev.From, &ev.Label, &ev.Body); err != nil {
			return nil, fmt.Errorf("scan inbound edge view: %w", err)
		}
		edges = append(edges, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate inbound edge views: %w", err)
	}
	return edges, nil
}
