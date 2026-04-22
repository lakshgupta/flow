# Architecture

Flow is a local-first planning tool for software projects. It stores canonical workspace data as Markdown, derives searchable and queryable state into a rebuildable SQLite index, and exposes shared backend logic through a CLI, a TUI, and a browser-based GUI.

This document describes the current system architecture, its major components, its data model, and the operational constraints that shape implementation work.

## Overview

Flow is built around a small set of architectural rules:

- Markdown files are the source of truth.
- The SQLite index is derived state and can always be rebuilt from disk.
- Workspace behavior is local-first and does not depend on cloud services.
- The CLI, TUI, and GUI share the same backend concepts and storage model.
- UI interactions ultimately resolve to Markdown writes followed by index refreshes.

The primary user-facing model is a graph-oriented workspace composed of:

- a Home document for workspace-level context,
- graph documents for notes, tasks, and commands,
- hard dependencies for executable work,
- soft references for contextual relationships.

## System Architecture

### Runtime Topology

Flow ships as a single Go binary. That binary can:

- run CLI commands,
- render the TUI,
- start the GUI HTTP server,
- rebuild and query the index,
- execute command documents.

The browser GUI is served from embedded static frontend assets. The backend serves both the asset bundle and the loopback-only JSON APIs used by the React application.

### Technology Stack

- Backend: Go
- Frontend: React with TypeScript
- Index storage: SQLite via `modernc.org/sqlite`
- Graph and canvas rendering: `@xyflow/react`
- Rich document rendering and editing support: `markdown-it` and the frontend editor stack
- Delivery model: single binary with embedded frontend assets

### Workspace Modes

Flow supports both project-local and user-global workspaces.

- Local workspace: tied to a project directory and stored under that project's `.flow` directory.
- Global workspace: user-scoped workspace with the same document and index model.

Both modes use the same schema, document structure, and command semantics. They differ only in workspace resolution and GUI server ownership.

### Package Layout

- `cmd/flow`: CLI entrypoint and command dispatch
- `internal/workspace`: workspace resolution, filesystem paths, mutations, GUI server ownership
- `internal/config`: configuration parsing and validation
- `internal/markdown`: document parsing, frontmatter decoding, serialization, validation
- `internal/index`: index rebuild, search, graph projections, node views
- `internal/graph`: layered graph computation and graph snapshots
- `internal/execution`: command execution and environment overlay
- `internal/httpapi`: static asset serving and JSON API handlers
- `internal/tui`: terminal interface built on shared backend logic

## Data Architecture

### Canonical Storage Layout

Workspace state lives under `.flow`.

- `.flow/config/flow.yaml`: workspace configuration
- `.flow/config/flow.index`: rebuildable SQLite index
- `.flow/config/gui-server.json`: GUI server state
- `.flow/data/home.md`: workspace Home document
- `.flow/data/content/<graph-path>/*.md`: graph documents

Markdown files are authoritative. The index is generated from these files and never treated as canonical state.

### Document Model

Flow supports three graph document types plus the Home document.

- Note: contextual or knowledge-oriented content
- Task: dependency-driven work item
- Command: executable workflow step with environment and run metadata
- Home: workspace-level landing and summary content

Shared frontmatter fields:

- `id`
- `type`
- `graph`
- `title`
- `description`
- `tags`
- `createdAt`
- `updatedAt`

Type-specific fields:

- Task: `status`, `dependsOn`, `references`
- Command: `name`, `dependsOn`, `references`, `env`, `run`
- Note: `references`

### Relationship Model

Flow distinguishes between execution dependencies and contextual references.

- Hard links: same-type dependencies for tasks and commands via `dependsOn`
- Soft links: contextual references via `references`

References are stored inline in source-document frontmatter as objects:

```yaml
references:
  - node: task-1
    context: informs implementation order
```

A plain scalar shorthand is also supported and normalized as a reference with empty context.

This architecture keeps relationship data with the source document and avoids separate edge files as canonical storage.

### Graph Membership

Graph membership is determined by document location on disk.

- File location is authoritative when it disagrees with frontmatter.
- Graph documents are classified by frontmatter `type`, not by directory name alone.
- Empty graph directories may exist independently of document count.

### Derived Index

The SQLite index supports:

- full-text and structured search,
- graph projections,
- dependency queries,
- reference queries,
- node-centric read models used by the GUI and CLI.

The index is safe to rebuild at any time from Markdown.

## Component Architecture

### Backend Responsibilities

`internal/workspace`

- resolves local versus global roots,
- computes canonical workspace paths,
- owns document mutation flows,
- coordinates GUI server lifecycle.

`internal/markdown`

- parses Markdown and frontmatter into typed documents,
- serializes documents back to canonical Markdown,
- validates cross-document invariants.

`internal/index`

- rebuilds the SQLite index from Markdown,
- provides search and graph projections,
- exposes node-oriented read models for traversal and UI queries.

`internal/graph`

- computes layered views for dependency-driven work,
- produces graph snapshots consumed by the GUI.

`internal/execution`

