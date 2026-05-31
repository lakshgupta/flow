---
id: development/20260509-001-FEAT-home-backlog/fix-editor-click-shortcut-activation
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Fix editor click shortcut activation
description: Ensure slash menu and heading markdown shortcuts activate immediately after clicking into the editor
tags:
    - implementation
    - frontend
status: Success
---

- Updated `frontend/src/components/editor/RichTextEditor.tsx` pointer-down selection logic to always establish a text selection, including a fallback when `posAtCoords` returns `null`.
- Added a regression in `frontend/src/components/editor/RichTextEditor.test.tsx` to cover unresolved pointer coordinate cases.

Validation

- cd frontend && npm test -- src/components/editor/RichTextEditor.test.tsx
- cd frontend && npm run build
