package workspace

import (
	"github.com/lex/flow/internal/core"
	"github.com/lex/flow/internal/markdown"
)

// CreateDocumentFromCoreRequest keeps the canonical mapping from shared core
// create requests to workspace mutations in one place so transports do not
// duplicate field-by-field adapters.
func CreateDocumentFromCoreRequest(root Root, request core.CreateDocumentRequest) (markdown.WorkspaceDocument, error) {
	return CreateDocument(root, CreateDocumentInput{
		Type:        request.Type,
		FeatureSlug: request.FeatureSlug,
		FileName:    request.FileName,
		ID:          request.ID,
		Graph:       request.Graph,
		Title:       request.Title,
		Description: request.Description,
		Tags:        request.Tags,
		CreatedAt:   request.CreatedAt,
		UpdatedAt:   request.UpdatedAt,
		Body:        request.Body,
		Status:      request.Status,
		Links:       request.Links,
		Name:        request.Name,
		Env:         request.Env,
		Run:         request.Run,
	})
}

// UpdateDocumentByIDFromCorePatch keeps the canonical mapping from shared core
// update patches to workspace mutations in one place so transports can reuse
// the same update semantics.
func UpdateDocumentByIDFromCorePatch(root Root, documentID string, patch core.UpdateDocumentPatch) (markdown.WorkspaceDocument, error) {
	return UpdateDocumentByID(root, documentID, documentPatchFromCorePatch(patch))
}

// UpdateDocumentByPathFromCorePatch lets path-based transports reuse the same
// canonical patch mapping as id-based mutations.
func UpdateDocumentByPathFromCorePatch(root Root, pathValue string, patch core.UpdateDocumentPatch) (markdown.WorkspaceDocument, error) {
	return UpdateDocumentByPath(root, pathValue, documentPatchFromCorePatch(patch))
}

func documentPatchFromCorePatch(patch core.UpdateDocumentPatch) DocumentPatch {
	return DocumentPatch{
		ID:          patch.ID,
		Graph:       patch.Graph,
		FileName:    patch.FileName,
		Title:       patch.Title,
		Description: patch.Description,
		Tags:        patch.Tags,
		CreatedAt:   patch.CreatedAt,
		UpdatedAt:   patch.UpdatedAt,
		Body:        patch.Body,
		Status:      patch.Status,
		Links:       patch.Links,
		Name:        patch.Name,
		Env:         patch.Env,
		Run:         patch.Run,
	}
}