- resolves command documents,
- validates dependency readiness,
- overlays environment variables,
- runs shell commands.

`internal/httpapi`

- serves embedded frontend assets,
- exposes JSON APIs for workspace reads and mutations,
- adapts backend models for the browser GUI.

`internal/tui`

- renders the terminal interface,
- reuses the same workspace, indexing, and execution layers.

### Frontend Responsibilities

The frontend is responsible for presentation and transient interaction state only.

Its primary concerns are:

- loading workspace and graph state from the HTTP API,
- rendering Home, graph canvas, search, calendar, and document views,
- collecting user edits,
- sending mutations back to the backend,
- reflecting refreshed backend state after saves and graph mutations.

The frontend does not own canonical persistence rules.

## External Interfaces

### CLI Surface

The CLI is the primary operational interface for workspace setup, search, document mutation, graph traversal, and execution.

Key command families include:

- workspace initialization and configuration,
- search and index rebuild,
- document and graph mutation,
- node-oriented read and mutation commands,
- command execution,
- GUI startup.

### HTTP API Surface

The GUI consumes a loopback-only HTTP API.

Read and query endpoints include:

- `GET /api/workspace`
- `GET /api/graphs`
- `GET /api/calendar-documents`
- `GET /api/graph-canvas`
- `GET /api/documents/:id`
- `GET /api/home`
- `GET /api/search`
- `GET /api/node-view`

Mutation endpoints include:

- `POST /api/documents`
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`
- `POST /api/documents/merge`
- `POST /api/references`
- `DELETE /api/references`
- `PUT /api/home`
- `PUT /api/graph-layout`
- `POST /api/graphs`
- `DELETE /api/graphs/:path`
- `PUT /api/workspace`
- `POST /api/gui/stop`

### Node-Oriented Read Model

Flow exposes a node-centric read shape for consumers that need to traverse workspace relationships without understanding file layout.

That read model includes:

- identity and document type,
- derived role information,
- body content,
- dependency references,
- contextual references,
- command execution metadata when present.

This is a system-level access pattern, not a separate storage format.

## Control Flow

### Initialization

`flow init` creates or validates workspace structure and rebuilds the index from Markdown. It must not rewrite existing canonical documents as part of initialization.

### Search

Search queries the index. If the index is missing, Flow rebuilds it before serving results.

### Save And Mutation Flow

Most mutations follow the same pattern:

1. load and validate workspace state,
2. parse and update the target document or graph state,
3. write Markdown or filesystem changes,
4. rebuild or refresh the derived index,
5. return updated read models to the caller.

This applies to document edits, Home edits, graph creation or deletion, relationship mutations, and merge operations.

### Graph View Flow

Graph and layer views are derived from indexed state rather than directly from ad hoc filesystem traversal. The GUI requests graph canvas data from the backend, which returns a projection suitable for rendering and interaction.

Notes use relationship-oriented views. Tasks and commands use dependency-aware layered views.

### Command Execution Flow

When executing a command document, Flow:

1. resolves the document,
2. checks prerequisite dependencies,
3. overlays configured environment variables,
4. launches the command through the shell runtime.

Execution is always grounded in workspace documents and configuration, not in separate runtime-only definitions.

### GUI Server Flow

The GUI server binds to a workspace-specific configured port on loopback. Startup fails on port conflict rather than silently rebinding. The browser UI is then served from embedded assets backed by the same workspace APIs.

## Constraints And Invariants

- Markdown files are canonical; the SQLite index is always derived.
- The index must remain rebuildable from disk without hidden state.
- `flow init` must not modify existing canonical document content.
- `flow search` must rebuild a missing index automatically.
- File location is authoritative for graph membership.
- Hard dependencies apply only to same-type executable work documents.
- Soft references never affect dependency readiness or graph layering.
- Notes are contextual and relationship-oriented rather than dependency-layered work.
- Tasks and commands are the only layered executable work types.
- Local and global workspaces share the same schema and command behavior.
- GUI server ports are configured per workspace and fail fast on conflict.
- Release automation targets Linux amd64 first.

## Testing Strategy

The system relies on layered validation:

- unit tests for Markdown parsing, validation, graph computation, and index logic,
- integration tests for CLI flows, HTTP handlers, server behavior, and workspace mutations,
- frontend tests for application-shell behavior and interaction regressions,
- build validation for the embedded frontend bundle.

Tests should validate canonical-state behavior first and treat the index and UI as projections of that state.

## Risks And Tradeoffs

- Markdown-first storage improves transparency and Git friendliness but requires careful parser and serializer discipline.
- A rebuildable SQLite index simplifies queries and search but introduces synchronization work after mutations.
- Serving a browser GUI from the Go binary reduces packaging complexity but splits presentation and backend implementation across different stacks.
- Supporting local and global workspaces increases flexibility while adding workspace-resolution and server-ownership complexity.
- Rich GUI interactions are easier to ship incrementally because backend state remains grounded in the document model.

## Related Documents

- [docs/design-language.md](design-language.md): UI design and styling rules
- [docs/backlog.md](backlog.md): planned and in-progress feature work

