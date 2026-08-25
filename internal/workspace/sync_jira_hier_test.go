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

func TestSyncJiraGeneralCases(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "hier2")
	defer os.RemoveAll(tmpDir)
	os.MkdirAll(filepath.Join(tmpDir, ".flow", "config"), 0755)
	os.MkdirAll(filepath.Join(tmpDir, ".flow", "data", "content"), 0755)
	os.WriteFile(filepath.Join(tmpDir, ".flow", "config", "flow.yaml"), []byte("gui:\n  port: 4317\n"), 0644)
	os.WriteFile(filepath.Join(tmpDir, ".flow", "data", "home.md"), []byte("# Home\n"), 0644)
	root, err := ResolveLocal(tmpDir)
	if err != nil {
		t.Fatalf("resolve error %v", err)
	}
	// Feature without epic, JIRA without feature, story with children
	issues := []core.JiraIssue{
		{Key: "PROJ-200", Summary: "Feature No Epic", Description: "Feature no epic", Status: "In Progress", IssueType: "Feature", URL: "https://example.com/browse/PROJ-200"},
		{Key: "PROJ-201", Summary: "Child of Feature No Epic", Description: "Child", Status: "To Do", IssueType: "Story", ParentKey: "PROJ-200", URL: "https://example.com/browse/PROJ-201"},
		{Key: "PROJ-300", Summary: "Standalone Bug", Description: "Bug desc", Status: "To Do", IssueType: "Bug", URL: "https://example.com/browse/PROJ-300"},
		{Key: "PROJ-400", Summary: "Epic With Story Children", Description: "Epic", Status: "In Progress", IssueType: "Epic", URL: "https://example.com/browse/PROJ-400"},
		{Key: "PROJ-401", Summary: "Story With Children", Description: "Story", Status: "To Do", IssueType: "Story", ParentKey: "PROJ-400", URL: "https://example.com/browse/PROJ-401"},
		{Key: "PROJ-402", Summary: "Subtask of Story", Description: "Subtask", Status: "To Do", IssueType: "Sub-task", ParentKey: "PROJ-401", URL: "https://example.com/browse/PROJ-402"},
		{Key: "PROJ-403", Summary: "Another Subtask", Description: "Another", Status: "To Do", IssueType: "Sub-task", ParentKey: "PROJ-401", URL: "https://example.com/browse/PROJ-403"},
	}
	result, err := SyncJira(root, "PROJ", issues, time.Now())
	if err != nil {
		t.Fatalf("sync error %v", err)
	}
	t.Logf("result %+v", result)
	// Feature without epic should be a graph at PROJ/PROJ-200
	if _, err := os.Stat(filepath.Join(tmpDir, ".flow", "data", "content", "external", "jira", "PROJ", "PROJ-200", "PROJ-200.md")); err != nil {
		t.Fatalf("feature without epic file missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(tmpDir, ".flow", "data", "content", "external", "jira", "PROJ", "PROJ-200", "PROJ-201.md")); err != nil {
		t.Fatalf("child of feature without epic missing: %v", err)
	}
	// Standalone Bug should be flat
	if _, err := os.Stat(filepath.Join(tmpDir, ".flow", "data", "content", "external", "jira", "PROJ", "PROJ-300.md")); err != nil {
		t.Fatalf("standalone bug missing: %v", err)
	}
	// Epic with story children: Epic graph, story graph, subtasks under story graph
	if _, err := os.Stat(filepath.Join(tmpDir, ".flow", "data", "content", "external", "jira", "PROJ", "PROJ-400", "PROJ-400.md")); err != nil {
		t.Fatalf("epic 400 missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(tmpDir, ".flow", "data", "content", "external", "jira", "PROJ", "PROJ-400", "PROJ-401", "PROJ-401.md")); err != nil {
		t.Fatalf("story with children file missing: %v", err)
	}
	// Subtasks should be under story's graph (since story has children, it becomes a graph)
	// Our logic makes story with children a graph, so its children should be under PROJ-400/PROJ-401/PROJ-402
	// Check for subtask files
	if _, err := os.Stat(filepath.Join(tmpDir, ".flow", "data", "content", "external", "jira", "PROJ", "PROJ-400", "PROJ-401", "PROJ-402.md")); err != nil {
		t.Fatalf("subtask 402 missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(tmpDir, ".flow", "data", "content", "external", "jira", "PROJ", "PROJ-400", "PROJ-401", "PROJ-403.md")); err != nil {
		t.Fatalf("subtask 403 missing: %v", err)
	}
	docs, _ := LoadDocuments(root.FlowPath)
	// Check links: feature without epic should link to its child
	found := false
	for _, d := range docs {
		note, ok := d.Document.(markdown.NoteDocument)
		if !ok {
			continue
		}
		if note.Metadata.ID == "external/jira/PROJ/PROJ-200/proj-200" {
			found = true
			if len(note.Metadata.Links) != 1 || note.Metadata.Links[0].Node != "external/jira/PROJ/PROJ-200/proj-201" {
				t.Fatalf("feature without epic links wrong: %+v", note.Metadata.Links)
			}
		}
	}
	if !found {
		t.Fatalf("feature without epic not found")
	}
	// Check story with children links to its subtasks
	found = false
	for _, d := range docs {
		note, ok := d.Document.(markdown.NoteDocument)
		if !ok {
			continue
		}
		if note.Metadata.ID == "external/jira/PROJ/PROJ-400/PROJ-401/proj-401" {
			found = true
			// Should have 2 links to subtasks
			if len(note.Metadata.Links) != 2 {
				t.Fatalf("story with children links wrong count: %+v", note.Metadata.Links)
			}
			// Check both subtasks present
			has402 := false
			has403 := false
			for _, l := range note.Metadata.Links {
				if l.Node == "external/jira/PROJ/PROJ-400/PROJ-401/proj-402" {
					has402 = true
				}
				if l.Node == "external/jira/PROJ/PROJ-400/PROJ-401/proj-403" {
					has403 = true
				}
			}
			if !has402 || !has403 {
				t.Fatalf("story links missing subtasks: %+v", note.Metadata.Links)
			}
		}
	}
	if !found {
		t.Fatalf("story with children not found")
	}
	// Check standalone bug has no links and is flat
	for _, d := range docs {
		note, ok := d.Document.(markdown.NoteDocument)
		if !ok {
			continue
		}
		if note.Metadata.ID == "external/jira/PROJ/proj-300" {
			if len(note.Metadata.Links) != 0 {
				t.Fatalf("standalone bug should have no links")
			}
			if note.Metadata.Graph != "external/jira/PROJ" {
				t.Fatalf("standalone bug graph wrong: %s", note.Metadata.Graph)
			}
		}
	}
}
