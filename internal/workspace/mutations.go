package workspace

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/lex/flow/internal/index"
	"github.com/lex/flow/internal/markdown"
)

// InvalidMutationError reports user-facing mutation input or validation failures.
type InvalidMutationError struct {
	Err error
}

func (errorValue InvalidMutationError) Error() string {
	return errorValue.Err.Error()
}

func (errorValue InvalidMutationError) Unwrap() error {
	return errorValue.Err
}

// DocumentNotFoundError reports a missing document selected by path or id.
type DocumentNotFoundError struct {
	Selector string
}

func (errorValue DocumentNotFoundError) Error() string {
	return fmt.Sprintf("document %q not found", errorValue.Selector)
}

// CreateDocumentInput describes one create operation against canonical Markdown files.
type CreateDocumentInput struct {
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
	DependsOn   []string
	References  []markdown.NodeReference
	Name        string
	Env         map[string]string
	Run         string
}

// DocumentPatch describes field updates for one existing Markdown document.
type DocumentPatch struct {
	ID          *string
	Graph       *string
	Title       *string
	Description *string
	Tags        *[]string
	CreatedAt   *string
	UpdatedAt   *string
	Body        *string
	Status      *string
	DependsOn   *[]string
	References  *[]markdown.NodeReference
	Name        *string
	Env         *map[string]string
	Run         *string
}

// CreateGraphInput describes the inputs for creating a new graph directory.
type CreateGraphInput struct {
	// Name is the graph path relative to the content directory (e.g. "arch" or "projects/backend").
	Name string
}

// CreateGraph creates a new graph directory under the workspace content path.
func CreateGraph(root Root, input CreateGraphInput) error {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return InvalidMutationError{Err: errors.New("graph name is required")}
	}
	// Guard against path traversal
	cleaned := filepath.Clean(name)
	if strings.HasPrefix(cleaned, "..") {
		return InvalidMutationError{Err: errors.New("graph name is invalid")}
	}
	graphDir := filepath.Join(root.GraphsPath, filepath.FromSlash(cleaned))
	if err := os.MkdirAll(graphDir, 0o755); err != nil {
		return fmt.Errorf("create graph directory: %w", err)
	}
	return nil
}

// DeleteGraph removes a graph directory and all its contents, then rebuilds the index.
func DeleteGraph(root Root, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return InvalidMutationError{Err: errors.New("graph name is required")}
	}
	cleaned := filepath.Clean(name)
	if strings.HasPrefix(cleaned, "..") {
		return InvalidMutationError{Err: errors.New("graph name is invalid")}
	}
	graphDir := filepath.Join(root.GraphsPath, filepath.FromSlash(cleaned))
	if _, err := os.Stat(graphDir); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return DocumentNotFoundError{Selector: name}
		}
		return fmt.Errorf("stat graph directory: %w", err)
	}
	if err := os.RemoveAll(graphDir); err != nil {
		return fmt.Errorf("delete graph directory: %w", err)
	}
	if err := rebuildIndex(root); err != nil {
		return err
	}
	return nil
}

// CreateDocument writes a new canonical Markdown document and rebuilds the index.
func CreateDocument(root Root, input CreateDocumentInput) (markdown.WorkspaceDocument, error) {
	relativePath, document, err := buildCreateWorkspaceDocument(input)
	if err != nil {
		return markdown.WorkspaceDocument{}, err
	}
	document = normalizeDocumentGraphForPath(relativePath, document)

	absolutePath := filepath.Join(root.FlowPath, filepath.FromSlash(relativePath))
	if err := validateWorkspaceMutation(root.FlowPath, "", relativePath, document, false); err != nil {
		return markdown.WorkspaceDocument{}, err
	}

	if err := writeDocumentFile(absolutePath, document, true); err != nil {
		return markdown.WorkspaceDocument{}, err
	}

	if err := rebuildIndex(root); err != nil {
		return markdown.WorkspaceDocument{}, err
	}

	return markdown.WorkspaceDocument{Path: relativePath, Document: document}, nil
}

