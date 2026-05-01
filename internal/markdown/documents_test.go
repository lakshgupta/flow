package markdown

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestParseNoteDocument(t *testing.T) {
	t.Parallel()

	input := strings.Join([]string{
		"---",
		"id: note-1",
		"type: note",
		"graph: notes",
		"title: Architecture Note",
		"description: Shared description",
		"tags:",
		"  - design",
		"links:",
		"  - task-1",
		"createdAt: 2026-03-16T10:00:00Z",
		"updatedAt: 2026-03-16T11:00:00Z",
		"---",
		"",
		"# Note",
		"",
		"Body text.",
	}, "\n")

	document, err := ParseNoteDocument([]byte(input))
	if err != nil {
		t.Fatalf("ParseNoteDocument() error = %v", err)
	}

	if document.Metadata.Type != NoteType {
		t.Fatalf("document.Metadata.Type = %q, want %q", document.Metadata.Type, NoteType)
	}

	if document.Metadata.ID != "note-1" {
		t.Fatalf("document.Metadata.ID = %q, want note-1", document.Metadata.ID)
	}

	if document.Metadata.Description != "Shared description" {
		t.Fatalf("document.Metadata.Description = %q, want Shared description", document.Metadata.Description)
	}

	if document.Metadata.Links[0].Node != "task-1" {
		t.Fatalf("document.Metadata.Links = %#v", document.Metadata.Links)
	}

	if !strings.Contains(document.Body, "Body text.") {
		t.Fatalf("document.Body = %q", document.Body)
	}
}

func TestParseTaskDocument(t *testing.T) {
	t.Parallel()

	input := strings.Join([]string{
		"---",
		"id: task-1",
		"type: task",
		"graph: execution",
		"title: Implement parser",
		"description: Shared task description",
		"status: todo",
		"links:",
		"  - note-1",
		"---",
		"",
		"Task body",
	}, "\n")

	document, err := ParseTaskDocument([]byte(input))
	if err != nil {
		t.Fatalf("ParseTaskDocument() error = %v", err)
	}

	if document.Metadata.Status != "todo" {
		t.Fatalf("document.Metadata.Status = %q, want todo", document.Metadata.Status)
	}

	if document.Metadata.Description != "Shared task description" {
		t.Fatalf("document.Metadata.Description = %q, want Shared task description", document.Metadata.Description)
	}

	if document.Metadata.Links[0].Node != "note-1" {
		t.Fatalf("document.Metadata.Links = %#v", document.Metadata.Links)
	}
}

func TestParseNoteDocumentLinkRelationships(t *testing.T) {
	t.Parallel()

	input := strings.Join([]string{
		"---",
		"id: note-1",
		"type: note",
		"graph: notes",
		"title: Architecture Note",
		"links:",
		"  - node: task-1",
		"    context: informs",
		"    relationships:",
		"      - depends_on",
		"      - blocks",
		"---",
		"",
		"Body text.",
	}, "\n")

	document, err := ParseNoteDocument([]byte(input))
	if err != nil {
		t.Fatalf("ParseNoteDocument() error = %v", err)
	}

	if len(document.Metadata.Links) != 1 {
		t.Fatalf("len(document.Metadata.Links) = %d, want 1", len(document.Metadata.Links))
	}

	if len(document.Metadata.Links[0].Relationships) != 2 {
		t.Fatalf("len(document.Metadata.Links[0].Relationships) = %d, want 2", len(document.Metadata.Links[0].Relationships))
	}

	if document.Metadata.Links[0].Relationships[0] != "depends_on" || document.Metadata.Links[0].Relationships[1] != "blocks" {
		t.Fatalf("document.Metadata.Links[0].Relationships = %#v, want [depends_on blocks]", document.Metadata.Links[0].Relationships)
	}
}

func TestParseCommandDocument(t *testing.T) {
	t.Parallel()

	input := strings.Join([]string{
		"---",
		"id: cmd-1",
		"type: command",
		"graph: release",
		"title: Build binary",
		"description: Shared command description",
		"name: build",
		"links:",
		"  - note-1",
		"env:",
		"  GOOS: linux",
		"  GOARCH: amd64",
		"run: go build ./cmd/flow",
		"---",
		"",
		"Command body",
	}, "\n")

	document, err := ParseCommandDocument([]byte(input))
	if err != nil {
		t.Fatalf("ParseCommandDocument() error = %v", err)
	}

	if document.Metadata.Name != "build" {
		t.Fatalf("document.Metadata.Name = %q, want build", document.Metadata.Name)
	}

	if document.Metadata.Description != "Shared command description" {
		t.Fatalf("document.Metadata.Description = %q, want Shared command description", document.Metadata.Description)
	}

	if document.Metadata.Env["GOOS"] != "linux" {
		t.Fatalf("document.Metadata.Env = %#v", document.Metadata.Env)
	}

	if document.Metadata.Run != "go build ./cmd/flow" {
		t.Fatalf("document.Metadata.Run = %q", document.Metadata.Run)
	}
}

