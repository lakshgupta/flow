---
id: development/20260806-001-FEAT-ui-pastel-notion-lookfe/app-frame-spacing
type: task
graph: development/20260806-001-FEAT-ui-pastel-notion-lookfe
title: Tighten app frame and header spacing
description: Reduce .app-shell outer padding to 0.5rem, slimmer workspace-shell-header (2.6rem), ghost icon buttons, flat border-only header; remove card-in-card chrome on panels
status: Done
commit: 5b55233
---

Done — 20260806. Tightened app frame spacing in frontend/src/styles.css per docs/DESIGN.md:

- `.app-shell` padding 0.85rem -> 0.5rem.
- `.workspace-shell-header` min-height 2.9rem -> 2.6rem; padding 0.42rem -> 0.36rem; kept flat (no shadow, border-bottom only).
- `.shell-header-icon-btn`: made ghost-style — border removed, transparent background, no drop shadow, 2rem size; hover gets flat `--surface-warm-alt` fill + foreground color.
- Card-in-card chrome removal deferred to `surfaces-flat` (this frame task concerns app shell + header only).

Validation: `cd frontend && npm test` 22/22 files, 138/138 tests pass; `npm run build` OK.