// UpdateDocumentByPath updates an existing document selected by canonical relative path.
func UpdateDocumentByPath(root Root, pathValue string, patch DocumentPatch) (markdown.WorkspaceDocument, error) {
	absolutePath, relativePath, err := resolveDocumentFilePath(root.FlowPath, pathValue)
	if err != nil {
		return markdown.WorkspaceDocument{}, err
	}

	document, err := readDocumentFile(absolutePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return markdown.WorkspaceDocument{}, DocumentNotFoundError{Selector: pathValue}
		}
		return markdown.WorkspaceDocument{}, err
	}

	updatedDocument, err := applyDocumentPatch(document, patch)
	if err != nil {
		return markdown.WorkspaceDocument{}, err
	}

	targetRelativePath, err := targetDocumentPath(relativePath, updatedDocument)
	if err != nil {
		return markdown.WorkspaceDocument{}, err
	}
	updatedDocument = normalizeDocumentGraphForPath(targetRelativePath, updatedDocument)
	targetAbsolutePath := filepath.Join(root.FlowPath, filepath.FromSlash(targetRelativePath))

	if err := validateWorkspaceMutation(root.FlowPath, relativePath, targetRelativePath, updatedDocument, false); err != nil {
		return markdown.WorkspaceDocument{}, err
	}

	failIfExists := targetRelativePath != relativePath
	if err := writeDocumentFile(targetAbsolutePath, updatedDocument, failIfExists); err != nil {
		return markdown.WorkspaceDocument{}, err
	}
	if targetRelativePath != relativePath {
		if err := os.Remove(absolutePath); err != nil {
			return markdown.WorkspaceDocument{}, fmt.Errorf("delete previous document path: %w", err)
		}
	}

	if err := rebuildIndex(root); err != nil {
		return markdown.WorkspaceDocument{}, err
	}

	return markdown.WorkspaceDocument{Path: targetRelativePath, Document: updatedDocument}, nil
}

// UpdateDocumentByID updates an existing document selected by document ID.
func UpdateDocumentByID(root Root, documentID string, patch DocumentPatch) (markdown.WorkspaceDocument, error) {
	workspaceDocument, err := findDocumentByID(root.FlowPath, documentID)
	if err != nil {
		return markdown.WorkspaceDocument{}, err
	}

	return UpdateDocumentByPath(root, workspaceDocument.Path, patch)
}

// DeleteDocumentByPath deletes an existing document selected by canonical relative path.
func DeleteDocumentByPath(root Root, pathValue string) (string, error) {
	absolutePath, relativePath, err := resolveDocumentFilePath(root.FlowPath, pathValue)
	if err != nil {
		return "", err
	}

	if _, err := os.Stat(absolutePath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", DocumentNotFoundError{Selector: pathValue}
		}
		return "", fmt.Errorf("stat document path: %w", err)
	}

	workspaceDocuments, err := LoadDocuments(root.FlowPath)
	if err != nil {
		return "", err
	}

	targetDocument, ok := findWorkspaceDocumentByPath(workspaceDocuments, relativePath)
	if !ok {
		return "", DocumentNotFoundError{Selector: pathValue}
	}

	cleanupWrites := map[string]markdown.Document{}
	deletionTargets, err := prepareDeletionDocuments(relativePath, targetDocument.Document, workspaceDocuments)
	if err != nil {
		return "", err
	}
	for _, item := range deletionTargets {
		if item.Path == relativePath {
			continue
		}

		cleanupWrites[item.Path] = item.Document
	}

	for cleanupPath, document := range cleanupWrites {
		absoluteCleanupPath := filepath.Join(root.FlowPath, filepath.FromSlash(cleanupPath))
		if err := writeDocumentFile(absoluteCleanupPath, document, false); err != nil {
			return "", err
		}
	}

	if err := os.Remove(absolutePath); err != nil {
		return "", fmt.Errorf("delete document: %w", err)
	}

	if err := rebuildIndex(root); err != nil {
		return "", err
	}

	return relativePath, nil
}

// DeleteDocumentByID deletes an existing document selected by document ID.
func DeleteDocumentByID(root Root, documentID string) (string, error) {
	workspaceDocument, err := findDocumentByID(root.FlowPath, documentID)
	if err != nil {
		return "", err
	}

	return DeleteDocumentByPath(root, workspaceDocument.Path)
}

// documentBody extracts the body text from a parsed Document via type switch.
func documentBody(doc markdown.Document) string {
	switch d := doc.(type) {
	case markdown.NoteDocument:
		return d.Body
	case markdown.TaskDocument:
		return d.Body
	case markdown.CommandDocument:
		return d.Body
	case markdown.HomeDocument:
		return d.Body
	default:
		return ""
	}
}

