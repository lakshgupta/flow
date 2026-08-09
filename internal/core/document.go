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
// The JSON tags let the Wails Go-JS binding marshal the request object sent by
// the frontend with the same camelCase keys as the HTTP API payload.
type CreateDocumentRequest struct {
	Type        markdown.DocumentType `json:"type"`
	FeatureSlug string                `json:"featureSlug"`
	FileName    string                `json:"fileName"`
	ID          string                `json:"id"`
	Graph       string                `json:"graph"`
	Title       string                `json:"title"`
	Description string                `json:"description"`
	Tags        []string              `json:"tags"`
	CreatedAt   string                `json:"createdAt"`
	UpdatedAt   string                `json:"updatedAt"`
	Body        string                `json:"body"`
	Status      string                `json:"status"`
	Links       []markdown.NodeLink   `json:"links"`
	Name        string                `json:"name"`
	Env         map[string]string     `json:"env"`
	Run         string                `json:"run"`
}

// UpdateDocumentPatch describes the mutable document fields that can be
// applied to an existing workspace document.
// The JSON tags mirror the HTTP update payload keys so the Wails Go-JS binding
// accepts the same camelCase patch object as the REST API.
type UpdateDocumentPatch struct {
	ID          *string               `json:"id"`
	Graph       *string               `json:"graph"`
	FileName    *string               `json:"fileName"`
	Title       *string               `json:"title"`
	Description *string               `json:"description"`
	Tags        *[]string             `json:"tags"`
	CreatedAt   *string               `json:"createdAt"`
	UpdatedAt   *string               `json:"updatedAt"`
	Body        *string               `json:"body"`
	Status      *string               `json:"status"`
	Links       *[]markdown.NodeLink  `json:"links"`
	Name        *string               `json:"name"`
	Env         *map[string]string    `json:"env"`
	Run         *string               `json:"run"`
	// Color is a pointer so that nil means "leave unchanged" and a non-nil pointer to an
	// empty string explicitly clears the per-node color override.
	Color *string `json:"color"`
}

// DocumentDeleter deletes one document selected by transport-specific identity
// and returns the canonical relative path that was removed, plus the
// workspace-relative paths of any documents modified while stripping dangling
// [[...]] references (empty for plain deletes).
type DocumentDeleter func(documentID string) (string, []string, error)

// DeleteDocumentRequest describes the input required to delete one document.
type DeleteDocumentRequest struct {
	DocumentID string `json:"documentID"`
	// Force strips dangling [[...]] inline references from referencers before
	// deleting, instead of blocking when another document references the node.
	Force bool `json:"force"`
}

// UpdateDocumentRequest describes the input required to update one document by
// ID through shared core workflows.
type UpdateDocumentRequest struct {
	DocumentID string               `json:"documentID"`
	Patch      UpdateDocumentPatch `json:"patch"`
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
// other. It returns the deleted relative path and the paths of any documents
// modified while stripping dangling references.
func DeleteDocument(request DeleteDocumentRequest, deleteDocument DocumentDeleter) (string, []string, error) {
	if deleteDocument == nil {
		return "", nil, errors.New("document deleter must not be nil")
	}

	return deleteDocument(request.DocumentID)
}
