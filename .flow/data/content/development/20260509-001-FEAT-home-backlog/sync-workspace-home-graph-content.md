---
id: development/20260509-001-FEAT-home-backlog/sync-workspace-home-graph-content
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Sync workspace home and graph content
description: Ensure switching workspaces resets stale context state and reloads Home and graph canvas content from the selected workspace
status: Success
tags:
    - implementation
    - frontend
---

- Updated `frontend/src/App.tsx` workspace switch and workspace deregistration handlers to call `clearContextPanel()` before returning to Home, which clears stale selected-document and thread state from the previous workspace.
- Extended `frontend/src/App.test.tsx` workspace-switch regression so it enters a graph in the first workspace, switches to another workspace, verifies Home content comes from the new workspace, and verifies the new graph canvas is loaded.

Validation

- cd frontend && npm run build
- cd frontend && npm test -- src/App.test.tsx -t "switches workspaces from the sidebar selector and refreshes the graph tree" (blocked in this environment by existing Vitest JSON import attribute error)
