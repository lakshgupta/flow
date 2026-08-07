---
id: development/20260806-001-FEAT-ui-pastel-notion-lookfe/plan
type: note
graph: development/20260806-001-FEAT-ui-pastel-notion-lookfe
title: 'Plan: pastel Notion UI refresh'
description: 'Planning note: token palette, spacing, docs'
links:
    - node: development/20260806-001-FEAT-ui-pastel-notion-lookfe/palette-tokens
      context: plan governs tasks
      relationships:
        - relates-to
---

Plan for the approved UI look-and-feel refresh (design/20260806-001-FEAT-ui-pastel-notion-lookfe, approved; docs/DESIGN.md created).

Mapping to design doc:

- palette-tokens -> DESIGN.md Palette + Change Management (styles.css :root/.dark token rewrite)
- app-frame-spacing -> DESIGN.md Spacing & Layout (app-shell 0.5rem, header 2.6rem)
- surfaces-flat -> DESIGN.md Spacing & Layout + Component Rules (hairline borders, minimal shadows)
- sidebar-compact -> DESIGN.md Spacing & Layout (menu rows ~0.45rem)
- graph-canvas-pastel -> DESIGN.md Component Rules (pastel node fills, per-graph colors)
- editor-document-tint -> DESIGN.md Spacing & Layout + Component Rules (graphDirectoryColors tint, editor measure)
- tests-visual -> DESIGN.md Change Management (npm test, regenerated visual baselines)

Execution order: palette-tokens -> app-frame-spacing | surfaces-flat -> (sidebar-compact, graph-canvas-pastel, editor-document-tint) -> tests-visual.

Assumptions:

- Component structure/markup unchanged; only CSS class-level styling and token values in frontend/src/styles.css.
- Dark theme stays in sync through the same token blocks.
- Visual regression baselines will change; diffs must be intentional.

Risks:

- Large styles.css (~6,800 lines) with stacked overrides; keep changes token-first, then class cleanup.
- Flatter look may reduce perceived depth vs current glassy style — intended Notion direction.