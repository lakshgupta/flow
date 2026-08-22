package flow

import (
	"embed"
	"io/fs"
	"path"
	"slices"
	"sort"
	"strings"
)

//go:embed all:packaging/skills
var embeddedSkills embed.FS

// SkillNames returns the names of all skills embedded at build time from
// packaging/skills/, sorted alphabetically.
func SkillNames() []string {
	entries, err := fs.ReadDir(embeddedSkills, "packaging/skills")
	if err != nil {
		return nil
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		names = append(names, entry.Name())
	}
	sort.Strings(names)
	return names
}

// SkillMarkdown returns the record-keeping ("flow") skill guide embedded at
// build time. It is the default skill printed by `flow skill content`.
func SkillMarkdown() string {
	markdown, _ := skillMarkdownByName("flow")
	return markdown
}

// SkillMarkdownByName returns the embedded skill markdown for a named skill.
// "record-keeping" is accepted as an alias for the "flow" skill. The second
// return value is false when the name is not a known skill.
func SkillMarkdownByName(name string) (string, bool) {
	switch name {
	case "record-keeping":
		return skillMarkdownByName("flow")
	default:
		return skillMarkdownByName(name)
	}
}

func skillMarkdownByName(name string) (string, bool) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "", false
	}

	// Guard against path traversal outside the embedded skill directory.
	if strings.Contains(trimmed, "..") || strings.Contains(trimmed, "/") || strings.Contains(trimmed, "\\") {
		return "", false
	}

	content, err := embeddedSkills.ReadFile(path.Join("packaging/skills", trimmed, "SKILL.md"))
	if err != nil {
		return "", false
	}

	return string(content), true
}

// Markers delimiting the mode-specific regions of the canonical SKILL.md.
// Everything between a start/end marker pair is replaced when composing a
// non-dev mode; the rest of the canonical skill is shared verbatim.
const (
	modesRoutingStart = "<!-- flow:modes:routing-start -->"
	modesRoutingEnd   = "<!-- flow:modes:routing-end -->"
	modesStagesStart  = "<!-- flow:modes:stages-start -->"
	modesStagesEnd    = "<!-- flow:modes:stages-end -->"

	// modesSplit separates the routing part (replaces the routing region)
	// from the workflows part (replaces the stages region) in a mode file.
	modesSplit = "<!-- flow:modes:split -->"
)

// SkillModes returns the workspace modes supported by `flow skill init`,
// sorted alphabetically. The dev mode is always present: it is the canonical
// skill itself.
func SkillModes() []string {
	modes := []string{"dev"}

	entries, err := fs.ReadDir(embeddedSkills, "packaging/skills/flow/modes")
	if err == nil {
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
				continue
			}
			mode := strings.TrimSuffix(entry.Name(), ".md")
			if !slices.Contains(modes, mode) {
				modes = append(modes, mode)
			}
		}
	}

	slices.Sort(modes)
	return modes
}

// SkillMarkdownForMode returns the composed skill markdown for a workspace
// mode. The dev mode returns the canonical SKILL.md unchanged. Other modes
// replace the canonical stage-routing and stage-workflow regions with the
// matching parts of the mode file; shared sections (record keeping, graph
// engineering) are preserved verbatim. The second return value is false for
// an unknown mode or a malformed composition source.
func SkillMarkdownForMode(mode string) (string, bool) {
	canonical, ok := skillMarkdownByName("flow")
	if !ok {
		return "", false
	}

	trimmed := strings.TrimSpace(mode)
	if trimmed == "" || trimmed == "dev" {
		return canonical, true
	}

	modeContent, ok := skillModeContent(trimmed)
	if !ok {
		return "", false
	}

	routingIndex := strings.Index(canonical, modesRoutingStart)
	routingEnd := strings.Index(canonical, modesRoutingEnd)
	stagesIndex := strings.Index(canonical, modesStagesStart)
	stagesEnd := strings.Index(canonical, modesStagesEnd)
	splitIndex := strings.Index(modeContent, modesSplit)
	if routingIndex < 0 || routingEnd < 0 || stagesIndex < 0 || stagesEnd < 0 || splitIndex < 0 {
		return "", false
	}
	if routingEnd < routingIndex || stagesEnd < stagesIndex || stagesIndex < routingEnd || splitIndex <= 0 {
		return "", false
	}

	routingPart := strings.TrimSpace(modeContent[:splitIndex])
	workflowsPart := strings.TrimSpace(modeContent[splitIndex+len(modesSplit):])

	var composed strings.Builder
	composed.WriteString(canonical[:routingIndex])
	composed.WriteString(routingPart + "\n\n")
	composed.WriteString(canonical[routingEnd+len(modesRoutingEnd) : stagesIndex])
	composed.WriteString(workflowsPart + "\n\n")
	composed.WriteString(canonical[stagesEnd+len(modesStagesEnd):])

	return strings.TrimSpace(composed.String()), true
}

func skillModeContent(mode string) (string, bool) {
	trimmed := strings.TrimSpace(mode)
	if trimmed == "" {
		return "", false
	}

	// Guard against path traversal outside the embedded mode directory.
	if strings.Contains(trimmed, "..") || strings.Contains(trimmed, "/") || strings.Contains(trimmed, "\\") {
		return "", false
	}

	content, err := embeddedSkills.ReadFile(path.Join("packaging/skills/flow/modes", trimmed+".md"))
	if err != nil {
		return "", false
	}

	return string(content), true
}
