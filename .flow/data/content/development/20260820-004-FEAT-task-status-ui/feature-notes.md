---
id: development/20260820-004-FEAT-task-status-ui/feature-notes
type: note
graph: development/20260820-004-FEAT-task-status-ui
title: Implementation and validation for task status tracking UI
description: 'Status controls added to center header, right-rail editor, and canvas nodes; persisted via existing document PUT path (commit: TBD)'
tags:
    - feature
    - frontend
links:
    - node: development/20260820-004-FEAT-task-status-ui/add-task-status-ui
      context: Feature task
      relationships:
        - maps-to
---

## Context

Task status tracking already existed end-to-end: the backend persists a `status`
field on task documents, the graph canvas renders a colored status pill on task
nodes, and the properties side panel has a status dropdown. The gap was
discoverability — opening a task document showed no status control anywhere:
the dropdown only appeared inside the hidden-by-default properties side panel,
and the right-rail editor had no status affordance at all.

## Change

Shared the canonical status list as `TASK_STATUS_OPTIONS` in
`frontend/src/lib/graphCanvasUtils.tsx` (used by the properties panel, both
editor headers, and the canvas dropdown) and added:

1. **Center editor header** (`ThreadPanels.tsx`) — a status `<select>` next to
   the type badge on the active panel when the document is a task. Writes
   through the existing `updateFormField("status", …)` → autosave path.
2. **Right-rail editor** (`DocumentEditorPane.tsx`) — the same status select in
   the document toolbar for task documents, using the same form-field path.
3. **Graph canvas nodes** (`GraphCanvasOverlayNodes.tsx`) — the static status
   pill became an inline `<select>` dropdown on task nodes, wired through a new
   `onNodeStatusChange` overlay action →
   `handleGraphCanvasNodeStatusChange` in `App.tsx`, which persists via the
   existing document PUT (HTTP or Wails binding) and updates the canvas node,
   selected document, and thread documents in place — no canvas reload.
4. **Styling** (`styles.css`) — `.center-document-status-select` for the editor
   headers and select-specific rules for the canvas status pill (chevron via
   background gradients, focus ring, empty-state style).

## Validation

- Unit tests: canvas node status dropdown (`GraphCanvasOverlayNodes.test.tsx`,
  4 tests: renders for tasks, absent for non-tasks, fires `onNodeStatusChange`,
  can clear to none) and right-rail select (`DocumentEditorPane.test.tsx`,
  3 tests: shows current status, absent for notes, updates the form field).
- Full frontend suite: **235/235 pass**; `tsc --noEmit` clean.
- Headless Chromium against the built binary, verified end-to-end:
  center header select persisted `Ready → Running`, canvas dropdown persisted
  `Running → Done`, right-rail select persisted `Done → Failed` — each
  confirmed via the API and on-disk frontmatter.
