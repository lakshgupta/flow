package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSyncProjectAgentsGuideCreatesFile(t *testing.T) {
	env := commandEnv{stdout: os.Stdout, stderr: os.Stderr}
	skillDir := filepath.Join(t.TempDir(), ".agents", "skills")

	path, err := syncProjectAgentsGuide(skillDir, []string{"dev"}, false, env)
	if err != nil {
		t.Fatalf("syncProjectAgentsGuide() error = %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read created guide: %v", err)
	}
	content := string(data)
	if !strings.Contains(content, agentsGuideStart) || !strings.Contains(content, agentsGuideEnd) {
		t.Fatalf("created guide missing markers:\n%s", content)
	}
	if !strings.Contains(content, "roadmap (2.9)") {
		t.Fatalf("dev guide missing roadmap routing:\n%s", content)
	}
}

func TestSyncProjectAgentsGuideAppendsWithoutClobberingWhenNonInteractive(t *testing.T) {
	dir := t.TempDir()
	env := commandEnv{stdout: os.Stdout, stderr: os.Stderr}
	skillDir := filepath.Join(dir, ".agents", "skills")
	agentsPath := filepath.Join(dir, "AGENTS.md")
	if err := os.WriteFile(agentsPath, []byte("# My project rules\n\nBe terse.\n"), 0o644); err != nil {
		t.Fatalf("seed AGENTS.md: %v", err)
	}

	if _, err := syncProjectAgentsGuide(skillDir, []string{"note"}, false, env); err != nil {
		t.Fatalf("syncProjectAgentsGuide() error = %v", err)
	}

	data, _ := os.ReadFile(agentsPath)
	content := string(data)
	if !strings.HasPrefix(content, "# My project rules") || !strings.Contains(content, "Be terse.") {
		t.Fatalf("existing content was clobbered:\n%s", content)
	}
	if !strings.Contains(content, "free-form graph directories") {
		t.Fatalf("note-mode guide missing:\n%s", content)
	}
}

func TestSyncProjectAgentsGuideIdempotentAndUpdates(t *testing.T) {
	dir := t.TempDir()
	env := commandEnv{stdout: os.Stdout, stderr: os.Stderr}
	skillDir := filepath.Join(dir, ".agents", "skills")

	if _, err := syncProjectAgentsGuide(skillDir, []string{"pm"}, false, env); err != nil {
		t.Fatalf("first init error = %v", err)
	}
	before, _ := os.ReadFile(filepath.Join(dir, "AGENTS.md"))

	path, err := syncProjectAgentsGuide(skillDir, []string{"pm"}, false, env)
	if err != nil {
		t.Fatalf("second init error = %v", err)
	}
	if path != "" {
		t.Fatal("identical rerun should report no change")
	}
	after, _ := os.ReadFile(filepath.Join(dir, "AGENTS.md"))
	if string(before) != string(after) {
		t.Fatal("idempotent rerun modified the file")
	}

	// Switching modes replaces only the managed block.
	if _, err := syncProjectAgentsGuide(skillDir, []string{"dev"}, false, env); err != nil {
		t.Fatalf("mode switch error = %v", err)
	}
	data, _ := os.ReadFile(filepath.Join(dir, "AGENTS.md"))
	content := string(data)
	if strings.Contains(content, "read-only mirrors of tracker tickets") {
		t.Fatalf("old pm guide survived mode switch:\n%s", content)
	}
	if count := strings.Count(content, agentsGuideStart); count != 1 {
		t.Fatalf("expected exactly one managed block; found %d", count)
	}
	if !strings.Contains(content, "roadmap (2.9)") {
		t.Fatalf("dev guide missing after switch:\n%s", content)
	}
}

func TestSyncProjectAgentsGuideInteractiveChoices(t *testing.T) {
	dir := t.TempDir()
	skillDir := filepath.Join(dir, ".agents", "skills")
	agentsPath := filepath.Join(dir, "AGENTS.md")
	existing := "# My project rules\n\nBe terse.\n"

	runChoice := func(seed string, input string) (string, string, string) {
		t.Helper()
		if seed != "" {
			if err := os.WriteFile(agentsPath, []byte(seed), 0o644); err != nil {
				t.Fatalf("seed AGENTS.md: %v", err)
			}
		}
		stdout := &strings.Builder{}
		env := commandEnv{
			stdout:          stdout,
			stderr:          os.Stderr,
			stdin:           strings.NewReader(input),
			stdinIsTerminal: true,
		}
		path, err := syncProjectAgentsGuide(skillDir, []string{"dev"}, false, env)
		if err != nil {
			t.Fatalf("syncProjectAgentsGuide() error = %v", err)
		}
		data, readErr := os.ReadFile(agentsPath)
		if readErr != nil {
			t.Fatalf("read AGENTS.md after choice: %v", readErr)
		}
		return path, stdout.String(), string(data)
	}

	// Rewrite replaces the whole file.
	path, _, content := runChoice(existing, "1\n")
	if path == "" || !strings.HasPrefix(content, "# Agent Guide") || strings.Contains(content, "Be terse.") {
		t.Fatalf("rewrite choice wrong; path=%q content=%q", path, content)
	}

	// Append preserves existing content.
	path, _, content = runChoice(existing, "2\n")
	if path == "" || !strings.Contains(content, "Be terse.") || !strings.Contains(content, agentsGuideStart) {
		t.Fatalf("append choice wrong; path=%q content=%q", path, content)
	}

	// Print shows the block and writes nothing.
	path, output, content := runChoice(existing, "3\n")
	if path != "" {
		t.Fatal("print choice must not report a write")
	}
	if !strings.Contains(output, agentsGuideStart) {
		t.Fatalf("print choice did not print the block: %q", output)
	}
	if content != existing {
		t.Fatalf("print choice modified the file:\n%s", content)
	}

	// Exit leaves the file untouched.
	path, output, content = runChoice(existing, "4\n")
	if path != "" {
		t.Fatal("exit choice must not report a write")
	}
	if !strings.Contains(output, "unchanged") {
		t.Fatalf("exit choice missing confirmation: %q", output)
	}
	if content != existing {
		t.Fatalf("exit choice modified the file:\n%s", content)
	}

	// Invalid input re-prompts, then a valid answer proceeds.
	_, output, content = runChoice(existing, "banana\n2\n")
	if !strings.Contains(output, "Please choose 1, 2, 3, or 4.") {
		t.Fatalf("invalid input was not re-prompted: %q", output)
	}
	if !strings.Contains(content, agentsGuideStart) {
		t.Fatal("re-prompted append did not apply")
	}

	// EOF at the prompt exits without changes.
	path, output, content = runChoice(existing, "")
	if path != "" || content != existing {
		t.Fatalf("EOF prompt should leave the file untouched; path=%q", path)
	}
}
