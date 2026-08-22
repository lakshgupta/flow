package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/lex/flow"
)

// Agents guide markers delimiting the Flow-managed section of a workspace
// AGENTS.md. Content between the markers is replaced on re-init; anything
// outside the markers is left untouched.
const (
	agentsGuideStart = "<!-- flow:agents:start -->"
	agentsGuideEnd   = "<!-- flow:agents:end -->"
)

// syncProjectAgentsGuide creates or updates the Flow-managed section of the
// workspace AGENTS.md for local skill installs. When AGENTS.md already exists
// without a Flow-managed block and stdin is a terminal, the user chooses how
// to proceed (rewrite, append, print only, or exit). Non-interactive runs
// append. It returns the written path, or an empty string when nothing was
// written.
func syncProjectAgentsGuide(skillTargetDir string, modes []string, force bool, env commandEnv) (string, error) {
	workspaceDir := filepath.Dir(filepath.Dir(skillTargetDir))
	agentsPath := filepath.Join(workspaceDir, "AGENTS.md")

	guide := agentsGuideForModes(modes)
	if guide == "" {
		return "", nil
	}
	block := agentsGuideStart + "\n" + guide + "\n" + agentsGuideEnd

	existing, readErr := os.ReadFile(agentsPath)
	if readErr != nil && !os.IsNotExist(readErr) {
		return "", fmt.Errorf("read AGENTS.md: %w", readErr)
	}

	if os.IsNotExist(readErr) {
		content := "# Agent Guide\n\n" + block + "\n"
		if err := os.WriteFile(agentsPath, []byte(content), 0o644); err != nil {
			return "", fmt.Errorf("write AGENTS.md: %w", err)
		}
		return agentsPath, nil
	}

	text := string(existing)
	if start := strings.Index(text, agentsGuideStart); start >= 0 {
		end := strings.Index(text[start:], agentsGuideEnd)
		if end < 0 {
			return "", fmt.Errorf("AGENTS.md has %s without %s; fix or remove the marker and rerun", agentsGuideStart, agentsGuideEnd)
		}
		if !force && strings.Contains(text[start:start+end], guide) {
			return "", nil
		}
		next := text[:start] + block + text[start+end+len(agentsGuideEnd):]
		if next == text {
			return "", nil
		}
		if err := os.WriteFile(agentsPath, []byte(next), 0o644); err != nil {
			return "", fmt.Errorf("update AGENTS.md: %w", err)
		}
		return agentsPath, nil
	}

	if env.stdinIsTerminal {
		choice, err := promptAgentsGuideChoice(block, env)
		if err != nil || choice == "" {
			return "", err
		}
		switch choice {
		case "rewrite":
			if err := os.WriteFile(agentsPath, []byte("# Agent Guide\n\n"+block+"\n"), 0o644); err != nil {
				return "", fmt.Errorf("rewrite AGENTS.md: %w", err)
			}
			return agentsPath, nil
		case "print":
			fmt.Fprintln(env.stdout, block)
			return "", nil
		}
		// "append" falls through to the shared append path below.
	}

	trimmed := strings.TrimRight(text, "\n")
	separator := ""
	if trimmed != "" {
		separator = "\n\n"
	}
	next := trimmed + separator + block + "\n"
	if err := os.WriteFile(agentsPath, []byte(next), 0o644); err != nil {
		return "", fmt.Errorf("append AGENTS.md: %w", err)
	}
	return agentsPath, nil
}

// promptAgentsGuideChoice asks the user how to add the Flow guide to an
// existing AGENTS.md. It returns "rewrite", "append", "print", or "" for
// exit/error. Unrecognized input re-prompts; EOF exits.
func promptAgentsGuideChoice(block string, env commandEnv) (string, error) {
	reader := bufio.NewReader(env.stdin)
	for {
		fmt.Fprintf(env.stdout, "\nAGENTS.md already exists with content outside Flow's managed section.\n")
		fmt.Fprintf(env.stdout, "How should the Flow guide be added?\n")
		fmt.Fprintf(env.stdout, "  1) Rewrite the file with the Flow guide\n")
		fmt.Fprintf(env.stdout, "  2) Append the Flow guide after the existing content\n")
		fmt.Fprintf(env.stdout, "  3) Print the content that will be added, then exit\n")
		fmt.Fprintf(env.stdout, "  4) Exit without changes\n")
		fmt.Fprint(env.stdout, "Choose [1-4]: ")

		line, err := reader.ReadString('\n')
		if err != nil && strings.TrimSpace(line) == "" {
			fmt.Fprintln(env.stdout)
			return "", nil
		}
		switch strings.TrimSpace(line) {
		case "1", "r", "rewrite":
			return "rewrite", nil
		case "2", "a", "append":
			return "append", nil
		case "3", "p", "print":
			return "print", nil
		case "4", "e", "q", "exit":
			fmt.Fprintln(env.stdout, "Leaving AGENTS.md unchanged.")
			return "", nil
		default:
			fmt.Fprintln(env.stdout, "Please choose 1, 2, 3, or 4.")
		}
	}
}

