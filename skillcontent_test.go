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
			wantSub:   "# Skill: Flow — Complete Workspace Workflow",
		},
		{
			name:      "record-keeping alias",
			skill:     "record-keeping",
			wantFound: true,
			wantSub:   "# Skill: Flow — Complete Workspace Workflow",
		},
		{
			name:      "record-keeping protocol section",
			skill:     "flow",
			wantFound: true,
			wantSub:   "## 1. Record Keeping Protocol",
		},
		{
			name:      "stage workflow sections",
			skill:     "flow",
			wantFound: true,
			wantSub:   "## 2. Stage Workflows",
		},
		{
			name:      "graph engineering section",
			skill:     "flow",
			wantFound: true,
			wantSub:   "## 3. Graph Engineering",
		},
		{
			name:      "unknown skill",
			skill:     "does-not-exist",
			wantFound: false,
		},
		{
			name:      "removed stage skill is unknown",
			skill:     "design",
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
	if !strings.Contains(SkillMarkdown(), "Complete Workspace Workflow") {
		t.Fatal("SkillMarkdown() does not contain the merged skill body")
	}
}

func TestSkillNames(t *testing.T) {
	names := SkillNames()

	if len(names) != 1 {
		t.Fatalf("SkillNames() should contain exactly one merged skill; got %v", names)
	}

	if !slices.Contains(names, "flow") {
		t.Fatalf("SkillNames() missing %q; got %v", "flow", names)
	}

	if !slices.IsSorted(names) {
		t.Fatalf("SkillNames() is not sorted: %v", names)
	}

	markdown, ok := SkillMarkdownByName(names[0])
	if !ok {
		t.Fatalf("SkillMarkdownByName(%q) not found for a listed skill", names[0])
	}
	if strings.TrimSpace(markdown) == "" {
		t.Fatalf("SkillMarkdownByName(%q) returned empty content", names[0])
	}
}
