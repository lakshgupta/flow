---
id: development/20260806-001-FEAT-ui-pastel-notion-lookfe/editor-document-tint
type: task
graph: development/20260806-001-FEAT-ui-pastel-notion-lookfe
title: Pastel-tinted editor and document panes
description: Apply pastel graph-directory tint to document/thread panes and home surface; keep editor measure comfortable; preserve tint via graphDirectoryColors, no markup change
status: Done
links:
    - node: development/20260806-001-FEAT-ui-pastel-notion-lookfe/tests-visual
      context: verify editor panes
      relationships:
        - depends-on
---

Done — 20260806. Pastel-tinted editor and document panes in frontend/src/styles.css per docs/DESIGN.md:

- `.thread-panel.thread-panel-tinted`: background changed from flat `--surface-warm` to a soft pastel `color-mix(var(--thread-graph-color) 9%, var(--surface-warm))`; border mix 54% -> 40% so the per-graph tint reads quiet on the panel.
- `.sidebar-document-panel-tinted` (right-rail document pane): same treatment with `--document-graph-color` (56% -> 40% border, 9% fill over surface-warm).
- Removed the dead `.thread-panel::before` overlay block (always `opacity: 0`; inert) — the tint now lives on the panel background itself.
- Home surface carries no graph color by design (Home is root); no tint applied there. Editor measure unchanged.

Validation: `cd frontend && npm run build` OK; `npm test` 22/22 files, 138/138 tests pass.

