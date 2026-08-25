package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/term"

	"github.com/lex/flow/internal/config"
	"github.com/lex/flow/internal/core"
	"github.com/lex/flow/internal/credentials"
	"github.com/lex/flow/internal/workspace"
)

func writeSyncHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow sync [jira|aha] [--service <service>] [--alias <alias>] [--project <key>]... [--json]")
	fmt.Fprintln(w, "       flow sync --service <service> [--alias <alias>] [--project <key>]... [--json]")
	fmt.Fprintln(w, "       flow sync configure [--service <service>] [--alias <alias>] [--host <url>] [--email <email>] [--token <token>] [--project <key>]...")
	fmt.Fprintln(w, "")
	fmt.Fprintln(w, "Mirror external tracker issues into read-only note nodes under external/<service>/<PROJECT>/.")
	fmt.Fprintln(w, "Options for sync:")
	fmt.Fprintln(w, "  --service <name>  Service to sync (jira, aha). Default: jira. Legacy positional 'jira' is supported.")
	fmt.Fprintln(w, "  --alias <name>    Instance alias (default: default). Use to sync multiple Jira instances.")
	fmt.Fprintln(w, "  --project <key>   Project key to sync (repeatable; defaults to configured projects)")
	fmt.Fprintln(w, "  --json            Machine-readable output")
	fmt.Fprintln(w, "")
	fmt.Fprintln(w, "Options for configure:")
	fmt.Fprintln(w, "  --service <name>  Service to configure (jira, aha). Default: jira")
	fmt.Fprintln(w, "  --alias <name>    Instance alias (default: default)")
	fmt.Fprintln(w, "  --host <url>      Tracker base URL (e.g. https://example.atlassian.net)")
	fmt.Fprintln(w, "  --email <email>   Jira email for Basic auth (optional)")
	fmt.Fprintln(w, "  --token <token>   API token (use env or interactive prompt if omitted)")
	fmt.Fprintln(w, "  --project <key>   Project key (repeatable)")
	fmt.Fprintln(w, "")
	fmt.Fprintln(w, "Examples:")
	fmt.Fprintln(w, "  flow sync configure --service jira --alias j1          # interactive, like aws configure")
	fmt.Fprintln(w, "  flow sync configure --service jira --host https://example.atlassian.net --project PROJ --token xxx")
	fmt.Fprintln(w, "  flow sync --service jira --alias j1 --project PROJ")
	fmt.Fprintln(w, "  flow sync jira                                          # legacy alias default")
	fmt.Fprintln(w, "")
	fmt.Fprintf(w, "Credentials: token from %s / %s_<ALIAS> env, or %s (0600, per-workspace). Never stored in flow.yaml.\n", core.JiraTokenEnvVar, core.JiraTokenEnvVar, ".flow/config/credentials")
	fmt.Fprintln(w, "Use `flow sync configure` (or `flow -g sync configure` for global workspace) to set host/projects in flow.yaml and token/email in credentials file.")
	fmt.Fprintln(w, "Global vs local: `flow sync` uses the local workspace; `flow -g sync` uses the global workspace. `flow sync configure` with -g configures global credentials/host.")
}

func writeSyncConfigureHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow sync configure [--service <service>] [--alias <alias>] [--host <url>] [--email <email>] [--token <token>] [--project <key>]...")
	fmt.Fprintln(w, "Configure an external tracker instance. Prompts interactively when run in a terminal, like `aws configure`.")
	fmt.Fprintln(w, "Options:")
	fmt.Fprintln(w, "  --service <name>  Service to configure (jira, aha). Default: jira")
	fmt.Fprintln(w, "  --alias <name>    Instance alias (default: default). Enables multiple instances (e.g. --alias j1).")
	fmt.Fprintln(w, "  --host <url>      Tracker base URL")
	fmt.Fprintln(w, "  --email <email>   Account email for Jira Basic auth")
	fmt.Fprintln(w, "  --token <token>   API token (hidden prompt if omitted in interactive mode)")
	fmt.Fprintln(w, "  --project <key>   Project key to sync (repeatable)")
}