// MergeDocumentsInput describes a merge of multiple documents into the first.
type MergeDocumentsInput struct {
	// DocumentIDs is the ordered list of document IDs to merge.
	// The first ID is the merge target; remaining documents are appended then deleted.
	DocumentIDs []string
}

// MergeDocuments merges the body of each document (in order) into the first document, then deletes the rest.
func MergeDocuments(root Root, input MergeDocumentsInput) (markdown.WorkspaceDocument, error) {
	if len(input.DocumentIDs) < 2 {
		return markdown.WorkspaceDocument{}, InvalidMutationError{Err: errors.New("merge requires at least 2 document IDs")}
	}

	// Resolve each document by ID.
	docs := make([]markdown.WorkspaceDocument, 0, len(input.DocumentIDs))
	for _, id := range input.DocumentIDs {
		doc, err := findDocumentByID(root.FlowPath, id)
		if err != nil {
			return markdown.WorkspaceDocument{}, err
		}
		docs = append(docs, doc)
	}

	// Build merged body: target body + separator + bodies of the rest.
	targetBody := documentBody(docs[0].Document)
	for _, doc := range docs[1:] {
		appendBody := documentBody(doc.Document)
		if appendBody == "" {
			continue
		}
		if targetBody != "" {
			targetBody += "\n\n---\n\n"
		}
		targetBody += appendBody
	}

	// Update the first document with the merged body.
	merged, err := UpdateDocumentByPath(root, docs[0].Path, DocumentPatch{Body: &targetBody})
	if err != nil {
		return markdown.WorkspaceDocument{}, err
	}

	// Delete the rest. Skip index rebuild on each; do a single rebuild after all deletions.
	for _, doc := range docs[1:] {
		absolutePath := filepath.Join(root.FlowPath, filepath.FromSlash(doc.Path))
		if err := os.Remove(absolutePath); err != nil && !errors.Is(err, os.ErrNotExist) {
			return markdown.WorkspaceDocument{}, fmt.Errorf("delete merged document: %w", err)
		}
	}

	if err := rebuildIndex(root); err != nil {
		return markdown.WorkspaceDocument{}, err
	}

	return merged, nil
}

// documentReferences returns a copy of the references list for any document type.
func documentReferences(doc markdown.Document) []markdown.NodeReference {
	switch d := doc.(type) {
	case markdown.NoteDocument:
		return cloneReferences(d.Metadata.References)
	case markdown.TaskDocument:
		return cloneReferences(d.Metadata.References)
	case markdown.CommandDocument:
		return cloneReferences(d.Metadata.References)
	default:
		return nil
	}
}

// AddReference appends a NodeReference{Node: toID, Context: context} to the source
// document's references list. It is a no-op when the reference already exists.
func AddReference(root Root, fromID, toID, context string) error {
	fromID = strings.TrimSpace(fromID)
	toID = strings.TrimSpace(toID)
	if fromID == "" || toID == "" {
		return InvalidMutationError{Err: errors.New("reference source and target IDs are required")}
	}
	if fromID == toID {
		return InvalidMutationError{Err: errors.New("reference source and target must be different documents")}
	}

	if _, err := findDocumentByID(root.FlowPath, toID); err != nil {
		return err
	}

	sourceDoc, err := findDocumentByID(root.FlowPath, fromID)
	if err != nil {
		return err
	}

	currentRefs := documentReferences(sourceDoc.Document)
	for _, ref := range currentRefs {
		if ref.Node == toID {
			return nil // already exists
		}
	}

	newRefs := append(currentRefs, markdown.NodeReference{Node: toID, Context: strings.TrimSpace(context)})
	_, err = UpdateDocumentByPath(root, sourceDoc.Path, DocumentPatch{References: &newRefs})
	return err
}

// RemoveReference removes the reference to toID from the source document's references
// list. It is a no-op when the reference does not exist.
func RemoveReference(root Root, fromID, toID string) error {
	fromID = strings.TrimSpace(fromID)
	toID = strings.TrimSpace(toID)
	if fromID == "" || toID == "" {
		return InvalidMutationError{Err: errors.New("reference source and target IDs are required")}
	}

	sourceDoc, err := findDocumentByID(root.FlowPath, fromID)
	if err != nil {
		return err
	}

	currentRefs := documentReferences(sourceDoc.Document)
	newRefs := removeNodeReference(currentRefs, toID)
	if len(newRefs) == len(currentRefs) {
		return nil // nothing to remove
	}

	_, err = UpdateDocumentByPath(root, sourceDoc.Path, DocumentPatch{References: &newRefs})
	return err
}

