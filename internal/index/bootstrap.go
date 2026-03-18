package index

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io/fs"
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
`

type indexedDocument struct {
	relativePath string
	featureSlug  string
	document     markdown.Document
}

// Rebuild recreates the derived index file without touching Markdown sources.
// When flowPaths[0] is provided, documents under .flow/features are reindexed into SQLite.
func Rebuild(indexPath string, flowPaths ...string) error {
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

		for _, document := range documents {
			if err := insertDocument(transaction, document, documentKindsByID); err != nil {
				return err
			}
		}
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit rebuild transaction: %w", err)
	}

	return nil
}

func collectDocuments(flowPath string) ([]indexedDocument, error) {
	featuresPath := filepath.Join(flowPath, "features")
	if _, err := os.Stat(featuresPath); err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}

		return nil, fmt.Errorf("stat features directory: %w", err)
	}

	documents := []indexedDocument{}
	err := filepath.WalkDir(featuresPath, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if entry.IsDir() || filepath.Ext(path) != ".md" {
			return nil
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read markdown document %s: %w", path, err)
		}

		document, err := markdown.ParseDocument(data)
		if err != nil {
			return fmt.Errorf("parse markdown document %s: %w", path, err)
		}

		relativePath, err := filepath.Rel(flowPath, path)
		if err != nil {
			return fmt.Errorf("resolve relative document path %s: %w", path, err)
		}

		featureSlug, err := featureSlugFromRelativePath(relativePath, document.Kind())
		if err != nil {
			return err
		}

		documents = append(documents, indexedDocument{
			relativePath: filepath.ToSlash(relativePath),
			featureSlug:  featureSlug,
			document:     document,
		})

		return nil
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

	return documents, nil
}

func featureSlugFromRelativePath(relativePath string, documentType markdown.DocumentType) (string, error) {
	parts := strings.Split(filepath.ToSlash(relativePath), "/")
	if len(parts) != 4 || parts[0] != "features" {
		return "", fmt.Errorf("document path %q is not in canonical features/<slug>/<type>/<file>.md layout", relativePath)
	}

	expectedDirectory, err := directoryNameForType(documentType)
	if err != nil {
		return "", err
	}

	if parts[2] != expectedDirectory {
		return "", fmt.Errorf("document path %q does not match type %q", relativePath, documentType)
	}

	return parts[1], nil
}

func directoryNameForType(documentType markdown.DocumentType) (string, error) {
	switch documentType {
	case markdown.NoteType:
		return "notes", nil
	case markdown.TaskType:
		return "tasks", nil
	case markdown.CommandType:
		return "commands", nil
	default:
		return "", fmt.Errorf("unsupported document type %q", documentType)
	}
}

func insertDocument(transaction *sql.Tx, indexed indexedDocument, documentKindsByID map[string]markdown.DocumentType) error {
	switch document := indexed.document.(type) {
	case markdown.NoteDocument:
		return insertNoteDocument(transaction, indexed.relativePath, indexed.featureSlug, document, documentKindsByID)
	case markdown.TaskDocument:
		return insertTaskDocument(transaction, indexed.relativePath, indexed.featureSlug, document)
	case markdown.CommandDocument:
		return insertCommandDocument(transaction, indexed.relativePath, indexed.featureSlug, document)
	default:
		return fmt.Errorf("unsupported parsed document type %T", indexed.document)
	}
}

func insertNoteDocument(transaction *sql.Tx, relativePath string, featureSlug string, document markdown.NoteDocument, documentKindsByID map[string]markdown.DocumentType) error {
	if err := insertDocumentRow(transaction, document.Metadata.CommonFields, featureSlug, relativePath, document.Body, "", "", ""); err != nil {
		return err
	}

	for _, referenceID := range document.Metadata.References {
		if documentKindsByID[referenceID] == markdown.NoteType {
			if err := insertNoteLink(transaction, document.Metadata.ID, referenceID); err != nil {
				return err
			}

			continue
		}

		if err := insertReference(transaction, document.Metadata.ID, referenceID); err != nil {
			return err
		}
	}

	return nil
}

func insertTaskDocument(transaction *sql.Tx, relativePath string, featureSlug string, document markdown.TaskDocument) error {
	if err := insertDocumentRow(transaction, document.Metadata.CommonFields, featureSlug, relativePath, document.Body, document.Metadata.Status, "", ""); err != nil {
		return err
	}

	if err := insertDependencies(transaction, document.Metadata.ID, document.Metadata.DependsOn); err != nil {
		return err
	}

	return insertReferences(transaction, document.Metadata.ID, document.Metadata.References)
}

func insertCommandDocument(transaction *sql.Tx, relativePath string, featureSlug string, document markdown.CommandDocument) error {
	if err := insertDocumentRow(transaction, document.Metadata.CommonFields, featureSlug, relativePath, document.Body, "", document.Metadata.Name, document.Metadata.Run); err != nil {
		return err
	}

	if err := insertDependencies(transaction, document.Metadata.ID, document.Metadata.DependsOn); err != nil {
		return err
	}

	if err := insertReferences(transaction, document.Metadata.ID, document.Metadata.References); err != nil {
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
		`INSERT INTO documents (id, type, feature_slug, graph, title, path, body_text, tags_json, created_at, updated_at, task_status, command_name, command_run)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		fields.ID,
		string(fields.Type),
		featureSlug,
		fields.Graph,
		fields.Title,
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

func insertDependencies(transaction *sql.Tx, documentID string, dependencyIDs []string) error {
	for _, dependencyID := range dependencyIDs {
		if _, err := transaction.Exec(
			`INSERT INTO hard_dependencies (document_id, depends_on_id) VALUES (?, ?)`,
			documentID,
			dependencyID,
		); err != nil {
			return fmt.Errorf("insert dependency for %q: %w", documentID, err)
		}
	}

	return nil
}

func insertReferences(transaction *sql.Tx, documentID string, referenceIDs []string) error {
	for _, referenceID := range referenceIDs {
		if err := insertReference(transaction, documentID, referenceID); err != nil {
			return err
		}
	}

	return nil
}

func insertReference(transaction *sql.Tx, documentID string, referenceID string) error {
	if _, err := transaction.Exec(
		`INSERT INTO soft_references (document_id, reference_id) VALUES (?, ?)`,
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
