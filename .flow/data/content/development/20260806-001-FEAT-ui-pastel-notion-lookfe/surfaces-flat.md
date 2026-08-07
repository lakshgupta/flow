---
id: development/20260806-001-FEAT-ui-pastel-notion-lookfe/surfaces-flat
type: task
graph: development/20260806-001-FEAT-ui-pastel-notion-lookfe
title: Flatten card surfaces to hairline borders
description: Replace stacked borders+shadows on .shell-rail-card, .ds-card, .panel-card, graph-button with single hairline border and minimal shadow; pastel-tinted hover states
status: Done
links:
    - node: development/20260806-001-FEAT-ui-pastel-notion-lookfe/sidebar-compact
      context: surfaces before compact rows
      relationships:
        - depends-on
    - node: development/20260806-001-FEAT-ui-pastel-notion-lookfe/graph-canvas-pastel
      context: surfaces before canvas nodes
      relationships:
        - depends-on
    - node: development/20260806-001-FEAT-ui-pastel-notion-lookfe/editor-document-tint
      context: surfaces before document tint
      relationships:
        - depends-on
---

Done — 20260806. Flattened card surfaces in frontend/src/styles.css per docs/DESIGN.md:

- Replaced all 12 stacked `rgba(0,0,0,0.02) 0px 2px 8px ...` shadows with minimal `var(--shadow-card)` (brand-block, sidebar-card, panel-card, detail-card, hero-panel, loading-card, ui-sidebar-rail, ds-card/dialog/sheet/menu/command, shell-rail/surface/context cards, shell-inner-card, graph canvas node search/layout-reset/create-action, canvas action bar, graph-canvas-node).
- Removed the `::before` top-highlight pseudo-element on shell cards (nested-card gloss) — one hairline border per surface now.
- `.graph-button` (Home surface graph list): flat `--surface-warm` background, hairline border, minimal shadow; hover/active use pastel tint `--surface-warm-glow` + `--primary` border mix; dark equivalents updated.

Validation: `cd frontend && npm run build` OK; `npm test` 22/22 files, 138/138 tests pass.

