package core

import (
	"errors"

	"github.com/lex/flow/internal/markdown"
)

// DocumentCreator writes one canonical Markdown document and returns the
// resulting workspace document metadata.
type DocumentCreator func(request CreateDocumentRequest) (markdown.WorkspaceDocument, error)

// DocumentUpdater updates one canonical Markdown document selected by ID and
// returns the resulting workspace document metadata.
type DocumentUpdater func(documentID string, patch UpdateDocumentPatch) (markdown.WorkspaceDocument, error)

// CreateDocumentRequest describes the canonical fields required to create one
// document in workspace storage.
type CreateDocumentRequest struct {
	Type        markdown.DocumentType
	FeatureSlug string
	FileName    string
	ID          string
	Graph       string
	Title       string
	Description string
	Tags        []string
	CreatedAt   string
	UpdatedAt   string
	Body        string
	Status      string
	Links       []markdown.NodeLink
	Name        string
	Env         map[string]string
	Run         string
}

// UpdateDocumentPatch describes the mutable document fields that can be
// applied to an existing workspace document.
type UpdateDocumentPatch struct {
	ID          *string
	Graph       *string
	FileName    *string
	Title       *string
	Description *string
	Tags        *[]string
	CreatedAt   *string
	UpdatedAt   *string
	Body        *string
	Status      *string
	Links       *[]markdown.NodeLink
	Name        *string
	Env         *map[string]string
	Run         *string
	// Color is a pointer so that nil means "leave unchanged" and a non-nil pointer to an
	// empty string explicitly clears the per-node color override.
	Color *string
}

// DocumentDeleter deletes one document selected by transport-specific identity
// and returns the canonical relative path that was removed.
type DocumentDeleter func(documentID string) (string, error)

// DeleteDocumentRequest describes the input required to delete one document.
type DeleteDocumentRequest struct {
	DocumentID string
}

// UpdateDocumentRequest describes the input required to update one document by
// ID through shared core workflows.
type UpdateDocumentRequest struct {
	DocumentID string
	Patch      UpdateDocumentPatch
}

// CreateDocument creates one document through an injected canonical storage
// function so CLI, HTTP, and desktop surfaces can share the same workflow.
func CreateDocument(request CreateDocumentRequest, createDocument DocumentCreator) (markdown.WorkspaceDocument, error) {
	if createDocument == nil {
		return markdown.WorkspaceDocument{}, errors.New("document creator must not be nil")
	}

	return createDocument(request)
}

// UpdateDocument updates one document through an injected canonical storage
// function so transports share the same orchestration boundary.
func UpdateDocument(request UpdateDocumentRequest, updateDocument DocumentUpdater) (markdown.WorkspaceDocument, error) {
	if updateDocument == nil {
		return markdown.WorkspaceDocument{}, errors.New("document updater must not be nil")
	}

	return updateDocument(request.DocumentID, request.Patch)
}

// DeleteDocument deletes one document through an injected canonical storage
// function so transport adapters can share the workflow without importing each
// other.
func DeleteDocument(request DeleteDocumentRequest, deleteDocument DocumentDeleter) (string, error) {
	if deleteDocument == nil {
		return "", errors.New("document deleter must not be nil")
	}

	return deleteDocument(request.DocumentID)
}
