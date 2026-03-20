# Flow

Flow is a Go-first local planning tool with Markdown as the canonical workspace format, a rebuildable SQLite index under `.flow/config/flow.index`, a CLI and TUI, and a browser GUI served by the `flow` binary itself.

The current rewrite targets a first release as a single `linux/amd64` binary with embedded frontend assets.

## Runtime

Flow stores workspace state in a `.flow` directory inside a local workspace, or in a configured global workspace when commands are prefixed with `-g`.

Canonical files:
- `.flow/config/flow.yaml`: workspace configuration
- `.flow/config/flow.index`: derived SQLite index rebuilt from Markdown
- `.flow/config/gui-server.json`: disposable GUI runtime state
- `.flow/data/home.md`: top-level Home document outside the graph tree
- `.flow/data/graphs/<graph-path>/*.md`: canonical graph-backed Markdown documents

Key runtime properties:
- Markdown files are canonical and remain Git-friendly.
- The SQLite index is derived and rebuildable.
- Configuration and canonical content are stored separately under `.flow/config` and `.flow/data`.
- `.flow/config/flow.yaml` also stores persisted GUI panel width ratios for the desktop browser workspace.
- Graphs are addressed by full path such as `execution/parser`.
- Graph visibility is derived from canonical Markdown content; empty graphs stay hidden.
- `flow gui` serves the browser UI on loopback HTTP and opens the default browser.
- Local and global workspaces are both supported.

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
    graphs/
      <graph-path>/
        <document>.md