func TestParseDocumentDispatchesByType(t *testing.T) {
	t.Parallel()

	input := []byte("---\ntype: note\ntitle: Dispatch\n---\n\nBody\n")
	document, err := ParseDocument(input)
	if err != nil {
		t.Fatalf("ParseDocument() error = %v", err)
	}

	if document.Kind() != NoteType {
		t.Fatalf("document.Kind() = %q, want %q", document.Kind(), NoteType)
	}
}

func TestSerializeDocumentRoundTripsTask(t *testing.T) {
	t.Parallel()

	input := TaskDocument{
		Metadata: TaskMetadata{
			CommonFields: CommonFields{
				ID:          "task-1",
				Type:        TaskType,
				Graph:       "execution",
				Title:       "Round trip",
				Description: "Task description",
				Tags:        []string{"parser", "test"},
			},
			Status: "todo",
			Links:  []NodeLink{{Node: "note-1"}},
		},
		Body: "Task body\n",
	}

	serialized, err := SerializeDocument(input)
	if err != nil {
		t.Fatalf("SerializeDocument() error = %v", err)
	}

	parsed, err := ParseTaskDocument(serialized)
	if err != nil {
		t.Fatalf("ParseTaskDocument() error = %v", err)
	}

	if parsed.Metadata.ID != input.Metadata.ID {
		t.Fatalf("parsed.Metadata.ID = %q, want %q", parsed.Metadata.ID, input.Metadata.ID)
	}

	if parsed.Metadata.Description != input.Metadata.Description {
		t.Fatalf("parsed.Metadata.Description = %q, want %q", parsed.Metadata.Description, input.Metadata.Description)
	}

	if CompactMarkdown(parsed.Body) != CompactMarkdown(input.Body) {
		t.Fatalf("parsed.Body = %q, want %q", parsed.Body, input.Body)
	}
}

func TestSerializeDocumentRoundTripsNote(t *testing.T) {
	t.Parallel()

	input := NoteDocument{
		Metadata: NoteMetadata{
			CommonFields: CommonFields{
				ID:          "note-1",
				Type:        NoteType,
				Graph:       "notes",
				Title:       "Architecture",
				Description: "Note description",
				Tags:        []string{"design", "reference"},
				CreatedAt:   "2026-03-17T10:00:00Z",
				UpdatedAt:   "2026-03-17T11:00:00Z",
			},
			Links: []NodeLink{{Node: "note-2"}, {Node: "task-1"}},
		},
		Body: "# Note\n\nRound-trip body\n",
	}

	serialized, err := SerializeDocument(input)
	if err != nil {
		t.Fatalf("SerializeDocument() error = %v", err)
	}

	parsed, err := ParseNoteDocument(serialized)
	if err != nil {
		t.Fatalf("ParseNoteDocument() error = %v", err)
	}

	if parsed.Metadata.ID != input.Metadata.ID {
		t.Fatalf("parsed.Metadata.ID = %q, want %q", parsed.Metadata.ID, input.Metadata.ID)
	}

	if parsed.Metadata.Description != input.Metadata.Description {
		t.Fatalf("parsed.Metadata.Description = %q, want %q", parsed.Metadata.Description, input.Metadata.Description)
	}

	if !slicesEqual(NodeLinkIDs(parsed.Metadata.Links), NodeLinkIDs(input.Metadata.Links)) {
		t.Fatalf("parsed.Metadata.Links = %#v, want %#v", parsed.Metadata.Links, input.Metadata.Links)
	}

	if CompactMarkdown(parsed.Body) != CompactMarkdown(input.Body) {
		t.Fatalf("parsed.Body = %q, want %q", parsed.Body, input.Body)
	}
}

