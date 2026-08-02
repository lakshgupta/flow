package flow

import _ "embed"

//go:embed all:packaging/SKILL.md
var embeddedSkillMarkdown string

//go:embed all:.agents/skills/graph-engineering/SKILL.md
var embeddedGraphEngineeringSkillMarkdown string

// SkillMarkdown returns the record-keeping skill guide embedded at build time.
func SkillMarkdown() string {
	return embeddedSkillMarkdown
}

// GraphEngineeringSkillMarkdown returns the graph-engineering skill guide embedded at build time.
func GraphEngineeringSkillMarkdown() string {
	return embeddedGraphEngineeringSkillMarkdown
}

// SkillMarkdownByName returns the embedded skill markdown for a named skill.
// The second return value is false when the name is not a known skill.
func SkillMarkdownByName(name string) (string, bool) {
	switch name {
	case "record-keeping", "":
		return embeddedSkillMarkdown, true
	case "graph-engineering":
		return embeddedGraphEngineeringSkillMarkdown, true
	default:
		return "", false
	}
}