```

Layout rules:
- Home is always stored at `.flow/data/home.md` and is not part of the graph tree.
- Graph documents live directly inside their graph directory; there are no type-specific subdirectories.
- Frontmatter `type` determines whether a document is `home`, a note, a task, or a command.
- Filesystem location is authoritative for graph membership when it disagrees with frontmatter `graph`.
- `flow init` creates `.flow/data/home.md` and writes default GUI panel width ratios when those files or settings are missing.
- Creating a graph path silently creates missing parent directories, but graphs appear in the visible tree only after their subtree contains canonical Markdown content.
- Graph counts shown by the TUI and GUI are derived counts in the format `3 direct / 11 total`.

## Browser GUI

`flow gui` opens a desktop-only three-panel workspace in the browser.

- The left rail contains the Flow header, workspace path, search, a dedicated Home entry, and the visible graph tree.
- Search returns one mixed list with explicit type labels such as `Home`, `Note`, `Task`, and `Command`.
- Search matches title, `description`, and body content for Home and graph-backed documents.
- Home participates in search, but it never appears inside graph lists or graph counts.
- The middle panel defaults to Home and switches to the selected graph canvas when you choose a graph.
- The right panel stays hidden until you select a graph node, then opens as the contextual editor for that document.
- The left and right split bars are draggable, and their width ratios persist in `.flow/config/flow.yaml`.

Graph canvas behavior:

- Home remains a page-style document in the middle panel and is never rendered as a canvas.
- Selecting a graph opens an infinite canvas for that graph scope in the middle panel.
- Notes, tasks, and commands share the same canvas card structure and are differentiated by type color and label.
- Nodes show type and title at rest, and reveal `description` on hover.
- Single click selects a node and highlights directly connected edges only.
- Double click opens the right-side document editor without recentering or zooming the canvas.
- Dragging moves nodes freely; persistence happens only on drag end.
- Dragged positions are stored as derived GUI state in `.flow/config/flow.index`, not in canonical Markdown.
- If a node has no saved position, Flow seeds its placement from graph relationships using layered columns derived from incoming and downstream links.
- Cycles use a stable pseudo-topological fallback based on creation time so unsaved layouts stay predictable.
- Dragging near a layer band applies only a slight magnetic pull rather than a hard snap during movement.
- When a selected graph canvas has no visible documents, the canvas shows inline create actions for note, task, and command documents.

Editing behavior:

- Home is backed by `.flow/data/home.md` and uses the same Markdown-plus-frontmatter model as other Flow-managed content.
- Home, notes, tasks, and commands all support a shared optional `description` field.
- `description` is shown in the Home surface, the right-side document panel, and search results.
- `description` is not shown on graph nodes or graph list buttons.
- The browser editor is WYSIWYG for Home bodies and graph document bodies.
- Typing `/` opens the slash-command menu for supported block actions.
- Selecting text opens a floating toolbar for inline formatting such as bold, italic, links, and highlight.
- Highlight is persisted as inline HTML `<mark>` inside the canonical Markdown body.

## Supported Commands

The first release supports these user-facing commands:
- `flow init`
- `flow configure`
- `flow version`
- `flow tui`
- `flow gui`
- `flow gui stop`
- `flow create`
- `flow update`
- `flow delete`
- `flow search`
- `flow run`
- the corresponding global variants with `-g` where applicable

Examples:

```bash
flow init
flow configure --gui-port 4317
flow version
flow create task --file parser --id task-1 --graph execution/parser --title "Build parser"
flow create note --file architecture --id note-1 --graph notes --title "Architecture"
flow search parser
flow run build
flow gui
```

## Markdown Frontmatter

Flow stores Home, notes, tasks, and commands as Markdown files with YAML frontmatter at the top of each file.

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
- Home does not use `graph` or graph-specific metadata

Note-specific fields:
- `references`: optional list of related document IDs; note-to-note references are treated as relationships, and cross-type references stay soft links

Task-specific fields:
- `status`: optional task state such as `todo`, `doing`, or `done`
- `dependsOn`: optional list of task IDs that must be completed first; hard dependencies must point to other tasks
- `references`: optional list of related document IDs that do not affect readiness

Command-specific fields:
- `name`: required short name used by `flow run <name>`; must be unique across the workspace
- `dependsOn`: optional list of command IDs that must run first; hard dependencies must point to other commands
- `references`: optional list of related document IDs that do not affect readiness
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
references:
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
dependsOn:
  - task-0
references:
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
dependsOn:
  - cmd-0
references:
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
# Build the embedded frontend assets
cd frontend
npm ci
npm run build

# Build the CLI binary from the repo root
cd ..
go build ./cmd/flow

# Print the local development build version
./flow version

# Run the targeted local Go validation matrix
go test ./internal/config ./internal/workspace ./internal/markdown ./internal/graph ./internal/execution ./internal/index ./internal/tui ./internal/httpapi ./cmd/flow
```

The frontend build emits bundled assets into `internal/httpapi/static/`, and the Go binary embeds those assets for `flow gui`.
Plain `go build` uses the project version from `internal/buildinfo/VERSION` and appends `-dev`; release builds inject the exact release version without the suffix.

## Graph Tree Behavior

The graph tree is derived from canonical files under `.flow/data/graphs` rather than from a separate graph registry.

- A document stored at `.flow/data/graphs/execution/parser/build.md` belongs to the `execution/parser` graph even if its frontmatter says otherwise.
- Parent graph nodes such as `execution` remain visible when descendants contain content, even if the parent directory has no direct Markdown files.
- Empty graphs are omitted from visible graph trees in the CLI, TUI, and GUI.
- Home is a separate top-level surface and is excluded from graph counts.

## Linux Release Process

The first release path is `linux/amd64` only.

Local packaging:

```bash
bash ./scripts/build-release-linux-amd64.sh
```

That script:
- runs `npm ci` and `npm run build` in `frontend/`
- builds a stripped `linux/amd64` `flow` binary with embedded assets
- reads the canonical project version from `internal/buildinfo/VERSION` unless `FLOW_VERSION` overrides it
- writes release artifacts to `dist/`
- creates:
  - `dist/flow-<version>-linux-amd64.tar.gz`
  - `dist/flow-<version>-linux-amd64.sha256`
  - `dist/install.sh`