// UpdateReferenceContext sets the context annotation on an existing reference
// from fromID to toID. An error is returned when the reference does not exist.
func UpdateReferenceContext(root Root, fromID, toID, context string) error {
	fromID = strings.TrimSpace(fromID)
	toID = strings.TrimSpace(toID)
	if fromID == "" || toID == "" {
		return InvalidMutationError{Err: errors.New("reference source and target IDs are required")}
	}

	sourceDoc, err := findDocumentByID(root.FlowPath, fromID)
	if err != nil {
		return err
	}

	currentRefs := documentReferences(sourceDoc.Document)
	found := false
	newRefs := make([]markdown.NodeReference, len(currentRefs))
	for i, ref := range currentRefs {
		if ref.Node == toID {
			newRefs[i] = markdown.NodeReference{Node: ref.Node, Context: strings.TrimSpace(context)}
			found = true
		} else {
			newRefs[i] = ref
		}
	}
	if !found {
		return InvalidMutationError{Err: fmt.Errorf("reference from %q to %q not found", fromID, toID)}
	}

	_, err = UpdateDocumentByPath(root, sourceDoc.Path, DocumentPatch{References: &newRefs})
	return err
}

func buildCreateWorkspaceDocument(input CreateDocumentInput) (string, markdown.Document, error) {
	if input.Type != markdown.NoteType && input.Type != markdown.TaskType && input.Type != markdown.CommandType {
		return "", nil, InvalidMutationError{Err: fmt.Errorf("unsupported document type %q", input.Type)}
	}

	if input.FileName == "" || input.ID == "" || input.Graph == "" {
		return "", nil, InvalidMutationError{Err: fmt.Errorf("document create requires fileName, id, and graph")}
	}

	if input.Type == markdown.CommandType && (input.Name == "" || input.Run == "") {
		return "", nil, InvalidMutationError{Err: fmt.Errorf("command document create requires name and run")}
	}

	relativePath, err := markdown.RelativeGraphDocumentPath(input.Graph, ensureMarkdownFileName(input.FileName))
	if err != nil {
		return "", nil, InvalidMutationError{Err: err}
	}

	document := buildCreateDocument(input)
	return filepath.ToSlash(relativePath), document, nil
}

func buildCreateDocument(input CreateDocumentInput) markdown.Document {
	common := markdown.CommonFields{
		ID:          input.ID,
		Type:        input.Type,
		Graph:       input.Graph,
		Title:       input.Title,
		Description: input.Description,
		Tags:        cloneStrings(input.Tags),
		CreatedAt:   input.CreatedAt,
		UpdatedAt:   input.UpdatedAt,
	}

	switch input.Type {
	case markdown.NoteType:
		return markdown.NoteDocument{
			Metadata: markdown.NoteMetadata{
				CommonFields: common,
				References:   cloneReferences(input.References),
			},
			Body: input.Body,
		}
	case markdown.TaskType:
		return markdown.TaskDocument{
			Metadata: markdown.TaskMetadata{
				CommonFields: common,
				Status:       input.Status,
				DependsOn:    cloneStrings(input.DependsOn),
				References:   cloneReferences(input.References),
			},
			Body: input.Body,
		}
	default:
		return markdown.CommandDocument{
			Metadata: markdown.CommandMetadata{
				CommonFields: common,
				Name:         input.Name,
				DependsOn:    cloneStrings(input.DependsOn),
				References:   cloneReferences(input.References),
				Env:          cloneMap(input.Env),
				Run:          input.Run,
			},
			Body: input.Body,
		}
	}
}

