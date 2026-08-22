package markdown

import (
	"bytes"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

const frontmatterDelimiter = "---"

var inlineReferencePattern = regexp.MustCompile(`\[\[([^\[\]\n]+)\]\]`)
var escapedInlineReferencePattern = regexp.MustCompile(`\\\[\\\[([^\[\]\n]+)\\\]\\\]`)

// DocumentType identifies the canonical Flow document kinds.
type DocumentType string

const (
	HomeType    DocumentType = "home"
	NoteType    DocumentType = "note"
	TaskType    DocumentType = "task"
	CommandType DocumentType = "command"
)

// NodeLink is a stored link from one document to another, with optional context.
// The JSON tags mirror the HTTP node-reference payload shape so transport
// bindings (e.g. the Wails Go-JS bridge) decode links with the same camelCase
// keys the frontend sends.
type NodeLink struct {
	Node          string   `yaml:"node" json:"node"`
	Context       string   `yaml:"context,omitempty" json:"context,omitempty"`
	Relationships []string `yaml:"relationships,omitempty" json:"relationships,omitempty"`
}

// UnmarshalYAML implements custom decoding so that a plain scalar string (legacy format) is
// treated as NodeLink{Node: value}.
func (r *NodeLink) UnmarshalYAML(value *yaml.Node) error {
	if value.Kind == yaml.ScalarNode {
		r.Node = value.Value
		r.Context = ""
		r.Relationships = nil
		return nil
	}
	type plain NodeLink
	var p plain
	if err := value.Decode(&p); err != nil {
		return err
	}
	*r = NodeLink(p)
	r.Relationships = normalizeNodeLinkRelationships(r.Relationships)
	return nil
}

func normalizeNodeLinkRelationships(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))

	appendUnique := func(value string) {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return
		}
		key := strings.ToLower(trimmed)
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		result = append(result, trimmed)
	}

	for _, value := range values {
		appendUnique(value)
	}

	if len(result) == 0 {
		return nil
	}

	return result
}

// CommonFields contains the frontmatter shared by all document kinds.
type CommonFields struct {
	ID          string       `yaml:"id,omitempty"`
	Type        DocumentType `yaml:"type,omitempty"`
	Graph       string       `yaml:"graph,omitempty"`
	Title       string       `yaml:"title,omitempty"`
	Description string       `yaml:"description,omitempty"`
	Tags        []string     `yaml:"tags,omitempty"`
	CreatedAt   string       `yaml:"createdAt,omitempty"`
	UpdatedAt   string       `yaml:"updatedAt,omitempty"`
	// Color is an optional per-node color override (a GraphDirectoryColorId value such as "rose" or "sky").
	// When set, the node renders with this color on the canvas instead of inheriting the graph directory color.
	Color string `yaml:"color,omitempty"`
}

// NoteMetadata describes note frontmatter fields.
type NoteMetadata struct {
	CommonFields `yaml:",inline"`
	Links        []NodeLink `yaml:"links,omitempty"`
}

// TaskMetadata describes task frontmatter fields.
type TaskMetadata struct {
	CommonFields `yaml:",inline"`
	Status       string `yaml:"status,omitempty"`
	// Session records the agent/session that claimed this task while it is
	// Running. Empty for unclaimed tasks.
	Session string `yaml:"session,omitempty"`
	// SessionAt is the RFC3339 UTC timestamp of when the claim was taken.
	SessionAt string     `yaml:"session-at,omitempty"`
	Links     []NodeLink `yaml:"links,omitempty"`
}

// CommandMetadata describes command frontmatter fields.
type CommandMetadata struct {
	CommonFields `yaml:",inline"`
	Name         string            `yaml:"name,omitempty"`
	Links        []NodeLink        `yaml:"links,omitempty"`
	Env          map[string]string `yaml:"env,omitempty"`
	Run          string            `yaml:"run,omitempty"`
}

// HomeDocument is the parsed representation of the home Markdown file.
type HomeDocument struct {
	Metadata CommonFields
	Body     string
}

// NoteDocument is the parsed representation of a note Markdown file.
type NoteDocument struct {
	Metadata NoteMetadata
	Body     string
}

// TaskDocument is the parsed representation of a task Markdown file.
type TaskDocument struct {
	Metadata TaskMetadata
	Body     string
}

// CommandDocument is the parsed representation of a command Markdown file.
type CommandDocument struct {
	Metadata CommandMetadata
	Body     string
}