func TestSerializeDocumentPreservesLeadingBlankLine(t *testing.T) {
	t.Parallel()

	input := HomeDocument{
		Metadata: CommonFields{
			ID:    "home",
			Type:  HomeType,
			Title: "Home",
		},
		Body: "\n# Home\n",
	}

	serialized, err := SerializeDocument(input)
	if err != nil {
		t.Fatalf("SerializeDocument() error = %v", err)
	}

	parsed, err := ParseHomeDocument(serialized)
	if err != nil {
		t.Fatalf("ParseHomeDocument() error = %v", err)
	}

	if parsed.Body != input.Body {
		t.Fatalf("parsed.Body = %q, want %q", parsed.Body, input.Body)
	}
}

func TestSerializeDocumentPreservesTrailingBlankLines(t *testing.T) {
	t.Parallel()

	input := NoteDocument{
		Metadata: NoteMetadata{
			CommonFields: CommonFields{
				ID:    "note-1",
				Type:  NoteType,
				Graph: "notes",
				Title: "Architecture",
			},
		},
		Body: "Line one\n\n",
	}

	serialized, err := SerializeDocument(input)
	if err != nil {
		t.Fatalf("SerializeDocument() error = %v", err)
	}

	parsed, err := ParseNoteDocument(serialized)
	if err != nil {
		t.Fatalf("ParseNoteDocument() error = %v", err)
	}

	if parsed.Body != input.Body {
		t.Fatalf("parsed.Body = %q, want %q", parsed.Body, input.Body)
	}
}

func TestSerializeDocumentRoundTripsCommand(t *testing.T) {
	t.Parallel()

	input := CommandDocument{
		Metadata: CommandMetadata{
			CommonFields: CommonFields{
				ID:          "cmd-1",
				Type:        CommandType,
				Graph:       "release",
				Title:       "Build",
				Description: "Command description",
				Tags:        []string{"release", "cli"},
				CreatedAt:   "2026-03-17T10:00:00Z",
			},
			Name:  "build",
			Links: []NodeLink{{Node: "note-1"}},
			Env: map[string]string{
				"GOOS":   "linux",
				"GOARCH": "amd64",
			},
			Run: "go build ./cmd/flow",
		},
		Body: "Command body\n",
	}

	serialized, err := SerializeDocument(input)
	if err != nil {
		t.Fatalf("SerializeDocument() error = %v", err)
	}

	parsed, err := ParseCommandDocument(serialized)
	if err != nil {
		t.Fatalf("ParseCommandDocument() error = %v", err)
	}

	if parsed.Metadata.ID != input.Metadata.ID {
		t.Fatalf("parsed.Metadata.ID = %q, want %q", parsed.Metadata.ID, input.Metadata.ID)
	}

	if parsed.Metadata.Name != input.Metadata.Name {
		t.Fatalf("parsed.Metadata.Name = %q, want %q", parsed.Metadata.Name, input.Metadata.Name)
	}

	if parsed.Metadata.Description != input.Metadata.Description {
		t.Fatalf("parsed.Metadata.Description = %q, want %q", parsed.Metadata.Description, input.Metadata.Description)
	}

	if !slicesEqual(NodeLinkIDs(parsed.Metadata.Links), NodeLinkIDs(input.Metadata.Links)) {
		t.Fatalf("parsed.Metadata.Links = %#v, want %#v", parsed.Metadata.Links, input.Metadata.Links)
	}

	if parsed.Metadata.Env["GOOS"] != "linux" || parsed.Metadata.Env["GOARCH"] != "amd64" {
		t.Fatalf("parsed.Metadata.Env = %#v, want GOOS/GOARCH values", parsed.Metadata.Env)
	}

	if CompactMarkdown(parsed.Body) != CompactMarkdown(input.Body) {
		t.Fatalf("parsed.Body = %q, want %q", parsed.Body, input.Body)
	}
}

func slicesEqual(left []string, right []string) bool {
	if len(left) != len(right) {
		return false
	}

	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}

	return true
}

func TestRelativeDocumentPath(t *testing.T) {
	t.Parallel()

	path, err := RelativeDocumentPath("rewrite", CommandType, "build.md")
	if err != nil {
		t.Fatalf("RelativeDocumentPath() error = %v", err)
	}

	if path != "features/rewrite/commands/build.md" {
		t.Fatalf("RelativeDocumentPath() = %q", path)
	}
}

func TestRelativeGraphDocumentPath(t *testing.T) {
	t.Parallel()

	path, err := RelativeGraphDocumentPath("execution/parser", "build.md")
	if err != nil {
		fatalf := t.Fatalf
		fatalf("RelativeGraphDocumentPath() error = %v", err)
	}

	if path != filepath.Join("data", "content", "execution", "parser", "build.md") {
		t.Fatalf("RelativeGraphDocumentPath() = %q", path)
	}
}

