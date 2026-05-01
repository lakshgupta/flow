# Reference

This document keeps the detailed workspace, storage, and development reference material that does not need to live in the top-level README.

## Workspace Layout

`flow init` creates this baseline workspace structure:

```text
.flow/
  config/
    flow.yaml
    flow.index
    gui-server.json
  data/
    home.md
    content/
      design/
        <type>-YYYYMMDD-NNN-<title>/
          <document>.md
      development/
        <type>-YYYYMMDD-NNN-<title>/
          <document>.md
```

Layout rules:

- Home is always stored at `.flow/data/home.md` and is not part of the graph tree.
- Graph documents live directly inside their graph directory under `.flow/data/content/`.
- Record keeping should use only two top-level graph directories under `.flow/data/content/`: `design/` and `development/`.
- Sub-graph naming is mandatory: `<type>-YYYYMMDD-NNN-<title>`.
- Design records live under `design/<type>-YYYYMMDD-NNN-<title>/...`.
- Planning and implementation records live under `development/<type>-YYYYMMDD-NNN-<title>/...`.
- `NNN` is the zero-padded incremental count of directories created on that `YYYYMMDD` date.
- Frontmatter `type` determines whether a document is a note, a task, or a command.
- Filesystem location is authoritative for graph membership when it disagrees with frontmatter `graph`.
- `flow init` creates `.flow/data/home.md` and writes default GUI panel width ratios when those files or settings are missing.
- Creating a graph path silently creates missing parent directories, but graphs appear in the visible tree only after their subtree contains canonical Markdown content.
- Graph counts shown by the TUI and GUI are derived counts in the format `3 direct / 11 total`.

## Browser GUI Details

`flow gui` opens a desktop-oriented three-panel workspace in the browser.

- The left rail contains search, Home, and the visible graph tree.
- Search returns a mixed list with explicit type labels such as `Home`, `Note`, `Task`, and `Command`.
- The middle panel shows Home by default and switches to the selected graph canvas when you choose a graph.
- The right panel opens as the contextual editor for the selected document.
- The left and right split bars are draggable, and their width ratios persist in `.flow/config/flow.yaml`.

Graph canvas behavior:

- Home is never rendered as a graph canvas.
- Selecting a graph opens an infinite canvas for that graph scope.
- Notes, tasks, and commands share the same canvas card structure and are differentiated by type color and label.
- Single click selects a node and highlights directly connected edges only.
- Double click opens the right-side document editor without recentering or zooming the canvas.
- Dragging moves nodes freely; persistence happens on drag end.
- Dragged positions are stored as derived GUI state in `.flow/config/flow.index`, not in canonical Markdown.
- If a node has no saved position, Flow seeds placement from graph relationships using layered columns derived from incoming and downstream links.
- Cycles use a stable pseudo-topological fallback based on creation time so unsaved layouts stay predictable.

Editing behavior:

- Home, notes, tasks, and commands all support a shared optional `description` field.
- `description` is shown in the Home surface, the right-side document panel, and search results.
- The browser editor is WYSIWYG for Home bodies and graph document bodies.
- Typing `/` opens the slash-command menu for supported block actions.
- Selecting text opens a floating toolbar for inline formatting such as bold, italic, links, and highlight.
- Highlight is persisted as inline HTML `<mark>` inside the canonical Markdown body.

## Markdown Frontmatter

Flow stores Home, notes, tasks, and commands as Markdown files with YAML frontmatter.

Common fields used by all document types:

- `id`: required unique document identifier inside the workspace
- `type`: document kind, one of `home`, `note`, `task`, or `command`
- `title`: human-readable label shown in CLI, TUI, and GUI views
- `description`: optional short summary shown in GUI panels and search results
- `tags`: optional list of labels for classification
- `createdAt`: optional creation timestamp string
- `updatedAt`: optional last-update timestamp string

Graph-backed fields used by notes, tasks, and commands:

- `graph`: graph path metadata normalized to the document's filesystem location

Home-specific fields:

- `id`: always `home`
- `type`: always `home`
- `title`: Home title shown in the middle panel
- `description`: optional Home summary shown in the Home surface and search results

Note-specific fields:

- `links`: optional list of related document IDs; note-to-note links are treated as note relationships, and cross-type links stay soft relationships in the derived index

Task-specific fields:

- `status`: optional task state such as `todo`, `doing`, or `done`
- `links`: optional list of related document IDs that do not affect readiness

Command-specific fields:

- `name`: required short name used by `flow run <name>`; must be unique across the workspace
- `links`: optional list of related document IDs that do not affect readiness
- `env`: optional map of environment variables merged over the current process environment when the command runs
- `run`: required shell command string executed from the workspace root

Examples:

```yaml
---
id: note-1
type: note
graph: notes
title: Architecture
description: Notes about the system structure and design choices
tags:
  - design
links:
  - task-1
createdAt: 2026-03-17T10:00:00Z
updatedAt: 2026-03-17T11:00:00Z
---
```

```yaml
---
id: task-1
type: task
graph: development/parser
title: Build parser
description: Implement the first parsing pass and wire it into the CLI flow
status: todo
links:
  - note-1
---
```