func applyDocumentPatch(document markdown.Document, patch DocumentPatch) (markdown.Document, error) {
	if patch.isEmpty() {
		return nil, InvalidMutationError{Err: fmt.Errorf("document update requires at least one field to change")}
	}

	switch value := document.(type) {
	case markdown.NoteDocument:
		patchCommonFields(&value.Metadata.CommonFields, patch)
		if patch.References != nil {
			value.Metadata.References = cloneReferences(*patch.References)
		}
		if patch.Body != nil {
			value.Body = *patch.Body
		}
		return value, nil
	case markdown.TaskDocument:
		patchCommonFields(&value.Metadata.CommonFields, patch)
		if patch.Status != nil {
			value.Metadata.Status = *patch.Status
		}
		if patch.DependsOn != nil {
			value.Metadata.DependsOn = cloneStrings(*patch.DependsOn)
		}
		if patch.References != nil {
			value.Metadata.References = cloneReferences(*patch.References)
		}
		if patch.Body != nil {
			value.Body = *patch.Body
		}
		return value, nil
	case markdown.CommandDocument:
		patchCommonFields(&value.Metadata.CommonFields, patch)
		if patch.Name != nil {
			value.Metadata.Name = *patch.Name
		}
		if patch.DependsOn != nil {
			value.Metadata.DependsOn = cloneStrings(*patch.DependsOn)
		}
		if patch.References != nil {
			value.Metadata.References = cloneReferences(*patch.References)
		}
		if patch.Env != nil {
			value.Metadata.Env = cloneMap(*patch.Env)
		}
		if patch.Run != nil {
			value.Metadata.Run = *patch.Run
		}
		if patch.Body != nil {
			value.Body = *patch.Body
		}
		return value, nil
	default:
		return nil, InvalidMutationError{Err: fmt.Errorf("unsupported document type %T", document)}
	}
}

func (patch DocumentPatch) isEmpty() bool {
	return patch.ID == nil && patch.Graph == nil && patch.Title == nil && patch.Description == nil && patch.Tags == nil && patch.CreatedAt == nil && patch.UpdatedAt == nil && patch.Body == nil && patch.Status == nil && patch.DependsOn == nil && patch.References == nil && patch.Name == nil && patch.Env == nil && patch.Run == nil
}

func patchCommonFields(fields *markdown.CommonFields, patch DocumentPatch) {
	if patch.ID != nil {
		fields.ID = *patch.ID
	}
	if patch.Graph != nil {
		fields.Graph = *patch.Graph
	}
	if patch.Title != nil {
		fields.Title = *patch.Title
	}
	if patch.Description != nil {
		fields.Description = *patch.Description
	}
	if patch.CreatedAt != nil {
		fields.CreatedAt = *patch.CreatedAt
	}
	if patch.UpdatedAt != nil {
		fields.UpdatedAt = *patch.UpdatedAt
	}
	if patch.Tags != nil {
		fields.Tags = cloneStrings(*patch.Tags)
	}
}

func resolveDocumentFilePath(flowPath string, pathValue string) (string, string, error) {
	cleaned := filepath.Clean(pathValue)
	flowPrefix := DirName + string(os.PathSeparator)
	if cleaned == DirName {
		return "", "", InvalidMutationError{Err: fmt.Errorf("document path must point to a Markdown file inside %s", DirName)}
	}
	cleaned = strings.TrimPrefix(cleaned, flowPrefix)

	absolutePath := cleaned
	if !filepath.IsAbs(absolutePath) {
		absolutePath = filepath.Join(flowPath, cleaned)
	}

	absolutePath, err := filepath.Abs(absolutePath)
	if err != nil {
		return "", "", fmt.Errorf("resolve document path: %w", err)
	}

	flowRoot, err := filepath.Abs(flowPath)
	if err != nil {
		return "", "", fmt.Errorf("resolve workspace flow path: %w", err)
	}

	relativePath, err := filepath.Rel(flowRoot, absolutePath)
	if err != nil {
		return "", "", fmt.Errorf("resolve relative document path: %w", err)
	}

	if relativePath == "." || relativePath == ".." || strings.HasPrefix(relativePath, ".."+string(os.PathSeparator)) {
		return "", "", InvalidMutationError{Err: fmt.Errorf("document path must stay inside %s", DirName)}
	}

	return absolutePath, filepath.ToSlash(relativePath), nil
}

func readDocumentFile(path string) (markdown.Document, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read document: %w", err)
	}

	document, err := markdown.ParseDocument(data)
	if err != nil {
		return nil, fmt.Errorf("parse document: %w", err)
	}

	return document, nil
}

