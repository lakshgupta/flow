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
// external/jira/<PROJECT>/. It now handles hierarchical epics:
//   - Open epics become graphs at external/jira/<PROJECT>/<EPIC>/<EPIC>.md
//   - Features (children of an epic) become sub-graphs at external/jira/<PROJECT>/<EPIC>/<FEATURE>/<FEATURE>.md
//   - Stories/tasks under a feature become files at external/jira/<PROJECT>/<EPIC>/<FEATURE>/<STORY>.md
//   - Orphan issues (no epic parent) remain flat at external/jira/<PROJECT>/<KEY>.md
// Relationships are captured via frontmatter `links` (edges). Bodies contain the Jira content.
// Markdown is written first, then the index refreshes. Deletions in source mark nodes with
// an archived-source tag instead of deleting, preserving edge integrity.
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
	// Collect existing jira docs under this project (including sub-graphs)
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

	// Build hierarchy: open epics -> features -> stories
	byKey := map[string]core.JiraIssue{}
	for _, issue := range issues {
		key := strings.TrimSpace(issue.Key)
		if key == "" {
			continue
		}
		byKey[strings.ToUpper(key)] = issue
	}

	openEpics := map[string]core.JiraIssue{}
	for _, issue := range issues {
		if isEpic(issue) && isOpenStatus(issue.Status) {
			openEpics[strings.ToUpper(issue.Key)] = issue
		}
	}

	// Map epic -> direct children (features)
	epicChildren := map[string][]core.JiraIssue{}
	// Map feature -> children (stories)
	featureChildren := map[string][]core.JiraIssue{}
	// Track which keys are part of hierarchy (to handle orphans)
	inHierarchy := map[string]bool{}

	for _, epic := range openEpics {
		epicKeyUpper := strings.ToUpper(epic.Key)
		inHierarchy[epicKeyUpper] = true
		for _, issue := range issues {
			if strings.EqualFold(issue.Key, epic.Key) {
				continue
			}
			parentUpper := strings.ToUpper(strings.TrimSpace(issue.ParentKey))
			epicLinkUpper := strings.ToUpper(strings.TrimSpace(issue.EpicLink))
			if parentUpper == epicKeyUpper || epicLinkUpper == epicKeyUpper {
				epicChildren[epicKeyUpper] = append(epicChildren[epicKeyUpper], issue)
				inHierarchy[strings.ToUpper(issue.Key)] = true
			}
		}
	}
	// For each feature under epic, find its children (stories)
	for _, features := range epicChildren {
		for _, feature := range features {
			featKeyUpper := strings.ToUpper(feature.Key)
			for _, issue := range issues {
				if strings.EqualFold(issue.Key, feature.Key) {
					continue
				}
				// Avoid re-adding epics themselves
				if _, isEpic := openEpics[strings.ToUpper(issue.Key)]; isEpic {
					continue
				}
				parentUpper := strings.ToUpper(strings.TrimSpace(issue.ParentKey))
				if parentUpper == featKeyUpper {
					featureChildren[featKeyUpper] = append(featureChildren[featKeyUpper], issue)
					inHierarchy[strings.ToUpper(issue.Key)] = true
				}
			}
		}
	}

	// Desired IDs and their graph/file mapping
	type desired struct {
		issue     core.JiraIssue
		graphPath string
		fileName  string
		id        string
		links     []markdown.NodeLink
	}
	desiredMap := map[string]desired{}
	// Also need to map issue key to ID for linking
	keyToID := map[string]string{}

	// First pass: create desired entries for epics, features, stories, orphans
	for epicKey, epic := range openEpics {
		graphPath := epicGraphPath(projectKey, epic.Key)
		id := jiraEpicNodeID(projectKey, epic.Key)
		keyToID[strings.ToUpper(epic.Key)] = id
		desiredMap[id] = desired{
			issue:     epic,
			graphPath: graphPath,
			fileName:  epic.Key + ".md",
			id:        id,
		}
		_ = epicKey
		_ = graphPath
	}

	for epicKey, features := range epicChildren {
		for _, feature := range features {
			featKeyUpper := strings.ToUpper(feature.Key)
			graphPath := featureGraphPath(projectKey, epicKey, feature.Key)
			id := jiraFeatureNodeID(projectKey, epicKey, feature.Key)
			keyToID[featKeyUpper] = id
			desiredMap[id] = desired{
				issue:     feature,
				graphPath: graphPath,
				fileName:  feature.Key + ".md",
				id:        id,
			}
			// Also handle stories under this feature
			for _, story := range featureChildren[featKeyUpper] {
				storyKeyUpper := strings.ToUpper(story.Key)
				// Stories share the feature's graph
				storyGraph := graphPath
				storyID := jiraStoryNodeID(projectKey, epicKey, feature.Key, story.Key)
				keyToID[storyKeyUpper] = storyID
				desiredMap[storyID] = desired{
					issue:     story,
					graphPath: storyGraph,
					fileName:  story.Key + ".md",
					id:        storyID,
				}
			}
		}
	}

	// Orphans: issues not in hierarchy (including non-epic flat issues, or closed epics)
	for _, issue := range issues {
		upper := strings.ToUpper(strings.TrimSpace(issue.Key))
		if _, ok := inHierarchy[upper]; ok {
			continue
		}
		// Also skip closed epics that were not open (they are not in openEpics but are epics)
		if isEpic(issue) && !isOpenStatus(issue.Status) {
			// Still need to handle archiving for previously synced closed epic? We will archive via missing desired, but not create new.
			continue
		}
		// For orphans, use flat graph
		graphPath := graphRoot
		id := jiraNodeID(projectKey, issue.Key)
		keyToID[upper] = id
		// Avoid overwriting if already in desiredMap (should not happen for orphans)
		if _, exists := desiredMap[id]; exists {
			continue
		}
		desiredMap[id] = desired{
			issue:     issue,
			graphPath: graphPath,
			fileName:  issue.Key + ".md",
			id:        id,
		}
	}

	// Second pass: populate links (edges) based on hierarchy
	for id, d := range desiredMap {
		issue := d.issue
		upper := strings.ToUpper(issue.Key)
		var links []markdown.NodeLink
		// If issue is an epic, link to its features
		if _, isEpic := openEpics[upper]; isEpic {
			for _, feat := range epicChildren[upper] {
				if fid, ok := keyToID[strings.ToUpper(feat.Key)]; ok {
					links = append(links, markdown.NodeLink{Node: fid})
				}
			}
		} else {
			// If issue is a feature, link to its stories
			if children, ok := featureChildren[upper]; ok && len(children) > 0 {
				for _, child := range children {
					if cid, ok := keyToID[strings.ToUpper(child.Key)]; ok {
						links = append(links, markdown.NodeLink{Node: cid})
					}
				}
			}
			// Also, if issue has a parent that is in hierarchy, ensure parent links to it (already handled via parent's links)
		}
		// Sort for determinism
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
			// Compare body and tags and links
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

		// Create new document (without links first to avoid validation order issues)
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

	// Second pass: set links for newly created documents that have edges
	// (existing docs already handled via patch above)
	for id, d := range desiredMap {
		if len(d.links) == 0 {
			continue
		}
		// Only update if this was newly created (not already handled as existing)
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

func jiraNodeID(projectKey string, key string) string {
	return JiraGraphRoot + "/" + projectKey + "/" + strings.ToLower(key)
}

func jiraEpicNodeID(projectKey string, epicKey string) string {
	return JiraGraphRoot + "/" + projectKey + "/" + epicKey + "/" + strings.ToLower(epicKey)
}

func jiraFeatureNodeID(projectKey string, epicKey string, featureKey string) string {
	return JiraGraphRoot + "/" + projectKey + "/" + epicKey + "/" + featureKey + "/" + strings.ToLower(featureKey)
}

func jiraStoryNodeID(projectKey string, epicKey string, featureKey string, storyKey string) string {
	return JiraGraphRoot + "/" + projectKey + "/" + epicKey + "/" + featureKey + "/" + strings.ToLower(storyKey)
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
		// Check if contains done/closed
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
