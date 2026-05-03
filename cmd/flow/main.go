package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	goruntime "runtime"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	flow "github.com/lex/flow"
	"github.com/lex/flow/internal/buildinfo"
	"github.com/lex/flow/internal/config"
	"github.com/lex/flow/internal/execution"
	"github.com/lex/flow/internal/httpapi"
	"github.com/lex/flow/internal/index"
	"github.com/lex/flow/internal/markdown"
	"github.com/lex/flow/internal/workspace"
)

var version = buildinfo.ProjectVersion()

const defaultGUIPort = 4317
const guiLogRetentionWindow = 7 * 24 * time.Hour
const workspaceGitignoreContent = "config/flow.index\nconfig/gui-server.json\nlogs/\n"

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
	if len(args) > 0 && isHelpOption(args[0]) {
		writeRootHelp(env.stdout)
		return nil
	}

	if len(args) > 0 && args[0] == "version" {
		fmt.Fprintf(env.stdout, "flow %s\n", version)
		return nil
	}

	global := false
	if len(args) > 0 && args[0] == "-g" {
		global = true
		args = args[1:]
		if len(args) > 0 && isHelpOption(args[0]) {
			writeRootHelp(env.stdout)
			return nil
		}
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
		return runInit(global, args[1:], env)
	case "workspace":
		return runWorkspace(global, args[1:], env)
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
		return fmt.Errorf("unknown command %q; use `flow --help`", args[0])
	}
}

func isHelpOption(value string) bool {
	return value == "-h" || value == "--help"
}

func parseFlagSetWithHelp(flagSet *flag.FlagSet, args []string, env commandEnv, writeHelp func(io.Writer)) (bool, error) {
	if err := flagSet.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			writeHelp(env.stdout)
			return true, nil
		}

		return false, err
	}

	return false, nil
}

func writeRootHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow [-g] <command> [options]")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "Commands:")
	fmt.Fprintln(w, "  version        Print Flow version")
	fmt.Fprintln(w, "  init           Initialize workspace files")
	fmt.Fprintln(w, "  configure      Configure workspace settings")
	fmt.Fprintln(w, "  gui            Start/stop GUI server")
	fmt.Fprintln(w, "  create         Create note/task/command documents")
	fmt.Fprintln(w, "  update         Update a document by path")
	fmt.Fprintln(w, "  delete         Delete a document by path")
	fmt.Fprintln(w, "  search         Search indexed content")
	fmt.Fprintln(w, "  run            Execute a command document")
	fmt.Fprintln(w, "  skill          Print Flow skill content")
	fmt.Fprintln(w, "  node           Node-oriented read/update/connect operations")
	fmt.Fprintln(w, "  workspace      Workspace management commands")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "Global option:")
	fmt.Fprintln(w, "  -g             Use globally configured workspace")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "Use `flow <command> --help` for command-specific help.")
}

func writeInitHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow [-g] init")
	fmt.Fprintln(w, "Initialize local or global workspace files.")
}

func writeConfigureHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow configure --gui-port <port>")
	fmt.Fprintln(w, "       flow -g configure [--workspace <absolute-path>] [--gui-port <port>]")
}

func writeSkillHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow skill <subcommand> [options]")
	fmt.Fprintln(w, "Subcommands:")
	fmt.Fprintln(w, "  content        Print embedded Flow skill content")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "Use `flow skill content --help` for options.")
}

func writeSkillContentHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow skill content [--graph <graph>]")
	fmt.Fprintln(w, "Options:")
	fmt.Fprintln(w, "  --graph <graph>   Development graph root label (default: development)")
}

func writeGUIHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow [-g] gui [stop] [--serve-internal]")
	fmt.Fprintln(w, "Start the GUI server, stop it, or run internal serve mode.")
}

func writeCreateHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow create <note|task|command> --file <name> --graph <graph> [options]")
	fmt.Fprintln(w, "For command documents, also require: --name <short-name> --run <command>")
}

func writeUpdateHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow update --path <relative-path> [field options]")
	fmt.Fprintln(w, "Updates one existing document by workspace-relative path.")
}

func writeDeleteHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow delete --path <relative-path>")
}

func writeNodeHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow node <subcommand> [options]")
	fmt.Fprintln(w, "Subcommands:")
	fmt.Fprintln(w, "  read         Read one node view")
	fmt.Fprintln(w, "  content      Read node body content")
	fmt.Fprintln(w, "  list         List nodes by filters")
	fmt.Fprintln(w, "  edges        List edges for a node")
	fmt.Fprintln(w, "  neighbors    List neighboring nodes")
	fmt.Fprintln(w, "  update       Update a node by ID")
	fmt.Fprintln(w, "  connect      Connect two nodes")
	fmt.Fprintln(w, "  disconnect   Disconnect two nodes")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "Use `flow node <subcommand> --help` for options.")
}

func writeNodeReadHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow node read --id <node-id> [--graph <graph>] [--format <json|markdown>]")
}

func writeNodeListHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow node list [--graph <graph>] [--feature <slug>] [--status <status>] [--tag <tag>] [--limit <n>] [--compact] [--format <json|markdown>]")
}

func writeNodeContentHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow node content --id <node-id> [--graph <graph>] [--line-start <n>] [--line-end <n>] [--format <text|json>]")
}

func writeNodeEdgesHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow node edges --id <node-id> [--graph <graph>] [--format <json|markdown>]")
}

func writeNodeNeighborsHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow node neighbors --id <node-id> [--graph <graph>] [--format <json|markdown>]")
}

func writeNodeUpdateHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow node update --id <node-id> [field options]")
}

func writeNodeConnectHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow node connect --from <node-id> --to <node-id> --graph <graph> [--context <text>] [--relationship <tag>]")
}

func writeNodeDisconnectHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow node disconnect --from <node-id> --to <node-id> --graph <graph>")
}

func writeSearchHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow search [query] [--limit <n>] [--graph <graph>] [--feature <feature>] [--type <type>] [--tag <tag>] [--title <text>] [--description <text>] [--content <text>] [--compact]")
}

func writeRunHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow run <command-id-or-short-name>")
}

func writeWorkspaceHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow -g workspace list")
	fmt.Fprintln(w, "List global workspace and tracked local workspaces.")
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
	if len(args) > 0 && isHelpOption(args[0]) {
		writeSkillHelp(env.stdout)
		return nil
	}

	if len(args) == 0 {
		return fmt.Errorf("flow skill requires subcommand; use `flow skill --help`")
	}

	switch args[0] {
	case "content":
		return runSkillContent(args[1:], env)
	default:
		return fmt.Errorf("unknown skill subcommand %q; use `flow skill --help`", args[0])
	}
}

func runSkillContent(args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("skill content", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)
	flagSet.Usage = func() {
		writeSkillContentHelp(env.stdout)
	}

	graph := flagSet.String("graph", "development", "development graph root for planning and implementation")
	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeSkillContentHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
	}

	if strings.TrimSpace(*graph) == "" {
		return fmt.Errorf("flow skill content requires non-empty --graph")
	}

	if _, err := io.WriteString(env.stdout, flow.SkillMarkdown()); err != nil {
		return fmt.Errorf("write embedded skill content: %w", err)
	}

	return nil
}

func runInit(global bool, args []string, env commandEnv) error {
	if len(args) > 0 && isHelpOption(args[0]) {
		writeInitHelp(env.stdout)
		return nil
	}

	var root workspace.Root
	if global {
		resolvedRoot, err := resolveRoot(true, env)
		if err != nil {
			return err
		}
		root = resolvedRoot
	} else {
		locatorPath, err := globalLocatorPath(env)
		if err != nil {
			return err
		}
		if _, err := workspace.ReadGlobalLocator(locatorPath); err != nil {
			return fmt.Errorf("global workspace is not configured; run `flow -g configure --workspace /absolute/path`")
		}

		workingDirectory, err := env.getwd()
		if err != nil {
			return fmt.Errorf("resolve working directory: %w", err)
		}

		resolvedRoot, err := workspace.ResolveLocal(workingDirectory)
		if err != nil {
			return err
		}
		root = resolvedRoot
	}

	if err := initializeWorkspace(root); err != nil {
		return err
	}

	if !global {
		locatorPath, err := globalLocatorPath(env)
		if err != nil {
			return err
		}

		if err := workspace.RegisterLocalWorkspace(locatorPath, root.WorkspacePath); err != nil {
			return fmt.Errorf("register local workspace: %w", err)
		}
	}

	label := "local"
	if global {
		label = "global"
	}

	fmt.Fprintf(env.stdout, "Initialized %s workspace at %s\n", label, root.WorkspacePath)
	return nil
}

