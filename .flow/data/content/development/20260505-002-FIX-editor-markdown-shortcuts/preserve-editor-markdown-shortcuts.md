---
id: development/20260505-002-FIX-editor-markdown-shortcuts/preserve-editor-markdown-shortcuts
type: task
graph: development/20260505-002-FIX-editor-markdown-shortcuts
title: Preserve editor markdown shortcuts on save
description: Fix rich-text export so editor heading and strikethrough shortcuts keep rendering after autosave
status: Success
links:
    - node: development/20260505-002-FIX-editor-markdown-shortcuts/fix-notes
      context: Captures the root cause, fix, and validation for editor markdown shortcut rendering.
      relationships:
        - documents
---

Fixed frontend/src/richText.ts so exported strikethrough uses GFM double tildes, and added regression coverage in frontend/src/richText.test.ts, frontend/src/App.test.tsx, and frontend/src/components/editor/RichTextEditor.shortcuts.test.tsx.

Validation

- cd frontend && npm test -- src/richText.test.ts src/App.test.tsx -t "serializes strikethrough markup with double tildes for markdown round-trips|keeps heading and strikethrough shortcuts rendered through app state echoes and autosave"
    
- cd frontend && npm test -- src/components/editor/RichTextEditor.shortcuts.test.tsx