// Document is the shared interface for parsed Flow Markdown documents.
type Document interface {
	Kind() DocumentType
	BodyContent() string
	metadata() any
	MetadataCommon() CommonFields
	ID() string
	Graph() string
	Title() string
	Description() string
	Tags() []string
	CreatedAt() string
	UpdatedAt() string
	Color() string
	Links() []NodeLink
}

func (document NoteDocument) Kind() DocumentType    { return NoteType }
func (document TaskDocument) Kind() DocumentType    { return TaskType }
func (document CommandDocument) Kind() DocumentType { return CommandType }
func (document HomeDocument) Kind() DocumentType    { return HomeType }

func (document NoteDocument) body() string    { return document.Body }
func (document TaskDocument) body() string    { return document.Body }
func (document CommandDocument) body() string { return document.Body }
func (document HomeDocument) body() string    { return document.Body }

func (document NoteDocument) metadata() any    { return document.Metadata }
func (document TaskDocument) metadata() any    { return document.Metadata }
func (document CommandDocument) metadata() any { return document.Metadata }
func (document HomeDocument) metadata() any    { return document.Metadata }

func (document NoteDocument) BodyContent() string    { return document.Body }
func (document TaskDocument) BodyContent() string    { return document.Body }
func (document CommandDocument) BodyContent() string { return document.Body }
func (document HomeDocument) BodyContent() string    { return document.Body }

func (document NoteDocument) MetadataCommon() CommonFields    { return document.Metadata.CommonFields }
func (document TaskDocument) MetadataCommon() CommonFields    { return document.Metadata.CommonFields }
func (document CommandDocument) MetadataCommon() CommonFields { return document.Metadata.CommonFields }
func (document HomeDocument) MetadataCommon() CommonFields    { return document.Metadata }

func (document NoteDocument) ID() string    { return document.Metadata.ID }
func (document TaskDocument) ID() string    { return document.Metadata.ID }
func (document CommandDocument) ID() string { return document.Metadata.ID }
func (document HomeDocument) ID() string    { return document.Metadata.ID }

func (document NoteDocument) Graph() string    { return document.Metadata.Graph }
func (document TaskDocument) Graph() string    { return document.Metadata.Graph }
func (document CommandDocument) Graph() string { return document.Metadata.Graph }
func (document HomeDocument) Graph() string    { return document.Metadata.Graph }

func (document NoteDocument) Title() string    { return document.Metadata.Title }
func (document TaskDocument) Title() string    { return document.Metadata.Title }
func (document CommandDocument) Title() string { return document.Metadata.Title }
func (document HomeDocument) Title() string    { return document.Metadata.Title }

func (document NoteDocument) Description() string    { return document.Metadata.Description }
func (document TaskDocument) Description() string    { return document.Metadata.Description }
func (document CommandDocument) Description() string { return document.Metadata.Description }
func (document HomeDocument) Description() string    { return document.Metadata.Description }

func (document NoteDocument) Tags() []string    { return document.Metadata.Tags }
func (document TaskDocument) Tags() []string    { return document.Metadata.Tags }
func (document CommandDocument) Tags() []string { return document.Metadata.Tags }
func (document HomeDocument) Tags() []string    { return document.Metadata.Tags }

func (document NoteDocument) CreatedAt() string    { return document.Metadata.CreatedAt }
func (document TaskDocument) CreatedAt() string    { return document.Metadata.CreatedAt }
func (document CommandDocument) CreatedAt() string { return document.Metadata.CreatedAt }
func (document HomeDocument) CreatedAt() string    { return document.Metadata.CreatedAt }

func (document NoteDocument) UpdatedAt() string    { return document.Metadata.UpdatedAt }
func (document TaskDocument) UpdatedAt() string    { return document.Metadata.UpdatedAt }
func (document CommandDocument) UpdatedAt() string { return document.Metadata.UpdatedAt }
func (document HomeDocument) UpdatedAt() string    { return document.Metadata.UpdatedAt }

func (document NoteDocument) Color() string    { return document.Metadata.Color }
func (document TaskDocument) Color() string    { return document.Metadata.Color }
func (document CommandDocument) Color() string { return document.Metadata.Color }
func (document HomeDocument) Color() string    { return document.Metadata.Color }

func (document NoteDocument) Links() []NodeLink    { return document.Metadata.Links }
func (document TaskDocument) Links() []NodeLink    { return document.Metadata.Links }
func (document CommandDocument) Links() []NodeLink { return document.Metadata.Links }
func (document HomeDocument) Links() []NodeLink    { return nil }

