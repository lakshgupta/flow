# Flow

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
flow create note --file architecture --id note-1 --graph notes --title "Architecture"
flow create task --file parser --id task-1 --graph execution/parser --title "Build parser"
flow create command --file build --id cmd-1 --graph release --title "Build binary" --name build --run "go build ./cmd/flow"
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
flow search parser
flow node read --id task-1
flow run build
```

Useful entry points:

- `flow init` creates a workspace.
- `flow create` adds notes, tasks, and commands.
- `flow update` changes document fields.
- `flow delete` removes documents.
- `flow search` finds matching content.
- `flow run <name>` executes a command document by name.
- `flow tui` opens the terminal interface.

Global workspaces are also supported with `-g` where applicable.

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
go test ./internal/config ./internal/workspace ./internal/markdown ./internal/graph ./internal/execution ./internal/index ./internal/tui ./internal/httpapi ./cmd/flow
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

Capture. Connect. Complete.