The Linux tarball includes:
- `flow`
- `LICENSE`

CI packaging:
- GitHub Actions workflow: `.github/workflows/release-linux-amd64.yml`
- publishes on version tag pushes and manual dispatch with an explicit release tag
- reads the project version from `internal/buildinfo/VERSION`
- validates that the release tag matches the project version
- publishes a GitHub Release with GitHub-generated release notes
- attaches exactly these release assets:
  - the Linux tarball
  - the SHA-256 file
  - the standalone `install.sh` downloader

Release tags may be either `0.1.0` or `v0.1.0`, but they must match the version stored in `internal/buildinfo/VERSION`.

Release procedure:

1. Update `internal/buildinfo/VERSION` to the release version.
  This is the canonical version source. The workflow reads it, the release build injects it into `flow version`, and the asset filenames are derived from it.

2. Run the local validation and packaging flow.
  This confirms the frontend builds, the Go packages still pass the targeted validation matrix, and the local Linux release script still produces the tarball, checksum, and installer before you publish anything.

  ```bash
  cd frontend
  npm ci
  npm run build

  cd ..
  go test ./internal/config ./internal/workspace ./internal/markdown ./internal/graph ./internal/execution ./internal/index ./internal/tui ./internal/httpapi ./cmd/flow
  bash ./scripts/build-release-linux-amd64.sh
  ```

3. Commit the version bump and any release-facing changes.
  The release workflow publishes from repository state, so the committed version file, README, and scripts should match what you intend to ship.

4. Create and push a matching release tag.
  Use either `v<version>` or `<version>`, but it must match `internal/buildinfo/VERSION`. The workflow rejects mismatched tags to prevent publishing assets under the wrong version.

  ```bash
  git tag v0.1.0
  git push origin v0.1.0
  ```

5. Let GitHub Actions publish the release.
  The workflow rebuilds the artifacts in CI, validates the tag against the version file, creates a GitHub Release, generates release notes automatically, and attaches the tarball, SHA-256 file, and `install.sh`.

6. Verify the published release page.
  Check that the generated notes look reasonable, the release assets are present, and the filenames match the version you intended to ship.

Manual alternative:
- Use `workflow_dispatch` and provide `release_tag` when you need to publish the release explicitly from the Actions UI instead of by pushing a tag.
- The same version check still applies, so the tag you enter must match `internal/buildinfo/VERSION`.

## Install The Linux Artifact

After building the local release artifact, install it with:

```bash
bash ./scripts/install-linux-amd64.sh
```

By default the installer:
- reads `dist/flow-<project-version>-linux-amd64.tar.gz`
- verifies `dist/flow-<project-version>-linux-amd64.sha256` when possible
- installs `flow` into `$HOME/.local/bin`

The installer also falls back to the legacy unversioned artifact names when those are the only local files present.

Optional environment overrides:
- `FLOW_ARCHIVE_PATH`: custom tarball path
- `FLOW_CHECKSUM_PATH`: custom checksum file path
- `FLOW_INSTALL_DIR`: destination directory for the binary

Example:

```bash
FLOW_INSTALL_DIR="$HOME/bin" bash ./scripts/install-linux-amd64.sh
```

Make sure the install directory is on `PATH`.

## Install From GitHub Releases

GitHub release artifacts include a standalone `install.sh` script. It detects the current OS and architecture, downloads the matching release tarball and checksum, verifies the archive when a SHA-256 tool is available, and installs `flow` into `$HOME/.local/bin` by default.

Usage:

```bash
bash ./install.sh
bash ./install.sh 0.1.0
bash ./install.sh v0.1.0
```

Current released artifact support remains `linux/amd64` only. The installer exits with a clear error on unsupported platforms until more release targets exist.

Optional environment overrides:
- `FLOW_INSTALL_DIR`: destination directory for the binary
- `FLOW_RELEASE_REPO`: alternate GitHub repository in `owner/name` format

Capture. Connect. Complete.
