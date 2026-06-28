---
id: 20260627-006-FIX-workspace-and-scroll/task
title: Fix workspace dropdown errors and editor scroll
type: task
status: Done
commit: 9ca5712
tags:
  - fix
  - workspace
  - scroll
---

# Fix workspace dropdown errors and editor scroll

## Description

Two fixes:

1. Workspace switch errors were invisible on the home surface because `mutationError` is only rendered inside ThreadPanelStack and DocumentEditorPane. Route errors through `homeMutationError` instead.

2. Editor scroll broken because `.middle-shell` was missing `min-height: 0`, breaking the flex height constraint chain from root to `.thread-panel-scroll`.

## Files

- `frontend/src/App.tsx`: Route workspace switch errors to `setHomeMutationError`
- `frontend/src/styles.css`: Add `min-height: 0` to `.middle-shell`

## Status

Done
