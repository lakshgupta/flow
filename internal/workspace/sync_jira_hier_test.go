package workspace

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/lex/flow/internal/core"
	"github.com/lex/flow/internal/markdown"
)

func TestSyncJiraHierarchical(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "hier")
	defer os.RemoveAll(tmpDir)
	os.MkdirAll(filepath.Join(tmpDir, ".flow", "config"), 0755)
	os.MkdirAll(filepath.Join(tmpDir, ".flow", "data", "content"), 0755)
	os.WriteFile(filepath.Join(tmpDir, ".flow", "config", "flow.yaml"), []byte("gui:\n  port: 4317\n"), 0644)
	os.WriteFile(filepath.Join(tmpDir, ".flow", "data", "home.md"), []byte("# Home\n"), 0644)
	root, err := ResolveLocal(tmpDir)
	if err != nil {
		t.Fatalf("resolve error %v", err)
	}
	issues := []core.JiraIssue{
		{Key: "PROJ-100", Summary: "Epic One", Description: "Epic desc", Status: "In Progress", Labels: []string{"epic"}, IssueType: "Epic", URL: "https://example.com/browse/PROJ-100"},
		{Key: "PROJ-101", Summary: "Feature One", Description: "Feature desc", Status: "To Do", IssueType: "Story", ParentKey: "PROJ-100", URL: "https://example.com/browse/PROJ-101"},
		{Key: "PROJ-102", Summary: "Story One", Description: "Story desc", Status: "To Do", IssueType: "Story", ParentKey: "PROJ-101", URL: "https://example.com/browse/PROJ-102"},
		{Key: "PROJ-103", Summary: "Orphan", Description: "Orphan desc", Status: "To Do", IssueType: "Task", URL: "https://example.com/browse/PROJ-103"},
		{Key: "PROJ-104", Summary: "Closed Epic", Description: "Closed", Status: "Done", IssueType: "Epic", URL: "https://example.com/browse/PROJ-104"},
	}
	result, err := SyncJira(root, "PROJ", issues, time.Now())
	if err != nil {
		t.Fatalf("sync error %v", err)
	}
	t.Logf("result %+v", result)
	if _, err := os.Stat(filepath.Join(tmpDir, ".flow", "data", "content", "external", "jira", "PROJ", "PROJ-100", "PROJ-100.md")); err != nil {
		t.Fatalf("epic file missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(tmpDir, ".flow", "data", "content", "external", "jira", "PROJ", "PROJ-100", "PROJ-101", "PROJ-101.md")); err != nil {
		t.Fatalf("feature file missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(tmpDir, ".flow", "data", "content", "external", "jira", "PROJ", "PROJ-100", "PROJ-101", "PROJ-102.md")); err != nil {
		t.Fatalf("story file missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(tmpDir, ".flow", "data", "content", "external", "jira", "PROJ", "PROJ-103.md")); err != nil {
		t.Fatalf("orphan file missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(tmpDir, ".flow", "data", "content", "external", "jira", "PROJ", "PROJ-100", "PROJ-104.md")); err == nil {
		t.Fatalf("closed epic should not be created")
	}
	docs, _ := LoadDocuments(root.FlowPath)
	foundEpic := false
	foundFeature := false
	for _, d := range docs {
		note, ok := d.Document.(markdown.NoteDocument)
		if !ok {
			continue
		}
		id := note.Metadata.ID
		if id == "external/jira/PROJ/PROJ-100/proj-100" {
			foundEpic = true
			links := note.Metadata.Links
			t.Logf("epic links %v", links)
			if len(links) != 1 || links[0].Node != "external/jira/PROJ/PROJ-100/PROJ-101/proj-101" {
				t.Fatalf("epic links wrong: %+v", links)
			}
			if !strings.Contains(note.Body, "Epic One") || !strings.Contains(note.Body, "https://example.com/browse/PROJ-100") {
				t.Fatalf("epic body wrong: %s", note.Body)
			}
			if !strings.Contains(note.Body, "**Type:** Epic") {
				t.Fatalf("epic body missing Type")
			}
		}
		if id == "external/jira/PROJ/PROJ-100/PROJ-101/proj-101" {
			foundFeature = true
			links := note.Metadata.Links
			t.Logf("feature links %v", links)
			if len(links) != 1 || links[0].Node != "external/jira/PROJ/PROJ-100/PROJ-101/proj-102" {
				t.Fatalf("feature links wrong: %+v", links)
			}
		}
	}
	if !foundEpic {
		t.Fatalf("epic not found")
	}
	if !foundFeature {
		t.Fatalf("feature not found")
	}
	for _, d := range docs {
		note, ok := d.Document.(markdown.NoteDocument)
		if !ok {
			continue
		}
		if note.Metadata.ID == "external/jira/PROJ/proj-103" {
			if !strings.Contains(note.Body, "Orphan desc") {
				t.Fatalf("orphan body wrong")
			}
		}
	}
}
