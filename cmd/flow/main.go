package main

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	goruntime "runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/lex/flow/internal/buildinfo"
	"github.com/lex/flow/internal/config"
	"github.com/lex/flow/internal/execution"
	"github.com/lex/flow/internal/httpapi"
	"github.com/lex/flow/internal/index"
	"github.com/lex/flow/internal/markdown"
	"github.com/lex/flow/internal/workspace"
)

var version = buildinfo.DevVersion()

const defaultGUIPort = 4317

type commandEnv struct {
	stdout           io.Writer
	stderr           io.Writer
	getwd            func() (string, error)
	environ          func() []string
	userConfigDir    func() (string, error)
	guiRuntime       *execution.GUIRuntime
	openBrowser      func(string) error
	startCommand     func(execution.CommandExecution, io.Writer, io.Writer) error
	launchGUIProcess func(bool, workspace.Root) error
	signalProcess    func(int, syscall.Signal) error
	waitForGUI       func(string) error
	waitForGUIState  func(string, bool) error
	waitForShutdown  func(string) error
}

var processGUIRuntime = execution.NewGUIRuntime()

type stringListFlag []string

func (flagValue *stringListFlag) String() string {
	return strings.Join(*flagValue, ",")
}

func (flagValue *stringListFlag) Set(value string) error {
	*flagValue = append(*flagValue, value)
	return nil
}

type stringMapFlag map[string]string

func (flagValue *stringMapFlag) String() string {
	parts := make([]string, 0, len(*flagValue))
	for key, value := range *flagValue {
		parts = append(parts, key+"="+value)
	}

	return strings.Join(parts, ",")
}

func (flagValue *stringMapFlag) Set(value string) error {
	if value == "" {
		return fmt.Errorf("env must use KEY=VALUE format")
	}

	parts := strings.SplitN(value, "=", 2)
	if len(parts) != 2 || parts[0] == "" {
		return fmt.Errorf("env must use KEY=VALUE format")
	}

	if *flagValue == nil {
		*flagValue = map[string]string{}
	}

	(*flagValue)[parts[0]] = parts[1]
	return nil
}

func main() {
	exitCode := run(os.Args[1:], commandEnv{
		stdout:        os.Stdout,
		stderr:        os.Stderr,
		getwd:         os.Getwd,
		environ:       os.Environ,
		userConfigDir: os.UserConfigDir,
	})

	os.Exit(exitCode)
}

func run(args []string, env commandEnv) int {
	env = withDefaultCommandEnv(env)

	if err := runCommand(args, env); err != nil {
		fmt.Fprintf(env.stderr, "error: %v\n", err)
		return 1
	}

	return 0
}