func runSync(global bool, args []string, env commandEnv) error {
	if len(args) > 0 && (args[0] == "--help" || args[0] == "-h") {
		writeSyncHelp(env.stdout)
		return nil
	}

	// Handle `flow sync configure ...`
	if len(args) > 0 && args[0] == "configure" {
		return runSyncConfigure(global, args[1:], env)
	}

	// Legacy positional: `flow sync jira` or `flow sync aha`
	service := "jira"
	alias := ""
	remaining := args
	if len(remaining) > 0 && !strings.HasPrefix(remaining[0], "-") {
		// Check if first arg is a known service name
		switch strings.ToLower(remaining[0]) {
		case "jira", "aha":
			service = strings.ToLower(remaining[0])
			remaining = remaining[1:]
		default:
			return fmt.Errorf("unknown sync target %q; use `flow sync jira` or `flow sync --service <service> [--alias <alias>]`", strings.Join(args, " "))
		}
	}

	flagSet := flag.NewFlagSet("sync", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)
	var projects stringListFlag
	serviceFlag := flagSet.String("service", service, "service to sync (jira, aha)")
	aliasFlag := flagSet.String("alias", alias, "instance alias (default: default)")
	asJSON := flagSet.Bool("json", false, "machine-readable output")
	flagSet.Var(&projects, "project", "project key to sync (repeatable)")

	helpShown, err := parseFlagSetWithHelp(flagSet, remaining, env, writeSyncHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
	}

	if *serviceFlag != "" {
		service = strings.ToLower(strings.TrimSpace(*serviceFlag))
	}
	alias = strings.TrimSpace(*aliasFlag)
	if alias == "" {
		alias = config.DefaultServiceAlias
	}
	if service != "jira" && service != "aha" {
		return fmt.Errorf("unknown service %q; supported: jira, aha", service)
	}
	if service == "aha" {
		return fmt.Errorf("aha sync is not yet implemented; configure it for future use with `flow sync configure --service aha`")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	workspaceConfig, err := workspace.ReadOrDefaultConfig(root.ConfigPath)
	if err != nil {
		return err
	}

	jiraCfg, ok := workspaceConfig.Integrations.JiraConfigForAlias(alias)
	// Backward compat: if alias is default and not found, try to give helpful error
	// suggesting `flow sync configure`.
	projectKeys := []string(projects)
	if len(projectKeys) == 0 {
		if ok {
			projectKeys = jiraCfg.Projects
		} else if alias == config.DefaultServiceAlias && len(workspaceConfig.Integrations.Jira) == 0 {
			// No config at all
		} else if !ok {
			return fmt.Errorf("no Jira config for alias %q; run `flow sync configure --service jira --alias %s --host <url> --project <key>`", alias, alias)
		}
	}
	if len(projectKeys) == 0 {
		return fmt.Errorf("no Jira projects configured for alias %q; run `flow sync configure --service jira --alias %s --host <url> --project <key>` or pass --project", alias, alias)
	}

	host := ""
	if ok {
		host = jiraCfg.Host
	}
	if host == "" {
		return fmt.Errorf("no Jira host configured for alias %q; run `flow sync configure --service jira --alias %s --host <url>`", alias, alias)
	}

	// Resolve token/email: env -> per-workspace credentials file (.flow/config/credentials)
	store, _ := credentials.LoadForWorkspace(root.ConfigDirPath, env.environ())
	email, token, _ := credentials.ResolveToken(service, alias, env.environ(), store)
	// Fallback to legacy env handling via core constant for default alias
	if token == "" && alias == config.DefaultServiceAlias {
		token = strings.TrimSpace(os.Getenv(core.JiraTokenEnvVar))
		// Also try env directly via env.environ for testability
		if token == "" {
			for _, kv := range env.environ() {
				if strings.HasPrefix(kv, core.JiraTokenEnvVar+"=") {
					token = strings.TrimSpace(strings.TrimPrefix(kv, core.JiraTokenEnvVar+"="))
					break
				}
			}
		}
	}
	// Note: empty token is allowed for public instances; Jira client handles it. Warn if missing?
	// We proceed; FetchIssues will work for public projects.

	client, err := core.NewJiraRESTClientWithEmail(host, email, token, nil)
	if err != nil {
		return err
	}

	results := make([]workspace.SyncJiraResult, 0, len(projectKeys))
	for _, projectKey := range projectKeys {
		issues, fetchErr := client.FetchIssues(projectKey)
		if fetchErr != nil {
			return fmt.Errorf("sync %s %s: %w", service, projectKey, fetchErr)
		}
		result, syncErr := workspace.SyncJira(root, projectKey, issues, timeNowUTC())
		if syncErr != nil {
			return fmt.Errorf("sync %s %s: %w", service, projectKey, syncErr)
		}
		results = append(results, result)
	}

	if *asJSON {
		encoder := json.NewEncoder(env.stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(results)
	}

	for _, result := range results {
		fmt.Fprintf(env.stdout, "synced %s: %d created, %d updated, %d archived\n",
			result.Project, len(result.Created), len(result.Updated), len(result.Archived))
		for _, id := range result.Created {
			fmt.Fprintf(env.stdout, "  created %s\n", id)
		}
		for _, id := range result.Updated {
			fmt.Fprintf(env.stdout, "  updated %s\n", id)
		}
		for _, id := range result.Archived {
			fmt.Fprintf(env.stdout, "  archived %s\n", id)
		}
	}
	return nil
}

func runSyncConfigure(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("sync configure", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)
	var projects stringListFlag
	serviceFlag := flagSet.String("service", "jira", "service to configure (jira, aha)")
	aliasFlag := flagSet.String("alias", config.DefaultServiceAlias, "instance alias")
	hostFlag := flagSet.String("host", "", "tracker base URL")
	emailFlag := flagSet.String("email", "", "account email")
	tokenFlag := flagSet.String("token", "", "API token")
	flagSet.Var(&projects, "project", "project key (repeatable)")

	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeSyncConfigureHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
	}

	service := strings.ToLower(strings.TrimSpace(*serviceFlag))
	if service == "" {
		service = "jira"
	}
	alias := strings.TrimSpace(*aliasFlag)
	if alias == "" {
		alias = config.DefaultServiceAlias
	}
	if service != "jira" && service != "aha" {
		return fmt.Errorf("unknown service %q; supported: jira, aha", service)
	}

	isInteractive := env.stdinIsTerminal && *hostFlag == "" && *emailFlag == "" && *tokenFlag == "" && len(projects) == 0

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	workspaceConfig, err := workspace.ReadOrDefaultConfig(root.ConfigPath)
	if err != nil {
		return err
	}

	existingJira, hasExisting := workspaceConfig.Integrations.JiraConfigForAlias(alias)
	existingCreds, _ := credentials.LoadForWorkspace(root.ConfigDirPath, env.environ())
	existingEmail, existingToken, _ := credentials.ResolveToken(service, alias, env.environ(), existingCreds)
	// Also check existing cred direct via store Get for display hint
	if cred, ok := existingCreds.Get(service, alias); ok {
		existingEmail = cred.Email
		existingToken = cred.Token
	}

	host := strings.TrimSpace(*hostFlag)
	email := strings.TrimSpace(*emailFlag)
	token := strings.TrimSpace(*tokenFlag)
	projectKeys := []string(projects)

	// Interactive prompts (aws configure style) — only for missing required fields
	if env.stdinIsTerminal {
		reader := bufio.NewReader(env.stdin)

		if host == "" {
			defaultHost := existingJira.Host
			if defaultHost == "" {
				defaultHost = "https://example.atlassian.net"
			}
			host = promptInput(env.stdout, reader, fmt.Sprintf("Jira Host URL [%s]", defaultHost), defaultHost)
		}
		if email == "" && service == "jira" && isInteractive {
			// Email is optional; only prompt in fully interactive mode to avoid noise in flag-based invocations
			defaultEmail := existingEmail
			prompt := "Jira Email"
			if defaultEmail != "" {
				prompt = fmt.Sprintf("Jira Email [%s]", defaultEmail)
			} else {
				prompt = "Jira Email (optional) []"
			}
			email = promptInput(env.stdout, reader, prompt, defaultEmail)
		}
		if token == "" {
			// Prompt for token if missing; hide input when possible
			token = promptPassword(env, fmt.Sprintf("Jira API Token [%s]", maskToken(existingToken)))
			if token == "" && existingToken != "" {
				token = existingToken
			}
		}
		if len(projectKeys) == 0 {
			defaultProjects := strings.Join(existingJira.Projects, ",")
			if hasExisting && len(existingJira.Projects) > 0 {
				projectKeys = promptProjects(env.stdout, reader, fmt.Sprintf("Project keys (comma-separated) [%s]", defaultProjects), defaultProjects)
			} else {
				input := promptInput(env.stdout, reader, "Project keys (comma-separated) []", "")
				if input != "" {
					projectKeys = parseProjectList(input)
				}
			}
		}
	}

	// Validate after prompts
	if host == "" {
		if hasExisting {
			host = existingJira.Host
		}
	}
	if host == "" {
		return fmt.Errorf("host is required; use --host or run interactively")
	}
	if len(projectKeys) == 0 {
		if hasExisting {
			projectKeys = existingJira.Projects
		}
	}
	if len(projectKeys) == 0 {
		return fmt.Errorf("at least one --project is required")
	}
	if token == "" {
		token = existingToken
	}
	// Token may be empty for public instances; allow but warn
	if token == "" && env.stdinIsTerminal {
		fmt.Fprintln(env.stdout, "Warning: no API token provided; sync will use unauthenticated requests (public projects only).")
	}

	// Persist host/projects to flow.yaml
	switch service {
	case "jira":
		workspaceConfig.Integrations.SetJiraConfig(alias, config.JiraConfig{Host: host, Projects: projectKeys})
	case "aha":
		// For aha, store similarly but not yet used
		if workspaceConfig.Integrations.Aha == nil {
			workspaceConfig.Integrations.Aha = map[string]config.AhaConfig{}
		}
		workspaceConfig.Integrations.Aha[alias] = config.AhaConfig{Host: host, Projects: projectKeys}
	}

	if err := config.Write(root.ConfigPath, workspaceConfig); err != nil {
		return err
	}

	// Ensure credentials are git-ignored (per-workspace)
	_ = ensureCredentialsGitignore(root)

	// Persist token/email to per-workspace credentials file (.flow/config/credentials, 0600)
	store := existingCreds
	if store == nil {
		store = &credentials.Store{}
	}
	if token != "" || email != "" {
		store.Set(service, alias, email, token)
		if err := store.SaveForWorkspace(root.ConfigDirPath, env.environ()); err != nil {
			return fmt.Errorf("save credentials: %w", err)
		}
		// Ensure gitignore again after creating file (in case it was just created)
		_ = ensureCredentialsGitignore(root)
	}

	credSource := "credentials file"
	if token == "" {
		credSource = "no token (public)"
	} else if env.stdinIsTerminal && isInteractive {
		credSource = "credentials file (0600)"
	}

	fmt.Fprintf(env.stdout, "Configured %s/%s: host=%s projects=%s (%s)\n", service, alias, host, strings.Join(projectKeys, ","), credSource)
	if service == "jira" && token == "" {
		fmt.Fprintln(env.stdout, "Tip: set token via env FLOW_JIRA_API_TOKEN or re-run `flow sync configure --service jira --alias", alias, "` to add it.")
	}
	return nil
}

func promptInput(w io.Writer, r *bufio.Reader, prompt, defaultVal string) string {
	fmt.Fprintf(w, "%s: ", prompt)
	line, err := r.ReadString('\n')
	if err != nil && line == "" {
		return defaultVal
	}
	line = strings.TrimSpace(line)
	if line == "" {
		return defaultVal
	}
	return line
}

func promptProjects(w io.Writer, r *bufio.Reader, prompt, defaultVal string) []string {
	input := promptInput(w, r, prompt, defaultVal)
	if input == "" {
		return nil
	}
	return parseProjectList(input)
}

func parseProjectList(input string) []string {
	parts := strings.Split(input, ",")
	out := []string{}
	seen := map[string]struct{}{}
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		out = append(out, p)
	}
	return out
}

