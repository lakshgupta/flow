# Flow

Capture. Connect. Complete.

Flow is a local planning tool for software projects.

It helps you capture notes, tasks, and commands in one workspace, browse them as a graph in the browser, and keep everything in plain Markdown files on disk.

The current release target is Linux on amd64.

## What Flow Does

- keeps your project planning data in local Markdown files,
- gives you a browser GUI for exploring graphs and editing documents,
- gives you CLI commands for creating, updating, searching, and running work,
- rebuilds its search and graph index from disk instead of treating the database as the source of truth.

## Install

### From GitHub Releases

Flow currently ships release artifacts for `linux/amd64`.

Download the `install.sh` asset from the release page and run it:

```bash
bash ./install.sh
bash ./install.sh 0.1.0
bash ./install.sh v0.1.0
```

By default the installer puts `flow` in `$HOME/.local/bin`.

You can override the install location with:

```bash
FLOW_INSTALL_DIR="$HOME/bin" bash ./install.sh v0.1.0
```

If you are running the installer from a repository checkout instead of a downloaded release asset, use:

```bash
bash ./scripts/install.sh v0.1.0
```

### From A Local Release Build

If you built the release artifact locally, install it with:

```bash
bash ./scripts/install-linux-amd64.sh
```

### From Source

If you want to build Flow directly from this repository:

```bash
cd frontend
npm ci
npm run build

cd ..
go build ./cmd/flow
```

## Quick Start

Initialize a workspace:

```bash
flow init
```

Create a few documents:

```bash
flow create note --file architecture --graph design/system --title "Architecture"
flow create task --file parser --graph development/parser --title "Build parser"
flow create command --file build --graph development/release --title "Build binary" --name build --run "go build ./cmd/flow"
```

### What the flags mean

| Flag | What it does | Example value | Result |
|------|-------------|---------------|--------|
| `--graph` | The graph path where the document lives. Slashes create a sub-directory hierarchy. | `development/parser` | Stored under `.flow/data/content/development/parser/` |
| `--file` | The filename on disk, without the `.md` extension. | `parser` | Creates `parser.md` in the graph directory |
| `--title` | Human-readable display name shown in the GUI and search results. | `"Build parser"` | Stored as `title: Build parser` in frontmatter |

ID is auto-derived by Flow for `flow create` as `<graph>/<file>` (without `.md`).

- `--graph development/parser --file tokenize` creates `id: development/parser/tokenize`
- `--graph development/release --file build` creates `id: development/release/build`

Record-keeping convention:

- The parent graph directory is `.flow/data/content`.
- Use only two top-level graphs under it: `design/` and `development/`.
- Sub-graph naming is mandatory: `YYYYMMDD-NNN-<type>-<title>`.
- Store all design records under `design/YYYYMMDD-NNN-<type>-<title>`.
- Store all planning/implementation records under `development/YYYYMMDD-NNN-<type>-<title>`.
- `NNN` is the zero-padded incremental count of directories created on `YYYYMMDD`.

**Concrete example — a feature with two tasks and a design note:**

```bash
# Create design and development sub-graphs for the same work key
flow create note --file design \
	--graph design/20260501-001-FEAT-parser --title "Parser design notes"

flow create task --file tokenize \
	--graph development/20260501-001-FEAT-parser --title "Implement tokenizer" --status todo

flow create task --file integrate \
	--graph development/20260501-001-FEAT-parser --title "Integrate parser into CLI" --status todo

# Link the design note to the first task
flow node connect --from design/20260501-001-FEAT-parser/design --to development/20260501-001-FEAT-parser/tokenize \
	--graph development/20260501-001-FEAT-parser --relationship records

# Mark the second task as depending on the first
flow node connect --from development/20260501-001-FEAT-parser/tokenize --to development/20260501-001-FEAT-parser/integrate \
	--graph development/20260501-001-FEAT-parser --relationship depends-on
```

This creates on disk:

```text
.flow/data/content/design/20260501-001-FEAT-parser/
	design.md       ← id: design/20260501-001-FEAT-parser/design

.flow/data/content/development/20260501-001-FEAT-parser/
	tokenize.md     ← id: development/20260501-001-FEAT-parser/tokenize
	integrate.md    ← id: development/20260501-001-FEAT-parser/integrate
```

Then open the GUI or keep working in the CLI.

## Use The GUI

Start the browser workspace with:

```bash
flow gui
```

In the GUI you can:

- browse the graph tree from the left rail,
- open Home or a graph in the center panel,
- select a node to inspect and edit it,
- drag graph nodes to arrange the canvas,
- edit document content in the browser.

Stop the GUI server with:

```bash
flow gui stop
```

## Use The CLI

Common commands:

```bash
flow version
flow init
flow configure --gui-port 4317
flow search parser
flow search --tag planning --type task --compact
flow skill content --graph development
flow node read --id development/parser/parser
flow node content --id development/parser/parser --line-start 20 --line-end 40
flow node list --feature development --status todo --compact
flow run build
```

Current command surface (implemented in the Go CLI):

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
	- Prints a Skill.md template for Flow-centric delivery using `design/YYYYMMDD-NNN-<type>-<title>` and `development/YYYYMMDD-NNN-<type>-<title>` record keeping conventions.
- `flow search [--limit <n>] [--graph <graph>] [--feature <feature>] [--type <note|task|command>] [--tag <tag>] [--title <text>] [--description <text>] [--content <text>] [--compact] [query]`
	- Indexed search with field filters and optional compact ID-only output.
- `flow run <command-id-or-short-name>`
	- Executes a command document.
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

### Agent-Oriented CLI Workflows

Flow now includes agent-friendly retrieval and filtering primitives designed for low-token usage.

Recommended patterns:

1. Pull only the lines needed for editing context.
	- `flow node content --id development/parser/tokenize --line-start 80 --line-end 120`

2. Use compact output for planning loops and ID collection.
	- `flow node list --feature development --status todo --compact`
	- `flow search --tag planning --type task --compact`

3. Narrow search by semantic field before opening full node views.
	- `flow search --title parser --graph development/parser`
	- `flow search --description migration --feature development`
	- `flow search --content "retry budget" --type note`

4. Read structured JSON only when a downstream tool needs machine-readable metadata.
	- `flow node content --id development/parser/tokenize --line-start 1 --line-end 20 --format json`
	- `flow node list --feature development --tag backend --format json`

These commands align with the current architecture: workspace Markdown is the source of truth, and the derived index is used for fast query and graph traversal.

## Release Procedure

This section is for maintainers preparing a release.

1. Update `internal/buildinfo/VERSION` to the release version.
2. Build the frontend and run the validation matrix.
3. Build the Linux release artifact.
4. Commit the release changes.
5. Create and push a matching tag such as `v0.1.0`.
6. Let GitHub Actions publish the release and verify the uploaded artifacts.

Recommended release validation:

```bash
cd frontend
npm ci
npm run build

cd ..
go test ./internal/config ./internal/workspace ./internal/markdown ./internal/graph ./internal/execution ./internal/index ./internal/httpapi ./cmd/flow
bash ./scripts/build-release-linux-amd64.sh
```

The release workflow publishes:

- `flow-<version>-linux-amd64.tar.gz`
- `flow-<version>-linux-amd64.sha256`
- `install.sh`

Release tags may be either `<version>` or `v<version>`, but they must match `internal/buildinfo/VERSION`.

## Learn More

- [docs/architecture.md](docs/architecture.md) for system architecture
- [docs/reference.md](docs/reference.md) for workspace layout, frontmatter, GUI details, and local development notes