```yaml
---
id: cmd-1
type: command
graph: release
title: Build binary
description: Produce the release binary for local verification
name: build
links:
  - note-1
env:
  GOOS: linux
  GOARCH: amd64
run: go build ./cmd/flow
---
```

```yaml
---
id: home
type: home
title: Home
description: Workspace home document
---
```

## Graph Tree Behavior

The graph tree is derived from canonical files under `.flow/data/content` rather than from a separate graph registry.

- A document stored at `.flow/data/content/development/parser/build.md` belongs to the `development/parser` graph even if its frontmatter says otherwise.
- Parent graph nodes such as `design` and `development` remain visible when descendants contain content, even if the parent directory has no direct Markdown files.
- Empty graphs are omitted from visible graph trees in the CLI, TUI, and GUI.
- Home is a separate top-level surface and is excluded from graph counts.

## CLI Command Reference

Core commands:

- `flow init`
  - Initializes local workspace files and folders.
- `flow configure --gui-port <port>`
  - Sets the local GUI port.
- `flow -g configure --workspace <absolute-path> [--gui-port <port>]`
  - Configures global workspace location and optionally GUI port.
- `flow gui`
  - Starts the GUI server and opens the browser.
- `flow gui stop`
  - Stops a running GUI server.
- `flow create <note|task|command> ...`
  - Creates documents (requires `--file --graph`; command also requires `--name --run`). IDs are auto-derived as `<graph>/<file>`.
- `flow update --path <relative-path> ...`
  - Updates document fields by path.
- `flow delete --path <relative-path>`
  - Deletes a document by path.
- `flow skill content [--graph <graph>]`
  - Prints a Skill.md template for Flow-centric delivery using `design/<type>-YYYYMMDD-NNN-<title>` and `development/<type>-YYYYMMDD-NNN-<title>` record keeping conventions.
- `flow search [--limit <n>] [--graph <graph>] [--feature <feature>] [--type <note|task|command>] [--tag <tag>] [--title <text>] [--description <text>] [--content <text>] [--compact] [query]`
  - Indexed search with field filters and optional compact ID-only output.
- `flow run <command-id-or-short-name>`
  - Executes a command document.
- `flow tui [--command-graph <graph>] [--search <query>] [--search-limit <n>]`
  - Renders terminal interface output.

Node subcommands:

- `flow node read --id <node-id> [--graph <graph>] [--format json|markdown]`
  - Reads one node view (includes body and linked edge info).
- `flow node content --id <node-id> [--graph <graph>] [--line-start <n>] [--line-end <n>] [--format text|json]`
  - Reads full body content or a specific line range.
- `flow node list [--graph <graph>] [--feature <feature>] [--tag <tag>]... [--status <todo|doing|done>] [--limit <n>] [--compact] [--format json|markdown]`
  - Lists nodes using graph/feature/tag/status filters; requires `--graph` or at least one filter.
- `flow node edges --id <node-id> [--graph <graph>] [--format json|markdown]`
  - Lists edges touching a node.
- `flow node neighbors --id <node-id> [--graph <graph>] [--format json|markdown]`
  - Lists neighbor nodes around a node.
- `flow node update --id <node-id> ...`
  - Updates one node by ID (supports `--title --description --body --status --tag --reference --name --env --run`).
- `flow node connect --from <node-id> --to <node-id> --graph <graph> [--context <text>] [--relationship <tag>]...`
  - Creates a directed node link with optional context and relationship tags.
- `flow node disconnect --from <node-id> --to <node-id> --graph <graph>`
  - Removes a directed node link.

Global mode is supported by prefixing commands with `-g`, for example `flow -g init` and `flow -g gui`.

Agent-oriented usage patterns:

- Use compact output for planning loops and ID collection:
  - `flow node list --feature development --status todo --compact`
  - `flow search --tag planning --type task --compact`
- Pull only the lines needed for edit context:
  - `flow node content --id task-1 --line-start 80 --line-end 120`
- Use field filters before opening full node views:
  - `flow search --title parser --graph development/parser`
  - `flow search --description migration --feature development`
  - `flow search --content "retry budget" --type note`

## Local Development

Toolchain:

- Go `1.25.0`
- Node.js `22.x`
- `npm`

Repository layout:

- `cmd/flow`: CLI entrypoint
- `internal/buildinfo/VERSION`: canonical project version used by the CLI and release scripts
- `internal/*`: Go application packages
- `frontend/`: React and TypeScript browser source
- `internal/httpapi/static/`: generated embedded frontend assets
- `scripts/build-release-linux-amd64.sh`: release packaging script
- `scripts/install-linux-amd64.sh`: local installer for the Linux release artifact
- `scripts/install.sh`: standalone GitHub release installer artifact

Common development workflow:

```bash
cd frontend
npm ci
npm run build

cd ..
go build ./cmd/flow
./flow version
go test ./internal/config ./internal/workspace ./internal/markdown ./internal/graph ./internal/execution ./internal/index ./internal/tui ./internal/httpapi ./cmd/flow
```

The frontend build emits bundled assets into `internal/httpapi/static/`, and the Go binary embeds those assets for `flow gui`.
Plain `go build` uses the project version from `internal/buildinfo/VERSION` and appends `-dev`; release builds inject the exact release version without the suffix.
