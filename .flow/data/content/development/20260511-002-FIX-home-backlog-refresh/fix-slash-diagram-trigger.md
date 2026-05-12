---
id: development/20260511-002-FIX-home-backlog-refresh/fix-slash-diagram-trigger
type: task
graph: development/20260511-002-FIX-home-backlog-refresh
title: Fix slash diagram trigger
description: 'Restore slash-menu insertion for Mermaid and Excalidraw blocks (commit: 7bd92ff)'
tags:
    - fix
    - frontend
status: Success
links:
    - node: development/20260511-002-FIX-home-backlog-refresh/fix-excalidraw-editor-session
      relationships:
        - depends-on
---

- Switched the Mermaid and Excalidraw slash-menu actions to `setCodeBlock(...)` so the current slash paragraph transforms into the requested diagram block instead of inserting a detached node.
- Kept plain code insertion behavior unchanged and updated the owner test to assert the in-place command path.

Validation

- cd frontend && npm test -- --run src/components/editor/ui/slash-menu/slash-menu.test.tsx
- cd frontend && npm run build