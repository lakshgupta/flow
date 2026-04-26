# Architecture

Flow is a local-first planning tool for software projects. It stores canonical workspace data as Markdown, derives searchable and queryable state into a rebuildable SQLite index, and exposes shared backend logic through a CLI, a TUI, and a browser-based GUI.

This document describes the architecture that is implemented today and separates approved but not yet implemented design work into its own section.

## Index

- [Overview](#overview)
- [Runtime Architecture](#runtime-architecture)
- [Storage And Data Model](#storage-and-data-model)
- [Component Responsibilities](#component-responsibilities)
- [External Interfaces](#external-interfaces)
- [Control Flow](#control-flow)
- [Constraints And Invariants](#constraints-and-invariants)
- [Testing And Validation](#testing-and-validation)
- [Risks And Tradeoffs](#risks-and-tradeoffs)
- [Planned Architecture: Inline References And Thread View](#planned-architecture-inline-references-and-thread-view)
- [Related Documents](#related-documents)

## Overview

Flow is built around a small set of architectural rules:

- Markdown files are the source of truth.
- The SQLite index is derived state and can always be rebuilt from disk.
- Workspace behavior is local-first and does not depend on cloud services.
- The CLI, TUI, and GUI share the same backend concepts and storage model.
- UI interactions resolve to Markdown writes followed by index refreshes.

The primary user-facing model today is a graph-oriented workspace composed of:

- a Home document for workspace-wide context,
- graph documents for notes, tasks, and commands,
- hard dependencies for executable work,
- contextual document relationships stored as metadata links,
- graph and canvas relationships rendered to the GUI as links.

## Runtime Architecture

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
- Rich document editing support: the frontend editor stack with Markdown round-tripping
- Delivery model: single binary with embedded frontend assets

### Workspace Modes

Flow supports both project-local and user-global workspaces.

- Local workspace: tied to a project directory and stored under that project's `.flow` directory.
- Global workspace: user-scoped workspace with the same document and index model.

Both modes use the same schema, document structure, and command semantics. They differ only in workspace resolution and GUI server ownership.

## Storage And Data Model

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

- Note: `links`
- Task: `status`, `links`
- Command: `name`, `links`, `env`, `run`

Document bodies are stored as plain Markdown strings. The current implementation does not yet parse or persist inline `[[...]]` body references as a first-class architecture feature.

### Relationship Model

Flow currently uses two relationship forms.

- Metadata links: contextual relationships stored in document frontmatter under `links`.
- Derived graph links: note graph relationships and canvas edges exposed to the GUI as links.

Metadata links are stored with the source document in canonical Markdown, for example:

```yaml
links:
  - node: task-1
    context: informs implementation order
```

A plain scalar shorthand is also supported and normalized to the same shape.

The browser-facing document API exposes these contextual relationships through a `links` field. Notes also derive related-note relationships through the indexed note graph.

### Graph Membership

Graph membership is determined by document location on disk.

- File location is authoritative when it disagrees with frontmatter.
- Graph documents are classified by frontmatter `type`, not by directory name alone.
- Empty graph directories may exist independently of document count.

### Derived Index

The SQLite index supports:

- full-text and structured search,
- graph projections and canvas snapshots,
- dependency queries,
- metadata reference queries,
- node-oriented read models,
- command lookup and environment projection,
- persisted graph layout positions.

At a schema level the index separates concerns into dedicated tables such as hard dependencies, soft references, note links, graph edges, command lookup data, and graph layout positions. The index is safe to rebuild at any time from Markdown.

## Component Responsibilities

### Backend Packages

- `cmd/flow`: CLI entrypoint and command dispatch.
- `internal/workspace`: workspace resolution, filesystem paths, document mutations, GUI server ownership.
- `internal/config`: configuration parsing and validation.
- `internal/markdown`: document parsing, frontmatter decoding, serialization, and validation.
- `internal/index`: index rebuild, search, graph projections, and node views.
- `internal/graph`: layered graph computation and graph snapshots.
- `internal/execution`: command execution and environment overlay.
- `internal/httpapi`: static asset serving and JSON API handlers.
- `internal/tui`: terminal interface built on shared backend logic.

### Frontend Responsibilities

The frontend is responsible for presentation and transient interaction state.

Its current responsibilities are:

- loading workspace, home, graph tree, calendar, search, graph canvas, and document state from the HTTP API,
- rendering the Home surface and graph workspace surfaces,
- opening a selected document either in the center surface or the right rail,
- editing document bodies and frontmatter-backed properties,
- presenting outgoing and incoming link summaries for the selected document,
- collecting user edits and persisting them through backend mutations,
- reflecting refreshed backend state after saves, deletions, merges, and graph mutations.

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

Read and query endpoints currently include:

- `GET /api/workspace`
- `GET /api/graphs`
- `GET /api/calendar-documents`
- `GET /api/graph-canvas`
- `GET /api/documents/:id`
- `GET /api/home`
- `GET /api/search`
- `GET /api/node-view`

Mutation endpoints currently include:

- `POST /api/documents`
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`
- `POST /api/documents/merge`
- `POST /api/links`
- `PATCH /api/links`
- `DELETE /api/links`
- `PUT /api/home`
- `POST /api/graphs`
- `PATCH /api/graphs/:path`
- `DELETE /api/graphs/:path`
- `PUT /api/graph-layout`
- `PUT /api/workspace`
- `POST /api/gui/stop`

`POST`, `PATCH`, and `DELETE /api/links` mutate the source document's canonical frontmatter links and then refresh the derived read models returned to the GUI.

### Node-Oriented Read Model

Flow exposes a node-centric read shape for consumers that need to traverse workspace relationships without understanding file layout.

The current node view includes:

- identity and document type,
- derived role information,
- graph membership,
- body content,
- hard dependencies,
- internal `links` lists,
- command execution metadata when present,
- inbound and outbound edge summaries.

This is a system-level access pattern, not a separate storage format.

## Control Flow

### Initialization And Index Maintenance

`flow init` creates or validates workspace structure and rebuilds the index from Markdown. It must not rewrite existing canonical documents as part of initialization.

`flow search` and other index-backed reads rebuild a missing index before serving results.

### Document Mutation Flow

Most document mutations follow the same pattern:

1. load and validate workspace state,
2. parse and update the target document,
3. write Markdown or filesystem changes,
4. rebuild or refresh the derived index,
5. return updated read models to the caller.

This applies to document edits, Home edits, graph creation or deletion, and merge operations.

### Relationship Mutation Flow

Relationship mutations use the `/api/links` surface in the GUI, but they persist by rewriting the source document's frontmatter links in canonical Markdown.

After the write completes, Flow refreshes the index so document responses, graph views, and node views stay consistent.

### Graph View Flow

Graph and layer views are derived from indexed state rather than direct ad hoc filesystem traversal. The GUI requests graph canvas data from the backend, which returns a projection suitable for rendering and interaction.

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
- Notes are contextual and relationship-oriented rather than dependency-layered work.
- Local and global workspaces share the same schema and command behavior.
- GUI server ports are configured per workspace and fail fast on conflict.
- The browser-facing document contract uses `links` for stored node-to-node relationships.

## Testing And Validation

The system relies on layered validation:

- unit tests for Markdown parsing, validation, graph computation, and index logic,
- integration tests for CLI flows, HTTP handlers, server behavior, and workspace mutations,
- frontend tests for application-shell behavior, graph interaction, document editing, and properties-panel behavior,
- build validation for the embedded frontend bundle.

Tests should validate canonical-state behavior first and treat the index and UI as projections of that state.

## Risks And Tradeoffs

- Markdown-first storage improves transparency and Git friendliness but requires careful parser and serializer discipline.
- A rebuildable SQLite index simplifies queries and search but introduces synchronization work after mutations.
- Serving a browser GUI from the Go binary reduces packaging complexity but splits presentation and backend implementation across different stacks.
- Supporting local and global workspaces increases flexibility while adding workspace-resolution and server-ownership complexity.
- Stored node-to-node relationships now use `links` consistently across canonical Markdown, the backend API, and the GUI.
- Rich text editing is easier to evolve because canonical state remains Markdown, but round-trip fidelity must be preserved carefully.

## Planned Architecture: Inline References And Thread View

Status: approved design, not implemented as of April 25, 2026.

The next planned relationship feature is a separate body-reference model for note, task, and command content. In that model, graph-connected nodes remain links, while inline `[[<node breadcrumb>]]` tokens inside document bodies become references.

The approved design introduces:

- inline `[[<node breadcrumb>]]` authoring in document bodies,
- autocomplete after the `[[` trigger,
- hyperlink-like rendering for resolved body references,
- a thread-view navigation mode that preserves followed reference paths.

Implementing that design will require architectural changes beyond the current system:

- parser and editor support for canonical inline reference tokens,
- derived index support for resolved body references and backlinks,
- a dedicated reference-target lookup API,
- rename flows that rewrite breadcrumb-based body references,
- frontend navigation state that can manage a thread stack instead of a single selected document surface.

That work should extend the current architecture rather than redefine it. Until it lands, canonical Markdown stores node-to-node relationships in frontmatter `links`, and `references` remain reserved for the planned body-reference model.

## Related Documents

- [docs/design-language.md](design-language.md): UI design and styling rules
- [docs/backlog.md](backlog.md): planned and in-progress feature work

