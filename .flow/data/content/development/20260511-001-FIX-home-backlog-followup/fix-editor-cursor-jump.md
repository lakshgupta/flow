---
id: development/20260511-001-FIX-home-backlog-followup/fix-editor-cursor-jump
type: task
graph: development/20260511-001-FIX-home-backlog-followup
title: Fix editor cursor jump
description: Stop active editing from jumping the caret to the top of the document
tags:
    - fix
    - frontend
status: Done
links:
    - node: development/20260511-001-FIX-home-backlog-followup/run-home-backlog-regression
      relationships:
        - depends-on
---

- Preserve the current ProseMirror selection when external content syncs call setContent so typing does not relocate the caret to the top of the editor.
- Added a rich-text editor regression covering the external sync path that used to reset selection.

Validation

- cd frontend && npm test -- src/components/editor/RichTextEditor.test.tsx
- cd frontend && npm run build