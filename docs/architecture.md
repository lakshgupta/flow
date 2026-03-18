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

Flow is a local-first planning tool for software projects. It stores notes, tasks, and commands as Markdown-backed documents inside a `.flow` directory, uses `.flow/flow.yaml` for workspace configuration, and maintains a rebuildable derived index in `.flow/flow.index` for search and graph queries.

The system supports:

- local project workspaces and configurable global workspaces
- a `flow` CLI entrypoint
- a TUI for execution-oriented workflows
- a browser-based GUI served from a local loopback server with layered views for tasks and commands and a canvas view for notes
- a Go runtime that owns CLI, TUI, server, indexing, graph computation, and save flows

## Cross-Cutting Constraints

The following constraints apply across the system:

- Markdown files are the canonical source of truth.
- `.flow/flow.index` is derived, rebuildable, and may be recreated from Markdown files.
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

Build a local-first planning tool for Git repositories where every item is stored as a Markdown-backed document inside a `.flow` directory. The workspace configuration lives in `.flow/flow.yaml`, and a rebuildable derived index lives in `.flow/flow.index`.

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

- Store notes, tasks, and commands as Markdown files in `.flow`.
- Store workspace configuration in `.flow/flow.yaml`.
- Store a rebuildable derived index in `.flow/flow.index`.
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
- `flow init` creates `.flow/flow.yaml`, creates `.flow/.gitignore` for derived runtime files, and rebuilds `.flow/flow.index`.
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
- If `.flow/flow.index` is missing, search rebuilds it automatically from Markdown files.
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
- SQLite stored in `.flow/flow.index`
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
- `internal/config`: `.flow/flow.yaml` parsing and validation, including workspace GUI server port configuration
- `internal/markdown`: Markdown parsing, serialization, canonical paths, and frontmatter handling that stays close to the current design
- `internal/index`: `.flow/flow.index` rebuild, search, and graph projections using SQLite
- `internal/graph`: layer computation, note relationship views, and focused graph snapshots
- `internal/execution`: explicit command execution, environment resolution, process spawning, and GUI server lifecycle control
- `internal/httpapi`: embedded asset serving plus read/query APIs first, then mutation APIs later
- `internal/tui`: Go TUI flows built on the shared backend domain logic

Core architectural rule:

- Markdown files are canonical.
- `.flow/flow.index` is derived and rebuildable.
- UI state is transient.
- Save flows write Markdown first, then refresh the index.
- The browser GUI started as a read-only milestone to stabilize the backend query APIs before browser-side editing was introduced.

#### Data And Interfaces

Workspace layout:

- `.flow/flow.yaml`
- `.flow/flow.index`
- `.flow/features/<feature-slug>/notes/*.md`
- `.flow/features/<feature-slug>/tasks/*.md`
- `.flow/features/<feature-slug>/commands/*.md`

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

- GUI and TUI show graph lists grouped by `Notes`, `Tasks`, and `Commands`.
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
- Unit tests for `.flow/flow.yaml` parsing and validation
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

## Decision Log

- V1 GUI uses a loopback-only local server plus the user's browser instead of an embedded desktop shell.
- GUI server ports are configured per workspace and must fail fast on conflicts rather than auto-selecting a fallback port.
- Repeated `flow gui` launches may restart the server for the same workspace, while cross-workspace port conflicts remain hard errors.
- The runtime is rewritten in Go and ships as a single binary with an embedded browser frontend.
- The browser GUI uses React plus targeted supporting libraries, starts with note canvas and layered views, and now supports document update and delete flows in the side panel while richer editing remains deferred.
- `.flow/flow.index` remains the derived index file name and continues to use SQLite, with `modernc.org/sqlite` preferred for the Go implementation.
- CI release automation starts with `linux/amd64` binaries before broader platform coverage or CI test execution.

## Open Questions

- None recorded yet.
