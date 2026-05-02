# Architecture

Flow is a local-first planning system for software work. Canonical data is stored as Markdown in the workspace. Query, graph, and UI read models are derived into a rebuildable SQLite index and exposed through a shared backend used by both CLI and GUI.

This document is intentionally high level and describes the architecture currently implemented in code.

## Design Principles

- Markdown is the source of truth.
- The index is derived state and can be rebuilt from disk.
- Local and global workspace modes share the same domain model and behavior.
- CLI and GUI are two interfaces over the same backend workflows.
- Mutations write canonical Markdown first, then refresh derived index state.

## System Context

Flow ships as a Go application with two user-facing interfaces:

- CLI (`cmd/flow`) for initialization, query, mutation, graph operations, and command execution.
- GUI (`flow gui`) served by an embedded HTTP server on loopback, with a React frontend consuming JSON APIs.

High-level runtime shape:

1. User acts through CLI or GUI.
2. Backend reads/writes Markdown under `.flow/data`.
3. Backend rebuilds or updates the SQLite index under `.flow/config/flow.index`.
4. Query and visualization responses are returned from index-backed read models.

## Deployment Model

Flow is distributed as a single Go binary that embeds frontend assets.

- Frontend bundles are generated into `internal/httpapi/static/` at build/release time.
- Those generated bundle files are intentionally git-ignored (except a placeholder file).
- The backend embeds `internal/httpapi/static` and serves it through `internal/httpapi`.

This keeps runtime packaging simple while preserving a clean source repository boundary between code and generated artifacts.

## Workspace Architecture

Canonical workspace layout:

- `.flow/config/flow.yaml`: workspace configuration
- `.flow/config/flow.index`: derived SQLite index
- `.flow/config/gui-server.json`: GUI runtime state metadata
- `.flow/data/home.md`: Home document
- `.flow/data/content/<graph-path>/*.md`: note/task/command documents

Workspace modes:

- Local mode resolves `.flow` relative to a project workspace.
- Global mode resolves a user-level workspace path.

Both modes use the same document schema, indexing rules, and API behavior.

## Domain Model

Primary document types:

- Home: workspace landing and context
- Note: knowledge/context nodes
- Task: status-based work nodes with dependencies and relationships
- Command: executable nodes with `name`, `env`, and `run`

Relationships:

- Canonical frontmatter links (`links`) are persisted in Markdown.
- Inline body references (`[[...]]`) are parsed and resolved into derived index relationships (`soft_references`).

Graph membership and pathing are filesystem-driven. The graph tree and canvas views are derived read models, not canonical stores.

## Derived Index Architecture

The index package (`internal/index`) owns all derived-state persistence and retrieval concerns.

It provides:

- full-text and filtered search,
- graph tree and graph canvas projections,
- layered task/command views,
- node-centric read models,
- inline reference resolution and reverse lookups,
- persisted GUI projection state (graph layout positions/viewports and workspace GUI settings).

The index schema is designed so rebuild from Markdown is always possible without hidden canonical data in SQLite.

## Component Responsibilities

Backend components:

- `cmd/flow`: command parsing, mode resolution, process orchestration
- `internal/workspace`: workspace discovery, filesystem mutations, path contracts
- `internal/markdown`: frontmatter/body parse, validate, serialize
- `internal/index`: derived schema, rebuild, query, projection APIs
- `internal/graph`: graph/layer composition used by index and API read models
- `internal/httpapi`: loopback JSON API and static asset serving
- `internal/execution`: command execution planning and environment overlay
- `internal/config`: workspace config read/write and defaults

Frontend components:

- application shell and layout
- document editor and properties UI
- graph canvas and graph tree visualization
- workspace/search/reference interaction surfaces

The frontend owns transient interaction state. Canonical persistence and invariants are enforced in backend packages.

## External Interfaces

CLI interface:

- workspace init/configuration,
- document and graph mutation,
- search and node-oriented queries,
- command execution,
- GUI lifecycle commands.

HTTP API interface (`internal/httpapi`):

- workspace/home/document/graph read and mutation endpoints,
- graph canvas and layout persistence endpoints,
- search and node view endpoints,
- reference target lookup and GUI control endpoints.

The GUI exclusively uses this API surface; no direct frontend filesystem access exists.

## Core Flows

Initialization and startup:

1. Resolve workspace (local/global).
2. Ensure required directories/files exist.
3. Build or verify index availability.

Mutation flow (CLI and GUI):

1. Validate request and current document shape.
2. Write canonical Markdown/filesystem changes.
3. Refresh affected derived index state.
4. Return updated read models.

GUI flow:

1. Start loopback HTTP server on configured per-workspace port.
2. Serve embedded static frontend.
3. Frontend performs API-driven reads/mutations.

Execution flow:

1. Resolve command node by id/name.
2. Build effective environment from process + command overrides.
3. Execute through shell command runtime.

## Architectural Invariants

- Canonical state is always Markdown on disk.
- Any index record must be derivable from canonical files.
- Missing index files are recoverable by rebuild.
- Workspace behavior is deterministic across local/global modes.
- API and CLI mutations must preserve Markdown schema validity.
- GUI state persistence (layout/appearance) is auxiliary and non-canonical.

## Quality Strategy

Validation is layered across:

- package-level tests for markdown/index/graph/workspace logic,
- API handler and server tests,
- CLI tests for command behavior,
- frontend component and behavior tests.

This keeps canonical-state correctness and projection correctness testable in isolation.

## Related Documents

- [docs/DESIGN.md](DESIGN.md)
- [docs/reference.md](reference.md)
- [README.md](../README.md)