func writeDocumentFile(path string, document markdown.Document, failIfExists bool) error {
	if failIfExists {
		if _, err := os.Stat(path); err == nil {
			return InvalidMutationError{Err: fmt.Errorf("document already exists at %s", path)}
		} else if !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("stat document path: %w", err)
		}
	}

	data, err := markdown.SerializeDocument(document)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create document directory: %w", err)
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write document: %w", err)
	}

	return nil
}

func validateWorkspaceMutation(flowPath string, currentRelativePath string, targetRelativePath string, document markdown.Document, deleting bool) error {
	workspaceDocuments, err := LoadDocuments(flowPath)
	if err != nil {
		return err
	}

	return validateWorkspaceMutationDocuments(currentRelativePath, targetRelativePath, document, deleting, workspaceDocuments)
}

func validateWorkspaceMutationDocuments(currentRelativePath string, targetRelativePath string, document markdown.Document, deleting bool, workspaceDocuments []markdown.WorkspaceDocument) error {

	targets := make([]markdown.WorkspaceDocument, 0, len(workspaceDocuments)+1)
	replaced := false
	for _, item := range workspaceDocuments {
		if item.Path != currentRelativePath {
			targets = append(targets, item)
			continue
		}

		replaced = true
		if !deleting {
			targets = append(targets, markdown.WorkspaceDocument{Path: targetRelativePath, Document: document})
		}
	}

	if !deleting && !replaced {
		targets = append(targets, markdown.WorkspaceDocument{Path: targetRelativePath, Document: document})
	}

	if err := markdown.ValidateWorkspaceDocuments(targets); err != nil {
		return InvalidMutationError{Err: fmt.Errorf("validate workspace documents: %w", err)}
	}

	return nil
}

// documentIDForCleanup extracts the canonical ID from any supported document type.
// Returns an empty string for unsupported types so callers can skip cleanup safely.
func documentIDForCleanup(document markdown.Document) string {
	switch d := document.(type) {
	case markdown.NoteDocument:
		return d.Metadata.ID
	case markdown.TaskDocument:
		return d.Metadata.ID
	case markdown.CommandDocument:
		return d.Metadata.ID
	default:
		return ""
	}
}

func prepareDeletionDocuments(relativePath string, document markdown.Document, workspaceDocuments []markdown.WorkspaceDocument) ([]markdown.WorkspaceDocument, error) {
	targets := make([]markdown.WorkspaceDocument, 0, len(workspaceDocuments))

	deletedID := documentIDForCleanup(document)

	for _, item := range workspaceDocuments {
		if item.Path == relativePath {
			continue
		}
		if deletedID != "" {
			item = removeReferenceFromWorkspaceDocument(item, deletedID)
			item = removeDependsOnFromWorkspaceDocument(item, deletedID)
		}
		targets = append(targets, item)
	}

	if err := markdown.ValidateWorkspaceDocuments(targets); err != nil {
		return nil, InvalidMutationError{Err: fmt.Errorf("validate workspace documents: %w", err)}
	}

	return targets, nil
}

func removeDependsOnFromWorkspaceDocument(item markdown.WorkspaceDocument, dependencyID string) markdown.WorkspaceDocument {
	switch document := item.Document.(type) {
	case markdown.TaskDocument:
		document.Metadata.DependsOn = removeString(document.Metadata.DependsOn, dependencyID)
		return markdown.WorkspaceDocument{Path: item.Path, Document: document}
	case markdown.CommandDocument:
		document.Metadata.DependsOn = removeString(document.Metadata.DependsOn, dependencyID)
		return markdown.WorkspaceDocument{Path: item.Path, Document: document}
	default:
		return item
	}
}

func removeReferenceFromWorkspaceDocument(item markdown.WorkspaceDocument, referenceID string) markdown.WorkspaceDocument {
	switch document := item.Document.(type) {
	case markdown.NoteDocument:
		document.Metadata.References = removeNodeReference(document.Metadata.References, referenceID)
		return markdown.WorkspaceDocument{Path: item.Path, Document: document}
	case markdown.TaskDocument:
		document.Metadata.References = removeNodeReference(document.Metadata.References, referenceID)
		return markdown.WorkspaceDocument{Path: item.Path, Document: document}
	case markdown.CommandDocument:
		document.Metadata.References = removeNodeReference(document.Metadata.References, referenceID)
		return markdown.WorkspaceDocument{Path: item.Path, Document: document}
	default:
		return item
	}
}

