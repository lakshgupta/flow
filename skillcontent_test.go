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

func TestSkillModes(t *testing.T) {
	modes := SkillModes()

	for _, want := range []string{"dev", "note", "pm"} {
		if !slices.Contains(modes, want) {
			t.Fatalf("SkillModes() missing %q; got %v", want, modes)
		}
	}

	if !slices.IsSorted(modes) {
		t.Fatalf("SkillModes() is not sorted: %v", modes)
	}
}

func TestSkillMarkdownForModeDevReturnsCanonical(t *testing.T) {
	canonical, _ := skillMarkdownByName("flow")

	composed, ok := SkillMarkdownForMode("dev")
	if !ok {
		t.Fatal("SkillMarkdownForMode(\"dev\") not found")
	}
	if composed != canonical {
		t.Fatal("dev mode must return the canonical SKILL.md verbatim")
	}

	composed, ok = SkillMarkdownForMode("")
	if !ok || composed != canonical {
		t.Fatal("empty mode must fall back to the canonical SKILL.md")
	}
}

func TestSkillMarkdownForModeComposesNoteMode(t *testing.T) {
	canonical, _ := skillMarkdownByName("flow")

	composed, ok := SkillMarkdownForMode("note")
	if !ok {
		t.Fatal("SkillMarkdownForMode(\"note\") not found")
	}

	for _, unwanted := range []string{
		"## 2.1 Design",
		"## 2.3 Implement",
		"## 2.8 Commit",
		"Feature design proposal recorded as a design note node",
	} {
		if strings.Contains(composed, unwanted) {
			t.Fatalf("note-mode composition contains development-only content %q", unwanted)
		}
	}

	for _, wanted := range []string{
		"# Skill: Flow — Complete Workspace Workflow",
		"## 1. Record Keeping Protocol",
		"## 3. Graph Engineering",
		"## Notes Mode",
		"Naming — Relaxed",
	} {
		if !strings.Contains(composed, wanted) {
			t.Fatalf("note-mode composition missing expected content %q", wanted)
		}
	}

	if strings.Contains(composed, "flow:modes:") {
		t.Fatal("composed output leaks composition markers")
	}

	if composed == canonical {
		t.Fatal("note-mode composition must differ from the canonical skill")
	}
}

func TestSkillMarkdownForModeComposesPmMode(t *testing.T) {
	composed, ok := SkillMarkdownForMode("pm")
	if !ok {
		t.Fatal("SkillMarkdownForMode(\"pm\") not found")
	}

	for _, wanted := range []string{
		"## 1. Record Keeping Protocol",
		"## Synced External Nodes — Read-Only Discipline",
	} {
		if !strings.Contains(composed, wanted) {
			t.Fatalf("pm-mode composition missing expected content %q", wanted)
		}
	}
}

func TestSkillMarkdownForModeUnknownAndMalformed(t *testing.T) {
	if _, ok := SkillMarkdownForMode("does-not-exist"); ok {
		t.Fatal("unknown mode must not be found")
	}
	if _, ok := SkillMarkdownForMode("../dev"); ok {
		t.Fatal("path traversal in mode name must be rejected")
	}
}