// agentsGuideForModes returns the AGENTS.md guide body for the selected
// modes. A single dev mode (or any selection containing dev) yields the full
// development guide; multiple non-dev modes merge their unique bullets.
func agentsGuideForModes(modes []string) string {
	normalized := make([]string, 0, len(modes))
	for _, mode := range modes {
		trimmed := strings.TrimSpace(mode)
		if trimmed != "" {
			normalized = append(normalized, trimmed)
		}
	}
	if len(normalized) == 0 {
		normalized = []string{"dev"}
	}

	bullets := make([]string, 0, 8)
	seen := map[string]struct{}{}
	hasDev := false
	for _, mode := range normalized {
		if mode == "dev" {
			hasDev = true
			break
		}
	}
	if hasDev {
		return agentsGuideForMode("dev")
	}

	for _, mode := range normalized {
		guide := agentsGuideForMode(mode)
		if guide == "" {
			continue
		}
		for _, line := range strings.Split(guide, "\n") {
			line = strings.TrimRight(line, " ")
			key := strings.ToLower(line)
			if line == "" {
				continue
			}
			if _, duplicate := seen[key]; duplicate {
				continue
			}
			seen[key] = struct{}{}
			bullets = append(bullets, line)
		}
	}
	return strings.Join(bullets, "\n")
}

func agentsGuideForMode(mode string) string {
	switch mode {
	case "dev":
		return `## Flow Workspace Workflow

- This workspace uses Flow (.flow/) as its system of record. Use the flow CLI for all record keeping; the full protocol lives in .agents/skills/flow/SKILL.md.
- Route each request to the matching stage: design (2.1), plan (2.2), implement (2.3), fix (2.4), refactor (2.5), test (2.6), review (2.7), commit (2.8), roadmap (2.9).
- Plan several features up front as design notes plus task graphs, then develop them together with flow roadmap --next / --claim (one claimed task per session).
- Record acceptance criteria and evidence per task; mark tasks Done only after validation, and keep commit ids on task nodes.
- External tickets under external/ are read-only mirrors; link them into plans, never edit them.`
	case "note":
		return `## Flow Notes Workspace

- This workspace uses Flow (.flow/) for note taking. Use the flow CLI for all capture and organization; guidance lives in .agents/skills/flow/SKILL.md.
- Notebooks are free-form graph directories (books/, manuals/, notebooks/...); date-prefix naming is not required.
- Connect related notes with context-rich edges; search before reading bodies.`
	case "pm":
		return `## Flow Tracked-Work Workspace

- This workspace uses Flow (.flow/) for notes plus externally tracked work. Guidance lives in .agents/skills/flow/SKILL.md.
- Nodes under external/ are read-only mirrors of tracker tickets; refresh them with flow sync jira, never by hand.
- Link mirrored tickets into plans with context-rich edges instead of copying their content.`
	default:
		return ""
	}
}

// stdinIsTerminal reports whether the reader is an interactive character
// device (a terminal), used to decide whether prompting is possible.
func stdinIsTerminal(reader io.Reader) bool {
	file, ok := reader.(*os.File)
	if !ok {
		return false
	}
	info, err := file.Stat()
	if err != nil {
		return false
	}
	return info.Mode()&os.ModeCharDevice != 0 && info.Mode()&os.ModeDevice != 0
}

// workspaceAgentSetupMarkerPresent reports whether the current directory
// looks like a place that wants Flow agent guidance: a Flow workspace (.flow)
// or an existing AGENTS.md.
func workspaceAgentSetupMarkerPresent(workDir string) bool {
	if _, err := os.Stat(filepath.Join(workDir, ".flow")); err == nil {
		return true
	}
	_, err := os.Stat(filepath.Join(workDir, "AGENTS.md"))
	return err == nil
}

