package main

import (
	"fmt"
	"io"
	"strings"

	flow "github.com/lex/flow"
)

func writeRootHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow [-g] <command> [options]")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "Commands:")
	fmt.Fprintln(w, "  version        Print Flow version")
	fmt.Fprintln(w, "  init           Initialize workspace files")
	fmt.Fprintln(w, "  configure      Configure workspace settings")
	fmt.Fprintln(w, "  service        Start/stop the web service (browser UI)")
	fmt.Fprintln(w, "  desktop        Open/close the desktop app window")
	fmt.Fprintln(w, "  create         Create note/task/command documents")
	fmt.Fprintln(w, "  update         Update a document by path")
	fmt.Fprintln(w, "  delete         Delete a document by path")
	fmt.Fprintln(w, "  search         Search indexed content")
	fmt.Fprintln(w, "  run            Execute a command document")
	fmt.Fprintln(w, "  skill          Print, list, or initialize Flow skills")
	fmt.Fprintln(w, "  node           Node-oriented read/update/connect operations")
	fmt.Fprintln(w, "  graph          Graph traversal operations (e.g. shortest path)")
	fmt.Fprintln(w, "  sync           Sync external trackers (jira, aha) — see `flow sync --help`")
	fmt.Fprintln(w, "  roadmap        Roadmap summary and next-ready task")
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
	fmt.Fprintln(w, "Usage: flow configure --gui-port <port> [--jira-host <url>] [--jira-project <key>]...")
	fmt.Fprintln(w, "       flow -g configure --workspace <absolute-path> [--gui-port <port>] [--jira-host <url>] [--jira-project <key>]...")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "Jira credentials are read from the FLOW_JIRA_API_TOKEN environment variable at sync time; they are never stored in config.")
}

func writeSkillHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow skill <subcommand> [options]")
	fmt.Fprintln(w, "Subcommands:")
	fmt.Fprintln(w, "  list           List embedded Flow skills")
	fmt.Fprintln(w, "  content        Print embedded Flow skill content")
	fmt.Fprintln(w, "  init           Install Flow skills for an agent")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "Use `flow skill <subcommand> --help` for options.")
}

func writeSkillContentHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow skill content [--graph <graph>] [--skill <name>]")
	fmt.Fprintln(w, "Options:")
	fmt.Fprintln(w, "  --graph <graph>   Development graph root label (accepted for compatibility, default: development)")
	fmt.Fprintln(w, "  --skill <name>    Skill to print (default: flow; alias record-keeping)")
	fmt.Fprintf(w, "  Available skills: %s\n", strings.Join(flow.SkillNames(), ", "))
	fmt.Fprintf(w, "  Workspace modes (use with `flow skill init --mode`): %s\n", strings.Join(flow.SkillModes(), ", "))
}

func writeSkillInitHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow skill init [options]")
	fmt.Fprintln(w, "Initialize the embedded Flow skills so an agent can use them.")
	fmt.Fprintln(w, "Options:")
	fmt.Fprintln(w, "  --mode <name>     Workspace mode(s) composing the skill content (repeatable; default: dev). Modes can be combined, for example --mode note --mode pm:")
	for _, line := range flow.SkillModeDescriptions() {
		fmt.Fprintf(w, "        %s\n", line)
	}
	fmt.Fprintln(w, "  --skill <name>    Only initialize this skill (repeatable)")
	fmt.Fprintln(w, "  --project         Write to .agents/skills in the current workspace instead of ~/.agents/skills")
	fmt.Fprintln(w, "  --local           Alias for --project")
	fmt.Fprintln(w, "  --force           Overwrite existing skill files")
	fmt.Fprintln(w, "  --quiet           Suppress per-file output")
}

func writeServiceHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow [-g] service [start|stop]")
	fmt.Fprintln(w, "Start or stop the web service that serves the browser UI.")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "  flow service          Start the service and open it in the browser")
	fmt.Fprintln(w, "  flow service start    Start the service and open it in the browser")
	fmt.Fprintln(w, "  flow service stop     Stop the running service")
}

func writeDesktopHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow [-g] desktop [stop]")
	fmt.Fprintln(w, "Open or close the desktop app window.")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "  flow desktop          Open the desktop window")
	fmt.Fprintln(w, "  flow desktop stop     Close the desktop window (stop the running process)")
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
	fmt.Fprintln(w, "Usage: flow delete --path <relative-path> [--force]")
	fmt.Fprintln(w, "Options:")
	fmt.Fprintln(w, "  --path <relative-path>   document path relative to .flow")
	fmt.Fprintln(w, "  --force                  strip dangling [[...]] references from referencers and delete anyway")
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

func writeGraphHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow graph <subcommand> [options]")
	fmt.Fprintln(w, "Subcommands:")
	fmt.Fprintln(w, "  path         Find the shortest path between two nodes")
	fmt.Fprintln(w, "  validate     Check edge-type compatibility (depends-on/maps-to/evolves-from)")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "Use `flow graph <subcommand> --help` for options.")
}

func writeGraphValidateHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow graph validate [--format <json|markdown>] [--graph <graph>]")
	fmt.Fprintln(w, "Options:")
	fmt.Fprintln(w, "  --format <fmt>     Output format: json or markdown (default: markdown)")
	fmt.Fprintln(w, "  --graph <graph>    Only report violations in this graph (e.g. development/20260501-001-FEAT-parser-retry-budget)")
	fmt.Fprintln(w, "Checks node-type × relationship compatibility for depends-on, maps-to, evolves-from, and supersedes edges.")
	fmt.Fprintln(w, "Warnings are advisory; error-severity violations exit non-zero.")
}

func writeGraphPathHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow graph path --from <node-id> --to <node-id> [--directed] [--format <json|markdown>]")
	fmt.Fprintln(w, "Options:")
	fmt.Fprintln(w, "  --from <node-id>   Start node id")
	fmt.Fprintln(w, "  --to <node-id>     Target node id")
	fmt.Fprintln(w, "  --directed         Follow edges only in their declared direction")
	fmt.Fprintln(w, "  --format <fmt>     Output format: json or markdown (default: markdown)")
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
	fmt.Fprintln(w, "Task claim fields: [--session <token>] [--session-at <RFC3339>] (empty values clear the claim)")
}

func writeRoadmapHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow roadmap [--graph <slug>] [--next] [--claim] [--json] [--session <token>] [--stale-hours <n>]")
	fmt.Fprintln(w, "Summarize planned features and their ready work across development graphs.")
	fmt.Fprintln(w, "Options:")
	fmt.Fprintln(w, "  --graph <slug>      Limit to one feature slug (first path segment)")
	fmt.Fprintln(w, "  --next              Print the full execution packet for the next ready task")
	fmt.Fprintln(w, "  --claim             Claim the next ready task (status Running + session stamp)")
	fmt.Fprintln(w, "  --session <token>   Session token for claims (default: derived from hostname)")
	fmt.Fprintln(w, "  --stale-hours <n>   Claims older than this surface as stale (default: 4)")
	fmt.Fprintln(w, "  --json              Machine-readable output")
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

func writeSkillListHelp(w io.Writer) {
	fmt.Fprintln(w, "Usage: flow skill list")
	fmt.Fprintln(w, "List the Flow skills embedded in this binary, plus available workspace modes.")
}