func removeString(values []string, target string) []string {
	if len(values) == 0 {
		return nil
	}

	filtered := make([]string, 0, len(values))
	for _, value := range values {
		if value != target {
			filtered = append(filtered, value)
		}
	}

	if len(filtered) == 0 {
		return nil
	}

	return filtered
}

func findWorkspaceDocumentByPath(documents []markdown.WorkspaceDocument, relativePath string) (markdown.WorkspaceDocument, bool) {
	for _, item := range documents {
		if item.Path == relativePath {
			return item, true
		}
	}

	return markdown.WorkspaceDocument{}, false
}

func findDocumentByID(flowPath string, documentID string) (markdown.WorkspaceDocument, error) {
	trimmedID := strings.TrimSpace(documentID)
	if trimmedID == "" {
		return markdown.WorkspaceDocument{}, InvalidMutationError{Err: fmt.Errorf("document id must not be empty")}
	}

	workspaceDocuments, err := LoadDocuments(flowPath)
	if err != nil {
		return markdown.WorkspaceDocument{}, err
	}

	for _, item := range workspaceDocuments {
		if documentIDFor(item.Document) == trimmedID {
			return item, nil
		}
	}

	return markdown.WorkspaceDocument{}, DocumentNotFoundError{Selector: trimmedID}
}

func documentIDFor(document markdown.Document) string {
	switch value := document.(type) {
	case markdown.NoteDocument:
		return value.Metadata.ID
	case markdown.TaskDocument:
		return value.Metadata.ID
	case markdown.CommandDocument:
		return value.Metadata.ID
	default:
		return ""
	}
}

func ensureMarkdownFileName(value string) string {
	if strings.HasSuffix(value, ".md") {
		return value
	}

	return value + ".md"
}

func rebuildIndex(root Root) error {
	if err := os.MkdirAll(root.FlowPath, 0o755); err != nil {
		return fmt.Errorf("create workspace metadata directory: %w", err)
	}

	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		return err
	}

	return nil
}

func targetDocumentPath(currentRelativePath string, document markdown.Document) (string, error) {
	graphPath := documentGraph(document)
	fileName := filepath.Base(filepath.FromSlash(currentRelativePath))
	if fileName == "." || fileName == string(filepath.Separator) || fileName == "" {
		return "", InvalidMutationError{Err: fmt.Errorf("document path must point to a Markdown file inside %s", DirName)}
	}

	relativePath, err := markdown.RelativeGraphDocumentPath(graphPath, fileName)
	if err != nil {
		return "", InvalidMutationError{Err: err}
	}

	return filepath.ToSlash(relativePath), nil
}

func normalizeDocumentGraphForPath(relativePath string, document markdown.Document) markdown.Document {
	normalized, err := markdown.NormalizeWorkspaceDocument(markdown.WorkspaceDocument{Path: relativePath, Document: document})
	if err != nil {
		return document
	}

	return normalized.Document
}

func documentGraph(document markdown.Document) string {
	switch value := document.(type) {
	case markdown.NoteDocument:
		return value.Metadata.Graph
	case markdown.TaskDocument:
		return value.Metadata.Graph
	case markdown.CommandDocument:
		return value.Metadata.Graph
	default:
		return ""
	}
}

func cloneReferences(values []markdown.NodeReference) []markdown.NodeReference {
	if len(values) == 0 {
		return nil
	}
	cloned := make([]markdown.NodeReference, len(values))
	copy(cloned, values)
	return cloned
}

func removeNodeReference(values []markdown.NodeReference, nodeID string) []markdown.NodeReference {
	if len(values) == 0 {
		return nil
	}
	filtered := make([]markdown.NodeReference, 0, len(values))
	for _, ref := range values {
		if ref.Node != nodeID {
			filtered = append(filtered, ref)
		}
	}
	if len(filtered) == 0 {
		return nil
	}
	return filtered
}

func cloneStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	cloned := make([]string, len(values))
	copy(cloned, values)
	return cloned
}

func cloneMap(values map[string]string) map[string]string {
	if len(values) == 0 {
		return nil
	}

	cloned := make(map[string]string, len(values))
	for key, value := range values {
		cloned[key] = value
	}

	return cloned
}
