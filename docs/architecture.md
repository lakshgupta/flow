# Architecture

> **One sentence:** Flow is a local-first workspace where Markdown is the source of truth, a rebuildable SQLite index powers search/graph/UI, and CLI, web service, and desktop all share the same backend.

This doc is the **current, code-accurate** overview. For how to build/release, see `build.md` / `release.md`; for UI styling, see `DESIGN.md`.

---

## How to read this

1. **New to Flow?** → Start with [Design Principles](#design-principles) and [System Context](#system-context).
2. **Need to change code?** → Jump to [Component Responsibilities](#component-responsibilities) + [Multi-Surface Runtime](#multi-surface-runtime-cli-service-desktop).
3. **Working on graphs/presentation/editor?** → Go to [Graph Operations](#graph-operations) or [Presentation Mode](#presentation-mode).

> **Index**
> [Principles](#design-principles) · [Context](#system-context) · [Deployment](#deployment-model) · [Workspace](#workspace-architecture) · [Domain](#domain-model) · [Index](#derived-index-architecture) · [Components](#component-responsibilities) · [Interfaces](#external-interfaces) · [Runtime](#multi-surface-runtime-cli-service-desktop) · [Flows](#core-flows) · [Graphs](#graph-operations) · [Presentation](#presentation-mode) · [Editor & UI](#editor-interaction--thread-ui) · [Invariants](#architectural-invariants) · [Workflow](#development-workflow--agent-skills)

---

## Design Principles

| Principle | What it means in code |
|---|---|
| **Markdown is canonical** | Every note/task/command lives as `*.md` under `.flow/data`. Nothing hides in SQLite. |
| **Index is derived & rebuildable** | `.flow/config/flow.index` can be deleted and rebuilt from Markdown. |
| **One domain, three shells** | `internal/core` holds business logic; `cmd/flow`, `internal/httpapi`, `internal/desktop` are thin adapters. |
| **Write Markdown first** | Mutations → validate → write file → refresh index → return read model. |

---

## System Context

```text
  CLI (cmd/flow) ──┐
                    ├─► Backend (Markdown ↔ SQLite index) ──► .flow/data + .flow/config/flow.index
  Service (browser) ┤          ▲
                    │          │  JSON API (internal/httpapi)
  Desktop (Wails) ──┘          └──► React frontend (frontend/src)
```

*User → CLI / browser / desktop → backend reads/writes Markdown → index rebuild/update → response from index.*

---

## Deployment Model

**One binary per platform, frontend embedded.**

| Step | Detail |
|---|---|
| **Frontend build** | `frontend/` (Vite + React) → `internal/httpapi/static/assets/*` + `index.html` (git-ignored, except `.gitkeep`). |
| **Version** | `internal/buildinfo/VERSION` is the source; `scripts/sync-frontend-version.sh` syncs `frontend/package.json`; `-ldflags -X main.version=$VERSION` stamps the binary. |
| **Binary** | `go build ./cmd/flow` embeds `internal/httpapi/static` via `embed.FS` and serves it through `internal/httpapi`. |

### Release artifacts (binary-only)

No Apple signing, no `.deb`/`.dmg`. Built by `scripts/build-release.sh <os> <arch>` and `.github/workflows/release.yml`:

| Target | Archive | Contents |
|---|---|---|
| `linux/amd64` | `flow-<ver>-linux-amd64.tar.gz` | `flow` + `LICENSE` |
| `darwin/amd64` | `flow-<ver>-darwin-amd64.tar.gz` | `flow` + `LICENSE` |
| `darwin/arm64` | `flow-<ver>-darwin-arm64.tar.gz` | `flow` + `LICENSE` |
| `windows/amd64` | `flow-<ver>-windows-amd64.zip` | `flow.exe` + `LICENSE` |
| `windows/arm64` | `flow-<ver>-windows-arm64.zip` | `flow.exe` + `LICENSE` |

Each archive has a `.sha256`. Published alongside: `install.sh` (=`scripts/install.sh`) and `flow-install.sh` (root copy).

**Installers:** auto-detect `OS/arch` (`FLOW_TARGET_OS`/`FLOW_TARGET_ARCH` override), pick `tar.gz` vs `zip`, verify SHA-256, install to `FLOW_INSTALL_DIR` (default `~/.local/bin`, `flow.exe` on Windows), and warn/hint if `INSTALL_DIR` is not on `PATH` (PowerShell `setx`, Bash/Zsh rc).

### Platform notes

* **Linux:** needs `libwebkit2gtk-4.1-dev` + `build-essential`; build tags `wails,production,webkit2_41`.
* **macOS:** WebKit is system-provided; tags `wails,production` + `UniformTypeIdentifiers` framework.
* **Windows:** CLI-only cross-compile from Linux (`CGO_ENABLED=0`, `production` only, no Wails) → `flow.exe`. Avoids `mingw` while keeping service/CLI.
* **CI:** `build-frontend` builds assets once → `build-binary` matrix (5 targets: Linux on `ubuntu-latest`, macOS on `macos-latest`, Windows on `ubuntu-latest`) → `publish-release` via `softprops/action-gh-release`. Validation workflow dry-runs all targets.

> Legacy `packaging/linux/nfpm.yaml`, `packaging/macos/Info.plist`, `scripts/build-package-*.sh` stay in-repo for experiments only — not used by CI.

---

## Workspace Architecture

```text
.flow/
  config/
    flow.yaml        # workspace settings (host/projects per alias)
    flow.index       # derived SQLite — deletable
    gui-server.json  # GUI runtime state
    flow.index.tmp   # rebuild scratch
    credentials      # per-workspace API tokens (0600, git-ignored, e.g. jira:default, jira:j1)
  logs/              # per-workspace logs, 15-day rotation
  data/
    home.md          # Home document
    content/
      design/YYYYMMDD-NNN-<type>-<title>/*.md
      development/YYYYMMDD-NNN-<type>-<title>/*.md
      external/jira/<PROJECT>/*.md  # read-only mirrors from `flow sync` (git-ignored in practice via per-workspace credentials)
```

* **Local vs Global:** same schema and behavior. Local resolves `.flow` next to the project; Global resolves the user-level path configured via `flow -g configure --workspace`.
* Both modes share discovery, indexing, and API contracts.

---

## Domain Model

| Type | Stored as | Key fields |
|---|---|---|
| **Home** | `.flow/data/home.md` | `id=home`, `type=home`, `title`, `description` |
| **Note** | `content/<graph>/*.md` | `title`, `description`, `tags`, `links[]`, `createdAt/updatedAt` |
| **Task** | `content/<graph>/*.md` | + `status` (`Ready`→`Running`→`Done`/`Success`/`Failed`/`Interrupted`), `session`/`session-at` (claim) |
| **Command** | `content/<graph>/*.md` | + `name` (unique), `env{}`, `run` (shell string) |

**Relationships**

* `links: [id]` in frontmatter → canonical edges.
* `[[...]]` in body → parsed into `soft_references` (derived, not canonical).
* Graph membership = filesystem path (`development/parser/build.md` ∈ `development/parser`, even if frontmatter disagrees). Graph tree/canvas are derived views.

---

## Derived Index Architecture

`internal/index` owns the rebuildable SQLite index (`.flow/config/flow.index`).

**Provides:**

* full-text + filtered search
* graph tree & canvas projections
* layered task/command views
* node-centric reads, edge/neighbor lookups
* inline `[[...]]` → soft-reference resolution + reverse lookups
* UI projection state (canvas positions, viewports, panel widths)

> Invariant: if you delete `flow.index`, `flow` rebuilds it from Markdown with no data loss.

---

## Component Responsibilities

### Backend

| Package | Role |
|---|---|
| `cmd/flow` | CLI parsing, mode resolution, process orchestration |
| `internal/workspace` | Discovery, filesystem mutations, path contracts |
| `internal/markdown` | Parse/validate/serialize frontmatter + body |
| `internal/index` | Schema, rebuild, queries, projections |
| `internal/graph` | Layering/composition for index & API |
| `internal/httpapi` | Loopback JSON API + static serving (embeds `static/`) |
| `internal/execution` | Env overlay + shell execution for commands |
| `internal/config` | `flow.yaml` read/write & defaults (including `integrations.jira.<alias>` / `aha.<alias>` map) |
| `internal/credentials` | Per-workspace `credentials` (0600) read/write for `jira`/`aha` tokens per alias, `FLOW_*_TOKEN` env fallback |
| `internal/core` | **Shared orchestration** — `cli`/`server`/`desktop` agnostic |
| `internal/desktop` | Wails adapter: `runner.go`, `runner_wails.go` (`//go:build wails`) vs `runner_stub.go` (`!wails`), `backend.go`/`app.go`, `icon_*`/`linux_integration.go` |
| `internal/buildinfo` | `VERSION` constant |
| `scripts/*` | `build-release.sh`, `lib/version.sh`/`checksums.sh`, `sync-frontend-version.sh`, `install.sh`/`flow-install.sh` |

### Frontend (`frontend/src`)

| Area | Key files |
|---|---|
| Shell & layout | `App.tsx`, `MiddleContent.tsx`, `GraphCanvasSurface.tsx`, `ThreadPanels.tsx` |
| Editor & properties | `components/editor/RichTextEditor.tsx`, `DocumentEditorPane.tsx` |
| Graph visuals | `GraphTree.tsx`, `GraphCanvasOverlay*`, `HomeSurface.tsx` |
| Presentation | `lib/presentationNavigation.ts` (pure reducer + `buildOrderedPresentationGraph`), `hooks/usePresentationMode.ts`, `components/PresentationOverlay.tsx` |
| Canvas utils | `lib/graphCanvasUtils.tsx`, `lib/canvasZoom.ts`, `lib/exportPdf.ts`, `lib/imageUploader.ts` |

> Frontend holds **transient** UI state; persistence & invariants live in backend.

---

## External Interfaces

* **CLI:** `flow init`, `flow create/update/delete`, `flow search`, `flow node ...`, `flow run`, `flow service [stop]`, `flow desktop [stop]`, `flow skill ...`, `flow roadmap`, `flow sync` (tracker mirrors).
* **HTTP API** (`internal/httpapi`): workspace/home/document/graph CRUD, canvas & layout persistence, search/node views, reference lookups, UI controls. Used by both web and desktop — no direct frontend filesystem access.
* **Installer:** `curl -fsSL .../flow-install.sh | bash` (latest) or `bash flow-install.sh 0.10.2`. Env: `FLOW_INSTALL_DIR`, `FLOW_RELEASE_REPO`, `FLOW_RELEASE_BASE_URL`, `FLOW_TARGET_OS`/`ARCH`, `FLOW_INSTALL_DRY_RUN`.
* **Sync:** `flow sync --service jira --alias <alias>` / `flow sync jira` (legacy) mirrors to `external/jira/<PROJECT>/`. Host/projects live in `.flow/config/flow.yaml` per workspace; tokens live in `.flow/config/credentials` (0600, per-workspace, `jira:<alias>` → `email`/`token`), with env override `FLOW_JIRA_API_TOKEN` / `FLOW_JIRA_API_TOKEN_<ALIAS>` / `FLOW_JIRA_EMAIL`. Global vs local: `flow sync` uses local workspace, `flow -g sync` uses global workspace — each has its own `flow.yaml` + `credentials`. Configure via `flow sync configure --service jira --alias j1` (interactive like `aws configure`: prompts for host, email, hidden token, projects; `--host`/`--email`/`--token`/`--project` for non-interactive) or legacy `flow configure --jira-host` (default alias).

---

## Multi-Surface Runtime (CLI, Service, Desktop)

All three share `internal/core`.

* **CLI:** direct command execution.
* **Service:** `flow service` spawns `--serve-internal` child, allocates per-workspace loopback port, opens browser. `flow service stop` shuts it down.
* **Desktop:** `flow desktop` resolves local/global scope via `internal/workspace`, bootstraps files/index, builds `desktop.Backend` context. `runner_stub.go` returns a friendly error unless built with `wails`; `runner_wails.go` reuses `httpapi.NewMux` as the Wails `AssetServer.Handler` so the React app is unchanged.

**Workspace switching:** rebuilds the selected workspace's index before returning workspace/graph data — both service and desktop reflect on-disk changes immediately. A `Loading workspace...` indicator covers the switch.

**Branding:** Linux uses `internal/desktop/assets/flow_logo_linux.png` → `~/.local/share/applications/flow.desktop`; macOS Dock icon via `applyMacOSDockIcon()` for raw-binary runs. Program split stays clean: `internal/core` (logic), `internal/httpapi`/`cmd/flow`/`internal/desktop` (adapters).

---

## Core Flows

**Init:** resolve workspace → ensure dirs/files → build/verify index.

**Mutation (CLI + UI):** validate → **write Markdown** → refresh index → return read model.

**Service/Desktop:** start loopback server on per-workspace port → serve embedded frontend → frontend drives API.

**Execute command:** resolve `id/name` → merge `process env + command.env` → run shell from workspace root.

---

## Graph Operations

### Rename & reparent (same backend path)

`PATCH /api/graphs/<path>` with `{ name: "<new-full-path>" }` → `workspace.RenameGraph`:

1. Validate source/target.
2. `os.Rename` the whole directory (including sub-graphs).
3. `planGraphReferenceRewriteWrites` diffs old vs new breadcrumbs and rewrites stale `[[Breadcrumb > Path]]` in every workspace doc.
4. Remap graph directory colors.
5. Rebuild index for path-derived fields.

*Safety:* `NodeLink` by ID and `[[doc-id]]` never break; `[[Title]]` may need disambiguation after scope changes.

### Drag-and-drop (frontend)

Sidebar **Content** tree: dragged row = `DraggedTreeFile | DraggedGraph`. Drop onto a graph → nests (e.g., `projects/backend` → `arch/backend`); drop onto Content root → flattens. On drop, calls `PATCH /api/graphs/<path>` with the new path. The outgoing-links constraint for single-document moves does not apply.

---

## Presentation Mode

Full-screen slide mode for the graph (`p` on canvas or toolbar Play → dimmed backdrop, one node/slide).

| Aspect | How it works |
|---|---|
| **Rendering** | Title + rendered markdown (command shows `run`), type/status badges, slide counter (`history.length+1`), footer child chips (`→`). Body lazy-loaded from `GET /api/documents/:id`. |
| **Ordering** | `buildOrderedPresentationGraph`: hard-link children topmost-first by canvas `y` then title; reference children by `[[id]]`/`[[title]]` mention offset (falls back to payload order until body loads). |
| **State** | `presentationReducer` (pure, tested): `active`, `currentId`, `candidates` (ordered successors), `highlightIndex`, `history` (counter only). Helpers: `candidatesFor`, `inboundParentsOrdered`. |
| **Keys** | `→` drill into highlighted child (`followHighlighted`), `←` back to primary parent (`goBack`, restores highlight for re-entry), `↑/↓` walk siblings (`previousSibling`/`nextSibling` via parent's children), `Enter` open in editor, `Esc` exit & re-select. No-ops when no children/parent/siblings. |
| **UI** | `PresentationOverlay.tsx` footer hints `← back · → drill in · ↑↓ siblings · enter open · esc exit`, chips `aria-label="Child nodes; press right to drill in"`. `MiddleContent.tsx` wires `presentation.run` to `onBack`/`onFollow`/`onRotate` (hidden `presentation-rotate-*` buttons for tests). |
| **Edge cases** | `graphUpdated` refreshes candidates, recovers from deletion via history or exits. Cycles handled via history stack. |

> `rotateHighlight` (cycle among direct children) stays as a reducer case for programmatic use but is **not** bound to `↑↓` anymore — `↑↓` now walks siblings.

---

## Editor Interaction & Thread UI

### Sidebar Table of Contents

Left sidebar doubles as TOC: default is **Content** tree; opening a doc or selecting a thread/Home switches to that doc's TOC (via `generateTOC` + `handleTOCNavigate` + scroll-target state). **Back to content tree** restores tree without closing the editor. Empty docs show `No headings yet.` Center/right panes have no TOC chrome.

### Rich-text navigation (Obsidian-style)

* Hide redundant **Write above/below** on code/Mermaid blocks.
* `ArrowUp`/`ArrowDown` at block boundaries → `NodeSelection` on the diagram; second press moves beyond. At document edges, insert a new paragraph.

### Brand & theme

* Sidebar **Flow** logo = gradient indigo→violet with hover scale; collapsed = glowing `F` monogram; selected editor nodes get primary-outline (`.ProseMirror-selectednode`).
* Pastel, flat, hairline-border look (2026-08-06 refresh) — **canon is `docs/DESIGN.md`** + semantic tokens in `frontend/src/styles.css` (`:root`/`.dark`).

### Thread loading

Loading thread panels show a pulsing **skeleton** (header + body lines) to avoid CLS.

---

## Architectural Invariants

> Must always hold — break one, break Flow.

* ✅ Markdown on disk is **always** canonical.
* ✅ Index is derivable; `flow.index` missing → **rebuild succeeds**.
* ✅ Local and Global modes are deterministic (same schema/behavior).
* ✅ All mutations keep Markdown schema-valid.
* ✅ Layout/appearance state is auxiliary (non-canonical).

---

## Development Workflow & Agent Skills

Flow eats its own dog food: work is tracked as Markdown task/note nodes under `.flow/data/content`.

**Single skill, embedded in the binary:**

```text
packaging/skills/flow/SKILL.md  — record-keeping + stages (design, plan, implement, fix, refactor, test, review, commit) + graph engineering
skillcontent.go embeds packaging/skills/ → flow skill list / flow skill content
```

| Command | Effect |
|---|---|
| `flow skill list` | list embedded skills |
| `flow skill content` | print merged skill (default) |
| `flow skill init` | write to `~/.agents/skills/` |
| `flow skill init --project` | write to `./.agents/skills/` (alias `--local`) |

* `--force` overwrites, `--skill <name>` restricts, `--mode dev|note|pm` (repeatable, any `dev` → full skill). Workspace `AGENTS.md` Flow section is marker-managed.

**Stage routing (`AGENTS.md`):** Design → `2.1`, Plan → `2.2`, Implement → `2.3`, Fix → `2.4`, Refactor → `2.5`, Test → `2.6`, Review → `2.7`, Commit → `2.8`, Graph ops → `3`. Record naming: `YYYYMMDD-NNN-<type>-<title>` with `depends-on` links.

---

## Quality Strategy

* Go: `go test ./internal/... ./cmd/flow` (markdown/index/graph/workspace/config).
* Frontend: Vitest component tests + Playwright visual regression.
* API & CLI: handler/server tests, command behavior tests.

Canonical vs projection correctness are tested in isolation.

---

## Related Documents

* `docs/DESIGN.md` — pastel styling canon
* `docs/build.md` — build from source & release binaries
* `docs/reference.md` — workspace/layout/CLI reference
* `docs/release.md` — tagging & publishing checklist
* `README.md` · `AGENTS.md` · `packaging/skills/flow/SKILL.md`