func runWorkspace(global bool, args []string, env commandEnv) error {
	if len(args) > 0 && isHelpOption(args[0]) {
		writeWorkspaceHelp(env.stdout)
		return nil
	}

	if len(args) == 0 {
		return fmt.Errorf("flow workspace requires a subcommand; use `flow workspace --help`")
	}

	if args[0] != "list" {
		return fmt.Errorf("unknown workspace subcommand %q; use `flow workspace --help`", args[0])
	}

	if !global {
		return fmt.Errorf("flow workspace list requires -g")
	}

	locatorPath, err := globalLocatorPath(env)
	if err != nil {
		return err
	}

	locator, err := workspace.ReadGlobalLocator(locatorPath)
	if err != nil {
		return err
	}

	fmt.Fprintf(env.stdout, "global %s\n", locator.WorkspacePath)
	for _, pathValue := range locator.LocalWorkspaces {
		fmt.Fprintf(env.stdout, "local %s\n", pathValue)
	}

	return nil
}

func runConfigure(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("configure", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)
	flagSet.Usage = func() {
		writeConfigureHelp(env.stdout)
	}

	guiPort := flagSet.Int("gui-port", 0, "GUI server port")
	workspacePath := flagSet.String("workspace", "", "global workspace path")

	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeConfigureHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
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
	flagSet.Usage = func() {
		writeGUIHelp(env.stdout)
	}

	serveInternal := flagSet.Bool("serve-internal", false, "internal GUI server mode")
	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeGUIHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
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

		return fmt.Errorf("unknown gui subcommand %q; use `flow gui --help`", flagSet.Arg(0))
	}

	return runGUIStart(global, env)
}

