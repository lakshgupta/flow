---
id: development/20260505-002-FIX-editor-markdown-shortcuts/fix-notes
type: note
graph: development/20260505-002-FIX-editor-markdown-shortcuts
title: Editor shortcut rendering fix notes
description: Root cause, fix decision, and validation for heading and strikethrough rendering in the editor
---

Root cause

- The mounted editor rendered heading and strikethrough shortcuts correctly, but editor HTML exported `<s>` tags as single-tilde markdown (`~text~`).
    
- On autosave and reload, markdown-it treated the single tildes as literal text, so users saw raw `~` markers instead of strikethrough.
    

Fix

- Added a dedicated Turndown rule in frontend/src/richText.ts to serialize `<s>`, `<strike>`, and `<del>` as GFM double tildes.
    
- Added a direct richText round-trip test plus an App-level autosave regression for heading and strikethrough shortcuts.
    

Validation

- cd frontend && npm test -- src/richText.test.ts src/App.test.tsx -t "serializes strikethrough markup with double tildes for markdown round-trips|keeps heading and strikethrough shortcuts rendered through app state echoes and autosave"
    
- cd frontend && npm test -- src/components/editor/RichTextEditor.shortcuts.test.tsx
