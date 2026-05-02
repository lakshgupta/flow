package flow

import _ "embed"

//go:embed all:.github/SKILL.md
var embeddedSkillMarkdown string

// SkillMarkdown returns the skill guide embedded at build time.
func SkillMarkdown() string {
	return embeddedSkillMarkdown
}
