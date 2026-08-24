package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/lex/flow/internal/core"
	"github.com/lex/flow/internal/workspace"
)

func writeSyncHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow sync jira [--project <key>]... [--json]")
	fmt.Fprintln(w, "Mirror Jira issues into read-only note nodes under external/jira/<PROJECT>/.")
	fmt.Fprintln(w, "Options:")
	fmt.Fprintln(w, "  --project <key>   Project key to sync (repeatable; defaults to configured projects)")
	fmt.Fprintln(w, "  --json            Machine-readable output")
	fmt.Fprintf(w, "\nCredentials are read from the %s environment variable.\n", core.JiraTokenEnvVar)
}

func runSync(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("sync", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	if len(args) > 0 && (args[0] == "--help" || args[0] == "-h") {
		writeSyncHelp(env.stdout)
		return nil
	}

	if len(args) == 0 || args[0] != "jira" {
		return fmt.Errorf("unknown sync target %q; use `flow sync jira`", strings.Join(args, " "))
	}

	jiraArgs := args[1:]
	var projects stringListFlag
	asJSON := flagSet.Bool("json", false, "machine-readable output")
	flagSet.Var(&projects, "project", "Jira project key to sync (repeatable)")
	helpShown, err := parseFlagSetWithHelp(flagSet, jiraArgs, env, writeSyncHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	workspaceConfig, err := workspace.ReadOrDefaultConfig(root.ConfigPath)
	if err != nil {
		return err
	}

	projectKeys := []string(projects)
	if len(projectKeys) == 0 {
		projectKeys = workspaceConfig.Integrations.Jira.Projects
	}
	if len(projectKeys) == 0 {
		return fmt.Errorf("no Jira projects configured; run `flow configure --jira-host <url> --jira-project <key>` or pass --project")
	}

	host := workspaceConfig.Integrations.Jira.Host
	if host == "" {
		return fmt.Errorf("no Jira host configured; run `flow configure --jira-host <url>`")
	}

	client, err := core.NewJiraRESTClient(host, os.Getenv(core.JiraTokenEnvVar), nil)
	if err != nil {
		return err
	}

	results := make([]workspace.SyncJiraResult, 0, len(projectKeys))
	for _, projectKey := range projectKeys {
		issues, fetchErr := client.FetchIssues(projectKey)
		if fetchErr != nil {
			return fmt.Errorf("sync jira %s: %w", projectKey, fetchErr)
		}
		result, syncErr := workspace.SyncJira(root, projectKey, issues, timeNowUTC())
		if syncErr != nil {
			return fmt.Errorf("sync jira %s: %w", projectKey, syncErr)
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

func timeNowUTC() time.Time {
	return time.Now().UTC()
}
