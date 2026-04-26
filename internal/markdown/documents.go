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
type NodeLink struct {
	Node    string `yaml:"node"`
	Context string `yaml:"context,omitempty"`
}

// UnmarshalYAML implements custom decoding so that a plain scalar string (legacy format) is
// treated as NodeLink{Node: value}.
func (r *NodeLink) UnmarshalYAML(value *yaml.Node) error {
	if value.Kind == yaml.ScalarNode {
		r.Node = value.Value
		r.Context = ""
		return nil
	}
	type plain NodeLink
	var p plain
	if err := value.Decode(&p); err != nil {
		return err
	}
	*r = NodeLink(p)
	return nil
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
}

// NoteMetadata describes note frontmatter fields.
type NoteMetadata struct {
	CommonFields `yaml:",inline"`
	Links        []NodeLink `yaml:"links,omitempty"`
}

// TaskMetadata describes task frontmatter fields.
type TaskMetadata struct {
	CommonFields `yaml:",inline"`
	Status       string     `yaml:"status,omitempty"`
	Links        []NodeLink `yaml:"links,omitempty"`
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
	body() string
	metadata() any
}

func (document NoteDocument) Kind() DocumentType    { return NoteType }
func (document TaskDocument) Kind() DocumentType    { return TaskType }
func (document CommandDocument) Kind() DocumentType { return CommandType }
func (document HomeDocument) Kind() DocumentType    { return HomeType }

func (document HomeDocument) body() string    { return document.Body }
func (document NoteDocument) body() string    { return document.Body }
func (document TaskDocument) body() string    { return document.Body }
func (document CommandDocument) body() string { return document.Body }

func (document HomeDocument) metadata() any    { return document.Metadata }
func (document NoteDocument) metadata() any    { return document.Metadata }
func (document TaskDocument) metadata() any    { return document.Metadata }
func (document CommandDocument) metadata() any { return document.Metadata }

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
	return serialize(document.metadata(), document.Kind(), document.body())
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