// ParseDocument parses Markdown with YAML frontmatter and dispatches to the concrete document type.
func ParseDocument(data []byte) (Document, error) {
	rawMetadata, _, err := parseFrontmatter(data)
	if err != nil {
		return nil, err
	}

	documentType, err := parseDocumentType(rawMetadata)
	if err != nil {
		return nil, err
	}

	switch documentType {
	case HomeType:
		return ParseHomeDocument(data)
	case NoteType:
		return ParseNoteDocument(data)
	case TaskType:
		return ParseTaskDocument(data)
	case CommandType:
		return ParseCommandDocument(data)
	default:
		return nil, fmt.Errorf("unsupported document type %q", documentType)
	}
}

// ParseHomeDocument parses a Home markdown document with YAML frontmatter.
func ParseHomeDocument(data []byte) (HomeDocument, error) {
	var metadata CommonFields
	body, err := parseTypedDocument(data, HomeType, &metadata)
	if err != nil {
		return HomeDocument{}, err
	}

	return HomeDocument{Metadata: metadata, Body: body}, nil
}

// ParseNoteDocument parses a note Markdown document.
func ParseNoteDocument(data []byte) (NoteDocument, error) {
	var metadata NoteMetadata
	body, err := parseTypedDocument(data, NoteType, &metadata)
	if err != nil {
		return NoteDocument{}, err
	}

	return NoteDocument{Metadata: metadata, Body: body}, nil
}

// ParseTaskDocument parses a task Markdown document.
func ParseTaskDocument(data []byte) (TaskDocument, error) {
	var metadata TaskMetadata
	body, err := parseTypedDocument(data, TaskType, &metadata)
	if err != nil {
		return TaskDocument{}, err
	}

	return TaskDocument{Metadata: metadata, Body: body}, nil
}

// ParseCommandDocument parses a command Markdown document.
func ParseCommandDocument(data []byte) (CommandDocument, error) {
	var metadata CommandMetadata
	body, err := parseTypedDocument(data, CommandType, &metadata)
	if err != nil {
		return CommandDocument{}, err
	}

	return CommandDocument{Metadata: metadata, Body: body}, nil
}

// SerializeDocument encodes a concrete Flow document back to Markdown.
func SerializeDocument(document Document) ([]byte, error) {
	return serialize(document.metadata(), document.Kind(), document.BodyContent())
}

// RelativeDocumentPath returns the canonical relative path for a document inside .flow.
func RelativeDocumentPath(featureSlug string, documentType DocumentType, fileName string) (string, error) {
	if featureSlug == "" {
		return "", fmt.Errorf("feature slug must not be empty")
	}

	if fileName == "" {
		return "", fmt.Errorf("file name must not be empty")
	}

	directoryName, err := documentDirectoryName(documentType)
	if err != nil {
		return "", err
	}

	return filepath.Join("features", featureSlug, directoryName, fileName), nil
}

// RelativeGraphDocumentPath returns the canonical relative path for a graph-backed document.
func RelativeGraphDocumentPath(graphPath string, fileName string) (string, error) {
	trimmedGraphPath := strings.TrimSpace(graphPath)
	if trimmedGraphPath == "" {
		return "", fmt.Errorf("graph path must not be empty")
	}

	if fileName == "" {
		return "", fmt.Errorf("file name must not be empty")
	}

	normalizedGraphPath := filepath.ToSlash(filepath.Clean(trimmedGraphPath))
	if normalizedGraphPath == "." || normalizedGraphPath == ".." || strings.HasPrefix(normalizedGraphPath, "../") || strings.Contains(normalizedGraphPath, "//") {
		return "", fmt.Errorf("graph path %q is invalid", graphPath)
	}

	segments := strings.Split(normalizedGraphPath, "/")
	for _, segment := range segments {
		if segment == "" || segment == "." || segment == ".." {
			return "", fmt.Errorf("graph path %q is invalid", graphPath)
		}
	}

	return filepath.Join("data", "content", filepath.FromSlash(normalizedGraphPath), fileName), nil
}

func parseTypedDocument(data []byte, expectedType DocumentType, destination any) (string, error) {
	rawMetadata, body, err := parseFrontmatter(data)
	if err != nil {
		return "", err
	}

	documentType, err := parseDocumentType(rawMetadata)
	if err != nil {
		return "", err
	}

	if documentType != expectedType {
		return "", fmt.Errorf("document type %q does not match expected %q", documentType, expectedType)
	}

	if err := yaml.Unmarshal(rawMetadata, destination); err != nil {
		return "", fmt.Errorf("parse %s frontmatter: %w", expectedType, err)
	}

	return body, nil
}