func TestRelativeGraphDocumentPathRejectsInvalidGraph(t *testing.T) {
	t.Parallel()

	_, err := RelativeGraphDocumentPath("../escape", "build.md")
	if err == nil {
		t.Fatal("RelativeGraphDocumentPath() error = nil, want invalid graph path")
	}
}

func TestParseDocumentRejectsMissingType(t *testing.T) {
	t.Parallel()

	_, err := ParseDocument([]byte("---\ntitle: Untyped\n---\n\nBody\n"))
	if err == nil {
		t.Fatal("ParseDocument() error = nil, want type validation error")
	}

	if !strings.Contains(err.Error(), "missing type") {
		t.Fatalf("ParseDocument() error = %v", err)
	}
}

func TestParseTaskDocumentRejectsMismatchedType(t *testing.T) {
	t.Parallel()

	_, err := ParseTaskDocument([]byte("---\ntype: note\n---\n\nBody\n"))
	if err == nil {
		t.Fatal("ParseTaskDocument() error = nil, want mismatch error")
	}

	if !strings.Contains(err.Error(), "does not match expected") {
		t.Fatalf("ParseTaskDocument() error = %v", err)
	}
}

func TestParseNoteDocumentInlineLinks(t *testing.T) {
	t.Parallel()

	input := strings.Join([]string{
		"---",
		"id: note-1",
		"type: note",
		"graph: notes",
		"title: Reference Note",
		"links:",
		"  - plain-id",
		"  - node: rich-id",
		"    context: informs the approach",
		"---",
		"",
	}, "\n")

	document, err := ParseNoteDocument([]byte(input))
	if err != nil {
		t.Fatalf("ParseNoteDocument() error = %v", err)
	}

	if len(document.Metadata.Links) != 2 {
		t.Fatalf("len(Links) = %d, want 2", len(document.Metadata.Links))
	}

	if document.Metadata.Links[0].Node != "plain-id" || document.Metadata.Links[0].Context != "" {
		t.Fatalf("Links[0] = %+v, want {Node: plain-id, Context: }", document.Metadata.Links[0])
	}

	if document.Metadata.Links[1].Node != "rich-id" || document.Metadata.Links[1].Context != "informs the approach" {
		t.Fatalf("Links[1] = %+v, want {Node: rich-id, Context: informs the approach}", document.Metadata.Links[1])
	}
}

func TestParseDocumentRejectsEdgeType(t *testing.T) {
	t.Parallel()

	input := []byte("---\ntype: edge\nfrom: a\nto: b\n---\n\nBody\n")
	_, err := ParseDocument(input)
	if err == nil {
		t.Fatal("ParseDocument() error = nil, want error for unsupported type edge")
	}

	if !strings.Contains(err.Error(), "unsupported document type") {
		t.Fatalf("ParseDocument() error = %v, want containing unsupported document type", err)
	}
}

func TestInlineReferenceIDs(t *testing.T) {
	t.Parallel()

	body := strings.Join([]string{
		"Start with [[note-a]].",
		"Repeat [[note-a]] and trim [[ task-1 ]] while ignoring [[]].",
		"Nested brackets like [[command/run]] stay intact as a single target.",
	}, "\n")

	got := InlineReferenceIDs(body)
	want := []string{"note-a", "task-1", "command/run"}

	if len(got) != len(want) {
		t.Fatalf("len(InlineReferenceIDs()) = %d, want %d (%v)", len(got), len(want), got)
	}

	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("InlineReferenceIDs()[%d] = %q, want %q", index, got[index], want[index])
		}
	}
}

func TestInlineReferenceIDsSupportsLegacyEscapedTokens(t *testing.T) {
	t.Parallel()

	body := strings.Join([]string{
		`Legacy token \[\[graph2 > Task1\]\] still resolves.`,
		`Repeat \[\[ graph2 > Task1 \]\] and add \[\[graph1/note1\]\].`,
	}, "\n")

	got := InlineReferenceIDs(body)
	want := []string{"graph2 > Task1", "graph1/note1"}

	if len(got) != len(want) {
		t.Fatalf("len(InlineReferenceIDs()) = %d, want %d (%v)", len(got), len(want), got)
	}

	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("InlineReferenceIDs()[%d] = %q, want %q", index, got[index], want[index])
		}
	}
}
