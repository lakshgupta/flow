# Architecture

Flow is a local-first planning system for software work. Canonical data is stored as Markdown in the workspace. Query, graph, and UI read models are derived into a rebuildable SQLite index and exposed through a shared backend used by CLI, service, and desktop surfaces.

This document is intentionally high level and describes the architecture currently implemented in code.

## Design Principles

- Markdown is the source of truth.
- The index is derived state and can be rebuilt from disk.
- Local and global workspace modes share the same domain model and behavior.
- CLI, service, and desktop are interfaces over the same backend workflows.
- Mutations write canonical Markdown first, then refresh derived index state.

## System Context

Flow ships as a Go application with three user-facing interfaces:

- CLI (`cmd/flow`) for initialization, query, mutation, graph operations, and command execution.
- Web service (`flow service`) served by an embedded HTTP server on loopback, with a React frontend consuming JSON APIs.
- Desktop (`flow desktop`) powered by Wails, reusing the same backend workflows.

High-level runtime shape:

1. User acts through CLI, service UI, or desktop UI.
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
- persisted UI projection state (graph layout positions/viewports and workspace UI settings).

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
- `internal/core`: shared surface-independent orchestration and mode parsing (`cli`, `server`, `desktop`)
- `internal/desktop`: desktop transport adapter and Wails runtime integration

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
- service and desktop lifecycle commands.

HTTP API interface (`internal/httpapi`):

- workspace/home/document/graph read and mutation endpoints,
- graph canvas and layout persistence endpoints,
- search and node view endpoints,
- reference target lookup and UI control endpoints.

Both the service frontend and desktop frontend use this API surface; no direct frontend filesystem access exists.

## Multi-Surface Runtime (CLI, Service, Desktop)

Flow ships with three user-facing surfaces sharing one backend logic layer:

- CLI: `flow` runs command-oriented UX.
- Service: `flow service` / `flow service stop` manages the embedded HTTP server and opens the browser.
- Desktop: `flow desktop` / `flow desktop stop` manages the Wails-based desktop app window.

Current implementation status:

- A shared mode dispatcher lives in `internal/core/mode.go` and is used by `cmd/flow/main.go`.
- `service` launches a background child process with `--serve-internal` and opens the browser on startup.
- `desktop` resolves local/global workspace scope, ensures workspace baseline files/index through shared `internal/workspace` bootstrap, and prepares a shared `desktop.Backend` runtime context with reusable read/write methods.
- workspace switching rebuilds the selected workspace index before returning workspace/graph responses, so service and desktop surfaces both reflect external on-disk graph and node changes.
- Build-tag seams in `internal/desktop` separate default stub behavior from the Wails runtime.

Target package split for shared business logic:

- `internal/core`: use-case orchestration and contracts (transport-agnostic)
- `internal/httpapi`: HTTP transport adapters only
- `cmd/flow`: CLI transport adapters only
- `internal/desktop`: Wails transport adapters only

This keeps mutations and read workflows centralized and prevents business-logic duplication across surfaces.

## Core Flows

Initialization and startup:

1. Resolve workspace (local/global).
2. Ensure required directories/files exist.
3. Build or verify index availability.

Mutation flow (CLI and UI surfaces):

1. Validate request and current document shape.
2. Write canonical Markdown/filesystem changes.
3. Refresh affected derived index state.
4. Return updated read models.

Service/Desktop UI flow:

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
- UI state persistence (layout/appearance) is auxiliary and non-canonical.

## Development Workflow & Agent Skills

Flow's own development follows a stage-based workflow with behavior governed by skill files under `.agents/skills/`. The default workflow order is: design, plan, implement or fix or refactor, test, review, commit.

### Skill Directory Structure

```
.agents/skills/
  design/SKILL.md     — Feature design proposal and architecture.md update workflow
  plan/SKILL.md       — Feature planning and Flow task-node creation
  implement/SKILL.md  — Feature implementation from Flow task nodes
  fix/SKILL.md        — Issue fixing workflow
  refactor/SKILL.md   — Behavior-preserving structural cleanup
  test/SKILL.md       — Validation and test execution
  review/SKILL.md     — Code review workflow
  commit/SKILL.md     — Commit creation and Flow record sync
```

Each skill file is a self-contained Markdown document with YAML frontmatter (`name`, `description`, `user-invocable`, `allowed-tools`, `argument-hint`) followed by the full stage-specific workflow instructions.

Key related files:

- `AGENTS.md` — Project-level routing table that maps work stages to skill files and defines persistent rules
- `packaging/SKILL.md` — Flow CLI record-keeping protocol, embedded at build time into the flow binary via `skillcontent.go`
- `skills-lock.json` — Lock file tracking installed skills with their source type and hash

### Stage Routing

`AGENTS.md` serves as the routing table. When a user request does not explicitly name a stage, the agent infers the correct stage and applies the matching skill file:

- New feature design → design skill
- Feature planning with task nodes → plan skill
- Feature implementation from task nodes → implement skill
- Bug fixes → fix skill
- Structural cleanup without behavior change → refactor skill
- Test execution and validation → test skill
- Code review → review skill
- Commit and Flow record sync → commit skill

### Flow Record Keeping

All phases of work are recorded in the Flow workspace itself — task and note nodes in `.flow/data/content/` serve as the system of record. The `packaging/SKILL.md` skill is embedded into the flow binary and provides the full CLI workflow and mandatory protocol for record keeping. Sub-graph naming follows the pattern `YYYYMMDD-NNN-<type>-<title>` with explicit `depends-on` dependency links between task nodes.

## Quality Strategy

Validation is layered across:

- package-level tests for markdown/index/graph/workspace logic,
- API handler and server tests,
- CLI tests for command behavior,
- frontend component and behavior tests.

This keeps canonical-state correctness and projection correctness testable in isolation.

## Related Documents

- [docs/DESIGN.md](DESIGN.md)
- [docs/build.md](build.md)
- [docs/reference.md](reference.md)
- [docs/release.md](release.md)
- [README.md](../README.md)
- [AGENTS.md](../AGENTS.md)
- [packaging/SKILL.md](../packaging/SKILL.md)

