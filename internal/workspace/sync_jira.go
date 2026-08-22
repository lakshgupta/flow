package workspace

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/lex/flow/internal/core"
	"github.com/lex/flow/internal/markdown"
)

// JiraGraphRoot is the graph root holding mirrored external tickets.
const JiraGraphRoot = "external/jira"

// SyncJiraResult reports what one sync pass changed.
type SyncJiraResult struct {
	Project  string   `json:"project"`
	Created  []string `json:"created,omitempty"`
	Updated  []string `json:"updated,omitempty"`
	Archived []string `json:"archived,omitempty"`
}

// SyncJira mirrors fetched tracker issues into read-only note nodes under
// external/jira/<PROJECT>/. Markdown is written first, then the index
// refreshes. Deletions in the source mark nodes with an archived-source tag
// instead of deleting, preserving edge integrity. Node ids derive from issue
// keys so links survive re-syncs.
func SyncJira(root Root, projectKey string, issues []core.JiraIssue, syncedAt time.Time) (SyncJiraResult, error) {
	projectKey = strings.ToUpper(strings.TrimSpace(projectKey))
	if projectKey == "" {
		return SyncJiraResult{}, fmt.Errorf("jira project key must not be empty")
	}

	graphPath := JiraGraphRoot + "/" + projectKey
	result := SyncJiraResult{Project: projectKey}

	documents, err := LoadDocuments(root.FlowPath)
	if err != nil {
		return SyncJiraResult{}, err
	}
	existing := map[string]markdown.WorkspaceDocument{}
	for _, item := range documents {
		noteDocument, ok := item.Document.(markdown.NoteDocument)
		if !ok {
			continue
		}
		if noteDocument.Metadata.Graph == graphPath {
			existing[noteDocument.Metadata.ID] = item
		}
	}

	desiredIDs := map[string]struct{}{}
	for _, issue := range issues {
		key := strings.TrimSpace(issue.Key)
		if key == "" {
			continue
		}
		id := jiraNodeID(projectKey, key)
		desiredIDs[id] = struct{}{}

		tags := append([]string{"synced", "jira"}, issue.Labels...)
		body := jiraIssueBody(issue, syncedAt)
		description := strings.TrimSpace(issue.Summary)

		if previous, exists := existing[id]; exists {
			noteDocument := previous.Document.(markdown.NoteDocument)
			if jiraMirrorComparableBody(noteDocument.Body) == jiraMirrorComparableBody(body) && !hasArchivedSourceTag(noteDocument.Metadata.Tags) {
				continue
			}
			if _, err := UpdateDocumentByID(root, id, DocumentPatch{
				Title:       pointerTo(key + " " + description),
				Description: pointerTo(description),
				Tags:        pointerToStrings(tags),
				Body:        pointerTo(body),
			}); err != nil {
				return SyncJiraResult{}, fmt.Errorf("sync update %s: %w", id, err)
			}
			result.Updated = append(result.Updated, id)
			continue
		}

		if _, err := CreateDocument(root, CreateDocumentInput{
			Type:        markdown.NoteType,
			Graph:       graphPath,
			FileName:    key + ".md",
			ID:          id,
			Title:       key + " " + description,
			Description: description,
			Tags:        tags,
			CreatedAt:   syncedAt.Format(time.RFC3339),
			UpdatedAt:   syncedAt.Format(time.RFC3339),
			Body:        body,
		}); err != nil {
			return SyncJiraResult{}, fmt.Errorf("sync create %s: %w", id, err)
		}
		result.Created = append(result.Created, id)
	}

	for id := range existing {
		if _, ok := desiredIDs[id]; ok {
			continue
		}
		item := existing[id]
		noteDocument := item.Document.(markdown.NoteDocument)
		if hasArchivedSourceTag(noteDocument.Metadata.Tags) {
			continue
		}
		tags := append(markdown.CloneStrings(noteDocument.Metadata.Tags), "archived-source")
		sort.Strings(tags)
		if _, err := UpdateDocumentByID(root, id, DocumentPatch{
			Tags:      pointerToStrings(tags),
			UpdatedAt: pointerTo(syncedAt.Format(time.RFC3339)),
		}); err != nil {
			return SyncJiraResult{}, fmt.Errorf("sync archive %s: %w", id, err)
		}
		result.Archived = append(result.Archived, id)
	}

	sort.Strings(result.Created)
	sort.Strings(result.Updated)
	sort.Strings(result.Archived)

	if err := rebuildIndex(root); err != nil {
		return SyncJiraResult{}, err
	}
	return result, nil
}

func jiraNodeID(projectKey string, key string) string {
	return JiraGraphRoot + "/" + projectKey + "/" + strings.ToLower(key)
}

// jiraMirrorComparableBody strips sync-time metadata (the last-synced line)
// so unchanged issues compare equal across syncs.
func jiraMirrorComparableBody(body string) string {
	lines := strings.Split(body, "\n")
	kept := make([]string, 0, len(lines))
	for _, line := range lines {
		if strings.HasPrefix(line, "**Last synced:**") {
			continue
		}
		kept = append(kept, line)
	}
	return strings.Join(kept, "\n")
}

func pointerTo(value string) *string {
	return &value
}

func pointerToStrings(values []string) *[]string {
	return &values
}

func hasArchivedSourceTag(tags []string) bool {
	for _, tag := range tags {
		if strings.EqualFold(tag, "archived-source") {
			return true
		}
	}
	return false
}

func jiraIssueBody(issue core.JiraIssue, syncedAt time.Time) string {
	var builder strings.Builder
	builder.WriteString("# " + issue.Key + " " + strings.TrimSpace(issue.Summary) + "\n\n")
	builder.WriteString("**Status:** " + strings.TrimSpace(issue.Status) + "\n")
	builder.WriteString("**URL:** " + issue.URL + "\n")
	if len(issue.Labels) > 0 {
		builder.WriteString("**Labels:** " + strings.Join(issue.Labels, ", ") + "\n")
	}
	builder.WriteString(fmt.Sprintf("**Last synced:** %s\n\n", syncedAt.Format(time.RFC3339)))
	builder.WriteString(strings.TrimSpace(issue.Description))
	builder.WriteString("\n\n<!-- Mirrored from Jira by flow sync jira. Read-only: edits are overwritten on the next sync. -->\n")
	return builder.String()
}
