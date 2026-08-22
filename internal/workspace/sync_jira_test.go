package workspace

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/lex/flow/internal/core"
)

func newSyncWorkspaceForTest(t *testing.T) Root {
	t.Helper()
	rootDir := t.TempDir()
	root, err := ResolveLocal(rootDir)
	if err != nil {
		t.Fatalf("resolve root: %v", err)
	}
	if err := os.MkdirAll(root.FlowPath, 0o755); err != nil {
		t.Fatalf("create .flow dir: %v", err)
	}
	return root
}

func TestSyncJiraCreatesUpdatesAndArchives(t *testing.T) {
	root := newSyncWorkspaceForTest(t)
	syncedAt := time.Now().UTC().Truncate(time.Second)

	firstBatch := []core.JiraIssue{
		{Key: "PROJ-1", Summary: "First issue", Description: "Does things.", Status: "Open", Labels: []string{"backend"}, URL: "https://jira.example.com/browse/PROJ-1"},
		{Key: "PROJ-2", Summary: "Second issue", Description: "Also does things.", Status: "Done", URL: "https://jira.example.com/browse/PROJ-2"},
	}

	result, err := SyncJira(root, "proj", firstBatch, syncedAt)
	if err != nil {
		t.Fatalf("SyncJira() error = %v", err)
	}
	if len(result.Created) != 2 {
		t.Fatalf("created = %v, want 2 ids", result.Created)
	}

	mirroredPath := filepath.Join(root.FlowPath, "data", "content", "external", "jira", "PROJ", "PROJ-1.md")
	data, err := os.ReadFile(mirroredPath)
	if err != nil {
		t.Fatalf("read mirrored note: %v", err)
	}
	content := string(data)
	for _, wanted := range []string{"id: external/jira/PROJ/proj-1", "type: note", "synced", "**Status:** Open", "Last synced"} {
		if !strings.Contains(content, wanted) {
			t.Fatalf("mirrored note missing %q:\n%s", wanted, content)
		}
	}

	// Second sync with PROJ-2 gone and PROJ-1 changed.
	secondBatch := []core.JiraIssue{
		{Key: "PROJ-1", Summary: "First issue renamed", Description: "Does things better.", Status: "In Progress", URL: "https://jira.example.com/browse/PROJ-1"},
	}
	result, err = SyncJira(root, "proj", secondBatch, syncedAt.Add(time.Minute))
	if err != nil {
		t.Fatalf("second SyncJira() error = %v", err)
	}
	if len(result.Updated) != 1 || result.Updated[0] != "external/jira/PROJ/proj-1" {
		t.Fatalf("updated = %v, want proj-1", result.Updated)
	}
	if len(result.Archived) != 1 || result.Archived[0] != "external/jira/PROJ/proj-2" {
		t.Fatalf("archived = %v, want proj-2", result.Archived)
	}

	archivedPath := filepath.Join(root.FlowPath, "data", "content", "external", "jira", "PROJ", "PROJ-2.md")
	if _, statErr := os.Stat(archivedPath); os.IsNotExist(statErr) {
		t.Fatal("archived node must not be deleted")
	}
	archiveData, readErr := os.ReadFile(archivedPath)
	if readErr != nil {
		t.Fatalf("reread archived note: %v", readErr)
	}
	if !strings.Contains(string(archiveData), "archived-source") {
		t.Fatalf("archived note missing archived-source tag:\n%s", archiveData)
	}

	// Idempotent: a third identical sync changes nothing.
	result, err = SyncJira(root, "proj", secondBatch, syncedAt.Add(2*time.Minute))
	if err != nil {
		t.Fatalf("third SyncJira() error = %v", err)
	}
	if len(result.Created)+len(result.Updated)+len(result.Archived) != 0 {
		t.Fatalf("third sync should be a no-op; got %#v", result)
	}
}

func TestSyncJiraRequiresProjectKey(t *testing.T) {
	root := newSyncWorkspaceForTest(t)
	if _, err := SyncJira(root, "", nil, time.Now()); err == nil {
		t.Fatal("empty project key should error")
	}
}