func runGUIStart(global bool, env commandEnv) error {
	root, err := resolveGUIRoot(global, env)
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

	if err := env.launchGUIProcess(root.Scope == workspace.GlobalScope, root); err != nil {
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

	if err := env.openBrowser(url); err != nil {
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

	scopeLabel := string(root.Scope)

	fmt.Fprintf(env.stdout, "%s %s GUI server for %s at %s\n", action, scopeLabel, root.WorkspacePath, url)
	return nil
}

func runGUIServe(global bool, env commandEnv) error {
	root, err := resolveGUIRoot(global, env)
	if err != nil {
		return err
	}

	workspaceConfig, err := readOrDefaultConfig(root.ConfigPath)
	if err != nil {
		return err
	}

	stopRequested := make(chan struct{})
	var stopOnce sync.Once
	locatorPath, locatorErr := globalLocatorPath(env)
	if locatorErr != nil {
		locatorPath = ""
	}

	handler, err := httpapi.NewMux(httpapi.Options{
		Root:              root,
		LaunchScope:       root.Scope,
		GlobalLocatorPath: locatorPath,
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
	root, err := resolveGUIRoot(global, env)
	if err != nil {
		return err
	}

	_, err = stopRunningGUI(root, env)
	if err != nil {
		return err
	}

	scopeLabel := string(root.Scope)

	fmt.Fprintf(env.stdout, "Stopped %s GUI server for %s\n", scopeLabel, root.WorkspacePath)
	return nil
}

func runCreate(global bool, args []string, env commandEnv) error {
	if len(args) > 0 && isHelpOption(args[0]) {
		writeCreateHelp(env.stdout)
		return nil
	}

	if len(args) == 0 {
		return fmt.Errorf("flow create requires a document type: note, task, or command")
	}

	documentType, err := parseDocumentTypeArg(args[0])
	if err != nil {
		return err
	}

	flagSet := flag.NewFlagSet("create", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)
	flagSet.Usage = func() {
		writeCreateHelp(env.stdout)
	}

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

	helpShown, err := parseFlagSetWithHelp(flagSet, args[1:], env, writeCreateHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
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
	flagSet.Usage = func() {
		writeUpdateHelp(env.stdout)
	}

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

	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeUpdateHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
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
	flagSet.Usage = func() {
		writeDeleteHelp(env.stdout)
	}

	pathValue := flagSet.String("path", "", "document path relative to .flow")
	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeDeleteHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
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
	if len(args) > 0 && isHelpOption(args[0]) {
		writeNodeHelp(env.stdout)
		return nil
	}

	if len(args) == 0 {
		return fmt.Errorf("flow node requires a subcommand: read, list, edges, neighbors, update, connect, or disconnect; use `flow node --help`")
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
		return fmt.Errorf("unknown node subcommand %q; use `flow node --help`", args[0])
	}
}

func runNodeRead(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("node read", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)
	flagSet.Usage = func() {
		writeNodeReadHelp(env.stdout)
	}

	id := flagSet.String("id", "", "node id")
	graph := flagSet.String("graph", "", "graph path (optional filter)")
	format := flagSet.String("format", "markdown", "output format: json or markdown")

	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeNodeReadHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
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
	flagSet.Usage = func() {
		writeNodeListHelp(env.stdout)
	}

	graph := flagSet.String("graph", "", "graph path")
	feature := flagSet.String("feature", "", "feature slug (first graph segment)")
	status := flagSet.String("status", "", "task status filter")
	limit := flagSet.Int("limit", 100, "maximum number of nodes")
	compact := flagSet.Bool("compact", false, "compact output for agent usage")
	var tags stringListFlag
	flagSet.Var(&tags, "tag", "repeatable tag filter")
	format := flagSet.String("format", "markdown", "output format: json or markdown")

	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeNodeListHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
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
	flagSet.Usage = func() {
		writeNodeContentHelp(env.stdout)
	}

	id := flagSet.String("id", "", "node id")
	graph := flagSet.String("graph", "", "graph path (optional filter)")
	lineStart := flagSet.Int("line-start", 0, "1-based content line start")
	lineEnd := flagSet.Int("line-end", 0, "1-based content line end")
	format := flagSet.String("format", "text", "output format: text or json")

	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeNodeContentHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
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
	flagSet.Usage = func() {
		writeNodeEdgesHelp(env.stdout)
	}

	id := flagSet.String("id", "", "node id")
	graph := flagSet.String("graph", "", "graph path (optional filter)")
	format := flagSet.String("format", "markdown", "output format: json or markdown")

	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeNodeEdgesHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
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
	flagSet.Usage = func() {
		writeNodeNeighborsHelp(env.stdout)
	}

	id := flagSet.String("id", "", "node id")
	graph := flagSet.String("graph", "", "graph path (optional filter)")
	format := flagSet.String("format", "markdown", "output format: json or markdown")

	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeNodeNeighborsHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
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
	flagSet.Usage = func() {
		writeNodeUpdateHelp(env.stdout)
	}

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

	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeNodeUpdateHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
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
	flagSet.Usage = func() {
		writeNodeConnectHelp(env.stdout)
	}
	from := flagSet.String("from", "", "ID of the source node")
	to := flagSet.String("to", "", "ID of the target node")
	graph := flagSet.String("graph", "", "graph the nodes belong to")
	context := flagSet.String("context", "", "optional context describing the relationship")
	var relationships stringListFlag
	flagSet.Var(&relationships, "relationship", "repeatable relationship tag")
	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeNodeConnectHelp)
	if err != nil {
		return fmt.Errorf("flow node connect: %w", err)
	}
	if helpShown {
		return nil
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
	flagSet.Usage = func() {
		writeNodeDisconnectHelp(env.stdout)
	}
	from := flagSet.String("from", "", "ID of the source node")
	to := flagSet.String("to", "", "ID of the target node")
	graph := flagSet.String("graph", "", "graph the edge belongs to")
	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeNodeDisconnectHelp)
	if err != nil {
		return fmt.Errorf("flow node disconnect: %w", err)
	}
	if helpShown {
		return nil
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
	flagSet.Usage = func() {
		writeSearchHelp(env.stdout)
	}

	limit := flagSet.Int("limit", 10, "maximum indexed search results")
	graph := flagSet.String("graph", "", "graph path filter")
	feature := flagSet.String("feature", "", "feature slug filter")
	documentType := flagSet.String("type", "", "document type filter")
	tag := flagSet.String("tag", "", "tag filter")
	title := flagSet.String("title", "", "title filter")
	description := flagSet.String("description", "", "description filter")
	content := flagSet.String("content", "", "content filter")
	compact := flagSet.Bool("compact", false, "compact output for agent usage")
	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeSearchHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
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
	flagSet.Usage = func() {
		writeRunHelp(env.stdout)
	}

	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeRunHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
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

	root, err := workspace.ResolveNearestLocal(workingDirectory)
	if err != nil {
		return workspace.Root{}, fmt.Errorf("no local workspace found from %s; run `flow init` or use `flow -g ...`", workingDirectory)
	}

	return root, nil
}

func resolveGUIRoot(global bool, env commandEnv) (workspace.Root, error) {
	if global {
		return resolveRoot(true, env)
	}

	workingDirectory, err := env.getwd()
	if err != nil {
		return workspace.Root{}, fmt.Errorf("resolve working directory: %w", err)
	}

	if info, statErr := os.Stat(filepath.Join(workingDirectory, workspace.DirName)); statErr == nil && info.IsDir() {
		return workspace.ResolveLocal(workingDirectory)
	}

	return resolveRoot(true, env)
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
	requiredEntries := strings.Split(strings.TrimSpace(strings.ReplaceAll(workspaceGitignoreContent, "\r\n", "\n")), "\n")

	existingContent, err := os.ReadFile(ignorePath)
	if errors.Is(err, os.ErrNotExist) {
		if err := os.WriteFile(ignorePath, []byte(workspaceGitignoreContent), 0o644); err != nil {
			return fmt.Errorf("write workspace ignore file: %w", err)
		}

		return nil
	}

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

	logDir := guiLogsPath(root)
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		return fmt.Errorf("create gui logs directory: %w", err)
	}

	if err := pruneFlowLogs(logDir, time.Now().Add(-guiLogRetentionWindow)); err != nil {
		return fmt.Errorf("prune gui logs: %w", err)
	}

	logPath := guiStartupLogPath(root)
	if err := os.Remove(logPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("clear gui startup log: %w", err)
	}

	logFile, err := os.Create(logPath)
	if err != nil {
		return fmt.Errorf("create gui startup log: %w", err)
	}
	if _, err := fmt.Fprintf(logFile, "%s starting GUI process in %s\n", logTimestamp(), root.WorkspacePath); err != nil {
		_ = logFile.Close()
		return fmt.Errorf("write gui startup log: %w", err)
	}

	command.Stdout = logFile
	command.Stderr = logFile

	if err := command.Start(); err != nil {
		_, _ = fmt.Fprintf(logFile, "%s error: failed to start gui server process: %v\n", logTimestamp(), err)
		_ = logFile.Close()
		return fmt.Errorf("start gui server process: %w", err)
	}
	if _, err := fmt.Fprintf(logFile, "%s started GUI child process pid=%d\n", logTimestamp(), command.Process.Pid); err != nil {
		_ = logFile.Close()
		return fmt.Errorf("write gui startup log: %w", err)
	}

	if err := logFile.Close(); err != nil {
		return fmt.Errorf("close gui startup log: %w", err)
	}

	return nil
}

func guiStartupLogPath(root workspace.Root) string {
	return filepath.Join(guiLogsPath(root), fmt.Sprintf("gui-startup-%s.log", time.Now().Format("20060102")))
}

func guiLogsPath(root workspace.Root) string {
	return filepath.Join(root.FlowPath, "logs")
}

func pruneFlowLogs(path string, cutoff time.Time) error {
	entries, err := os.ReadDir(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}

		return err
	}

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".log" {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			return err
		}

		if info.ModTime().Before(cutoff) {
			if err := os.Remove(filepath.Join(path, entry.Name())); err != nil {
				return err
			}
		}
	}

	return nil
}

func readGUIStartupLog(root workspace.Root) (string, error) {
	data, err := os.ReadFile(guiStartupLogPath(root))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", nil
		}

		return "", fmt.Errorf("read gui startup log: %w", err)
	}

	lines := strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if line == "" {
			continue
		}

		if index := strings.Index(line, "error:"); index >= 0 {
			return strings.TrimSpace(line[index+len("error:"):]), nil
		}
	}

	return "", nil
}

func logTimestamp() string {
	return time.Now().Format(time.RFC3339)
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
