package markdown

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
)

var envKeyPattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// WorkspaceDocument describes a parsed workspace document together with its relative path.
type WorkspaceDocument struct {
	Path     string
	Document Document
}

// ValidateCommandDocument applies command-specific validation rules that do not require workspace context.
func ValidateCommandDocument(document CommandDocument) error {
	if strings.TrimSpace(document.Metadata.ID) == "" {
		return fmt.Errorf("command id must not be empty")
	}

	if strings.TrimSpace(document.Metadata.Graph) == "" {
		return fmt.Errorf("command graph must not be empty")
	}

	if strings.TrimSpace(document.Metadata.Name) == "" {
		return fmt.Errorf("command short name must not be empty")
	}

	if strings.TrimSpace(document.Metadata.Name) != document.Metadata.Name {
		return fmt.Errorf("command short name must not have leading or trailing whitespace")
	}

	if strings.TrimSpace(document.Metadata.Run) == "" {
		return fmt.Errorf("command run must not be empty")
	}

	for key := range document.Metadata.Env {
		if !envKeyPattern.MatchString(key) {
			return fmt.Errorf("command env key %q is invalid", key)
		}
	}

	return nil
}

// ValidateWorkspaceDocuments applies workspace-wide document validation rules.
func ValidateWorkspaceDocuments(documents []WorkspaceDocument) error {
	normalizedDocuments := make([]WorkspaceDocument, 0, len(documents))
	for _, item := range documents {
		normalizedItem, err := NormalizeWorkspaceDocument(item)
		if err != nil {
			return err
		}

		normalizedDocuments = append(normalizedDocuments, normalizedItem)
	}

	commandNames := map[string]string{}
	documentKindsByID := map[string]DocumentType{}
	documentsByID := map[string]WorkspaceDocument{}

	for _, item := range normalizedDocuments {
		switch document := item.Document.(type) {
		case NoteDocument:
			if strings.TrimSpace(document.Metadata.ID) == "" {
				return fmt.Errorf("%s: note id must not be empty", item.Path)
			}

			if previous, exists := documentsByID[document.Metadata.ID]; exists {
				return fmt.Errorf("duplicate document id %q in %s and %s", document.Metadata.ID, previous.Path, item.Path)
			}

			documentsByID[document.Metadata.ID] = item
			documentKindsByID[document.Metadata.ID] = document.Metadata.Type
		case TaskDocument:
			if strings.TrimSpace(document.Metadata.ID) == "" {
				return fmt.Errorf("%s: task id must not be empty", item.Path)
			}

			if !IsAllowedTaskStatus(document.Metadata.Status) {
				return fmt.Errorf("%s: task status %q is invalid; allowed values: %s", item.Path, document.Metadata.Status, strings.Join(AllowedTaskStatuses(), ", "))
			}

			if previous, exists := documentsByID[document.Metadata.ID]; exists {
				return fmt.Errorf("duplicate document id %q in %s and %s", document.Metadata.ID, previous.Path, item.Path)
			}

			documentsByID[document.Metadata.ID] = item
			documentKindsByID[document.Metadata.ID] = document.Metadata.Type
		case CommandDocument:
			if err := ValidateCommandDocument(document); err != nil {
				return fmt.Errorf("%s: %w", item.Path, err)
			}

			if previous, exists := documentsByID[document.Metadata.ID]; exists {
				return fmt.Errorf("duplicate document id %q in %s and %s", document.Metadata.ID, previous.Path, item.Path)
			}

			if previousPath, exists := commandNames[document.Metadata.Name]; exists {
				return fmt.Errorf("duplicate command short name %q in %s and %s", document.Metadata.Name, previousPath, item.Path)
			}

			documentsByID[document.Metadata.ID] = item
			commandNames[document.Metadata.Name] = item.Path
			documentKindsByID[document.Metadata.ID] = document.Metadata.Type
		}
	}

	for _, item := range normalizedDocuments {
		_, _, linkIDs, referenceIDs := linkTargets(item.Document)
		_, sourceGraph := documentBodyAndGraph(item.Document)

		for _, linkID := range linkIDs {
			if _, exists := documentKindsByID[linkID]; !exists {
				return fmt.Errorf("%s: reference %q does not exist", item.Path, linkID)
			}
		}

		for _, referenceID := range referenceIDs {
			if _, ok, err := ResolveReferenceTarget(normalizedDocuments, referenceID, sourceGraph); err != nil {
				return err
			} else if !ok {
				return fmt.Errorf("%s: reference %q does not exist", item.Path, referenceID)
			}
		}
	}

	return nil
}