// offerWorkspaceAgentSetup asks the user whether to install the Flow skill
// into .agents/skills and add the AGENTS.md guide for the current workspace.
// Interactive runs get options (including mode selection when allowModeChoice
// is set); non-interactive runs only print a hint. modes is the default mode
// selection to install.
func offerWorkspaceAgentSetup(env commandEnv, modes []string, allowModeChoice bool) error {
	if !env.stdinIsTerminal {
		fmt.Fprintf(env.stdout, "Tip: run `flow skill init --local` to install agent skills and an AGENTS.md guide for this workspace.\n")
		return nil
	}

	fmt.Fprintln(env.stdout)
	fmt.Fprintln(env.stdout, "Set up Flow agent guidance for this workspace?")
	fmt.Fprintln(env.stdout, "  1) Install the skill into .agents/skills and add the AGENTS.md guide")
	if allowModeChoice {
		fmt.Fprintln(env.stdout, "  2) Install with specific workspace modes (you will be asked)")
	}
	fmt.Fprintln(env.stdout, "  s) Skip")
	fmt.Fprint(env.stdout, "Choose [1", map[bool]string{true: "-2", false: ""}[allowModeChoice], "/s]: ")

	reader := bufio.NewReader(env.stdin)
	line, err := reader.ReadString('\n')
	if err != nil && strings.TrimSpace(line) == "" {
		fmt.Fprintln(env.stdout, "Skipped.")
		return nil
	}
	answer := strings.ToLower(strings.TrimSpace(line))

	selectedModes := modes
	if allowModeChoice && answer == "2" {
		fmt.Fprint(env.stdout, "Workspace modes [dev,note,pm; comma separated, default dev]: ")
		modeLine, readErr := reader.ReadString('\n')
		if readErr != nil && strings.TrimSpace(modeLine) == "" {
			return nil
		}
		parsed := []string{}
		for _, part := range strings.Split(modeLine, ",") {
			part = strings.TrimSpace(part)
			if part != "" {
				parsed = append(parsed, part)
			}
		}
		if len(parsed) > 0 {
			if _, ok := flow.SkillMarkdownForModes(parsed); !ok {
				return fmt.Errorf("unknown workspace mode in %q; available modes: %s", strings.Join(parsed, ","), strings.Join(flow.SkillModes(), ", "))
			}
			selectedModes = parsed
		}
	}

	switch answer {
	case "1", "y":
		return installLocalSkills(env, selectedModes)
	case "2":
		return installLocalSkills(env, selectedModes)
	default:
		fmt.Fprintln(env.stdout, "Skipped. Run `flow skill init --local` any time.")
		return nil
	}
}

// installLocalSkills writes the embedded skills into <workdir>/.agents/skills
// composed for the given modes, then syncs the AGENTS.md managed section.
func installLocalSkills(env commandEnv, modes []string) error {
	workingDirectory, err := env.getwd()
	if err != nil {
		return fmt.Errorf("resolve working directory: %w", err)
	}
	targetDir := filepath.Join(workingDirectory, ".agents", "skills")

	for _, name := range flow.SkillNames() {
		markdown, ok := flow.SkillMarkdownByName(name)
		if !ok {
			continue
		}
		if name == "flow" {
			composed, composedOK := flow.SkillMarkdownForModes(modes)
			if !composedOK {
				return fmt.Errorf("unknown workspace mode in %q; available modes: %s", strings.Join(modes, ","), strings.Join(flow.SkillModes(), ", "))
			}
			markdown = composed
		}
		skillDir := filepath.Join(targetDir, name)
		if err := os.MkdirAll(skillDir, 0o755); err != nil {
			return fmt.Errorf("create skill directory: %w", err)
		}
		targetPath := filepath.Join(skillDir, "SKILL.md")
		if err := os.WriteFile(targetPath, []byte(markdown), 0o644); err != nil {
			return fmt.Errorf("write skill file: %w", err)
		}
		fmt.Fprintf(env.stdout, "wrote %s\n", targetPath)
	}

	agentsPath, err := syncProjectAgentsGuide(targetDir, modes, false, env)
	if err != nil {
		return err
	}
	if agentsPath != "" {
		fmt.Fprintf(env.stdout, "updated %s\n", agentsPath)
	}
	return nil
}
