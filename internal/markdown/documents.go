package markdown

import (
	"bytes"
	"fmt"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

const frontmatterDelimiter = "---"

// DocumentType identifies the canonical Flow document kinds.
type DocumentType string

const (
	NoteType    DocumentType = "note"
	TaskType    DocumentType = "task"
	CommandType DocumentType = "command"
)

// CommonFields contains the frontmatter shared by all document kinds.
type CommonFields struct {
	ID        string       `yaml:"id,omitempty"`
	Type      DocumentType `yaml:"type,omitempty"`
	Graph     string       `yaml:"graph,omitempty"`
	Title     string       `yaml:"title,omitempty"`
	Tags      []string     `yaml:"tags,omitempty"`
	CreatedAt string       `yaml:"createdAt,omitempty"`
	UpdatedAt string       `yaml:"updatedAt,omitempty"`
}

// NoteMetadata describes note frontmatter fields.
type NoteMetadata struct {
	CommonFields `yaml:",inline"`
	References   []string `yaml:"references,omitempty"`
}

// TaskMetadata describes task frontmatter fields.
type TaskMetadata struct {
	CommonFields `yaml:",inline"`
	Status       string   `yaml:"status,omitempty"`
	DependsOn    []string `yaml:"dependsOn,omitempty"`
	References   []string `yaml:"references,omitempty"`
}

// CommandMetadata describes command frontmatter fields.
type CommandMetadata struct {
	CommonFields `yaml:",inline"`
	Name         string            `yaml:"name,omitempty"`
	DependsOn    []string          `yaml:"dependsOn,omitempty"`
	References   []string          `yaml:"references,omitempty"`
	Env          map[string]string `yaml:"env,omitempty"`
	Run          string            `yaml:"run,omitempty"`
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

func (document NoteDocument) body() string    { return document.Body }
func (document TaskDocument) body() string    { return document.Body }
func (document CommandDocument) body() string { return document.Body }

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

	trimmedBody := strings.TrimLeft(body, "\n")

	var builder strings.Builder
	builder.WriteString(frontmatterDelimiter)
	builder.WriteByte('\n')
	builder.Write(data)
	builder.WriteString(frontmatterDelimiter)
	builder.WriteString("\n\n")
	builder.WriteString(trimmedBody)

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