// NormalizeWorkspaceDocument applies path-derived metadata rules for canonical workspace paths.
func NormalizeWorkspaceDocument(item WorkspaceDocument) (WorkspaceDocument, error) {
	graphPath, ok, err := GraphPathFromWorkspacePath(item.Path)
	if err != nil {
		return WorkspaceDocument{}, err
	}

	if !ok {
		return item, nil
	}

	switch document := item.Document.(type) {
	case NoteDocument:
		document.Metadata.Graph = graphPath
		item.Document = document
	case TaskDocument:
		document.Metadata.Graph = graphPath
		item.Document = document
	case CommandDocument:
		document.Metadata.Graph = graphPath
		item.Document = document
	}

	return item, nil
}

// GraphPathFromWorkspacePath returns the canonical graph path for a graph-backed document path.
func GraphPathFromWorkspacePath(path string) (string, bool, error) {
	normalizedPath := strings.TrimPrefix(strings.ReplaceAll(path, "\\", "/"), "./")
	normalizedPath = strings.TrimPrefix(normalizedPath, "/")

	const graphRoot = "data/content/"
	if !strings.HasPrefix(normalizedPath, graphRoot) {
		return "", false, nil
	}

	remainder := strings.TrimPrefix(normalizedPath, graphRoot)
	parts := strings.Split(remainder, "/")
	if len(parts) < 2 {
		return "", false, fmt.Errorf("document path %q is not in canonical data/content/<graph-path>/<file>.md layout", path)
	}

	segments := parts[:len(parts)-1]
	fileName := parts[len(parts)-1]
	if strings.TrimSpace(fileName) == "" || !strings.HasSuffix(fileName, ".md") {
		return "", false, fmt.Errorf("document path %q is not in canonical data/content/<graph-path>/<file>.md layout", path)
	}

	for _, segment := range segments {
		if segment == "" || segment == "." || segment == ".." {
			return "", false, fmt.Errorf("document path %q is not in canonical data/content/<graph-path>/<file>.md layout", path)
		}
	}

	return strings.Join(segments, "/"), true, nil
}

func linkTargets(document Document) (string, DocumentType, []string, []string) {
	switch value := document.(type) {
	case NoteDocument:
		return value.Metadata.ID, value.Metadata.Type, NodeLinkIDs(value.Metadata.Links), InlineReferenceIDs(value.Body)
	case TaskDocument:
		return value.Metadata.ID, value.Metadata.Type, NodeLinkIDs(value.Metadata.Links), InlineReferenceIDs(value.Body)
	case CommandDocument:
		return value.Metadata.ID, value.Metadata.Type, NodeLinkIDs(value.Metadata.Links), InlineReferenceIDs(value.Body)
	default:
		return "", "", nil, nil
	}
}

// EdgeTypeSeverity classifies how seriously a node-type × relationship mismatch is treated.
type EdgeTypeSeverity string

const (
	// EdgeTypeSeverityError marks an edge that contradicts the graph model: the
	// relationship cannot meaningfully hold between these node types.
	EdgeTypeSeverityError EdgeTypeSeverity = "error"
	// EdgeTypeSeverityWarning marks a non-canonical but tolerated edge.
	EdgeTypeSeverityWarning EdgeTypeSeverity = "warning"
)

// EdgeTypeViolation describes one node-type × relationship incompatibility found
// during static graph validation. Graph is the graph of the document that
// declares the link (the "edge's" home graph, matching the index edges table).
//
// FixTags holds the relationship tags that resolve this violation when swapped
// in for the offending Relationship tag (empty means "remove the tag"). It is
// the payload consumed by the canvas quick-fix action.
//
// Note: relationships outside the validated vocabulary (depends-on, maps-to,
// evolves-from, supersedes) pass through unchecked by design — this includes
// evolves-to, blocks, documents, captures, and relates-to, which appear in real
// workspaces as free-form contextual tags.
type EdgeTypeViolation struct {
	Path         string           `json:"path"`
	Graph        string           `json:"graph"`
	FromID       string           `json:"fromID"`
	FromType     DocumentType     `json:"fromType"`
	ToID         string           `json:"toID"`
	ToType       DocumentType     `json:"toType"`
	Relationship string           `json:"relationship"`
	Severity     EdgeTypeSeverity `json:"severity"`
	Message      string           `json:"message"`
	FixTags      []string         `json:"fixTags,omitempty"`
}

