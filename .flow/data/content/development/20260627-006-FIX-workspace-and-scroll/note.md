---
id: 20260627-006-FIX-workspace-and-scroll/note
title: Fix notes for workspace and scroll
type: note
tags:
  - fix
  - workspace
  - scroll
---

# Fix Notes

## Workspace dropdown errors

Root cause: `handleWorkspaceSelection` stored errors in `mutationError`, but that state is only rendered inside `ThreadPanelStack` and `DocumentEditorPane`. After a workspace switch (success or failure), the app navigates to the home surface where neither component is visible.

Fix: Route errors through `homeMutationError` which is rendered on the home surface via `HomeSurface`.

## Editor scroll

Root cause: `.middle-shell` was missing `min-height: 0`. The flex height constraint chain from `html/body/#root` through `.workspace-shell-body` → `.middle-shell` → `.center-document-shell` → `.thread-panel-scroll` was broken at `.middle-shell` because its default `min-height: auto` prevented it from shrinking below content height. The RichTextEditor's `h-full` (`height: 100%`) could not resolve against the unconstrained parent.

Fix: Add `min-height: 0` to `.middle-shell` in `styles.css`.

## Validation

- All 114 frontend tests pass (1 known flaky test excluded)
- All Go tests pass