func serialize(metadata any, documentType DocumentType, body string) ([]byte, error) {
	data, err := yaml.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("serialize %s frontmatter: %w", documentType, err)
	}

	var builder strings.Builder
	builder.WriteString(frontmatterDelimiter)
	builder.WriteByte('\n')
	builder.Write(data)
	builder.WriteString(frontmatterDelimiter)
	builder.WriteString("\n\n")
	builder.WriteString(body)

	return []byte(builder.String()), nil
}

func parseFrontmatter(data []byte) ([]byte, string, error) {
	normalized := strings.ReplaceAll(string(data), "\r\n", "\n")
	if !strings.HasPrefix(normalized, frontmatterDelimiter+"\n") {
		return nil, "", fmt.Errorf("markdown document must start with YAML frontmatter")
	}

	remainder := normalized[len(frontmatterDelimiter)+1:]
	separator := "\n" + frontmatterDelimiter + "\n"
	separatorIndex := strings.Index(remainder, separator)
	if separatorIndex < 0 {
		return nil, "", fmt.Errorf("markdown document is missing a closing frontmatter delimiter")
	}

	rawMetadata := remainder[:separatorIndex]
	body := remainder[separatorIndex+len(separator):]
	body = strings.TrimPrefix(body, "\n")

	return []byte(rawMetadata), body, nil
}

func parseDocumentType(rawMetadata []byte) (DocumentType, error) {
	var common CommonFields
	if err := yaml.Unmarshal(rawMetadata, &common); err != nil {
		return "", fmt.Errorf("parse shared frontmatter: %w", err)
	}

	if common.Type == "" {
		return "", fmt.Errorf("document frontmatter is missing type")
	}

	return common.Type, nil
}

func documentDirectoryName(documentType DocumentType) (string, error) {
	switch documentType {
	case HomeType:
		return "", nil
	case NoteType:
		return "notes", nil
	case TaskType:
		return "tasks", nil
	case CommandType:
		return "commands", nil
	default:
		return "", fmt.Errorf("unsupported document type %q", documentType)
	}
}

// CloneStrings returns a copy of the string slice.
func CloneStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	cloned := make([]string, len(values))
	copy(cloned, values)
	return cloned
}

// CloneMap returns a copy of the string map.
func CloneMap(values map[string]string) map[string]string {
	if len(values) == 0 {
		return nil
	}
	cloned := make(map[string]string, len(values))
	for key, value := range values {
		cloned[key] = value
	}
	return cloned
}

// LooksLikeFlowDocument returns true when data begins with YAML frontmatter.
func LooksLikeFlowDocument(data []byte) bool {
	return strings.HasPrefix(NormalizeMarkdownText(string(data)), "---\n")
}

func NormalizeMarkdownText(value string) string {
	return strings.ReplaceAll(value, "\r\n", "\n")
}

// DeriveHomeTitle extracts the first H1 heading from body, falling back to "Home".
func DeriveHomeTitle(body string) string {
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "# ") {
			return strings.TrimSpace(strings.TrimPrefix(trimmed, "# "))
		}
	}
	return "Home"
}

// CompactMarkdown normalizes newlines and trims trailing whitespace-only lines.
func CompactMarkdown(body string) string {
	normalized := strings.ReplaceAll(body, "\r\n", "\n")
	return string(bytes.TrimRight([]byte(normalized), "\n"))
}

// NormalizeInlineReferenceTokens canonicalizes legacy escaped inline reference tokens.
func NormalizeInlineReferenceTokens(body string) string {
	if body == "" {
		return ""
	}

	return escapedInlineReferencePattern.ReplaceAllString(body, "[[$1]]")
}

// NodeLinkIDs extracts the node IDs from a slice of NodeLink values.
func NodeLinkIDs(links []NodeLink) []string {
	if len(links) == 0 {
		return nil
	}
	ids := make([]string, len(links))
	for i, link := range links {
		ids[i] = link.Node
	}
	return ids
}

// InlineReferenceIDs extracts unique inline reference targets from markdown body text.
// The current canonical token shape is [[target]], with surrounding inner whitespace ignored.
func InlineReferenceIDs(body string) []string {
	matches := inlineReferencePattern.FindAllStringSubmatch(NormalizeInlineReferenceTokens(body), -1)
	if len(matches) == 0 {
		return nil
	}

	result := make([]string, 0, len(matches))
	seen := make(map[string]struct{}, len(matches))
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}

		target := strings.TrimSpace(match[1])
		if target == "" {
			continue
		}
		if _, ok := seen[target]; ok {
			continue
		}

		seen[target] = struct{}{}
		result = append(result, target)
	}

	if len(result) == 0 {
		return nil
	}

	return result
}
