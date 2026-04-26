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
      <graph-path>/
        <document>.md
```

Layout rules:

- Home is always stored at `.flow/data/home.md` and is not part of the graph tree.
- Graph documents live directly inside their graph directory under `.flow/data/content/`.
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
graph: execution/parser
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

- A document stored at `.flow/data/content/execution/parser/build.md` belongs to the `execution/parser` graph even if its frontmatter says otherwise.
- Parent graph nodes such as `execution` remain visible when descendants contain content, even if the parent directory has no direct Markdown files.
- Empty graphs are omitted from visible graph trees in the CLI, TUI, and GUI.
- Home is a separate top-level surface and is excluded from graph counts.

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
