---
id: development/20260601-002-UI-dialog-and-theme-refinements/commit-notes
type: note
graph: development/20260601-002-UI-dialog-and-theme-refinements
title: Commit Notes
description: Records the full scope of the commit including all files changed and Flow node mapping
tags:
  - commit
  - refactor
---

## Commit Scope

**Commit**: 418d965

**Files changed (15)**:
- `.gitignore` — build artifact exclusions
- `frontend/index.html` — Google Fonts preconnect/link for Plus Jakarta Sans
- `frontend/src/App.tsx` — import RightSidebarPanel, lazy load LazyExcalidraw
- `frontend/src/components/LazyExcalidraw.tsx` — NEW: React.lazy wrapper for excalidraw with Suspense skeleton
- `frontend/src/components/MiddleContent.tsx` — skeleton loading states
- `frontend/src/components/RightSidebarPanel.tsx` — NEW: extracted right sidebar panel
- `frontend/src/components/SettingsDialog.tsx` — Sheet→Dialog popup refactor, overflow-hidden fix
- `frontend/src/components/editor/ui/code-block-view/code-block-view.test.tsx` — async mocks for dynamic excalidraw import
- `frontend/src/components/editor/ui/code-block-view/code-block-view.tsx` — async excalidraw loading via useState+useEffect
- `frontend/src/components/ui/dialog.tsx` — backdrop-blur-sm on overlay
- `frontend/src/lib/excalidraw.test.ts` — async/await for dynamic import helpers
- `frontend/src/lib/excalidraw.ts` — converted to async dynamic import()
- `frontend/src/styles.css` — @theme block, palette refresh, sidebar hsl(), removed dialog !important rules, animations, skeleton classes
- `frontend/vite.config.ts` — manualChunks for vendor-xyflow code splitting
- `scripts/build-package-linux.sh` — nfpm --packager deb --output fix

**Included Flow task node**:
- `development/20260601-002-UI-dialog-and-theme-refinements/implement-dialog-theme-refinements`

**Related but already committed**:
- `development/20260601-001-REFACTOR-frontend-performance-optimizations/perform-optimizations` (useMemo, sidebar resize, WorkspaceHeader — committed in 3511a14)

**Excluded from commit**:
- Unstaged changes to `.flow/data/home.md` and `.flow/data/content/manual/index.md`
- Untracked files (node_modules, flow binary, .opencode/)

**Validation**: 134/135 frontend tests pass (1 pre-existing RichTextEditor.shortcuts.test.tsx failure)
