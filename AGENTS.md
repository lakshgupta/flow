# Project Guidelines

## Default Workflow

- When the user does not explicitly choose a prompt, infer the correct stage of work and follow this project workflow: design, plan, implement or fix or refactor, test, review, then commit.
- Treat the single skill file [packaging/skills/flow/SKILL.md](packaging/skills/flow/SKILL.md) as the source of truth for stage-specific behavior even when the user does not invoke it explicitly.
- Reuse the matching skill section by default rather than reinterpreting the process from scratch.
- For record-keeping behavior, follow Section 1 of the skill file as the authoritative protocol when prompt wording differs.

## Stage Routing

Use the matching section of the single skill file [packaging/skills/flow/SKILL.md](packaging/skills/flow/SKILL.md):

- New feature design or behavior change: follow [Section 2.1 Design](packaging/skills/flow/SKILL.md)
- Feature planning and Flow task-node creation: follow [Section 2.2 Plan](packaging/skills/flow/SKILL.md)
- Feature implementation from Flow task nodes: follow [Section 2.3 Implement](packaging/skills/flow/SKILL.md)
- Issue fixing: follow [Section 2.4 Fix](packaging/skills/flow/SKILL.md)
- Behavior-preserving structural cleanup: follow [Section 2.5 Refactor](packaging/skills/flow/SKILL.md)
- Validation and test execution: follow [Section 2.6 Test](packaging/skills/flow/SKILL.md)
- Code review: follow [Section 2.7 Review](packaging/skills/flow/SKILL.md)
- Commit creation and Flow record sync: follow [Section 2.8 Commit](packaging/skills/flow/SKILL.md)
- Graph structure, node/edge engineering, and dependency ordering: follow [Section 3 Graph Engineering](packaging/skills/flow/SKILL.md)

## Flow Record Keeping

- Follow the [Flow skill](packaging/skills/flow/SKILL.md) for all record keeping: use Flow graph task/note nodes as the system of record for every phase of work.
- Store graph records under `.flow/data/content`.
- Design records must use `design/YYYYMMDD-NNN-<type>-<title>`.
- Planning and implementation records must use `development/YYYYMMDD-NNN-<type>-<title>`.
- Sub-graph naming pattern is mandatory: `YYYYMMDD-NNN-<type>-<title>` (for example `20260501-001-FEAT-parser-retry-budget`).
- `NNN` is the zero-padded incremental count of directories created on that date.
- For design updates, filter candidate nodes by title/description/tags first, then inspect body content.
- Define and maintain task dependencies with explicit `depends-on` links.
- Refer to [packaging/skills/flow/SKILL.md](packaging/skills/flow/SKILL.md) for the full CLI workflow and mandatory protocol.

## Persistent Rules

- Keep [docs/architecture.md](../docs/architecture.md) as the approved design source for feature work, including the arrangement and structure of UI components.
- For UI look and feel, refer to [docs/DESIGN.md](../docs/DESIGN.md) for visual language, component styling, and design guidelines.
- Keep Flow `design/YYYYMMDD-NNN-<type>-<title>` and `development/YYYYMMDD-NNN-<type>-<title>` sub-graphs and task/note nodes as the execution source of truth for planned feature work.
- Run relevant validation after code changes whenever feasible.
- Keep changes focused and prefer root-cause fixes over superficial patches.

## Stage Selection

- When the correct stage is unclear, ask the minimum question needed to determine whether the task is design, planning, implementation, fix, refactor, review, or commit work.
- If the user skips the stage name but the intent is clear, apply the corresponding skill workflow automatically.

## Build

This is a Go + React monorepo. The Go binary (`cmd/flow`) embeds frontend assets at build time.

### Build order (full build)

```bash
cd frontend && npm ci && npm run build && cd ..
go build ./cmd/flow
```

### Build frontend only

```bash
cd frontend && npm ci && npm run build
```

This writes generated files to `internal/httpapi/static/`. That directory is git-ignored (except `.gitkeep`). The `--serve-internal` flag is used by `flow service` to launch the HTTP server in a background child process; do not expose it to users or document it.

### Build Go binary only (skip frontend)

```bash
go build ./cmd/flow
```

Useful for CLI-only changes. The web UI will be broken until frontend is rebuilt.

### Version

`internal/buildinfo/VERSION` is the single source of truth (currently `0.5.0-dev`). The release CI validates the git tag against this file.

### Desktop build tags

The `internal/desktop` package uses build tags:
- `runner_wails.go` — `//go:build wails` (real Wails runtime)
- `runner_stub.go` — `//go:build !wails` (stub for CLI-only builds)

Desktop builds require `libwebkit2gtk-4.1-dev` on Linux. macOS needs no extra deps.

## Test

### Go tests

```bash
go test ./...
```

No special setup required. Tests create temp directories and do not depend on external services. Some desktop tests are Linux-specific (`*_test.go` with build tags).

### Frontend unit tests (vitest)

```bash
cd frontend && npm test
```

Test setup at `frontend/src/test/setup.ts` stubs `ResizeObserver`, `matchMedia`, and other browser APIs for jsdom.

### Frontend visual regression tests (Playwright)

```bash
cd frontend && npm run test:visual
```

Snapshot baselines live under `frontend/tests/visual-regression.spec.ts-snapshots/`. These require the GUI server running and may be flaky without proper display server setup.

### No CI test step

The CI workflows (release, installer-validation) do not run Go or frontend tests. They only validate the installer script and build release artifacts. Tests must be run locally.

## Architecture Notes

- **Markdown is the source of truth.** The SQLite index at `.flow/config/flow.index` is derived and rebuildable. Never treat index state as canonical.
- **Mutations write Markdown first, then refresh the index.** Never reverse this order.
- `internal/core/` is the shared orchestration layer (transport-agnostic). `cmd/flow/`, `internal/httpapi/`, and `internal/desktop/` are transport adapters only. Keep business logic in `internal/core/`.
- The React frontend at `frontend/` uses Vite, React 19, Tailwind CSS 4, and shadcn/ui. Component aliases use `@/` for `frontend/src/`.
- `skillcontent.go` at repo root embeds the whole `packaging/skills/` tree into the binary via `//go:embed`. The `flow skill list`, `flow skill content`, and `flow skill init` commands read from it.
- `internal/httpapi/static/` is git-ignored — it receives frontend build output. The Go binary embeds it with `embed.FS`.
