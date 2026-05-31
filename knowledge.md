# Project Knowledge

## What Is This?

**Flow** is a local-first Markdown planning system. It's a Go application (Wails desktop + CLI + web service) with a React/TypeScript frontend. Canonical data is Markdown on disk; a SQLite index provides search/graph projections.

Three user surfaces share one backend:
- **CLI** (`cmd/flow/`) — command-oriented UX
- **Web service** (`flow service`) — embedded HTTP server + browser frontend
- **Desktop app** (`flow desktop`) — Wails v2 native window

## Commands

### Frontend (React/TypeScript)

```bash
cd frontend
npm ci                     # install dependencies
npm run dev                # Vite dev server on 127.0.0.1:5173
npm run build              # production build → ../internal/httpapi/static/
npm test                   # vitest unit tests (jsdom)
npm run test:visual        # Playwright e2e tests (starts own dev server on :5174)
```

### Go Backend

```bash
go build ./cmd/flow        # build binary
go test ./...              # run all Go tests
./flow version             # print version
./flow service             # start web service
./flow desktop             # start desktop app
```

### Release Builds

```bash
bash scripts/build-release.sh linux amd64           # production binary
bash scripts/build-package-linux.sh amd64           # .deb package
FLOW_SKIP_FRONTEND_BUILD=1 bash scripts/build-release.sh darwin arm64  # macOS
```

## Key Directories

```
cmd/flow/                  Go CLI entrypoint
internal/
  core/                    surface-independent orchestration & mode parsing
  workspace/               workspace discovery, filesystem mutations
  markdown/                frontmatter/body parse, validate, serialize
  index/                   SQLite-derived index (search, graph trees, canvas)
  graph/                   graph/layer composition
  httpapi/                 loopback JSON API + static asset serving
  execution/               command execution planning & shell runtime
  config/                  workspace config read/write
  desktop/                 Wails runtime adapter (build-tag seams for stub vs real)
frontend/src/
  App.tsx                  main app shell & orchestration
  components/              UI components (editor, graph canvas, sidebar, etc.)
  components/editor/       ProseKit-based rich text editor
  hooks/                   React hooks (sidebar, canvas, thread panel actions)
  lib/                     utilities (api.ts, imageUploader.ts, richText.ts)
  styles.css               Tailwind v4 global styles
frontend/tests/            Playwright e2e tests
docs/                      architecture, build, reference docs
.agents/skills/            agent skill files (design, implement, fix, etc.)
packaging/                 Linux .deb & macOS .dmg manifests + SKILL.md protocol
scripts/                   build/release/install shell scripts
.flow/                     Flow's own workspace (yes, Flow eats its own dogfood)
```

## Architecture Highlights

- **Markdown is source of truth.** SQLite index is derived, always rebuildable.
- **Frontend builds into `internal/httpapi/static/`** — Go binary embeds these at build time.
- **HTTP API** is the frontend's only interface; no direct filesystem access from frontend.
- **Workspace modes:** local (`.flow/` in project root) and global (user config directory). Both use the same domain logic.
- **Graph membership is filesystem-driven.** A file at `.flow/data/content/foo/bar.md` belongs to graph `foo/bar`.
- **Mutations write Markdown first, then refresh derived index state.**
- **Desktop (Wails) reuses the same backend & HTTP API** as the web service. The desktop adapter (`internal/desktop/`) provides build-tag seams between stub and Wails runtime.

## Frontend Conventions

- **`@/` path alias** maps to `frontend/src/` (vite + tsconfig).
- **Tailwind v4** with `@tailwindcss/vite` plugin. No tailwind.config.js.
- **shadcn/ui** components live under `src/components/ui/`, using `tabler` icon library.
- **ProseKit** rich text editor with custom image view and upload handler.
- **Vitest** for unit tests (jsdom), **Playwright** for e2e tests.
- **TypeScript strict mode**, React 19, Vite 6.
- Tests import from `vitest` and use `vi.fn()` / `vi.stubGlobal()` patterns.

## Gotchas & Constraints

### Wails Desktop — Image Upload
The Wails v2 asset server cannot handle multipart/form-data POST requests. Image uploads in desktop mode bypass HTTP and call `window.go.main.App.UploadFile()` directly via a Go-JS binding. The binary file content must be base64-encoded as a **string** (not `number[]`) because Go's `json.Unmarshal` expects `[]byte` as a base64 JSON string.

When converting binary → base64 for Wails upload: **do not use `TextDecoder('latin1')`** — that encoding label is unsupported in WebKitGTK (Linux Wails). Use chunked `String.fromCharCode` instead:
```typescript
const CHUNK_SIZE = 0x8000
let binary = ''
for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
  binary += String.fromCharCode(...uint8Array.subarray(i, i + CHUNK_SIZE))
}
const base64 = btoa(binary)
```

### TypeScript Version
The `tsconfig.json` uses `"ignoreDeprecations": "6.0"` which causes TS5103 errors on newer TypeScript. This is pre-existing and safe to ignore during local typechecks.

### Frontend Build Before Go Build
Always run `npm run build` before `go build` for production binaries — the Go binary embeds the generated static assets. The `prebuild` script in `package.json` auto-syncs the version.

### Playwright Dev Server
Playwright tests use port 5174 (separate from the Vite dev server on 5173). The Playwright config auto-starts this when running tests.

### No Committed Build Artifacts
`internal/httpapi/static/` is git-ignored (except `.gitkeep`). Generated files should never be committed.

## Agent Workflow

This project uses a stage-based workflow via `.agents/skills/`:
1. **design** → feature proposal & architecture.md update
2. **plan** → create Flow task nodes
3. **implement** → code from task nodes
4. **fix** → bug fixes
5. **refactor** → behavior-preserving cleanup
6. **test** → validation & test execution
7. **review** → code review
8. **commit** → commit + Flow record sync

All phases recorded in `.flow/data/content/` as Flow task/note nodes. Sub-graph naming: `YYYYMMDD-NNN-<type>-<title>`.