func promptPassword(env commandEnv, prompt string) string {
	fmt.Fprintf(env.stdout, "%s: ", prompt)
	if env.stdinIsTerminal {
		// Try to read with hidden input using term.ReadPassword on os.Stdin
		if f, ok := env.stdin.(*os.File); ok {
			if term.IsTerminal(int(f.Fd())) {
				b, err := term.ReadPassword(int(f.Fd()))
				if err == nil {
					fmt.Fprintln(env.stdout, "")
					return strings.TrimSpace(string(b))
				}
			}
		}
		// Fallback: try os.Stdin directly if env.stdin is not *os.File but terminal flag is set
		if term.IsTerminal(int(os.Stdin.Fd())) {
			b, err := term.ReadPassword(int(os.Stdin.Fd()))
			if err == nil {
				fmt.Fprintln(env.stdout, "")
				return strings.TrimSpace(string(b))
			}
		}
	}
	// Fallback to plain read (echoed)
	// Use bufio on env.stdin if available, otherwise os.Stdin
	var r *bufio.Reader
	if env.stdin != nil {
		r = bufio.NewReader(env.stdin)
	} else {
		r = bufio.NewReader(os.Stdin)
	}
	line, _ := r.ReadString('\n')
	return strings.TrimSpace(line)
}

func maskToken(token string) string {
	if token == "" {
		return ""
	}
	if len(token) <= 4 {
		return "****"
	}
	return token[:2] + strings.Repeat("*", len(token)-4) + token[len(token)-2:]
}

func ensureCredentialsGitignore(root workspace.Root) error {
	ignorePath := filepath.Join(root.FlowPath, ".gitignore")
	data, err := os.ReadFile(ignorePath)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	content := string(data)
	if strings.Contains(content, "config/credentials") {
		return nil
	}
	if content != "" && !strings.HasSuffix(content, "\n") {
		content += "\n"
	}
	content += "config/credentials\n"
	if err := os.MkdirAll(filepath.Dir(ignorePath), 0755); err != nil {
		return err
	}
	return os.WriteFile(ignorePath, []byte(content), 0644)
}

func timeNowUTC() time.Time {
	return time.Now().UTC()
}