// ValidateEdgeTypeCompatibility checks that declared link relationships agree with the
// node types they connect. It is a static, non-fatal validation: violations are returned
// for reporting (logged by the index, or surfaced by `flow graph validate`) but never
// block indexing, because legacy workspaces legitimately contain tolerated patterns.
//
// Relationship names are matched case-insensitively with underscores treated as hyphens,
// so "depends_on" and "depends-on" are the same relationship.
func ValidateEdgeTypeCompatibility(documents []WorkspaceDocument) []EdgeTypeViolation {
	typesByID := make(map[string]DocumentType, len(documents))
	for _, item := range documents {
		if id := item.Document.ID(); id != "" {
			typesByID[id] = item.Document.Kind()
		}
	}

	var violations []EdgeTypeViolation
	for _, item := range documents {
		fromID := item.Document.ID()
		fromType := item.Document.Kind()
		if fromID == "" {
			continue
		}

		for _, link := range item.Document.Links() {
			toType, ok := typesByID[link.Node]
			if !ok {
				// Missing targets are reported by ValidateWorkspaceDocuments.
				continue
			}

			for _, relationship := range link.Relationships {
				violations = append(violations, checkEdgeTypeCompatibility(item.Path, documentGraph(item), fromID, fromType, link.Node, toType, relationship)...)
			}
		}
	}

	slices.SortFunc(violations, func(left EdgeTypeViolation, right EdgeTypeViolation) int {
		if left.Path != right.Path {
			return strings.Compare(left.Path, right.Path)
		}
		if left.FromID != right.FromID {
			return strings.Compare(left.FromID, right.FromID)
		}
		if left.ToID != right.ToID {
			return strings.Compare(left.ToID, right.ToID)
		}
		return strings.Compare(left.Relationship, right.Relationship)
	})

	return violations
}

func checkEdgeTypeCompatibility(path string, graph string, fromID string, fromType DocumentType, toID string, toType DocumentType, relationship string) []EdgeTypeViolation {
	// Quick-fix semantics follow each message: only the rule that explicitly
	// recommends a replacement ("use relates-to for contextual notes") emits fix
	// tags. The other rules leave fixTags empty, which the UI renders as "Remove
	// tag" — relabeling an intended execution dependency or record mapping as
	// "relates-to" would silently mask the user's original intent.
	makeViolation := func(severity EdgeTypeSeverity, message string, fixTags ...string) EdgeTypeViolation {
		return EdgeTypeViolation{
			Path:         path,
			Graph:        graph,
			FromID:       fromID,
			FromType:     fromType,
			ToID:         toID,
			ToType:       toType,
			Relationship: relationship,
			Severity:     severity,
			Message:      message,
			FixTags:      fixTags,
		}
	}

	switch normalizedEdgeRelationship(relationship) {
	case "depends-on":
		if fromType == NoteType {
			return []EdgeTypeViolation{makeViolation(EdgeTypeSeverityError, "depends-on requires a task or command source; a note cannot declare execution dependencies")}
		}
		if toType == NoteType {
			return []EdgeTypeViolation{makeViolation(EdgeTypeSeverityWarning, "depends-on targets a note; use relates-to for contextual notes", "relates-to")}
		}
	case "maps-to":
		if fromType == CommandType || toType == CommandType {
			return []EdgeTypeViolation{makeViolation(EdgeTypeSeverityError, "maps-to connects a record note to a task; commands are not recordable")}
		}
		if fromType != NoteType || toType != TaskType {
			return []EdgeTypeViolation{makeViolation(EdgeTypeSeverityWarning, "maps-to canonically runs from a note to the task it records")}
		}
	case "evolves-from", "supersedes":
		if fromType == CommandType || toType == CommandType {
			return []EdgeTypeViolation{makeViolation(EdgeTypeSeverityError, "evolves-from/supersedes connects notes or tasks; commands are not design nodes")}
		}
	}

	return nil
}

// normalizedEdgeRelationship canonicalizes a relationship tag for rule matching:
// lowercase, trimmed, and underscore normalized to hyphen ("depends_on" → "depends-on").
func normalizedEdgeRelationship(value string) string {
	return strings.ReplaceAll(strings.ToLower(strings.TrimSpace(value)), "_", "-")
}

// documentGraph returns the canonical graph for a workspace document: the
// path-derived graph when the path is canonical, otherwise the frontmatter graph.
func documentGraph(item WorkspaceDocument) string {
	if graphPath, ok, err := GraphPathFromWorkspacePath(item.Path); err == nil && ok && graphPath != "" {
		return graphPath
	}

	return item.Document.Graph()
}
