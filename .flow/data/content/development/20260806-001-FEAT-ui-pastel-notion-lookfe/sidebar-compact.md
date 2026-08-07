---
id: development/20260806-001-FEAT-ui-pastel-notion-lookfe/sidebar-compact
type: task
graph: development/20260806-001-FEAT-ui-pastel-notion-lookfe
title: Compact sidebar navigation
description: Reduce .ui-sidebar-menu-button/sub-button vertical padding to ~0.45rem; flat pastel-tinted active state; keep collapsible tree and brand block
status: Done
links:
    - node: development/20260806-001-FEAT-ui-pastel-notion-lookfe/tests-visual
      context: verify sidebar
      relationships:
        - depends-on
---

Done — 20260806. Compacted sidebar navigation in frontend/src/styles.css per docs/DESIGN.md:

- `.ui-sidebar-menu-button` vertical padding 0.72rem -> 0.45rem; gap 0.75rem -> 0.6rem; radius 0.95rem -> 0.75rem.
- `.ui-sidebar-menu-sub-button` padding 0.64rem -> 0.42rem; radius 0.82rem -> 0.72rem.
- Active rows now flat pastel: `--surface-warm-glow` fill + `--primary` border mix, no shadow (was white mix + strong border + shadow).
- `.ui-sidebar-menu` gap 0.28rem -> 0.2rem for tighter rows.
- Header `.ui-sidebar-trigger` (mobile) made ghost-style: 2rem, transparent bg, no border/shadow; hover uses `--surface-warm-alt` fill.

Validation: `cd frontend && npm run build` OK; `npm test` — the only failure is the known pre-existing RichTextEditor code-block ArrowDown timing flake (passes in isolation; unrelated to CSS).

