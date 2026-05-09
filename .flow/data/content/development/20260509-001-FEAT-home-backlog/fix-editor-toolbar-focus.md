---
id: development/20260509-001-FEAT-home-backlog/fix-editor-toolbar-focus
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Fix editor toolbar focus activation
description: Restore slash and heading shortcuts on first click into the markdown editor
tags:
    - fix
    - frontend
status: Success
links:
    - node: development/20260509-001-FEAT-home-backlog/fix-code-block-exit
      context: Continue through the editor bug backlog in order.
      relationships:
        - depends-on
---

Restored first-click editor activation by re-establishing a ProseMirror text selection on pointer-down before focus settles, so slash commands and heading shortcuts work immediately after external content sync.

Validation

- cd frontend && npm test -- src/components/editor/RichTextEditor.test.tsx src/components/editor/RichTextEditor.shortcuts.test.tsx
- cd frontend && npm run build