func runCommand(args []string, env commandEnv) error {
	if len(args) > 0 && args[0] == "version" {
		fmt.Fprintf(env.stdout, "flow %s\n", version)
		return nil
	}

	global := false
	if len(args) > 0 && args[0] == "-g" {
		global = true
		args = args[1:]
	}

	if len(args) == 0 {
		if _, err := httpapi.NewMux(httpapi.Options{}); err != nil {
			return fmt.Errorf("failed to prepare embedded assets: %w", err)
		}

		fmt.Fprintln(env.stdout, "Flow workspace is ready. Use Flow graph feature sub-directories and task/note nodes for planning and execution records.")
		return nil
	}

	switch args[0] {
	case "init":
		return runInit(global, env)
	case "configure":
		return runConfigure(global, args[1:], env)
	case "skill":
		return runSkill(global, args[1:], env)
	case "run":
		return runRun(global, args[1:], env)
	case "search":
		return runSearch(global, args[1:], env)
	case "gui":
		return runGUI(global, args[1:], env)
	case "create":
		return runCreate(global, args[1:], env)
	case "update":
		return runUpdate(global, args[1:], env)
	case "delete":
		return runDelete(global, args[1:], env)
	case "node":
		return runNode(global, args[1:], env)
	default:
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func withDefaultCommandEnv(env commandEnv) commandEnv {
	if env.guiRuntime == nil {
		env.guiRuntime = processGUIRuntime
	}

	if env.openBrowser == nil {
		env.openBrowser = openBrowser
	}

	if env.environ == nil {
		env.environ = os.Environ
	}

	if env.startCommand == nil {
		env.startCommand = runExternalCommand
	}

	if env.launchGUIProcess == nil {
		env.launchGUIProcess = launchGUIProcess
	}

	if env.signalProcess == nil {
		env.signalProcess = signalProcess
	}

	if env.waitForGUI == nil {
		env.waitForGUI = waitForGUI
	}

	if env.waitForGUIState == nil {
		env.waitForGUIState = waitForGUIState
	}

	if env.waitForShutdown == nil {
		env.waitForShutdown = waitForShutdownSignal
	}

	return env
}

func runSkill(_ bool, args []string, env commandEnv) error {
	if len(args) == 0 {
		return fmt.Errorf("flow skill requires subcommand")
	}

	switch args[0] {
	case "content":
		return runSkillContent(args[1:], env)
	default:
		return fmt.Errorf("unknown skill subcommand %q", args[0])
	}
}

func runSkillContent(args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("skill content", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	graph := flagSet.String("graph", "development", "development graph root for planning and implementation")
	if err := flagSet.Parse(args); err != nil {
		return err
	}

	graphValue := strings.TrimSpace(*graph)
	if graphValue == "" {
		return fmt.Errorf("flow skill content requires non-empty --graph")
	}

	fmt.Fprint(env.stdout, skillMarkdownTemplate(graphValue))
	return nil
}

func skillMarkdownTemplate(graph string) string {
	designRoot := "design"

	return fmt.Sprintf(`# Skill: Flow-First Record Keeping

## Purpose
Use the Flow CLI for every record-keeping action in design, planning, and implementation work on this project.

## Graph Convention
- The parent graph directory is `+"`"+`.flow/data/content`+"`"+`.
- Design graph root is fixed as `+"`"+`%s`+"`"+`.
- Development graph root is fixed as `+"`"+`%s`+"`"+`.
- Sub-graph names are required to follow: `+"`"+`YYYYMMDD-NNN-<type>-<title>`+"`"+`.
- Valid type prefixes include `+"`"+`FEAT`+"`"+`, `+"`"+`FIX`+"`"+`, `+"`"+`REFACTOR`+"`"+`, `+"`"+`TEST`+"`"+`, `+"`"+`REVIEW`+"`"+`, `+"`"+`DOC`+"`"+`.
- `+"`"+`NNN`+"`"+` is a zero-padded incremental counter for directories created on that `+"`"+`YYYYMMDD`+"`"+` date.
- For each new design, create or reuse `+"`"+`%s/YYYYMMDD-NNN-<type>-<title>`+"`"+`.
- Planning and implementation use the same suffix under `+"`"+`%s/YYYYMMDD-NNN-<type>-<title>`+"`"+`.
- Do not use docs/backlog.md for planning; represent work as Flow task/note nodes and edges.

## Design Protocol (mandatory)
1. Resolve the work key from the request using `+"`"+`YYYYMMDD-NNN-<type>-<title>`+"`"+`.
2. Ensure `+"`"+`%s/YYYYMMDD-NNN-<type>-<title>`+"`"+` exists by creating or updating nodes there.
3. Before reading node bodies, filter candidates using title/description/tags with `+"`"+`flow search`+"`"+`.
4. Read body content only after filtering (`+"`"+`flow node content`+"`"+`) to choose the right node.
5. Record design decisions as note nodes and connect them with context-rich edges.
6. For modifications, update existing node content and description in place (`+"`"+`flow node update --body --description`+"`"+`).

## Planning Protocol (mandatory)
1. Create or reuse planning sub-graph `+"`"+`%s/YYYYMMDD-NNN-<type>-<title>`+"`"+`.
2. Convert approved design into task nodes with explicit acceptance criteria.
3. Add review and test tasks where needed to keep code modular, clean, and validated.
	4. Connect task dependencies using edges tagged with `+"`"+`depends-on`+"`"+`.
5. Keep task statuses current (`+"`"+`todo`+"`"+`, `+"`"+`doing`+"`"+`, `+"`"+`done`+"`"+`).

## Implementation Protocol (mandatory)
1. Start with tasks that have no incomplete dependency predecessors.
2. Update status transitions as work proceeds (`+"`"+`todo -> doing -> done`+"`"+`).
3. After each completed task, show the next ready task set based on dependency edges.
4. If requirements change, update both `+"`"+`%s/YYYYMMDD-NNN-<type>-<title>`+"`"+` and `+"`"+`%s/YYYYMMDD-NNN-<type>-<title>`+"`"+` before continuing.
5. Keep dependency links up to date so execution order stays explicit.

## CLI Workflow Example
`+"`"+`bash
# Design
flow create note --file overview --graph %s/20260501-001-FEAT-parser-retry-budget --title "Parser retry budget design" --description "Decision log and constraints" --tag design --tag parser
flow search --graph %s/20260501-001-FEAT-parser-retry-budget --type note --title parser --description retry --tag design --compact
flow node content --id %s/20260501-001-FEAT-parser-retry-budget/overview --line-start 1 --line-end 200
flow node update --id %s/20260501-001-FEAT-parser-retry-budget/overview --description "Updated constraints after perf analysis" --body "<updated design body>"
flow create note --file decision-queue --graph %s/20260501-001-FEAT-parser-retry-budget --title "Queue design decision" --description "Why queue-based retry is introduced" --tag decision
flow node connect --from %s/20260501-001-FEAT-parser-retry-budget/overview --to %s/20260501-001-FEAT-parser-retry-budget/decision-queue --graph %s/20260501-001-FEAT-parser-retry-budget --relationship evolves-from --context "Adds queueing to satisfy bounded retry latency"

# Planning
flow create task --file implement-queue --graph %[2]s/20260501-001-FEAT-parser-retry-budget --title "Implement retry queue" --description "Core queue implementation" --status todo --tag implementation
flow create task --file review-queue --graph %[2]s/20260501-001-FEAT-parser-retry-budget --title "Review queue implementation" --description "Code review and refactor pass" --status todo --tag review
flow create task --file test-retry --graph %[2]s/20260501-001-FEAT-parser-retry-budget --title "Test retry behavior" --description "Unit and integration coverage" --status todo --tag test
flow node connect --from %[2]s/20260501-001-FEAT-parser-retry-budget/implement-queue --to %[2]s/20260501-001-FEAT-parser-retry-budget/review-queue --graph %[2]s/20260501-001-FEAT-parser-retry-budget --relationship depends-on
flow node connect --from %[2]s/20260501-001-FEAT-parser-retry-budget/review-queue --to %[2]s/20260501-001-FEAT-parser-retry-budget/test-retry --graph %[2]s/20260501-001-FEAT-parser-retry-budget --relationship depends-on

# Implementation
flow node update --id %[2]s/20260501-001-FEAT-parser-retry-budget/implement-queue --status doing
flow node update --id %[2]s/20260501-001-FEAT-parser-retry-budget/implement-queue --status done
flow node edges --id %[2]s/20260501-001-FEAT-parser-retry-budget/implement-queue --graph %[2]s/20260501-001-FEAT-parser-retry-budget
flow node list --graph %[2]s/20260501-001-FEAT-parser-retry-budget --status todo --compact
`+"`"+`

## Completion Criteria
- Design decisions are captured as notes and connected with contextual edges under `+"`"+`%s/YYYYMMDD-NNN-<type>-<title>`+"`"+`.
- Planning tasks, including review and test tasks, have explicit dependency links.
- Implementation status and next-ready tasks are derivable from task status plus dependency edges.
`, designRoot, graph, designRoot, graph, designRoot, graph, designRoot, graph, graph, graph, designRoot, designRoot, designRoot, designRoot, designRoot, designRoot, designRoot, designRoot)
}

func runInit(global bool, env commandEnv) error {
	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	if err := initializeWorkspace(root); err != nil {
		return err
	}

	label := "local"
	if global {
		label = "global"
	}

	fmt.Fprintf(env.stdout, "Initialized %s workspace at %s\n", label, root.WorkspacePath)
	return nil
}

func runConfigure(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("configure", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	guiPort := flagSet.Int("gui-port", 0, "GUI server port")
	workspacePath := flagSet.String("workspace", "", "global workspace path")

	if err := flagSet.Parse(args); err != nil {
		return err
	}

	if !global {
		if *guiPort == 0 {
			return fmt.Errorf("flow configure requires --gui-port")
		}

		root, err := resolveRoot(false, env)
		if err != nil {
			return err
		}

		workspaceConfig, err := readOrDefaultConfig(root.ConfigPath)
		if err != nil {
			return err
		}

		workspaceConfig.GUI.Port = *guiPort
		if err := config.Write(root.ConfigPath, workspaceConfig); err != nil {
			return err
		}

		fmt.Fprintf(env.stdout, "Configured local workspace GUI port %d at %s\n", *guiPort, root.ConfigPath)
		return nil
	}

	locatorPath, err := globalLocatorPath(env)
	if err != nil {
		return err
	}

	if *workspacePath == "" && *guiPort == 0 {
		return fmt.Errorf("flow -g configure requires --workspace, --gui-port, or both")
	}

	if *workspacePath != "" {
		absoluteWorkspacePath, err := filepath.Abs(*workspacePath)
		if err != nil {
			return fmt.Errorf("resolve global workspace path: %w", err)
		}

		if err := workspace.WriteGlobalLocator(locatorPath, workspace.GlobalLocator{WorkspacePath: absoluteWorkspacePath}); err != nil {
			return err
		}
	}

	if *guiPort == 0 {
		fmt.Fprintf(env.stdout, "Configured global workspace locator at %s\n", locatorPath)
		return nil
	}

	root, err := workspace.ResolveGlobal(locatorPath)
	if err != nil {
		return err
	}

	workspaceConfig, err := readOrDefaultConfig(root.ConfigPath)
	if err != nil {
		return err
	}

	workspaceConfig.GUI.Port = *guiPort
	if err := config.Write(root.ConfigPath, workspaceConfig); err != nil {
		return err
	}

	fmt.Fprintf(env.stdout, "Configured global workspace GUI port %d at %s\n", *guiPort, root.ConfigPath)
	return nil
}

func runGUI(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("gui", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	serveInternal := flagSet.Bool("serve-internal", false, "internal GUI server mode")
	if err := flagSet.Parse(args); err != nil {
		return err
	}

	if *serveInternal {
		if flagSet.NArg() != 0 {
			return fmt.Errorf("flow gui --serve-internal does not accept positional arguments")
		}

		return runGUIServe(global, env)
	}

	if flagSet.NArg() > 0 {
		if flagSet.Arg(0) == "stop" {
			if flagSet.NArg() != 1 {
				return fmt.Errorf("flow gui stop does not accept extra arguments")
			}

			return runGUIStop(global, env)
		}

		return fmt.Errorf("unknown gui subcommand %q", flagSet.Arg(0))
	}

	return runGUIStart(global, env)
}

func runGUIStart(global bool, env commandEnv) error {
	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	workspaceConfig, err := readOrDefaultConfig(root.ConfigPath)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("http://127.0.0.1:%d", workspaceConfig.GUI.Port)
	restarted, err := stopRunningGUI(root, env)
	if err != nil && !errors.Is(err, execution.ErrGUIServerNotRunning) {
		return err
	}

	if err := env.launchGUIProcess(global, root); err != nil {
		return err
	}

	if err := env.waitForGUIState(execution.GUIStatePath(root), true); err != nil {
		startupMessage, logErr := readGUIStartupLog(root)
		if logErr == nil && startupMessage != "" {
			return fmt.Errorf("wait for gui state: %s", startupMessage)
		}

		if logErr != nil {
			return fmt.Errorf("wait for gui state: %w (startup log: %v)", err, logErr)
		}

		return fmt.Errorf("wait for gui state: %w", err)
	}

	if err := env.waitForGUI(url); err != nil {
		_, stopErr := stopRunningGUI(root, env)
		if stopErr != nil && !errors.Is(stopErr, execution.ErrGUIServerNotRunning) {
			return fmt.Errorf("wait for gui startup: %w (cleanup failed: %v)", err, stopErr)
		}

		return fmt.Errorf("wait for gui startup: %w", err)
	}

	if err := env.openBrowser(browserLaunchURL(url)); err != nil {
		_, stopErr := stopRunningGUI(root, env)
		if stopErr != nil && !errors.Is(stopErr, execution.ErrGUIServerNotRunning) {
			return fmt.Errorf("open browser: %w (cleanup failed: %v)", err, stopErr)
		}

		return fmt.Errorf("open browser: %w", err)
	}

	action := "Started"
	if restarted {
		action = "Restarted"
	}

	scopeLabel := "local"
	if global {
		scopeLabel = "global"
	}

	fmt.Fprintf(env.stdout, "%s %s GUI server for %s at %s\n", action, scopeLabel, root.WorkspacePath, url)
	return nil
}

func browserLaunchURL(base string) string {
	parsed, err := url.Parse(base)
	if err != nil {
		return base
	}

	query := parsed.Query()
	query.Set("flow-launch", strconv.FormatInt(time.Now().UnixNano(), 10))
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func runGUIServe(global bool, env commandEnv) error {
	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	workspaceConfig, err := readOrDefaultConfig(root.ConfigPath)
	if err != nil {
		return err
	}

	stopRequested := make(chan struct{})
	var stopOnce sync.Once

	handler, err := httpapi.NewMux(httpapi.Options{
		Root: root,
		Stop: func() error {
			stopOnce.Do(func() {
				close(stopRequested)
			})
			return nil
		},
	})
	if err != nil {
		return fmt.Errorf("prepare GUI assets: %w", err)
	}

	result, err := env.guiRuntime.Start(root, workspaceConfig.GUI.Port, handler)
	if err != nil {
		return err
	}
	defer env.guiRuntime.Stop(root)

	state := execution.GUIState{PID: os.Getpid(), Port: result.Port, URL: result.URL}
	if err := execution.WriteGUIState(root, state); err != nil {
		return err
	}
	defer execution.RemoveGUIState(root)

	return waitForShutdown(stopRequested, env.waitForShutdown, result.URL)
}

func runGUIStop(global bool, env commandEnv) error {
	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	_, err = stopRunningGUI(root, env)
	if err != nil {
		return err
	}

	scopeLabel := "local"
	if global {
		scopeLabel = "global"
	}

	fmt.Fprintf(env.stdout, "Stopped %s GUI server for %s\n", scopeLabel, root.WorkspacePath)
	return nil
}

func runCreate(global bool, args []string, env commandEnv) error {
	if len(args) == 0 {
		return fmt.Errorf("flow create requires a document type: note, task, or command")
	}

	documentType, err := parseDocumentTypeArg(args[0])
	if err != nil {
		return err
	}

	flagSet := flag.NewFlagSet("create", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	featureSlug := flagSet.String("feature", "", "legacy feature slug")
	fileName := flagSet.String("file", "", "document file name")
	graph := flagSet.String("graph", "", "document graph")
	title := flagSet.String("title", "", "document title")
	description := flagSet.String("description", "", "document description")
	createdAt := flagSet.String("created-at", "", "created timestamp")
	updatedAt := flagSet.String("updated-at", "", "updated timestamp")
	body := flagSet.String("body", "", "document body")
	status := flagSet.String("status", "", "task status")
	name := flagSet.String("name", "", "command short name")
	runValue := flagSet.String("run", "", "command run string")

	var tags stringListFlag
	var references stringListFlag
	var envValues stringMapFlag
	flagSet.Var(&tags, "tag", "repeatable tag")
	flagSet.Var(&references, "reference", "repeatable reference id")
	flagSet.Var(&envValues, "env", "repeatable KEY=VALUE pair")

	if err := flagSet.Parse(args[1:]); err != nil {
		return err
	}

	if *fileName == "" || *graph == "" {
		return fmt.Errorf("flow create requires --file and --graph")
	}

	if documentType == markdown.CommandType && (*name == "" || *runValue == "") {
		return fmt.Errorf("flow create command requires --name and --run")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	if err := initializeWorkspace(root); err != nil {
		return err
	}

	fileNameValue := ensureMarkdownFileName(*fileName)
	idValue := deriveCreateDocumentID(*graph, fileNameValue)
	workspaceDocument, err := workspace.CreateDocument(root, workspace.CreateDocumentInput{
		Type:        documentType,
		FeatureSlug: *featureSlug,
		FileName:    fileNameValue,
		ID:          idValue,
		Graph:       *graph,
		Title:       *title,
		Description: *description,
		Tags:        []string(tags),
		CreatedAt:   *createdAt,
		UpdatedAt:   *updatedAt,
		Body:        *body,
		Status:      *status,
		Links:       stringsToNodeLinks([]string(references)),
		Name:        *name,
		Env:         map[string]string(envValues),
		Run:         *runValue,
	})
	if err != nil {
		return err
	}

	fmt.Fprintf(env.stdout, "Created %s document at %s\n", documentType, workspaceDocument.Path)
	return nil
}

func runUpdate(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("update", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	pathValue := flagSet.String("path", "", "document path relative to .flow")
	id := flagSet.String("id", "", "document id")
	graph := flagSet.String("graph", "", "document graph")
	title := flagSet.String("title", "", "document title")
	description := flagSet.String("description", "", "document description")
	createdAt := flagSet.String("created-at", "", "created timestamp")
	updatedAt := flagSet.String("updated-at", "", "updated timestamp")
	body := flagSet.String("body", "", "document body")
	status := flagSet.String("status", "", "task status")
	name := flagSet.String("name", "", "command short name")
	runValue := flagSet.String("run", "", "command run string")

	var tags stringListFlag
	var references stringListFlag
	var envValues stringMapFlag
	flagSet.Var(&tags, "tag", "repeatable tag")
	flagSet.Var(&references, "reference", "repeatable reference id")
	flagSet.Var(&envValues, "env", "repeatable KEY=VALUE pair")

	if err := flagSet.Parse(args); err != nil {
		return err
	}

	if *pathValue == "" {
		return fmt.Errorf("flow update requires --path")
	}

	visited := map[string]bool{}
	flagSet.Visit(func(flagValue *flag.Flag) {
		visited[flagValue.Name] = true
	})
	delete(visited, "path")

	if len(visited) == 0 {
		return fmt.Errorf("flow update requires at least one field to change")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	workspaceDocument, err := workspace.UpdateDocumentByPath(root, *pathValue, documentPatchFromFlags(visited, documentPatchValues{
		id:          *id,
		graph:       *graph,
		title:       *title,
		description: *description,
		createdAt:   *createdAt,
		updatedAt:   *updatedAt,
		body:        *body,
		tags:        []string(tags),
		status:      *status,
		references:  []string(references),
		name:        *name,
		env:         map[string]string(envValues),
		run:         *runValue,
	}))
	if err != nil {
		return err
	}

	fmt.Fprintf(env.stdout, "Updated document at %s\n", workspaceDocument.Path)
	return nil
}

func runDelete(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("delete", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	pathValue := flagSet.String("path", "", "document path relative to .flow")
	if err := flagSet.Parse(args); err != nil {
		return err
	}

	if *pathValue == "" {
		return fmt.Errorf("flow delete requires --path")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	relativePath, err := workspace.DeleteDocumentByPath(root, *pathValue)
	if err != nil {
		return err
	}

	fmt.Fprintf(env.stdout, "Deleted document at %s\n", relativePath)
	return nil
}

func runNode(global bool, args []string, env commandEnv) error {
	if len(args) == 0 {
		return fmt.Errorf("flow node requires a subcommand: read, list, edges, neighbors, update, connect, or disconnect")
	}

	switch args[0] {
	case "read":
		return runNodeRead(global, args[1:], env)
	case "content":
		return runNodeContent(global, args[1:], env)
	case "list":
		return runNodeList(global, args[1:], env)
	case "edges":
		return runNodeEdges(global, args[1:], env)
	case "neighbors":
		return runNodeNeighbors(global, args[1:], env)
	case "update":
		return runNodeUpdate(global, args[1:], env)
	case "connect":
		return runNodeConnect(global, args[1:], env)
	case "disconnect":
		return runNodeDisconnect(global, args[1:], env)
	default:
		return fmt.Errorf("unknown node subcommand %q", args[0])
	}
}

func runNodeRead(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("node read", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	id := flagSet.String("id", "", "node id")
	graph := flagSet.String("graph", "", "graph path (optional filter)")
	format := flagSet.String("format", "markdown", "output format: json or markdown")

	if err := flagSet.Parse(args); err != nil {
		return err
	}

	if *id == "" {
		return fmt.Errorf("flow node read requires --id")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	view, err := index.ReadNodeViewWorkspace(root.IndexPath, root.FlowPath, *id, *graph)
	if err != nil {
		return err
	}

	return renderNodeView(env.stdout, view, *format)
}

func runNodeList(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("node list", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	graph := flagSet.String("graph", "", "graph path")
	feature := flagSet.String("feature", "", "feature slug (first graph segment)")
	status := flagSet.String("status", "", "task status filter")
	limit := flagSet.Int("limit", 100, "maximum number of nodes")
	compact := flagSet.Bool("compact", false, "compact output for agent usage")
	var tags stringListFlag
	flagSet.Var(&tags, "tag", "repeatable tag filter")
	format := flagSet.String("format", "markdown", "output format: json or markdown")

	if err := flagSet.Parse(args); err != nil {
		return err
	}

	if *limit <= 0 {
		return fmt.Errorf("flow node list requires --limit > 0")
	}

	if strings.TrimSpace(*graph) == "" && strings.TrimSpace(*feature) == "" && strings.TrimSpace(*status) == "" && len(tags) == 0 {
		return fmt.Errorf("flow node list requires --graph or at least one filter (--feature, --status, --tag)")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	records, err := loadNodeRecords(root)
	if err != nil {
		return err
	}

	records = filterNodeRecords(records, nodeRecordFilter{
		Graph:   strings.TrimSpace(*graph),
		Feature: strings.TrimSpace(*feature),
		Status:  strings.TrimSpace(*status),
		Tags:    []string(tags),
	})

	if len(records) > *limit {
		records = records[:*limit]
	}

	if *format == "json" {
		data, err := json.Marshal(records)
		if err != nil {
			return fmt.Errorf("marshal node list: %w", err)
		}
		fmt.Fprintln(env.stdout, string(data))
		return nil
	}

	if len(records) == 0 {
		fmt.Fprintln(env.stdout, "No nodes match filters")
		return nil
	}

	for _, record := range records {
		if *compact {
			fmt.Fprintln(env.stdout, record.ID)
			continue
		}

		line := fmt.Sprintf("- %s %s [%s/%s]", record.ID, record.Type, deriveRole(record.Type), record.Graph)
		if record.Title != "" {
			line += " :: " + record.Title
		}
		if record.Status != "" {
			line += " (" + record.Status + ")"
		}
		if len(record.Tags) > 0 {
			line += " tags=" + strings.Join(record.Tags, ",")
		}
		fmt.Fprintln(env.stdout, line)
	}

	return nil
}

func runNodeContent(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("node content", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	id := flagSet.String("id", "", "node id")
	graph := flagSet.String("graph", "", "graph path (optional filter)")
	lineStart := flagSet.Int("line-start", 0, "1-based content line start")
	lineEnd := flagSet.Int("line-end", 0, "1-based content line end")
	format := flagSet.String("format", "text", "output format: text or json")

	if err := flagSet.Parse(args); err != nil {
		return err
	}

	if *id == "" {
		return fmt.Errorf("flow node content requires --id")
	}

	if (*lineStart > 0 && *lineEnd > 0 && *lineStart > *lineEnd) || *lineStart < 0 || *lineEnd < 0 {
		return fmt.Errorf("invalid line range; ensure 0 <= line-start <= line-end")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	view, err := index.ReadNodeViewWorkspace(root.IndexPath, root.FlowPath, *id, *graph)
	if err != nil {
		return err
	}

	lines := strings.Split(view.Body, "\n")
	start := 1
	end := len(lines)
	if *lineStart > 0 {
		start = *lineStart
	}
	if *lineEnd > 0 {
		end = *lineEnd
	}

	if len(lines) == 1 && lines[0] == "" {
		start = 0
		end = 0
	}

	if start > len(lines) {
		start = len(lines) + 1
	}
	if end > len(lines) {
		end = len(lines)
	}

	selected := ""
	if start > 0 && end >= start && start <= len(lines) {
		selected = strings.Join(lines[start-1:end], "\n")
	}

	if *format == "json" {
		payload := map[string]any{
			"id":          view.ID,
			"graph":       view.Graph,
			"lineStart":   start,
			"lineEnd":     end,
			"lineCount":   len(lines),
			"content":     selected,
			"fullContent": view.Body,
		}
		if *lineStart == 0 && *lineEnd == 0 {
			delete(payload, "content")
		}
		data, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("marshal node content: %w", err)
		}
		fmt.Fprintln(env.stdout, string(data))
		return nil
	}

	if *lineStart == 0 && *lineEnd == 0 {
		fmt.Fprint(env.stdout, view.Body)
		return nil
	}

	fmt.Fprint(env.stdout, selected)
	return nil
}

func runNodeEdges(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("node edges", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	id := flagSet.String("id", "", "node id")
	graph := flagSet.String("graph", "", "graph path (optional filter)")
	format := flagSet.String("format", "markdown", "output format: json or markdown")

	if err := flagSet.Parse(args); err != nil {
		return err
	}

	if *id == "" {
		return fmt.Errorf("flow node edges requires --id")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	if err := index.EnsureIndexExists(root.IndexPath, root.FlowPath); err != nil {
		return err
	}

	edges, err := index.ReadEdgesByEndpoint(root.IndexPath, *id)
	if err != nil {
		return err
	}

	if *graph != "" {
		filtered := edges[:0]
		for _, e := range edges {
			if e.Graph == *graph {
				filtered = append(filtered, e)
			}
		}
		edges = filtered
	}

	if *format == "json" {
		data, err := json.Marshal(edges)
		if err != nil {
			return fmt.Errorf("marshal edges: %w", err)
		}
		fmt.Fprintln(env.stdout, string(data))
		return nil
	}

	if len(edges) == 0 {
		fmt.Fprintf(env.stdout, "No edges for node %q\n", *id)
		return nil
	}

	for _, e := range edges {
		direction := "→"
		if e.ToID == *id {
			direction = "←"
		}
		label := e.Label
		if label == "" {
			label = "(unlabeled)"
		}
		fmt.Fprintf(env.stdout, "- %s %s %s %s [%s] (%s)\n", e.ID, e.FromID, direction, e.ToID, label, e.Graph)
	}

	return nil
}

func runNodeNeighbors(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("node neighbors", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	id := flagSet.String("id", "", "node id")
	graph := flagSet.String("graph", "", "graph path (optional filter)")
	format := flagSet.String("format", "markdown", "output format: json or markdown")

	if err := flagSet.Parse(args); err != nil {
		return err
	}

	if *id == "" {
		return fmt.Errorf("flow node neighbors requires --id")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	view, err := index.ReadNodeViewWorkspace(root.IndexPath, root.FlowPath, *id, *graph)
	if err != nil {
		return err
	}

	// Collect all neighbor IDs: links + outbound edge targets + inbound edge sources.
	seen := map[string]bool{}
	var neighborIDs []string
	for _, link := range view.Links {
		if !seen[link] {
			seen[link] = true
			neighborIDs = append(neighborIDs, link)
		}
	}
	for _, ev := range view.OutboundEdges {
		if !seen[ev.To] {
			seen[ev.To] = true
			neighborIDs = append(neighborIDs, ev.To)
		}
	}
	for _, ev := range view.InboundEdges {
		if !seen[ev.From] {
			seen[ev.From] = true
			neighborIDs = append(neighborIDs, ev.From)
		}
	}

	summaries, err := index.ReadNodeSummariesByIDs(root.IndexPath, neighborIDs)
	if err != nil {
		return err
	}

	if *format == "json" {
		data, err := json.Marshal(summaries)
		if err != nil {
			return fmt.Errorf("marshal neighbors: %w", err)
		}
		fmt.Fprintln(env.stdout, string(data))
		return nil
	}

	if len(summaries) == 0 {
		fmt.Fprintf(env.stdout, "No neighbors for node %q\n", *id)
		return nil
	}

	for _, s := range summaries {
		line := fmt.Sprintf("- %s %s [%s/%s]", s.ID, s.Type, s.Role, s.Graph)
		if s.Title != "" {
			line += " :: " + s.Title
		}
		fmt.Fprintln(env.stdout, line)
	}

	return nil
}

func runNodeUpdate(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("node update", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	id := flagSet.String("id", "", "node id")
	title := flagSet.String("title", "", "document title")
	description := flagSet.String("description", "", "document description")
	createdAt := flagSet.String("created-at", "", "created timestamp")
	updatedAt := flagSet.String("updated-at", "", "updated timestamp")
	body := flagSet.String("body", "", "document body")
	status := flagSet.String("status", "", "task status")
	name := flagSet.String("name", "", "command short name")
	runValue := flagSet.String("run", "", "command run string")

	var tags stringListFlag
	var references stringListFlag
	var envValues stringMapFlag
	flagSet.Var(&tags, "tag", "repeatable tag")
	flagSet.Var(&references, "reference", "repeatable reference id")
	flagSet.Var(&envValues, "env", "repeatable KEY=VALUE pair")

	if err := flagSet.Parse(args); err != nil {
		return err
	}

	if *id == "" {
		return fmt.Errorf("flow node update requires --id")
	}

	visited := map[string]bool{}
	flagSet.Visit(func(flagValue *flag.Flag) {
		visited[flagValue.Name] = true
	})
	delete(visited, "id")

	if len(visited) == 0 {
		return fmt.Errorf("flow node update requires at least one field to change")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	workspaceDocument, err := workspace.UpdateDocumentByID(root, *id, documentPatchFromFlags(visited, documentPatchValues{
		title:       *title,
		description: *description,
		createdAt:   *createdAt,
		updatedAt:   *updatedAt,
		body:        *body,
		tags:        []string(tags),
		status:      *status,
		references:  []string(references),
		name:        *name,
		env:         map[string]string(envValues),
		run:         *runValue,
	}))
	if err != nil {
		return err
	}

	fmt.Fprintf(env.stdout, "Updated node %s at %s\n", *id, workspaceDocument.Path)
	return nil
}

func runNodeConnect(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("node connect", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)
	from := flagSet.String("from", "", "ID of the source node")
	to := flagSet.String("to", "", "ID of the target node")
	graph := flagSet.String("graph", "", "graph the nodes belong to")
	context := flagSet.String("context", "", "optional context describing the relationship")
	var relationships stringListFlag
	flagSet.Var(&relationships, "relationship", "repeatable relationship tag")
	if err := flagSet.Parse(args); err != nil {
		return fmt.Errorf("flow node connect: %w", err)
	}
	if *from == "" {
		return fmt.Errorf("flow node connect requires --from")
	}
	if *to == "" {
		return fmt.Errorf("flow node connect requires --to")
	}
	if *graph == "" {
		return fmt.Errorf("flow node connect requires --graph")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	if err := workspace.AddLink(root, *from, *to, *context, []string(relationships)); err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	fmt.Fprintf(env.stdout, "Connected %s → %s in graph %s\n", *from, *to, *graph)
	return nil
}

func runNodeDisconnect(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("node disconnect", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)
	from := flagSet.String("from", "", "ID of the source node")
	to := flagSet.String("to", "", "ID of the target node")
	graph := flagSet.String("graph", "", "graph the edge belongs to")
	if err := flagSet.Parse(args); err != nil {
		return fmt.Errorf("flow node disconnect: %w", err)
	}
	if *from == "" {
		return fmt.Errorf("flow node disconnect requires --from")
	}
	if *to == "" {
		return fmt.Errorf("flow node disconnect requires --to")
	}
	if *graph == "" {
		return fmt.Errorf("flow node disconnect requires --graph")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}
	if err := workspace.RemoveLink(root, *from, *to); err != nil {
		return fmt.Errorf("disconnect: %w", err)
	}
	fmt.Fprintf(env.stdout, "Disconnected %s → %s\n", *from, *to)
	return nil
}

func renderNodeView(w io.Writer, view index.NodeView, format string) error {
	if format == "json" {
		data, err := json.Marshal(view)
		if err != nil {
			return fmt.Errorf("marshal node view: %w", err)
		}
		fmt.Fprintln(w, string(data))
		return nil
	}

	fmt.Fprintf(w, "# %s\n\n", view.Title)
	fmt.Fprintf(w, "ID: %s\nType: %s\nRole: %s\nGraph: %s\n", view.ID, view.Type, view.Role, view.Graph)
	if view.Status != "" {
		fmt.Fprintf(w, "Status: %s\n", view.Status)
	}
	if view.Run != "" {
		fmt.Fprintf(w, "Run: %s\n", view.Run)
	}

	if view.Body != "" {
		fmt.Fprintf(w, "\n## Body\n\n%s", view.Body)
	}

	if len(view.Links) > 0 {
		fmt.Fprintf(w, "\n## Links\n\n")
		for _, link := range view.Links {
			fmt.Fprintf(w, "- %s\n", link)
		}
	}

	if len(view.OutboundEdges) > 0 {
		fmt.Fprintf(w, "\n## Outbound Edges\n\n")
		for _, ev := range view.OutboundEdges {
			label := ev.Label
			if label == "" {
				label = "(unlabeled)"
			}
			fmt.Fprintf(w, "- %s → %s [%s]\n", ev.ID, ev.To, label)
			if ev.Body != "" {
				fmt.Fprintf(w, "  Body: %s", strings.TrimRight(ev.Body, "\n"))
				fmt.Fprintln(w)
			}
		}
	}

	if len(view.InboundEdges) > 0 {
		fmt.Fprintf(w, "\n## Inbound Edges\n\n")
		for _, ev := range view.InboundEdges {
			label := ev.Label
			if label == "" {
				label = "(unlabeled)"
			}
			fmt.Fprintf(w, "- %s ← %s [%s]\n", ev.ID, ev.From, label)
			if ev.Body != "" {
				fmt.Fprintf(w, "  Body: %s", strings.TrimRight(ev.Body, "\n"))
				fmt.Fprintln(w)
			}
		}
	}

	return nil
}

func runSearch(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("search", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	limit := flagSet.Int("limit", 10, "maximum indexed search results")
	graph := flagSet.String("graph", "", "graph path filter")
	feature := flagSet.String("feature", "", "feature slug filter")
	documentType := flagSet.String("type", "", "document type filter")
	tag := flagSet.String("tag", "", "tag filter")
	title := flagSet.String("title", "", "title filter")
	description := flagSet.String("description", "", "description filter")
	content := flagSet.String("content", "", "content filter")
	compact := flagSet.Bool("compact", false, "compact output for agent usage")
	if err := flagSet.Parse(args); err != nil {
		return err
	}

	if *limit <= 0 {
		return fmt.Errorf("flow search requires --limit > 0")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	query := strings.TrimSpace(strings.Join(flagSet.Args(), " "))
	filters := index.SearchFilters{
		Any:         query,
		Tag:         strings.TrimSpace(*tag),
		Title:       strings.TrimSpace(*title),
		Description: strings.TrimSpace(*description),
		Content:     strings.TrimSpace(*content),
	}

	if strings.TrimSpace(filters.Any) == "" && strings.TrimSpace(filters.Tag) == "" && strings.TrimSpace(filters.Title) == "" && strings.TrimSpace(filters.Description) == "" && strings.TrimSpace(filters.Content) == "" {
		return fmt.Errorf("flow search requires a query or at least one filter (--tag, --title, --description, --content)")
	}

	results, err := index.SearchWorkspaceWithFilters(root.IndexPath, root.FlowPath, filters, *limit)
	if err != nil {
		return err
	}

	if *graph != "" {
		filtered := make([]index.SearchResult, 0, len(results))
		for _, result := range results {
			if result.Graph == *graph {
				filtered = append(filtered, result)
			}
		}
		results = filtered
	}

	if *feature != "" {
		filtered := make([]index.SearchResult, 0, len(results))
		for _, result := range results {
			if result.FeatureSlug == *feature {
				filtered = append(filtered, result)
			}
		}
		results = filtered
	}

	if *documentType != "" {
		filtered := make([]index.SearchResult, 0, len(results))
		for _, result := range results {
			if result.Type == *documentType {
				filtered = append(filtered, result)
			}
		}
		results = filtered
	}

	if len(results) == 0 {
		if query != "" {
			fmt.Fprintf(env.stdout, "No indexed matches for %q\n", query)
		} else {
			fmt.Fprintln(env.stdout, "No indexed matches")
		}
		return nil
	}

	for _, result := range results {
		if *compact {
			fmt.Fprintln(env.stdout, result.ID)
			continue
		}

		line := fmt.Sprintf("- %s %s [%s] %s", result.Type, result.ID, result.Graph, result.Path)
		if result.Title != "" {
			line += " :: " + result.Title
		}
		if result.Snippet != "" {
			line += " :: " + result.Snippet
		}
		fmt.Fprintln(env.stdout, line)
	}

	return nil
}

type nodeRecord struct {
	ID          string   `json:"id"`
	Type        string   `json:"type"`
	Graph       string   `json:"graph"`
	Feature     string   `json:"feature"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Status      string   `json:"status,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	Path        string   `json:"path"`
}

type nodeRecordFilter struct {
	Graph   string
	Feature string
	Status  string
	Tags    []string
}

func loadNodeRecords(root workspace.Root) ([]nodeRecord, error) {
	documents, err := workspace.LoadDocuments(root.FlowPath)
	if err != nil {
		return nil, err
	}

	records := make([]nodeRecord, 0, len(documents))
	for _, item := range documents {
		switch document := item.Document.(type) {
		case markdown.HomeDocument:
			records = append(records, nodeRecord{
				ID:          document.Metadata.ID,
				Type:        string(document.Metadata.Type),
				Graph:       "",
				Feature:     "",
				Title:       document.Metadata.Title,
				Description: document.Metadata.Description,
				Tags:        cloneStrings(document.Metadata.Tags),
				Path:        item.Path,
			})
		case markdown.NoteDocument:
			records = append(records, nodeRecord{
				ID:          document.Metadata.ID,
				Type:        string(document.Metadata.Type),
				Graph:       document.Metadata.Graph,
				Feature:     featureFromGraph(document.Metadata.Graph),
				Title:       document.Metadata.Title,
				Description: document.Metadata.Description,
				Tags:        cloneStrings(document.Metadata.Tags),
				Path:        item.Path,
			})
		case markdown.TaskDocument:
			records = append(records, nodeRecord{
				ID:          document.Metadata.ID,
				Type:        string(document.Metadata.Type),
				Graph:       document.Metadata.Graph,
				Feature:     featureFromGraph(document.Metadata.Graph),
				Title:       document.Metadata.Title,
				Description: document.Metadata.Description,
				Status:      document.Metadata.Status,
				Tags:        cloneStrings(document.Metadata.Tags),
				Path:        item.Path,
			})
		case markdown.CommandDocument:
			records = append(records, nodeRecord{
				ID:          document.Metadata.ID,
				Type:        string(document.Metadata.Type),
				Graph:       document.Metadata.Graph,
				Feature:     featureFromGraph(document.Metadata.Graph),
				Title:       document.Metadata.Title,
				Description: document.Metadata.Description,
				Tags:        cloneStrings(document.Metadata.Tags),
				Path:        item.Path,
			})
		}
	}

	sort.Slice(records, func(i, j int) bool {
		if records[i].Path == records[j].Path {
			return records[i].ID < records[j].ID
		}
		return records[i].Path < records[j].Path
	})

	return records, nil
}

func filterNodeRecords(records []nodeRecord, filter nodeRecordFilter) []nodeRecord {
	if len(records) == 0 {
		return records
	}

	tagSet := make(map[string]struct{}, len(filter.Tags))
	for _, tag := range filter.Tags {
		trimmed := strings.TrimSpace(strings.ToLower(tag))
		if trimmed == "" {
			continue
		}
		tagSet[trimmed] = struct{}{}
	}

	filtered := make([]nodeRecord, 0, len(records))
	for _, record := range records {
		if filter.Graph != "" && record.Graph != filter.Graph {
			continue
		}
		if filter.Feature != "" && record.Feature != filter.Feature {
			continue
		}
		if filter.Status != "" {
			if record.Type != string(markdown.TaskType) || record.Status != filter.Status {
				continue
			}
		}
		if len(tagSet) > 0 {
			matchesTag := false
			for _, tag := range record.Tags {
				if _, ok := tagSet[strings.ToLower(strings.TrimSpace(tag))]; ok {
					matchesTag = true
					break
				}
			}
			if !matchesTag {
				continue
			}
		}
		filtered = append(filtered, record)
	}

	return filtered
}

func featureFromGraph(graph string) string {
	trimmed := strings.TrimSpace(graph)
	if trimmed == "" {
		return ""
	}

	parts := strings.Split(trimmed, "/")
	if len(parts) == 0 {
		return ""
	}

	return parts[0]
}

func deriveRole(documentType string) string {
	switch documentType {
	case string(markdown.TaskType):
		return "work"
	case string(markdown.CommandType):
		return "decision"
	default:
		return "context"
	}
}

func runRun(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("run", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)
	if err := flagSet.Parse(args); err != nil {
		return err
	}

	if flagSet.NArg() != 1 {
		return fmt.Errorf("flow run requires exactly one command id or short name")
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	commandExecution, err := execution.PrepareCommandExecution(root, flagSet.Arg(0), env.environ())
	if err != nil {
		return err
	}

	fmt.Fprintf(env.stdout, "Running command %s (%s)\n", commandExecution.Title, commandExecution.ID)
	if err := env.startCommand(commandExecution, env.stdout, env.stderr); err != nil {
		return fmt.Errorf("run command %s (%s): %w", commandExecution.Title, commandExecution.ID, err)
	}
	fmt.Fprintf(env.stdout, "Completed command %s (%s)\n", commandExecution.Title, commandExecution.ID)

	return nil
}

func resolveRoot(global bool, env commandEnv) (workspace.Root, error) {
	if global {
		locatorPath, err := globalLocatorPath(env)
		if err != nil {
			return workspace.Root{}, err
		}

		root, err := workspace.ResolveGlobal(locatorPath)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				return workspace.Root{}, fmt.Errorf("global workspace is not configured; run `flow -g configure --workspace /absolute/path`")
			}

			return workspace.Root{}, err
		}

		return root, nil
	}

	workingDirectory, err := env.getwd()
	if err != nil {
		return workspace.Root{}, fmt.Errorf("resolve working directory: %w", err)
	}

	return workspace.ResolveLocal(workingDirectory)
}

type createDocumentOptions struct {
	id         string
	graph      string
	title      string
	tags       []string
	createdAt  string
	updatedAt  string
	body       string
	status     string
	references []string
	name       string
	env        map[string]string
	run        string
}

type documentUpdateOptions struct {
	visited    map[string]bool
	id         string
	graph      string
	title      string
	createdAt  string
	updatedAt  string
	body       string
	tags       []string
	status     string
	references []string
	name       string
	env        map[string]string
	run        string
}

type documentPatchValues struct {
	id          string
	graph       string
	title       string
	description string
	createdAt   string
	updatedAt   string
	body        string
	tags        []string
	status      string
	references  []string
	name        string
	env         map[string]string
	run         string
}

func documentPatchFromFlags(visited map[string]bool, values documentPatchValues) workspace.DocumentPatch {
	patch := workspace.DocumentPatch{}
	if visited["id"] {
		patch.ID = stringPointer(values.id)
	}
	if visited["graph"] {
		patch.Graph = stringPointer(values.graph)
	}
	if visited["title"] {
		patch.Title = stringPointer(values.title)
	}
	if visited["description"] {
		patch.Description = stringPointer(values.description)
	}
	if visited["created-at"] {
		patch.CreatedAt = stringPointer(values.createdAt)
	}
	if visited["updated-at"] {
		patch.UpdatedAt = stringPointer(values.updatedAt)
	}
	if visited["body"] {
		patch.Body = stringPointer(values.body)
	}
	if visited["tag"] {
		patch.Tags = stringSlicePointer(values.tags)
	}
	if visited["status"] {
		patch.Status = stringPointer(values.status)
	}
	if visited["reference"] {
		patch.Links = nodeLinkSlicePointer(values.references)
	}
	if visited["name"] {
		patch.Name = stringPointer(values.name)
	}
	if visited["env"] {
		patch.Env = stringMapPointer(values.env)
	}
	if visited["run"] {
		patch.Run = stringPointer(values.run)
	}
	return patch
}

func stringPointer(value string) *string {
	return &value
}

func stringSlicePointer(values []string) *[]string {
	cloned := cloneStrings(values)
	if cloned == nil {
		cloned = []string{}
	}
	return &cloned
}

func nodeLinkSlicePointer(ids []string) *[]markdown.NodeLink {
	links := stringsToNodeLinks(ids)
	if links == nil {
		links = []markdown.NodeLink{}
	}
	return &links
}

func stringMapPointer(values map[string]string) *map[string]string {
	cloned := cloneMap(values)
	if cloned == nil {
		cloned = map[string]string{}
	}
	return &cloned
}

func parseDocumentTypeArg(value string) (markdown.DocumentType, error) {
	switch markdown.DocumentType(value) {
	case markdown.NoteType, markdown.TaskType, markdown.CommandType:
		return markdown.DocumentType(value), nil
	default:
		return "", fmt.Errorf("unsupported document type %q", value)
	}
}

func ensureMarkdownFileName(value string) string {
	if strings.HasSuffix(value, ".md") {
		return value
	}

	return value + ".md"
}

func deriveCreateDocumentID(graph string, fileName string) string {
	cleanGraph := strings.Trim(filepath.ToSlash(filepath.Clean(graph)), "/")
	cleanFile := strings.Trim(filepath.ToSlash(strings.TrimSuffix(fileName, ".md")), "/")

	if cleanGraph == "" || cleanGraph == "." {
		return cleanFile
	}

	return cleanGraph + "/" + cleanFile
}

func buildCreateDocument(documentType markdown.DocumentType, options createDocumentOptions) markdown.Document {
	common := markdown.CommonFields{
		ID:        options.id,
		Type:      documentType,
		Graph:     options.graph,
		Title:     options.title,
		Tags:      cloneStrings(options.tags),
		CreatedAt: options.createdAt,
		UpdatedAt: options.updatedAt,
	}

	switch documentType {
	case markdown.NoteType:
		return markdown.NoteDocument{
			Metadata: markdown.NoteMetadata{
				CommonFields: common,
				Links:        stringsToNodeLinks(options.references),
			},
			Body: options.body,
		}
	case markdown.TaskType:
		return markdown.TaskDocument{
			Metadata: markdown.TaskMetadata{
				CommonFields: common,
				Status:       options.status,
				Links:        stringsToNodeLinks(options.references),
			},
			Body: options.body,
		}
	case markdown.CommandType:
		return markdown.CommandDocument{
			Metadata: markdown.CommandMetadata{
				CommonFields: common,
				Name:         options.name,
				Links:        stringsToNodeLinks(options.references),
				Env:          cloneMap(options.env),
				Run:          options.run,
			},
			Body: options.body,
		}
	default:
		return nil
	}
}

func applyDocumentUpdate(document markdown.Document, options documentUpdateOptions) (markdown.Document, error) {
	switch value := document.(type) {
	case markdown.NoteDocument:
		patchCommonFields(&value.Metadata.CommonFields, options)
		if options.visited["reference"] {
			value.Metadata.Links = stringsToNodeLinks(options.references)
		}
		if options.visited["body"] {
			value.Body = options.body
		}
		return value, nil
	case markdown.TaskDocument:
		patchCommonFields(&value.Metadata.CommonFields, options)
		if options.visited["status"] {
			value.Metadata.Status = options.status
		}
		if options.visited["reference"] {
			value.Metadata.Links = stringsToNodeLinks(options.references)
		}
		if options.visited["body"] {
			value.Body = options.body
		}
		return value, nil
	case markdown.CommandDocument:
		patchCommonFields(&value.Metadata.CommonFields, options)
		if options.visited["name"] {
			value.Metadata.Name = options.name
		}
		if options.visited["reference"] {
			value.Metadata.Links = stringsToNodeLinks(options.references)
		}
		if options.visited["env"] {
			value.Metadata.Env = cloneMap(options.env)
		}
		if options.visited["run"] {
			value.Metadata.Run = options.run
		}
		if options.visited["body"] {
			value.Body = options.body
		}
		return value, nil
	default:
		return nil, fmt.Errorf("unsupported document type %T", document)
	}
}

func patchCommonFields(fields *markdown.CommonFields, options documentUpdateOptions) {
	if options.visited["id"] {
		fields.ID = options.id
	}
	if options.visited["graph"] {
		fields.Graph = options.graph
	}
	if options.visited["title"] {
		fields.Title = options.title
	}
	if options.visited["created-at"] {
		fields.CreatedAt = options.createdAt
	}
	if options.visited["updated-at"] {
		fields.UpdatedAt = options.updatedAt
	}
	if options.visited["tag"] {
		fields.Tags = cloneStrings(options.tags)
	}
}

func cloneStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	cloned := make([]string, len(values))
	copy(cloned, values)
	return cloned
}

func stringsToNodeLinks(ids []string) []markdown.NodeLink {
	if len(ids) == 0 {
		return nil
	}
	refs := make([]markdown.NodeLink, len(ids))
	for i, id := range ids {
		refs[i] = markdown.NodeLink{Node: id}
	}
	return refs
}

func cloneMap(values map[string]string) map[string]string {
	if len(values) == 0 {
		return nil
	}

	cloned := make(map[string]string, len(values))
	for key, value := range values {
		cloned[key] = value
	}

	return cloned
}

func resolveDocumentFilePath(flowPath string, pathValue string) (string, string, error) {
	cleaned := filepath.Clean(pathValue)
	flowPrefix := workspace.DirName + string(os.PathSeparator)
	if cleaned == workspace.DirName {
		return "", "", fmt.Errorf("document path must point to a Markdown file inside %s", workspace.DirName)
	}
	cleaned = strings.TrimPrefix(cleaned, flowPrefix)

	absolutePath := cleaned
	if !filepath.IsAbs(absolutePath) {
		absolutePath = filepath.Join(flowPath, cleaned)
	}

	absolutePath, err := filepath.Abs(absolutePath)
	if err != nil {
		return "", "", fmt.Errorf("resolve document path: %w", err)
	}

	flowRoot, err := filepath.Abs(flowPath)
	if err != nil {
		return "", "", fmt.Errorf("resolve workspace flow path: %w", err)
	}

	relativePath, err := filepath.Rel(flowRoot, absolutePath)
	if err != nil {
		return "", "", fmt.Errorf("resolve relative document path: %w", err)
	}

	if relativePath == "." || relativePath == ".." || strings.HasPrefix(relativePath, ".."+string(os.PathSeparator)) {
		return "", "", fmt.Errorf("document path must stay inside %s", workspace.DirName)
	}

	return absolutePath, filepath.ToSlash(relativePath), nil
}

func readDocumentFile(path string) (markdown.Document, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read document: %w", err)
	}

	document, err := markdown.ParseDocument(data)
	if err != nil {
		return nil, fmt.Errorf("parse document: %w", err)
	}

	return document, nil
}

func writeDocumentFile(path string, document markdown.Document, failIfExists bool) error {
	if failIfExists {
		if _, err := os.Stat(path); err == nil {
			return fmt.Errorf("document already exists at %s", path)
		} else if !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("stat document path: %w", err)
		}
	}

	data, err := markdown.SerializeDocument(document)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create document directory: %w", err)
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write document: %w", err)
	}

	return nil
}

func validateWorkspaceMutation(flowPath string, relativePath string, document markdown.Document, deleting bool) error {
	workspaceDocuments, err := workspace.LoadDocuments(flowPath)
	if err != nil {
		return err
	}

	targets := make([]markdown.WorkspaceDocument, 0, len(workspaceDocuments)+1)
	replaced := false
	for _, item := range workspaceDocuments {
		if item.Path != relativePath {
			targets = append(targets, item)
			continue
		}

		replaced = true
		if !deleting {
			targets = append(targets, markdown.WorkspaceDocument{Path: relativePath, Document: document})
		}
	}

	if !deleting && !replaced {
		targets = append(targets, markdown.WorkspaceDocument{Path: relativePath, Document: document})
	}

	if err := markdown.ValidateWorkspaceDocuments(targets); err != nil {
		return fmt.Errorf("validate workspace documents: %w", err)
	}

	return nil
}

func globalLocatorPath(env commandEnv) (string, error) {
	configDir, err := env.userConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolve user config directory: %w", err)
	}

	return workspace.DefaultGlobalLocatorPath(configDir), nil
}

func initializeWorkspace(root workspace.Root) error {
	if err := os.MkdirAll(root.FlowPath, 0o755); err != nil {
		return fmt.Errorf("create workspace metadata directory: %w", err)
	}

	for _, path := range []string{root.ConfigDirPath, root.DataPath, root.GraphsPath} {
		if err := os.MkdirAll(path, 0o755); err != nil {
			return fmt.Errorf("create workspace directory %s: %w", path, err)
		}
	}

	if err := ensureWorkspaceGitignore(root); err != nil {
		return err
	}

	workspaceConfig, err := readOrDefaultConfig(root.ConfigPath)
	if err != nil {
		return err
	}

	if err := config.Write(root.ConfigPath, workspaceConfig); err != nil {
		return err
	}

	if err := ensureHomeDocument(root.HomePath); err != nil {
		return err
	}

	if err := index.Rebuild(root.IndexPath, root.FlowPath); err != nil {
		return err
	}

	return nil
}

func ensureWorkspaceGitignore(root workspace.Root) error {
	ignorePath := filepath.Join(root.FlowPath, ".gitignore")
	requiredEntries := []string{
		filepath.ToSlash(filepath.Join(workspace.ConfigDirName, workspace.IndexFileName)),
		filepath.ToSlash(filepath.Join(workspace.ConfigDirName, execution.GUIStateFileName)),
	}

	existingContent, err := os.ReadFile(ignorePath)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("read workspace ignore file: %w", err)
	}

	existingLines := []string{}
	if err == nil {
		existingLines = strings.Split(strings.ReplaceAll(string(existingContent), "\r\n", "\n"), "\n")
	}

	present := make(map[string]bool, len(existingLines))
	for _, line := range existingLines {
		present[strings.TrimSpace(line)] = true
	}

	updatedLines := append([]string(nil), existingLines...)
	changed := false
	for _, entry := range requiredEntries {
		if present[entry] {
			continue
		}
		updatedLines = append(updatedLines, entry)
		changed = true
	}

	if err == nil && !changed {
		return nil
	}

	content := strings.TrimRight(strings.Join(updatedLines, "\n"), "\n") + "\n"
	if err := os.WriteFile(ignorePath, []byte(content), 0o644); err != nil {
		return fmt.Errorf("write workspace ignore file: %w", err)
	}

	return nil
}

func readOrDefaultConfig(path string) (config.Workspace, error) {
	workspaceConfig, err := config.Read(path)
	if err == nil {
		return workspaceConfig, nil
	}

	if !config.IsNotFound(err) {
		return config.Workspace{}, err
	}

	return config.DefaultWorkspace(), nil
}

func ensureHomeDocument(path string) error {
	if _, err := os.Stat(path); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("stat home document: %w", err)
	}

	if err := os.WriteFile(path, []byte("# Home\n"), 0o644); err != nil {
		return fmt.Errorf("write home document: %w", err)
	}

	return nil
}

func runExternalCommand(commandExecution execution.CommandExecution, stdout io.Writer, stderr io.Writer) error {
	command := exec.Command(commandExecution.Shell, commandExecution.Args...)
	command.Dir = commandExecution.WorkingDir
	command.Env = commandExecution.Environment
	command.Stdout = stdout
	command.Stderr = stderr
	return command.Run()
}

func openBrowser(url string) error {
	command := "xdg-open"
	args := []string{url}

	switch goruntime.GOOS {
	case "darwin":
		command = "open"
	case "windows":
		command = "rundll32"
		args = []string{"url.dll,FileProtocolHandler", url}
	}

	if err := exec.Command(command, args...).Start(); err != nil {
		return fmt.Errorf("start browser command %q: %w", command, err)
	}

	return nil
}

func launchGUIProcess(global bool, root workspace.Root) error {
	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve executable: %w", err)
	}

	args := []string{"gui", "--serve-internal"}
	if global {
		args = []string{"-g", "gui", "--serve-internal"}
	}

	command := exec.Command(executable, args...)
	command.Dir = root.WorkspacePath

	logPath := guiStartupLogPath(root)
	if err := os.Remove(logPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("clear gui startup log: %w", err)
	}

	logFile, err := os.Create(logPath)
	if err != nil {
		return fmt.Errorf("create gui startup log: %w", err)
	}

	command.Stdout = logFile
	command.Stderr = logFile

	if err := command.Start(); err != nil {
		_ = logFile.Close()
		return fmt.Errorf("start gui server process: %w", err)
	}

	if err := logFile.Close(); err != nil {
		return fmt.Errorf("close gui startup log: %w", err)
	}

	return nil
}

func guiStartupLogPath(root workspace.Root) string {
	hash := sha256.Sum256([]byte(root.WorkspacePath))
	return filepath.Join(os.TempDir(), fmt.Sprintf("flow-gui-startup-%x.log", hash[:6]))
}

func readGUIStartupLog(root workspace.Root) (string, error) {
	data, err := os.ReadFile(guiStartupLogPath(root))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", nil
		}

		return "", fmt.Errorf("read gui startup log: %w", err)
	}

	message := strings.TrimSpace(string(data))
	message = strings.TrimPrefix(message, "error:")
	message = strings.TrimSpace(message)
	return message, nil
}

func signalProcess(pid int, signal syscall.Signal) error {
	process, err := os.FindProcess(pid)
	if err != nil {
		return fmt.Errorf("find gui server process: %w", err)
	}

	if err := process.Signal(signal); err != nil {
		return err
	}

	return nil
}

func waitForGUI(url string) error {
	return waitForURL(url)
}

func waitForGUIState(path string, wantExists bool) error {
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		_, err := os.Stat(path)
		exists := err == nil
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("stat gui state: %w", err)
		}

		if exists == wantExists {
			return nil
		}

		time.Sleep(10 * time.Millisecond)
	}

	if wantExists {
		return fmt.Errorf("gui state file was not created")
	}

	return fmt.Errorf("gui state file was not removed")
}

func waitForShutdownSignal(_ string) error {
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(signals)

	<-signals
	return nil
}

func waitForShutdown(stopRequested <-chan struct{}, wait func(string) error, url string) error {
	errCh := make(chan error, 1)
	go func() {
		errCh <- wait(url)
	}()

	select {
	case err := <-errCh:
		return err
	case <-stopRequested:
		return nil
	}
}

func waitForURL(url string) error {
	client := &http.Client{Timeout: 250 * time.Millisecond}
	deadline := time.Now().Add(2 * time.Second)
	var lastErr error

	for time.Now().Before(deadline) {
		response, err := client.Get(url)
		if err == nil {
			response.Body.Close()
			if response.StatusCode == http.StatusOK {
				return nil
			}

			lastErr = fmt.Errorf("unexpected status %d", response.StatusCode)
		} else {
			lastErr = err
		}

		time.Sleep(10 * time.Millisecond)
	}

	return fmt.Errorf("GET %s did not succeed: %w", url, lastErr)
}

func stopRunningGUI(root workspace.Root, env commandEnv) (bool, error) {
	state, err := execution.ReadGUIState(root)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, execution.ErrGUIServerNotRunning
		}

		return false, err
	}

	if err := env.signalProcess(state.PID, syscall.Signal(0)); err != nil {
		if isMissingProcessError(err) {
			if removeErr := execution.RemoveGUIState(root); removeErr != nil {
				return false, removeErr
			}

			return false, execution.ErrGUIServerNotRunning
		}

		return false, fmt.Errorf("check gui server process: %w", err)
	}

	if err := env.signalProcess(state.PID, syscall.SIGTERM); err != nil {
		if isMissingProcessError(err) {
			if removeErr := execution.RemoveGUIState(root); removeErr != nil {
				return false, removeErr
			}

			return false, execution.ErrGUIServerNotRunning
		}

		return false, fmt.Errorf("stop gui server process: %w", err)
	}

	if err := env.waitForGUIState(execution.GUIStatePath(root), false); err != nil {
		return false, fmt.Errorf("wait for gui shutdown: %w", err)
	}

	return true, nil
}

func isMissingProcessError(err error) bool {
	return errors.Is(err, os.ErrProcessDone) || errors.Is(err, syscall.ESRCH)
}
