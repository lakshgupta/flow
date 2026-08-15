---
id: development/20260806-001-FEAT-ui-pastel-notion-lookfe/palette-tokens
type: task
graph: development/20260806-001-FEAT-ui-pastel-notion-lookfe
title: Update palette tokens to pastel
description: 'Rewrite :root and .dark color tokens in frontend/src/styles.css: warm off-white background, pastel indigo primary ~#7c8cf8 with hover, pastel accent family (mint/sky/lavender/blush/butter), hairline borders, adjust shadow vars to minimal'
status: Done
links:
    - node: development/20260806-001-FEAT-ui-pastel-notion-lookfe/app-frame-spacing
      context: palette before frame
      relationships:
        - depends-on
    - node: development/20260806-001-FEAT-ui-pastel-notion-lookfe/surfaces-flat
      context: palette before surfaces
      relationships:
        - depends-on
---

Done — 20260806. Rewrote `:root` and `.dark` token blocks in frontend/src/styles.css per docs/DESIGN.md:

- Background `#fafafa` -> warm off-white `#faf9f7` (`--surface-warm` -> `#fbf9f7`).
- Primary `#6366f1` -> pastel indigo `#7c8cf8`; hover `#4f46e5` -> `#6a7cf5`; ring/badges/sidebar-primary/graph edges follow.
- Accent `#f0fdfa` mint -> lavender `#e4e0f7`; charts remapped to pastel family (mint `#7fd1b9`, sky `#7ab8f5`, lavender, blush `#f291b2`, butter `#f2c14e`).
- Destructive softened to `#f2706b`; success `#34c9a0`, warn `#f2a33b`.
- Shadows minimized: `--shadow-card` -> `0 1px 2px rgba(0,0,0,0.04)`.
- Dark theme desaturated to match (background `#0b0b0e`, primary `#8b7cf8`, pastel-tinted accents); brand logo gradient updated to pastel lavender in both themes.

Validation: `cd frontend && npm test` (22/22 files, 137/138 — 1 pre-existing flake in RichTextEditor.shortcuts passes in isolation, passes with changes), `npm run build` OK.

