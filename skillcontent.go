package flow

import (
	"embed"
	"io/fs"
	"path"
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
