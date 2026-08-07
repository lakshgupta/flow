---
id: development/20260806-001-FEAT-ui-pastel-notion-lookfe/graph-canvas-pastel
type: task
graph: development/20260806-001-FEAT-ui-pastel-notion-lookfe
title: Pastel graph canvas nodes
description: Soft pastel node fills with tinted borders matching per-graph directory colors; keep edges dimmed (--graph-edge-dim); ensure node styling reads pastel in both themes
status: Done
commit: 5b55233
links:
    - node: development/20260806-001-FEAT-ui-pastel-notion-lookfe/tests-visual
      context: verify canvas
      relationships:
        - depends-on
---

Done — 20260806. Pastel graph canvas nodes in frontend/src/styles.css per docs/DESIGN.md:

- `.graph-canvas-node-tinted` light: background changed from `color-mix(var(--graph-node-color) 56%, transparent)` (translucent) to a flat soft paste: `color-mix(var(--graph-node-color) 22%, var(--card))`; border 62% -> 55% mix so tint reads as a quiet pastel on the card.
- `.dark .graph-canvas-node-tinted`: gradient layers softened (26%/18% from 32%/26%), nested shadow from `rgba(0,0,0,0.18) 0 8px 20px` -> `var(--shadow-card)`.
- Expanded/split tinted variants scaled down correspondingly (16%/14% mixes) so per-graph directory colors stay pastel in both themes.
- Edges were already pastel: the overlay strokes use `var(--graph-edge)` / `var(--graph-edge-dim)` tokens, which palette-tokens set to pastel indigo `#7c8cf8` family; no visual-state rework needed.
- `.graph-canvas-shell` background uses `var(--background)` (now warm off-white) — consistent.

Validation: `cd frontend && npm run build` OK; `npm test` 137/138 (only the known pre-existing RichTextEditor code-block ArrowDown timing flake, passes in isolation).

