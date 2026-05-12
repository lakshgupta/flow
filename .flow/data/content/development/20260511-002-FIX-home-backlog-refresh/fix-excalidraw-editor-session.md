---
id: development/20260511-002-FIX-home-backlog-refresh/fix-excalidraw-editor-session
type: task
graph: development/20260511-002-FIX-home-backlog-refresh
title: Fix Excalidraw editor session
description: 'Restore drawing and interaction inside embedded Excalidraw sections (commit: ba650d1)'
tags:
    - fix
    - frontend
status: Success
links:
    - node: development/20260511-002-FIX-home-backlog-refresh/polish-workspace-shell
      relationships:
        - depends-on
---

- Marked the embedded Excalidraw shell as editor-interactive and taught the RichTextEditor pointer-down capture guard to leave those embedded diagram interactions alone.
- Added a focused RichTextEditor regression so future selection-restoration work does not steal pointer gestures from embedded Excalidraw canvases.

Validation

- cd frontend && npm test -- --run src/components/editor/RichTextEditor.test.tsx src/components/editor/ui/code-block-view/code-block-view.test.tsx
- cd frontend && npm run build