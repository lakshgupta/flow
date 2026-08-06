package flow

import (
	"slices"
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
			name:      "flow default",
			skill:     "flow",
			wantFound: true,
			wantSub:   "# Skill: Flow-First Record Keeping",
		},
		{
			name:      "record-keeping alias",
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
			name:      "design",
			skill:     "design",
			wantFound: true,
			wantSub:   "Flow record-keeping requirements",
		},
		{
			name:      "unknown skill",
			skill:     "does-not-exist",
			wantFound: false,
		},
		{
			name:      "empty name",
			skill:     "",
			wantFound: false,
		},
		{
			name:      "path traversal rejected",
			skill:     "../flow",
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

func TestSkillNames(t *testing.T) {
	names := SkillNames()

	for _, expected := range []string{"flow", "design", "plan", "implement", "fix", "refactor", "test", "review", "commit", "graph-engineering"} {
		if !slices.Contains(names, expected) {
			t.Fatalf("SkillNames() missing %q; got %v", expected, names)
		}
	}

	if !slices.IsSorted(names) {
		t.Fatalf("SkillNames() is not sorted: %v", names)
	}

	seen := map[string]bool{}
	for _, name := range names {
		if seen[name] {
			t.Fatalf("SkillNames() contains duplicate %q", name)
		}
		seen[name] = true

		markdown, ok := SkillMarkdownByName(name)
		if !ok {
			t.Fatalf("SkillMarkdownByName(%q) not found for a listed skill", name)
		}
		if strings.TrimSpace(markdown) == "" {
			t.Fatalf("SkillMarkdownByName(%q) returned empty content", name)
		}
	}
}