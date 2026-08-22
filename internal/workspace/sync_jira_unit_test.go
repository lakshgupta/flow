package workspace

import (
	"strings"
	"testing"
	"time"

	"github.com/lex/flow/internal/core"
)

func TestJiraMirrorBodyComparisonIgnoresSyncTime(t *testing.T) {
	now := time.Now().UTC()
	later := now.Add(time.Hour)

	issue := core.JiraIssue{Key: "K-1", Summary: "S", Description: "D", Status: "Open", URL: "https://jira/k-1"}
	first := jiraIssueBody(issue, now)
	second := jiraIssueBody(issue, later)

	if first == second {
		t.Fatal("bodies should differ by last-synced line")
	}
	if jiraMirrorComparableBody(first) != jiraMirrorComparableBody(second) {
		t.Fatal("comparable bodies should match ignoring last-synced line")
	}
}

func TestJiraNodeIDIsStableAndLowercased(t *testing.T) {
	if got := jiraNodeID("PROJ", "ProJ-12"); got != "external/jira/PROJ/proj-12" {
		t.Fatalf("jiraNodeID = %q", got)
	}
}

func TestHasArchivedSourceTagCaseInsensitive(t *testing.T) {
	if !hasArchivedSourceTag([]string{"synced", "Archived-Source"}) {
		t.Fatal("case-insensitive match failed")
	}
	if hasArchivedSourceTag([]string{"synced", "jira"}) {
		t.Fatal("false positive archived-source match")
	}
}

func TestJiraIssueBodyContainsReadonlyNotice(t *testing.T) {
	body := jiraIssueBody(core.JiraIssue{Key: "K-1", Summary: "S", Status: "Open", URL: "u"}, time.Now())
	if !strings.Contains(body, "Read-only") {
		t.Fatalf("body missing read-only notice:\n%s", body)
	}
}
