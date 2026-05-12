---
id: development/20260511-002-FIX-home-backlog-refresh/intensify-node-colors-light
type: task
graph: development/20260511-002-FIX-home-backlog-refresh
title: Intensify node colors in light mode
description: Increase graph node tint visibility in the light theme
tags:
    - fix
    - frontend
status: Done
links:
    - node: development/20260511-002-FIX-home-backlog-refresh/restore-node-colors-dark
      relationships:
        - depends-on
---

- Strengthened the shared graph directory palette so light-theme tree rows, graph swatches, and tinted canvas nodes read as intentional accents instead of nearly-neutral surfaces.
- Kept the same color families and identifiers so existing graph color assignments continue to work.

Validation

- cd frontend && npm test -- --run src/lib/graphColors.test.ts src/components/editor/ui/inline-menu/inline-menu.test.tsx
- cd frontend && npm run build