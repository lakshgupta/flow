---
id: development/20260511-001-FIX-home-backlog-followup/fix-excalidraw-visibility-persistence
type: task
graph: development/20260511-001-FIX-home-backlog-followup
title: Fix Excalidraw visibility and persistence
description: 'Make drawn Excalidraw content visible immediately and persist across reloads (commit: ec72776)'
tags:
    - fix
    - frontend
status: Success
links:
    - node: development/20260511-001-FIX-home-backlog-followup/inherit-graph-node-parent-color
      relationships:
        - depends-on
---

- Added a local-scene sync guard so Excalidraw does not immediately push the same just-saved scene back into the live canvas on rerender.
- Kept serialized Excalidraw markdown persistence intact while preventing the redundant update cycle that could hide freshly drawn content during editing.

Validation

- cd frontend && npm test -- src/components/editor/ui/code-block-view/code-block-view.test.tsx src/lib/excalidraw.test.ts
- cd frontend && npm run build