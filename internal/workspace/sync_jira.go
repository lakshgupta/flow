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

// SyncJira mirrors fetched tracker issues into read-only note nodes.
// It handles the full Jira hierarchy generically:
//
//   - Any issue can be a parent (has children via ParentKey/EpicLink) or a leaf.
//   - Epics and Features are always graphs (even without children) to give them a dedicated directory.
//   - An issue that has children becomes a graph at <parentGraph>/<issueKey>/<issueKey>.md
//   - A leaf issue becomes a file at <parentGraph>/<issueKey>.md where parentGraph is its parent's graph (or project root if no parent).
//   - Open epics are top-level graphs; features without an epic become top-level graphs; standalone JIRAs (Bug/Task/Story without parent) are flat files at project root.
//   - Stories with children become graphs (their children are files under them).
//   - Relationships are captured via frontmatter `links` (edges) from parent to children, and bodies contain the Jira content.
//
// Markdown is written first, then the index refreshes. Missing issues are archived with `archived-source`.
func SyncJira(root Root, projectKey string, issues []core.JiraIssue, syncedAt time.Time) (SyncJiraResult, error) {
	projectKey = strings.ToUpper(strings.TrimSpace(projectKey))
	if projectKey == "" {
		return SyncJiraResult{}, fmt.Errorf("jira project key must not be empty")
	}

	graphRoot := JiraGraphRoot + "/" + projectKey
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
		graph := noteDocument.Metadata.Graph
		if graph == graphRoot || strings.HasPrefix(graph, graphRoot+"/") {
			existing[noteDocument.Metadata.ID] = item
		}
	}

	// Build maps for hierarchy
	byKey := map[string]core.JiraIssue{}
	for _, issue := range issues {
		key := strings.TrimSpace(issue.Key)
		if key == "" {
			continue
		}
		byKey[strings.ToUpper(key)] = issue
	}

	// Build parent -> children map for all issues (including Done, to preserve links)
	childrenMap := map[string][]core.JiraIssue{}
	for _, issue := range issues {
		parentKey := strings.TrimSpace(issue.ParentKey)
		if parentKey == "" {
			parentKey = strings.TrimSpace(issue.EpicLink)
		}
		if parentKey == "" {
			continue
		}
		parentUpper := strings.ToUpper(parentKey)
		if _, ok := byKey[parentUpper]; ok {
			childrenMap[parentUpper] = append(childrenMap[parentUpper], issue)
		}
	}

	// Helper to determine if an issue should be a graph (directory)
	shouldBeGraph := func(issue core.JiraIssue) bool {
		upper := strings.ToUpper(issue.Key)
		if _, hasChildren := childrenMap[upper]; hasChildren {
			return true
		}
		if isEpic(issue) {
			return true
		}
		if strings.EqualFold(strings.TrimSpace(issue.IssueType), "Feature") {
			return true
		}
		return false
	}

	// For each issue (including Done for archiving test), compute its graph path and ID
	desiredMap := map[string]desired{}
	keyToID := map[string]string{}

	for _, issue := range issues {
		key := strings.TrimSpace(issue.Key)
		if key == "" {
			continue
		}
		upper := strings.ToUpper(key)
		graphPath, fileName, id := graphAndIDForIssue(issue, childrenMap, projectKey, byKey, shouldBeGraph)
		keyToID[upper] = id
		desiredMap[id] = desired{
			issue:     issue,
			graphPath: graphPath,
			fileName:  fileName,
			id:        id,
		}
	}

	// Second pass: populate links from parent to children
	for id, d := range desiredMap {
		upper := strings.ToUpper(d.issue.Key)
		children, ok := childrenMap[upper]
		if !ok || len(children) == 0 {
			continue
		}
		var links []markdown.NodeLink
		for _, child := range children {
			childUpper := strings.ToUpper(child.Key)
			if cid, ok := keyToID[childUpper]; ok {
				links = append(links, markdown.NodeLink{Node: cid})
			}
		}
		sort.Slice(links, func(i, j int) bool { return links[i].Node < links[j].Node })
		d.links = links
		desiredMap[id] = d
	}

	desiredIDs := map[string]struct{}{}
	for id := range desiredMap {
		desiredIDs[id] = struct{}{}
	}

	// Create or update desired docs
	for id, d := range desiredMap {
		issue := d.issue
		tags := append([]string{"synced", "jira"}, issue.Labels...)
		body := jiraIssueBody(issue, syncedAt)
		description := strings.TrimSpace(issue.Summary)
		title := issue.Key + " " + description
		if description == "" {
			title = issue.Key
		}

		if previous, exists := existing[id]; exists {
			noteDocument := previous.Document.(markdown.NoteDocument)
			existingLinks := noteDocument.Metadata.Links
			existingLinkIDs := []string{}
			for _, l := range existingLinks {
				existingLinkIDs = append(existingLinkIDs, l.Node)
			}
			sort.Strings(existingLinkIDs)
			desiredLinkIDs := []string{}
			for _, l := range d.links {
				desiredLinkIDs = append(desiredLinkIDs, l.Node)
			}
			sort.Strings(desiredLinkIDs)
			bodySame := jiraMirrorComparableBody(noteDocument.Body) == jiraMirrorComparableBody(body)
			tagsSame := stringsEqualIgnoreOrder(noteDocument.Metadata.Tags, tags)
			linksSame := stringsEqualIgnoreOrder(existingLinkIDs, desiredLinkIDs)
			if bodySame && tagsSame && linksSame && !hasArchivedSourceTag(noteDocument.Metadata.Tags) && noteDocument.Metadata.Title == title && noteDocument.Metadata.Description == description {
				continue
			}
			patch := DocumentPatch{
				Title:       pointerTo(title),
				Description: pointerTo(description),
				Tags:        pointerToStrings(tags),
				Body:        pointerTo(body),
			}
			if !linksSame {
				linksCopy := append([]markdown.NodeLink(nil), d.links...)
				patch.Links = &linksCopy
			}
			if _, err := UpdateDocumentByID(root, id, patch); err != nil {
				return SyncJiraResult{}, fmt.Errorf("sync update %s: %w", id, err)
			}
			result.Updated = append(result.Updated, id)
			continue
		}

		if _, err := CreateDocument(root, CreateDocumentInput{
			Type:        markdown.NoteType,
			Graph:       d.graphPath,
			FileName:    d.fileName,
			ID:          id,
			Title:       title,
			Description: description,
			Tags:        tags,
			CreatedAt:   syncedAt.Format(time.RFC3339),
			UpdatedAt:   syncedAt.Format(time.RFC3339),
			Body:        body,
			Links:       nil,
		}); err != nil {
			return SyncJiraResult{}, fmt.Errorf("sync create %s: %w", id, err)
		}
		result.Created = append(result.Created, id)
	}

	// Second pass: set links for newly created documents
	for id, d := range desiredMap {
		if len(d.links) == 0 {
			continue
		}
		isNew := false
		for _, cid := range result.Created {
			if cid == id {
				isNew = true
				break
			}
		}
		if !isNew {
			continue
		}
		linksCopy := append([]markdown.NodeLink(nil), d.links...)
		if _, err := UpdateDocumentByID(root, id, DocumentPatch{Links: &linksCopy}); err != nil {
			return SyncJiraResult{}, fmt.Errorf("sync set links %s: %w", id, err)
		}
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

type desired struct {
	issue     core.JiraIssue
	graphPath string
	fileName  string
	id        string
	links     []markdown.NodeLink
}

func graphAndIDForIssue(issue core.JiraIssue, childrenMap map[string][]core.JiraIssue, projectKey string, byKey map[string]core.JiraIssue, shouldBeGraph func(core.JiraIssue) bool) (string, string, string) {
	parentChain := []string{}
	curKey := strings.TrimSpace(issue.ParentKey)
	if curKey == "" {
		curKey = strings.TrimSpace(issue.EpicLink)
	}
	visited := map[string]bool{}
	for curKey != "" && len(parentChain) < 10 {
		upper := strings.ToUpper(curKey)
		if visited[upper] {
			break
		}
		visited[upper] = true
		parentIssue, ok := byKey[upper]
		if !ok {
			break
		}
		if shouldBeGraph(parentIssue) {
			parentChain = append([]string{parentIssue.Key}, parentChain...)
		} else {
			curKey = strings.TrimSpace(parentIssue.ParentKey)
			if curKey == "" {
				curKey = strings.TrimSpace(parentIssue.EpicLink)
			}
			continue
		}
		curKey = strings.TrimSpace(parentIssue.ParentKey)
		if curKey == "" {
			curKey = strings.TrimSpace(parentIssue.EpicLink)
		}
	}

	isGraph := shouldBeGraph(issue)
	var graphPath string
	var fileName string
	var id string
	if isGraph {
		if len(parentChain) == 0 {
			graphPath = epicGraphPath(projectKey, issue.Key)
		} else {
			parts := []string{JiraGraphRoot, projectKey}
			parts = append(parts, parentChain...)
			parts = append(parts, issue.Key)
			graphPath = strings.Join(parts, "/")
		}
		fileName = issue.Key + ".md"
		id = graphPath + "/" + strings.ToLower(issue.Key)
	} else {
		if len(parentChain) == 0 {
			parentKey := strings.TrimSpace(issue.ParentKey)
			if parentKey == "" {
				parentKey = strings.TrimSpace(issue.EpicLink)
			}
			if parentKey != "" {
				parentUpper := strings.ToUpper(parentKey)
				if parentIssue, ok := byKey[parentUpper]; ok {
					pg, _, _ := graphAndIDForIssue(parentIssue, childrenMap, projectKey, byKey, shouldBeGraph)
					graphPath = pg
				} else {
					graphPath = JiraGraphRoot + "/" + projectKey
				}
			} else {
				graphPath = JiraGraphRoot + "/" + projectKey
			}
		} else {
			parts := []string{JiraGraphRoot, projectKey}
			parts = append(parts, parentChain...)
			graphPath = strings.Join(parts, "/")
		}
		fileName = issue.Key + ".md"
		id = graphPath + "/" + strings.ToLower(issue.Key)
		if len(parentChain) == 0 && issue.ParentKey != "" {
			parentUpper := strings.ToUpper(strings.TrimSpace(issue.ParentKey))
			if parentIssue, ok := byKey[parentUpper]; ok && shouldBeGraph(parentIssue) {
				pg, _, _ := graphAndIDForIssue(parentIssue, childrenMap, projectKey, byKey, shouldBeGraph)
				graphPath = pg
				id = graphPath + "/" + strings.ToLower(issue.Key)
			}
		}
	}
	graphPath = strings.TrimSuffix(graphPath, "/")
	if !isGraph {
		if strings.HasSuffix(graphPath, "/"+issue.Key) {
			graphPath = strings.TrimSuffix(graphPath, "/"+issue.Key)
			if graphPath == "" {
				graphPath = JiraGraphRoot + "/" + projectKey
			}
			id = graphPath + "/" + strings.ToLower(issue.Key)
		}
	}
	return graphPath, fileName, id
}

func jiraNodeID(projectKey string, key string) string {
	return JiraGraphRoot + "/" + projectKey + "/" + strings.ToLower(key)
}

func epicGraphPath(projectKey string, epicKey string) string {
	return JiraGraphRoot + "/" + projectKey + "/" + epicKey
}

func featureGraphPath(projectKey string, epicKey string, featureKey string) string {
	return JiraGraphRoot + "/" + projectKey + "/" + epicKey + "/" + featureKey
}

func isEpic(issue core.JiraIssue) bool {
	return strings.EqualFold(strings.TrimSpace(issue.IssueType), "Epic")
}

func isOpenStatus(status string) bool {
	s := strings.ToLower(strings.TrimSpace(status))
	switch s {
	case "done", "closed", "resolved", "completed", "complete", "cancelled", "canceled", "rejected", "won't do", "wont do":
		return false
	case "":
		return true
	default:
		if strings.Contains(s, "done") || strings.Contains(s, "closed") || strings.Contains(s, "resolved") {
			return false
		}
		return true
	}
}

func stringsEqualIgnoreOrder(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	aa := append([]string(nil), a...)
	bb := append([]string(nil), b...)
	sort.Strings(aa)
	sort.Strings(bb)
	for i := range aa {
		if aa[i] != bb[i] {
			return false
		}
	}
	return true
}

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
	if issue.IssueType != "" {
		builder.WriteString("**Type:** " + strings.TrimSpace(issue.IssueType) + "\n")
	}
	builder.WriteString("**Status:** " + strings.TrimSpace(issue.Status) + "\n")
	if issue.ParentKey != "" {
		builder.WriteString("**Parent:** " + issue.ParentKey + "\n")
	}
	builder.WriteString("**URL:** " + issue.URL + "\n")
	if len(issue.Labels) > 0 {
		builder.WriteString("**Labels:** " + strings.Join(issue.Labels, ", ") + "\n")
	}
	builder.WriteString(fmt.Sprintf("**Last synced:** %s\n\n", syncedAt.Format(time.RFC3339)))
	builder.WriteString(strings.TrimSpace(issue.Description))
	builder.WriteString("\n\n<!-- Mirrored from Jira by flow sync jira. Read-only: edits are overwritten on the next sync. -->\n")
	return builder.String()
}
