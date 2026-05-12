---
id: development/20260511-001-FIX-home-backlog-followup/fix-diagram-cursor-exit
type: task
graph: development/20260511-001-FIX-home-backlog-followup
title: Fix diagram cursor exit
description: 'Allow the caret to move into normal text around diagram and code blocks (commit: d61674f)'
tags:
    - fix
    - frontend
status: Success
links:
    - node: development/20260511-001-FIX-home-backlog-followup/fix-excalidraw-visibility-persistence
      relationships:
        - depends-on
---

- Added a direct node-view action to insert a paragraph above code, Mermaid, and Excalidraw blocks so writing can resume immediately above embedded sections.
- Reused the same affordance for plain code blocks and diagram blocks to keep the interaction consistent.

Validation

- cd frontend && npm test -- src/components/editor/ui/code-block-view/code-block-view.test.tsx
- cd frontend && npm run build