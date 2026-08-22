package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// initWorkspaceDirForTest runs flow init non-interactively and returns the dir.
func initWorkspaceDirForTest(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	stdout, stderr := runForTest(t, []string{"init"}, dir)
	if stderr != "" {
		t.Fatalf("init stderr = %q", stderr)
	}
	if !strings.Contains(stdout, "Initialized local workspace") {
		t.Fatalf("unexpected init output %q", stdout)
	}
	return dir
}

func TestFlowInitNonInteractivePrintsHintWithoutWritingAgents(t *testing.T) {
	dir := initWorkspaceDirForTest(t)

	if _, err := os.Stat(filepath.Join(dir, ".agents")); !os.IsNotExist(err) {
		t.Fatal("non-interactive flow init must not create .agents")
	}
	if _, err := os.Stat(filepath.Join(dir, "AGENTS.md")); !os.IsNotExist(err) {
		t.Fatal("non-interactive flow init must not create AGENTS.md")
	}
}

func TestFlowInitInteractiveChoiceInstallsSkillAndGuide(t *testing.T) {
	dir := t.TempDir()
	runForTest(t, []string{"init"}, dir, withStdin("1\n"))

	skillPath := filepath.Join(dir, ".agents", "skills", "flow", "SKILL.md")
	data, err := os.ReadFile(skillPath)
	if err != nil {
		t.Fatalf("read installed skill: %v", err)
	}
	if !strings.Contains(string(data), "## 2. Stage Workflows") {
		t.Fatal("dev-mode skill should be the canonical skill")
	}

	agentsData, err := os.ReadFile(filepath.Join(dir, "AGENTS.md"))
	if err != nil {
		t.Fatalf("read AGENTS.md: %v", err)
	}
	if !strings.Contains(string(agentsData), agentsGuideStart) || !strings.Contains(string(agentsData), "roadmap (2.9)") {
		t.Fatalf("AGENTS.md missing managed dev guide:\n%s", agentsData)
	}
}

func TestFlowInitInteractiveModeChoiceInstallsComposedSkill(t *testing.T) {
	dir := t.TempDir()
	runForTest(t, []string{"init"}, dir, withStdin("2\nnote,pm\n"))

	content, err := os.ReadFile(filepath.Join(dir, ".agents", "skills", "flow", "SKILL.md"))
	if err != nil {
		t.Fatalf("read composed skill: %v", err)
	}
	composed := string(content)
	for _, wanted := range []string{"## Notes Mode", "## Synced External Nodes — Read-Only Discipline"} {
		if !strings.Contains(composed, wanted) {
			t.Fatalf("note+pm skill missing %q", wanted)
		}
	}
	if strings.Contains(composed, "## 2. Stage Workflows") {
		t.Fatal("note+pm skill must exclude development stages")
	}
}

func TestFlowInitInteractiveSkipLeavesWorkspaceUntouched(t *testing.T) {
	dir := t.TempDir()
	stdout, _ := runForTest(t, []string{"init"}, dir, withStdin("s\n"))
	if strings.Contains(stdout, "wrote ") {
		t.Fatalf("skip should not install skills: %q", stdout)
	}
	if _, err := os.Stat(filepath.Join(dir, "AGENTS.md")); !os.IsNotExist(err) {
		t.Fatal("skip should not write AGENTS.md")
	}
}

func TestFlowSkillInitGlobalInWorkspaceOffersSetupInteractively(t *testing.T) {
	dir := t.TempDir()
	runForTest(t, []string{"init"}, dir) // workspace exists now
	home := t.TempDir()

	stdout, _ := runForTest(t, []string{"skill", "init"}, dir, withHomeDir(home), withStdin("1\n"))

	if !strings.Contains(stdout, "Set up Flow agent guidance") {
		t.Fatalf("global skill init did not offer setup: %q", stdout)
	}
	if _, err := os.Stat(filepath.Join(dir, ".agents", "skills", "flow", "SKILL.md")); err != nil {
		t.Fatalf("offer acceptance should install local skills: %v", err)
	}
	if _, err := os.Stat(filepath.Join(home, ".agents", "skills", "flow", "SKILL.md")); err != nil {
		t.Fatalf("global skills still installed: %v", err)
	}
}

func TestFlowSkillInitGlobalOutsideWorkspaceStaysSilent(t *testing.T) {
	dir := t.TempDir() // no .flow, no AGENTS.md
	home := t.TempDir()

	stdout, stderr := runForTest(t, []string{"skill", "init", "--quiet"}, dir, withHomeDir(home))
	if stderr != "" {
		t.Fatalf("stderr = %q", stderr)
	}
	if strings.Contains(stdout, "Set up Flow agent guidance") || strings.Contains(stdout, "Tip: run") {
		t.Fatalf("no offer or hint expected outside a workspace: %q", stdout)
	}
	if _, err := os.Stat(filepath.Join(dir, "AGENTS.md")); !os.IsNotExist(err) {
		t.Fatal("AGENTS.md must not be created outside a workspace")
	}
}
