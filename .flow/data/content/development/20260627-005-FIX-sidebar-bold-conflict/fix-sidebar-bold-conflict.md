---
title: Fix Ctrl+B sidebar toggle conflict with editor bold
type: task
status: Done
tags:
  - bug
  - keyboard
  - sidebar
  - editor
links:
  - "20260627-005-FIX-sidebar-bold-conflict"
---

When text is selected in the editor and Ctrl+B/Cmd+B is pressed, the text becomes bold but the left sidebar also collapses.

## Root Cause

The sidebar's global `keydown` listener at `sidebar.tsx:96-109` captures Ctrl+B/Cmd+B without checking if the user is typing in an editor. Both the ProseKit bold keymap and the sidebar handler fire for the same keyboard event.

## Fix

Added a guard that skips the sidebar toggle when the active element is `<input>`, `<textarea>`, or `contentEditable` (which includes the ProseMirror editor). This matches the pattern already used in `App.tsx:834-865` for thread navigation shortcuts.

## Validation
- `npm run build` passes
- `npm test` passes (113/114, only pre-existing flaky test fails)
