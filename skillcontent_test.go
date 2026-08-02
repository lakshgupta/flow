package flow

import (
	"strings"
	"testing"
)

func TestSkillMarkdownByName(t *testing.T) {
	tests := []struct {
		name      string
		skill     string
		wantFound bool
		wantSub   string
	}{
		{
			name:      "record-keeping default",
			skill:     "record-keeping",
			wantFound: true,
			wantSub:   "# Skill: Flow-First Record Keeping",
		},
		{
			name:      "graph-engineering",
			skill:     "graph-engineering",
			wantFound: true,
			wantSub:   "## Flow Graph Model",
		},
		{
			name:      "unknown skill",
			skill:     "does-not-exist",
			wantFound: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			markdown, found := SkillMarkdownByName(tc.skill)
			if found != tc.wantFound {
				t.Fatalf("SkillMarkdownByName(%q) found = %v, want %v", tc.skill, found, tc.wantFound)
			}
			if !tc.wantFound {
				if markdown != "" {
					t.Fatalf("SkillMarkdownByName(%q) returned content %q for an unknown skill", tc.skill, markdown)
				}
				return
			}
			if !strings.Contains(markdown, tc.wantSub) {
				t.Fatalf("SkillMarkdownByName(%q) content missing expected substring %q; got:\n%s", tc.skill, tc.wantSub, markdown)
			}
		})
	}
}

func TestSkillMarkdownAccessors(t *testing.T) {
	if !strings.Contains(SkillMarkdown(), "Flow-First Record Keeping") {
		t.Fatal("SkillMarkdown() does not contain the record-keeping skill body")
	}
	if !strings.Contains(GraphEngineeringSkillMarkdown(), "Flow Graph Model") {
		t.Fatal("GraphEngineeringSkillMarkdown() does not contain the graph-engineering skill body")
	}
}
