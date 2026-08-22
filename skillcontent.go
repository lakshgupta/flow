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

// skillModeDescriptionLines maps mode names to the one-line purpose shown in
// `flow skill init --help`.
var skillModeDescriptionLines = map[string]string{
	"dev":  "dev   Full development workflow (design, plan, implement, fix, refactor, test, review, commit) plus roadmap batching",
	"note": "note  General note taking: free-form notebooks for ad-hoc notes, books, manuals; no development stages",
	"pm":   "pm    Notes plus read-only discipline for externally synced tickets (Jira/Aha mirrors)",
}

// SkillModeDescriptions returns one "<name> <purpose>" line per available
// mode, sorted by mode name.
func SkillModeDescriptions() []string {
	lines := make([]string, 0, len(skillModeDescriptionLines))
	for _, mode := range SkillModes() {
		line := skillModeDescriptionLines[mode]
		if line == "" {
			line = mode + "  Workspace mode"
		}
		lines = append(lines, line)
	}
	return lines
}

// SkillMarkdownForMode returns the composed skill markdown for one workspace
// mode. See SkillMarkdownForModes.
func SkillMarkdownForMode(mode string) (string, bool) {
	return SkillMarkdownForModes([]string{mode})
}

// SkillMarkdownForModes composes the skill markdown for one or more workspace
// modes. The dev mode returns the canonical SKILL.md unchanged (it already
// contains everything the other modes provide). Multiple non-dev modes are
// composed by concatenating their routing and workflow sections in the given
// order; shared sections (record keeping, graph engineering) are preserved
// verbatim. The second return value is false for an unknown mode or a
// malformed composition source.
func SkillMarkdownForModes(modes []string) (string, bool) {
	canonical, ok := skillMarkdownByName("flow")
	if !ok {
		return "", false
	}

	cleaned := make([]string, 0, len(modes))
	for _, mode := range modes {
		trimmed := strings.TrimSpace(mode)
		if trimmed == "" {
			continue
		}
		if trimmed == "dev" {
			return canonical, true
		}
		cleaned = append(cleaned, trimmed)
	}
	if len(cleaned) == 0 {
		return canonical, true
	}

	modeContents := make([]string, 0, len(cleaned))
	for _, mode := range cleaned {
		content, ok := skillModeContent(mode)
		if !ok {
			return "", false
		}
		modeContents = append(modeContents, content)
	}

	routingIndex := strings.Index(canonical, modesRoutingStart)
	routingEnd := strings.Index(canonical, modesRoutingEnd)
	stagesIndex := strings.Index(canonical, modesStagesStart)
	stagesEnd := strings.Index(canonical, modesStagesEnd)
	if routingIndex < 0 || routingEnd < 0 || stagesIndex < 0 || stagesEnd < 0 {
		return "", false
	}
	if routingEnd < routingIndex || stagesEnd < stagesIndex || stagesIndex < routingEnd {
		return "", false
	}

	routingParts := make([]string, 0, len(modeContents))
	workflowsParts := make([]string, 0, len(modeContents))
	for _, modeContent := range modeContents {
		splitIndex := strings.Index(modeContent, modesSplit)
		if splitIndex <= 0 {
			return "", false
		}
		routingParts = append(routingParts, strings.TrimSpace(modeContent[:splitIndex]))
		workflowsParts = append(workflowsParts, strings.TrimSpace(modeContent[splitIndex+len(modesSplit):]))
	}

	var composed strings.Builder
	composed.WriteString(canonical[:routingIndex])
	composed.WriteString(strings.Join(routingParts, "\n\n") + "\n\n")
	composed.WriteString(canonical[routingEnd+len(modesRoutingEnd) : stagesIndex])
	composed.WriteString(strings.Join(workflowsParts, "\n\n") + "\n\n")
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
