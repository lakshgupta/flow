# Architecture

This document captures approved feature designs and the architectural decisions needed to implement them. It is written for both human readers and implementation agents: concise enough to scan, descriptive enough to guide delivery.

## Index

- [Document Purpose](#document-purpose)
- [How To Use This Document](#how-to-use-this-document)
- [System Overview](#system-overview)
- [Cross-Cutting Constraints](#cross-cutting-constraints)
- [Approved Feature Designs](#approved-feature-designs)
- [Decision Log](#decision-log)
- [Open Questions](#open-questions)

## Document Purpose

Use this file to record approved feature designs before implementation begins or while implementation is in progress.

Each feature entry should explain:

- What problem is being solved
- What the final user or system behavior should be
- Which parts of the system change
- Which interfaces, data shapes, and flows are affected
- Which constraints, tradeoffs, and risks matter during implementation

## How To Use This Document

Add new approved work under the Approved Feature Designs section.

For each feature:

1. Use a clear title.
2. Keep the content understandable to a human reviewer.
3. Include enough detail that an implementation agent can act on it without needing the original design chat.
4. Prefer updating an existing feature section if the work extends that design instead of creating duplicate sections.
5. Move final architectural choices into the Decision Log when they affect multiple features or future work.

## System Overview

Flow is a local-first planning tool for software projects. It stores canonical Markdown documents inside `.flow/data`, keeps workspace configuration and runtime files inside `.flow/config`, and maintains a rebuildable derived SQLite index in `.flow/config/flow.index` for search and graph queries.

The system supports:

- local project workspaces and configurable global workspaces
- a `flow` CLI entrypoint
- a TUI for execution-oriented workflows
- a browser-based GUI served from a local loopback server with layered views for tasks and commands and a canvas view for notes
- a Go runtime that owns CLI, TUI, server, indexing, graph computation, and save flows

## Cross-Cutting Constraints

The following constraints apply across the system:

- Markdown files are the canonical source of truth.
- `.flow/config/flow.index` is derived, rebuildable, and may be recreated from Markdown files.
- File location is authoritative for graph membership when it disagrees with document frontmatter.
- Graph documents are classified by frontmatter `type`, not by type-specific directories.
- `flow init` always rebuilds the index and must not modify Markdown note, task, or command files.
- `flow search` auto-rebuilds a missing index.
- Local and global workspaces share the same schema and command behavior.
- GUI server ports are configured per workspace and server startup fails instead of auto-falling back when the configured port is unavailable.
- The first rewrite keeps note, task, and command frontmatter close to the current design.
- Hard links represent same-type dependencies only.
- Soft links represent references only and never affect readiness or layering.
- Notes are relationship-oriented and not treated as dependency-layered work.
- Tasks and commands are the only layered executable work types in v1.
- The first browser GUI milestone is read-only and focuses on note canvas and layered views.
- Release automation starts with `linux/amd64` binaries before broader platform coverage.

## Approved Feature Designs

### Feature: Layered Task Graph Planner

#### Status

Approved.

#### Summary

Build a local-first planning tool for Git repositories where every item is stored as a Markdown-backed document inside a `.flow` directory. The workspace configuration lives in `.flow/config/flow.yaml`, canonical content lives under `.flow/data`, and a rebuildable derived index lives in `.flow/config/flow.index`.

The product supports both project-local and user-global workspaces, a CLI entrypoint named `flow`, a layered primary view for executable work, a graph canvas for note exploration, and three document types with distinct semantics:

- `note`: knowledge and reference content
- `task`: dependency-driven work items
- `command`: executable workflow steps

The local workspace uses one notes graph, one tasks graph, and multiple command graphs. The global workspace supports multiple graphs for all three document types.

The implementation runtime is a Go rewrite that serves an embedded browser frontend and ships Flow as a single binary, starting with `linux/amd64` release artifacts.

#### Problem

Software projects need more than flat task lists. They accumulate design notes, feature plans, implementation tasks, and repeatable commands. Users need to understand:

- which tasks or commands are blocked
- which tasks or commands can run in parallel
- how notes relate to work without becoming execution blockers
- how to manage both repository-local planning and broader global planning

The system must remain Git-friendly and transparent, so Markdown files are the canonical source of truth. At the same time, search, graph traversal, and layer computation need a rebuildable local index.

#### Goals

- Store notes, tasks, and commands as Markdown files in `.flow/data`.
- Store workspace configuration in `.flow/config/flow.yaml`.
- Store a rebuildable derived index in `.flow/config/flow.index`.
- Support both local and global workspaces.
- Provide `flow init`, `flow tui`, `flow gui`, `flow configure`, `flow create`, `flow update`, `flow delete`, `flow search`, and `flow run`.
- Ship Flow as a single binary for the initial Linux release target.
- Make layered views primary for tasks and commands.
- Make the notes experience canvas-based and relationship-oriented.
- Keep Markdown canonical and the index rebuildable from Markdown files.
- Support a browser GUI that started read-only, then adds document update and delete flows after the backend APIs stabilize.

#### Non-Goals

- Recurring tasks in v1.
- Multi-user collaboration in v1.
- Cloud sync in v1.
- Cross-type hard dependencies in v1.
- A dedicated `flow reindex` command in v1.
- Raw Markdown editing mode for notes in the GUI in v1.
- Preserving the current TypeScript backend or Bun runtime.

#### User Experience

Local workspace behavior:

- Commands without `-g` operate on the `.flow` directory in the current working directory.
- `flow init` creates `.flow/config/flow.yaml`, creates `.flow/.gitignore` for derived runtime files, and rebuilds `.flow/config/flow.index`.
- `flow configure` can set the local workspace GUI server port.
- `flow run <command-id-or-short-name>` resolves a command by ID or unique short name, checks command dependencies, merges command environment variables over the current process environment, and runs the configured shell command from the workspace root.
- `flow gui` starts or restarts the local workspace GUI server on the configured port and opens the browser UI.
- `flow gui stop` stops the local workspace GUI server.

Global workspace behavior:

- Commands with `-g` operate on a configured global workspace.
- `flow -g configure` stores the global workspace location in the platform-default app config directory, validates it, creates parent directories immediately, and can set the global workspace GUI server port.
- `flow -g init` initializes the configured global workspace if it does not exist yet.
- `flow -g run <command-id-or-short-name>` resolves and runs a command from the configured global workspace with the same dependency and environment behavior as the local command.
- `flow -g gui` starts or restarts the global workspace GUI server on the configured port and opens the browser UI.
- `flow -g gui stop` stops the global workspace GUI server.

GUI server behavior:

- `flow gui` and `flow -g gui` serve the UI on loopback HTTP and open browser tabs or windows rather than a contained desktop shell.
- Repeating `flow gui` for the same workspace may restart that workspace's existing GUI server on its configured port.
- Starting `flow gui` or `flow -g gui` for a different workspace on a port already used by another Flow GUI server fails with a port-in-use error.
- Users resolve GUI port conflicts by changing the workspace port with `flow configure` or `flow -g configure`.
- If the configured port is unavailable when the server starts, startup fails with an explicit error instead of selecting another port automatically.

Search behavior:

- `flow search` queries the workspace index.
- If `.flow/config/flow.index` is missing, search rebuilds it automatically from Markdown files.
- `flow init` always rebuilds the index and never modifies Markdown files.

Document-type behavior:

- Notes are shown on a canvas as a graph of bidirectional relationships.
- Tasks are shown primarily in layered views and dependency-oriented graph views.
- Commands are shown primarily in layered views and dependency-oriented graph views.

Note editing behavior:

- Clicking a note on the canvas opens a right-side panel.
- After the read/query APIs settled, the panel gained browser-side update and delete flows backed by the mutation APIs.
- Richer WYSIWYG editing is deferred until the backend APIs and Markdown round-tripping behavior are stable.

#### Architecture

Recommended stack:

- Go
- React
- TypeScript for the embedded frontend only
- `@xyflow/react` for note canvas and graph interaction
- `markdown-it` for read-focused Markdown rendering
- a loopback-only HTTP server for `flow gui` and `flow -g gui`
- the user's default browser for GUI presentation
- SQLite stored in `.flow/config/flow.index`
- `modernc.org/sqlite` as the default Go SQLite driver

Suggested package layout:

- `cmd/flow`
- `internal/workspace`
- `internal/config`
- `internal/markdown`
- `internal/index`
- `internal/graph`
- `internal/execution`
- `internal/httpapi`
- `internal/tui`

Key responsibilities:

- `internal/workspace`: local versus global workspace resolution, `-g` behavior, and GUI server ownership rules
- `internal/config`: `.flow/config/flow.yaml` parsing and validation, including workspace GUI server port configuration
- `internal/markdown`: Markdown parsing, serialization, canonical paths, and frontmatter handling that stays close to the current design
- `internal/index`: `.flow/config/flow.index` rebuild, search, and graph projections using SQLite
- `internal/graph`: layer computation, note relationship views, and focused graph snapshots
- `internal/execution`: explicit command execution, environment resolution, process spawning, and GUI server lifecycle control
- `internal/httpapi`: embedded asset serving plus read/query APIs first, then mutation APIs later
- `internal/tui`: Go TUI flows built on the shared backend domain logic

Core architectural rule:

- Markdown files are canonical.
- `.flow/config/flow.index` is derived and rebuildable.
- UI state is transient.
- Save flows write Markdown first, then refresh the index.
- The browser GUI started as a read-only milestone to stabilize the backend query APIs before browser-side editing was introduced.

#### Data And Interfaces

Workspace layout:

- `.flow/config/flow.yaml`
- `.flow/config/flow.index`
- `.flow/config/gui-server.json`
- `.flow/data/home.md`
- `.flow/data/graphs/<graph-path>/*.md`

Document semantics:

- `note`: knowledge document with bidirectional note relationships and soft references to tasks or commands
- `task`: work document with same-type hard dependencies and soft references to notes or commands
- `command`: executable document with same-type hard dependencies, a unique short name, environment metadata, and soft references to notes or tasks

Suggested frontmatter conventions:

- shared fields: `id`, `type`, `graph`, `title`, `tags`, `createdAt`, `updatedAt`
- task fields: `status`, `dependsOn`, `references`
- command fields: `name`, `dependsOn`, `references`, `env`, `run`
- note fields: `references`

First rewrite frontmatter policy:

- Keep note, task, and command frontmatter close to the current design.
- Allow cleanup only when it simplifies parsing or validation without changing the core document semantics.

Suggested workspace config fields:

- `gui.port`: workspace-local GUI server port

Suggested browser API surface for the first GUI milestone:

- `GET /api/workspace`
- `GET /api/graphs/:type`
- `GET /api/layers/tasks`
- `GET /api/layers/commands`
- `GET /api/notes/graph`
- `GET /api/documents/:id`
- `GET /api/search`
- `POST /api/gui/stop`

Deferred mutation API surface:

- `POST /api/documents`
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`

Link semantics:

- Hard links represent dependencies.
- Hard links are allowed only between documents of the same type.
- Hard links may cross graph boundaries.
- Soft links represent references only.
- Soft links may connect different document types.

Graph cardinality:

- Local workspace: one notes graph, one tasks graph, multiple command graphs
- Global workspace: multiple notes graphs, multiple tasks graphs, multiple command graphs

#### Control Flow

Initialization flow:

- `flow init` creates missing workspace files and always rebuilds the index from Markdown.
- `flow init` never changes Markdown note, task, or command files.

Search flow:

- `flow search` or `flow -g search` resolves the target workspace.
- If the index is missing, the tool rebuilds it automatically.
- Search uses indexed metadata and body text.

Command execution flow:

- `flow run` or `flow -g run` resolves the target workspace and loads canonical Markdown documents.
- The command may be selected by exact document ID or by unique short name.
- Workspace validation rejects missing or invalid command dependencies before process startup.
- The command environment overlays command-specific `env` values on top of the current process environment.
- The configured `run` string executes through the platform shell from the workspace root.
- CLI output reports dependency checks, start, and completion or surfaced subprocess failure.

Build and release flow:

- The browser frontend is built into static assets.
- The Go build embeds those assets into the `flow` binary.
- CI initially produces release binaries only for `linux/amd64`.
- Broader platform release automation is added after the Linux path is stable.

GUI server flow:

- `flow gui` or `flow -g gui` resolves the target workspace and reads its configured GUI port.
- If a Flow GUI server is already running for the same workspace, the command may stop it and start a replacement server on the same configured port.
- If the configured port is occupied by a different process or by a Flow GUI server for another workspace, startup fails with a port-in-use error.
- On successful startup, the command opens the browser to the local loopback URL for that workspace.
- `flow gui stop` and `flow -g gui stop` stop the running GUI server for the targeted workspace.

First GUI rollout flow:

- The first browser GUI milestone stabilized read/query APIs with a strictly read-only side panel.
- After the read/query APIs stabilized, the browser side panel gained document update and delete flows backed by the mutation APIs.
- Richer WYSIWYG editing is added only after the backend mutation flows and Markdown round-tripping behavior are stable.

Save flow:

- User edits a document in the CLI, TUI, or GUI.
- The shared core validates the change.
- Markdown is written to disk.
- The index is refreshed for the changed item.
- Search, graph, and layered views refresh from the updated index.

Graph flow:

- GUI and TUI show a graph tree derived from `.flow/data/graphs`, with document type determined by frontmatter rather than directory buckets.
- Focused graph views collapse external same-type dependency nodes into boundary markers until expanded.
- Boundary markers show count only by default.

Layer flow:

- Tasks support layered views across same-type hard dependencies.
- Commands support layered views across same-type hard dependencies.
- The default command layered view is one command graph at a time.
- A workspace-wide aggregate command view may be added later as an optional mode.

Note canvas flow:

- Notes are displayed as a canvas graph of bidirectional relationships.
- Notes are not treated as dependency graphs.
- Clicking a note opens a right-side panel that now supports document update and delete flows.

Delete note flow:

- Deleting a note removes the Markdown file.
- The note is removed from the index.
- Bidirectional note relationships are removed.
- Soft references from tasks and commands to that note are removed automatically.

#### Edge Cases And Failure Modes

- Missing index file: `flow search` auto-rebuilds it; `flow init` always rebuilds it.
- Corrupted index: rerunning `flow init` reconstructs it from Markdown.
- GUI port conflict: `flow gui` and `flow -g gui` fail fast if the configured port is unavailable.
- Same-workspace GUI restart: repeated GUI launch commands may replace the existing server process for that workspace.
- Browser launch failure should leave the server running and print the local URL.
- Deferring browser-side editing reduced early complexity but made the first GUI milestone intentionally narrower.
- WYSIWYG-to-Markdown serialization can cause formatting drift; serialization should minimize unnecessary churn once editing is introduced.
- Deleting notes can remove many soft references; the deletion flow should remain consistent and predictable.
- Cross-type hard dependencies must be rejected.
- Duplicate command short names must be rejected.
- Focused graphs with many external dependencies must remain readable through boundary-marker summarization.

#### Testing Strategy

- Unit tests for workspace resolution, including local and global targeting
- Unit tests for `.flow/config/flow.yaml` parsing and validation
- Unit tests for Markdown parsing and serialization
- Unit tests for task and command layer computation
- Unit tests for hard-link and soft-link validation
- Unit tests for command short-name uniqueness and env parsing
- Unit tests for workspace GUI port configuration parsing and validation
- Integration tests for `flow init` rebuilding the index without modifying Markdown files
- Integration tests for `flow search` auto-rebuild when the index is missing
- Integration tests for local and global GUI server startup, browser launch intent, restart, stop, and port-conflict behavior
- Integration tests for note canvas, layered views, document inspection, and browser-side update/delete flows
- Integration tests for note editing and note deletion cleanup after the mutation APIs are introduced
- Integration tests for focused graph views and count-only boundary markers
- Integration tests for command layered views by single graph
- CI initially focuses on producing `linux/amd64` release binaries; automated test execution may be added after the first release path is stable.

#### Risks And Tradeoffs

- SQLite is acceptable for the index because it is derived and does not need to be human-readable.
- Rewriting the runtime in Go simplifies single-binary delivery and TUI integration, but it discards the current TypeScript backend implementation work.
- Using React plus a few targeted frontend libraries is simpler in practice than forcing a minimal custom frontend for canvas and graph behavior.
- Choosing `modernc.org/sqlite` avoids CGo packaging complexity and better matches the initial Linux-first single-binary release strategy.
- Using the browser instead of an embedded desktop shell reduces packaging complexity for v1 but requires explicit server lifecycle management.
- Deferring richer browser-side editing beyond update/delete flows reduces first-release risk but postpones the richer note editor experience.
- Allowing hard dependencies across same-type graphs makes graph boundaries organizational rather than absolute.
- Keeping notes out of dependency layering preserves conceptual clarity.
- Separate local and global workspaces increase flexibility but require explicit targeting and labeling.

#### Open Questions

- None blocking the first rewrite design.

### Feature: Three-Panel Workspace GUI

#### Status

Approved.

#### Summary

Evolve the browser GUI from its current fixed card layout into a desktop-first three-panel workspace with draggable split bars, a dedicated Home surface backed by `.flow/data/home.md`, graph navigation and search in the left rail, and contextual document editing in a right-side panel.

This feature also extends the canonical Markdown model with a shared `description` frontmatter field for every Flow-managed Markdown file, persists GUI panel width ratios in `.flow/config/flow.yaml`, includes Home and descriptions in search, and upgrades the browser editor from form-style Markdown editing to a WYSIWYG document editor with slash commands, a floating text-selection toolbar, and HTML `<mark>` highlight persistence.

#### Problem

The current browser GUI exposes workspace data, but it does not yet behave like a full workspace application.

- Navigation, graph exploration, and editing are not clearly separated.
- There is no first-class Home document for workspace-level context.
- The graph canvas is not the dominant center-panel experience.
- The detail editor is not purely contextual.
- Panel widths are fixed rather than user-adjustable.
- The editor experience is still closer to form-based Markdown editing than a WYSIWYG workflow comparable to Logseq or Obsidian.
- The system lacks a short shared `description` field for panels and search results.

The product needs a stronger desktop information architecture without giving up Markdown as the canonical source of truth.

#### Goals

- Divide the GUI into three vertical desktop panels with draggable resize bars.
- Default the left panel to roughly one quarter of the page width.
- Make the left panel contain, in order:
	- Flow logo
	- tagline
	- workspace path
	- search input
	- Home entry
	- grouped graph lists
- Show Home in the middle panel by default.
- Have `flow init` create `.flow/data/home.md`.
- Use frontmatter in `home.md`.
- Keep Home as a dedicated top-level entry rather than part of graph navigation.
- Show the selected graph in an infinite canvas in the middle panel.
- Open the right panel only when a graph node is selected.
- Use a WYSIWYG editor for Home and graph documents.
- Support slash commands for headings, bold, italic, bulleted lists, checklists, code blocks, links, block quotes, highlight, and the agreed basic formatting set.
- Show a floating toolbar when text is selected.
- Add `description` frontmatter to every Flow-managed Markdown file.
- Use `description` in panels and search results, but not in graph node rendering.
- Include Home content and descriptions in search.
- Persist left and right panel widths as ratios in `.flow/config/flow.yaml`.

#### Non-Goals

- Mobile or responsive redesign.
- Replacing Markdown as the canonical storage format.
- Making Home part of the graph lists.
- Giving Home a distinct visual style from other content surfaces.
- Showing descriptions on graph nodes.
- Multi-user editing or sync.

#### User Experience

Desktop shell behavior:

- The GUI opens to Home by default.
- The left panel is always visible and acts as the workspace navigation rail.
- The middle panel is always visible and is the primary surface.
- The right panel is hidden until the user selects a graph node.

Left panel behavior:

- Default width is 25% of available width.
- The panel shows the Flow logo, tagline, workspace path, search, Home entry, and grouped graph lists.
- Search results appear in one mixed list with explicit labels such as `Home`, `Note`, `Task`, and `Command`.
- Home appears once as a dedicated top-level entry and is not duplicated in graph lists.

Middle panel behavior:

- When Home is active, the middle panel shows a WYSIWYG editor for `.flow/data/home.md`.
- When a graph is active, the middle panel shows the selected graph on an infinite canvas.
- The middle panel should retain the largest share of workspace width by default.

Right panel behavior:

- The right panel opens only when a graph node is selected.
- The right panel shows a WYSIWYG editor for the selected note, task, or command.
- The panel includes title, description, metadata, and body editing.

Editor behavior:

- Typing `/` opens a slash-command menu for the supported block and formatting actions.
- Selecting text opens a floating toolbar for inline actions such as bold, italic, link, and highlight.
- Highlight is persisted using HTML `<mark>` inside Markdown content.
- The editor should feel closer to Logseq or Obsidian than a textarea-driven form.

Description behavior:

- `description` is editable for Home, notes, tasks, and commands.
- `description` appears in panels and search results.
- `description` does not appear on graph nodes or graph list buttons.

#### Architecture

Frontend shell:

- Replace the fixed grid/card layout with a split-pane desktop shell.
- Add a layout controller that owns:
	- active surface: `home` or `graph`
	- selected graph type and graph name
	- selected node/document id
	- left panel width ratio
	- right panel width ratio
	- right-panel visibility
	- drag-resize behavior

Panel model:

- Left panel is always present.
- Middle panel is always present and remains the primary surface.
- Right panel is conditional and appears only when a graph node is selected.
- Home remains separate from graph navigation state.

Editor architecture:

- Introduce a reusable WYSIWYG editor abstraction used by both Home and note/task/command editing.
- Use a rich-text engine that supports:
	- slash commands
	- floating text-selection toolbar
	- block editing
	- inline formatting
	- Markdown import/export
- A ProseMirror-derived stack such as Tiptap or Milkdown is the preferred class of solution because it is compatible with Obsidian/Logseq-like workflows and structured editing.

Persistence boundary:

- Editor state is not canonical.
- Markdown files remain canonical.
- Save flows serialize editor content back to Markdown plus frontmatter.
- Supported formatting must be limited to constructs that can be round-tripped safely.
- Highlight is serialized as inline HTML `<mark>` in Markdown content.

Backend architecture:

- Add Home as a special canonical document at `.flow/data/home.md`.
- Keep Home outside the graph tree under `.flow/data/graphs/...`.
- Extend parsing, serialization, validation, indexing, and GUI APIs to support Home, the shared `description` field, and persisted panel width ratios in `.flow/config/flow.yaml`.

State boundaries:

- Canonical:
	- `.flow/data/home.md`
	- note/task/command Markdown files
	- `.flow/config/flow.yaml`
- Derived:
	- `.flow/config/flow.index`
- Transient:
	- selection state
	- unsaved editor draft state
	- drag state
	- toolbar visibility state

#### Data And Interfaces

New canonical file:

- `.flow/data/home.md`

Suggested `home.md` format:

```yaml
---
id: home
type: home
title: Home
description: Workspace home document
---
```

Shared frontmatter changes:

- Add `description` to every Flow-managed Markdown file.
- Shared fields become:
	- `id`
	- `type`
	- `title`
	- `description`
	- `tags`
	- `createdAt`
	- `updatedAt`
- Graph-backed files additionally keep:
	- `graph` where applicable
	- task/command-specific fields

Workspace config changes:

- Persist panel width ratios inside `.flow/config/flow.yaml`.

Suggested shape:

```yaml
gui:
	port: 4317
	panelWidths:
		leftRatio: 0.25
		rightRatio: 0.24
```

Browser API additions or changes:

- `GET /api/home`
- `PUT /api/home`
- Extend document read/update payloads with `description`
- Extend workspace/config payloads with panel width ratios
- Extend search result payloads with `description` and explicit type labeling, including `home`

Search contract:

- Search matches title, description, and body.
- Results appear in one mixed list.
- Each result includes a type label.
- Home participates in search but not in graph lists.

Editor command model:

- Slash menu inserts block-level and structural formatting.
- Floating toolbar applies inline formatting.
- Highlight persists as HTML `<mark>`.

#### Control Flow

Initialization flow:

- `flow init` creates `.flow/config/flow.yaml` if missing.
- `flow init` creates `.flow/data/home.md` if missing.
- `flow init` rebuilds `.flow/config/flow.index`.
- Default panel width ratios are written into `flow.yaml` if absent.

GUI load flow:

- Load workspace metadata and config.
- Load Home content.
- Restore left and right panel width ratios.
- Set active surface to Home.
- Render Home editor in the middle panel.
- Keep the right panel closed.

Navigation flow:

- Selecting Home clears graph and node selection and renders Home in the middle panel.
- Selecting a graph switches the middle panel to the infinite canvas for that graph.
- Selecting a node opens the right panel and loads the selected document editor.

Save flow:

- Editor updates local draft state.
- Draft serializes to Markdown with frontmatter including `description`.
- Home saves through `PUT /api/home`.
- Note/task/command saves continue through the document mutation APIs.
- Backend writes canonical Markdown, then refreshes the derived index.

Search flow:

- The left-panel search matches title, description, and body content.
- Search results render in one list with explicit type labels.
- Selecting a Home result switches to Home.
- Selecting a document result restores graph context if needed and opens the right-side editor.

Formatting flow:

- Typing `/` opens the slash-command menu.
- Selecting text opens the floating toolbar.
- Inline or block actions update editor state.
- Saving persists the content back to Markdown-compatible output.

Resize flow:

- Dragging a divider updates adjacent panel ratios live.
- Ratios are clamped to usable desktop bounds.
- On drag end, ratios are persisted to `flow.yaml`.

#### Edge Cases And Failure Modes

- Older workspaces may lack `.flow/data/home.md` or panel width settings; GUI load should create or default them safely.
- `description` remains optional but must be validated consistently across all Markdown files.
- Invalid ratio settings in `flow.yaml` should be clamped to sane defaults.
- `home.md` must not require graph-only fields.
- Only formatting that round-trips safely should be exposed in the editor.
- Unsupported imported markup should degrade visibly rather than disappearing silently.
- Home search results must never be treated as graph nodes.
- Restored panel ratios should be clamped if they become unusable for the current desktop window size.
- The feature is desktop-only; narrow screens may remain poor UX until future responsive work.

#### Testing Strategy

- Backend tests for `flow init` creating `.flow/data/home.md`
- Backend tests for Home frontmatter parsing and serialization
- Backend tests for shared `description` support across all Markdown types
- Backend tests for search indexing title, description, body, and Home content
- Backend tests for config round-tripping ratio-based panel widths
- API tests for `GET /api/home` and `PUT /api/home`
- Regression tests for document APIs with `description`
- Frontend tests for three-panel shell rendering and default Home load
- Frontend tests for graph selection, node selection, and right-panel opening
- Frontend tests for drag-resize behavior with persisted ratios
- Frontend tests for mixed search result rendering with type labels
- Frontend tests for Home result routing and graph document result routing
- Frontend tests for slash-command menu, floating text-selection toolbar, and highlight behavior
- Integration tests for Home editing, document editing, search by description/body, and persisted panel widths

#### Risks And Tradeoffs

- A true WYSIWYG editor is the largest implementation risk because Markdown round-tripping becomes more complex.
- Persisting highlight as HTML `<mark>` is practical and explicit, but it introduces inline HTML into canonical Markdown files.
- Persisting layout ratios in `flow.yaml` matches the requested workspace-scoped behavior, but it may create Git churn in shared repositories.
- Treating Home as a special document is cleaner for UX than forcing it into graph semantics, but it adds special-case code paths.
- A single mixed search result list is compact and efficient, but it depends on strong type labeling for clarity.
- Keeping Home visually unstyled relative to other surfaces simplifies the overall shell design.

#### Open Questions

- Should the floating toolbar initially include all inline formatting actions or only the highest-value subset such as bold, italic, link, and highlight?
- Should non-`<mark>` inline HTML be preserved as-is or normalized during save?

### Feature: Graph Tree Workspace Layout

#### Status

Approved.

#### Summary

Replace the old feature-bucket workspace layout with a graph-tree layout that separates configuration from canonical content. Workspace configuration and runtime state live under `.flow/config`, Home lives at `.flow/data/home.md`, and graph documents live directly inside `.flow/data/graphs/<graph-path>/`.

The graph tree is derived from directory structure and indexed documents. Graph creation accepts full paths such as `execution/parser`, silently creates missing parent directories, and shows counts in `3 direct / 11 total` format.

#### Problem

The old `.flow/features/<feature>/notes|tasks|commands` structure does not match the graph-oriented model used by the GUI and TUI.

- It forces type-oriented storage instead of graph-oriented storage.
- It makes nested graph organization awkward.
- It keeps Home outside the canonical data area.
- It mixes durable configuration and derived runtime files with the rest of the workspace.

The workspace model needs to align storage, indexing, graph navigation, and creation semantics around graphs as first-class filesystem paths.

#### Goals

- Separate workspace config/runtime files from canonical Markdown content.
- Store Home at `.flow/data/home.md`.
- Store graph documents directly in `.flow/data/graphs/<graph-path>/`.
- Support nested graph paths such as `execution/parser`.
- Silently create missing intermediate parent directories during graph creation.
- Ignore empty graph directories in indexed and visible graph trees.
- Use file location as the authoritative source of graph membership.
- Use frontmatter `type` as the authoritative source of note/task/command classification.
- Show graph counts as `3 direct / 11 total`.

#### Non-Goals

- Adding per-graph metadata files such as `graph.yaml`.
- Automatic migration of existing repositories in this feature.
- Adding type-specific filesystem directories like `notes/`, `tasks/`, or `commands/`.
- Showing count information for Home.

#### User Experience

Canonical layout:

- `.flow/config/flow.yaml`
- `.flow/config/flow.index`
- `.flow/config/gui-server.json`
- `.flow/data/home.md`
- `.flow/data/graphs/<graph-path>/*.md`

Behavior:

- `flow init` creates `.flow/config` and `.flow/data`.
- Home is a dedicated top-level entry and is not part of the graph tree.
- Users create graphs by full path, for example `execution/parser`.
- Missing parent directories are created silently during graph creation.
- A graph becomes visible only when its subtree contains canonical Markdown content.
- Parent graph nodes display counts as `3 direct / 11 total`.

#### Architecture

Workspace boundaries:

- Config layer: `.flow/config/flow.yaml` and disposable runtime files such as `.flow/config/gui-server.json`
- Canonical content layer: `.flow/data/home.md` and `.flow/data/graphs/<graph-path>/*.md`
- Derived index layer: `.flow/config/flow.index`

Major responsibilities:

- `internal/workspace`: resolve config root, data root, graphs root, and Home path
- `internal/markdown`: parse frontmatter-driven document types and serialize canonical Markdown
- `internal/index`: walk Home plus graph directories, derive graph counts, and persist the SQLite index
- `internal/httpapi`: expose graph-tree and Home-aware APIs
- `internal/tui` and frontend GUI: create graphs by full path and render the derived graph tree

#### Data And Interfaces

Filesystem contracts:

- `.flow/config/flow.yaml`
- `.flow/config/flow.index`
- `.flow/config/gui-server.json`
- `.flow/data/home.md`
- `.flow/data/graphs/<graph-path>/*.md`

Document rules:

- Home is a standalone canonical document outside the graph tree.
- Graph documents are stored directly in their graph directory as Markdown files.
- Frontmatter `type` determines whether a document is a note, task, or command.
- File location determines graph membership when location and frontmatter `graph` disagree.

API and model expectations:

- Graph tree payloads include graph path, display name, direct count, total count, and child presence.
- Count formatting is `3 direct / 11 total`.
- Home is addressable separately from graph navigation and does not expose counts.

#### Control Flow

Graph creation flow:

- Validate the requested full graph path.
- Create missing parent directories under `.flow/data/graphs`.
- Create the target graph directory.
- Defer graph visibility until the subtree contains canonical Markdown content.

Indexing flow:

- Load Home from `.flow/data/home.md` when present.
- Walk `.flow/data/graphs` recursively.
- Read Markdown files directly inside each graph directory.
- Determine document type from frontmatter.
- Attribute graph membership from filesystem location.
- Aggregate direct counts per graph.
- Roll descendant totals up the tree.
- Persist the derived index in `.flow/config/flow.index`.

#### Edge Cases And Failure Modes

- Invalid graph paths with empty segments or escape attempts must be rejected.
- Empty parent directories created during graph creation remain invisible until their subtree has content.
- Empty target graphs remain invisible until at least one canonical document exists in the subtree.
- Missing Home is tolerated and can be created later.
- Stale `.flow/config/gui-server.json` may be replaced or deleted without affecting canonical data.
- Files with missing or invalid `type` frontmatter fail type-specific behaviors until corrected.
- If frontmatter `graph` disagrees with filesystem location, runtime behavior follows location.

#### Testing Strategy

- Unit tests for workspace path resolution under `.flow/config` and `.flow/data`
- Unit tests for Home loading from `.flow/data/home.md`
- Unit tests for graph discovery from flat per-graph file storage
- Index tests for empty-graph filtering, nested graph traversal, and direct versus total counts
- Validation tests for file-location authority when frontmatter `graph` disagrees
- CLI, HTTP, GUI, and TUI tests for full-path graph creation with silent parent creation

#### Risks And Tradeoffs

- Silent parent creation improves usability but leaves empty structural directories on disk.
- Ignoring empty graphs keeps the UI cleaner but means graph creation and graph visibility are distinct moments.
- Flat per-graph file storage is simpler than type-specific subdirectories, but large graphs may accumulate many files in one directory.
- Using filesystem location as the authority simplifies runtime semantics but requires write-path normalization when users move files manually.

#### Open Questions

- None recorded for the approved design.

## Decision Log

- V1 GUI uses a loopback-only local server plus the user's browser instead of an embedded desktop shell.
- GUI server ports are configured per workspace and must fail fast on conflicts rather than auto-selecting a fallback port.
- Repeated `flow gui` launches may restart the server for the same workspace, while cross-workspace port conflicts remain hard errors.
- The runtime is rewritten in Go and ships as a single binary with an embedded browser frontend.
- The browser GUI uses React plus targeted supporting libraries, starts with note canvas and layered views, and now supports document update and delete flows in the side panel while richer editing remains deferred.
- `.flow/config/flow.index` remains the derived index file name and continues to use SQLite, with `modernc.org/sqlite` preferred for the Go implementation.
- CI release automation starts with `linux/amd64` binaries before broader platform coverage or CI test execution.
- The desktop GUI evolves to a three-panel split-pane workspace with Home as a dedicated top-level entry backed by `.flow/data/home.md`.
- Every Flow-managed Markdown file gains a shared `description` field that is used in panels and search results, but not on graph nodes.
- GUI panel widths are persisted as ratios in `.flow/config/flow.yaml`.
- Rich browser editing uses a WYSIWYG editor with slash commands, a floating text-selection toolbar, and HTML `<mark>` highlight persistence.
- Workspace configuration and runtime files live under `.flow/config`, while canonical Markdown content lives under `.flow/data`.
- Home is stored at `.flow/data/home.md` and remains outside the graph tree.
- Graph documents are stored directly inside `.flow/data/graphs/<graph-path>/` with document type determined by frontmatter `type`.
- File location is authoritative for graph membership when it disagrees with frontmatter `graph`.
- Graph creation accepts full paths, silently creates missing parent directories, ignores empty graphs in visible graph trees, and displays counts as `3 direct / 11 total`.

## Open Questions

- None recorded yet.
