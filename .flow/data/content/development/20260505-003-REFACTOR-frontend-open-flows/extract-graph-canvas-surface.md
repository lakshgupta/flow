---
id: development/20260505-003-REFACTOR-frontend-open-flows/extract-graph-canvas-surface
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Extract graph canvas surface
description: Move the loaded graph-canvas ReactFlow host out of App.tsx and stabilize its callback/controller boundary to reduce unrelated rerenders
tags:
    - performance
    - frontend
links:
    - node: development/20260505-003-REFACTOR-frontend-open-flows/extract-home-surface
      context: Continue extracting large App.tsx editor and layout surfaces after stabilizing the graph canvas host
      relationships:
        - depends-on
---

- Added `frontend/src/components/GraphCanvasSurface.tsx` to own the loaded graph canvas toolbar, ReactFlow host, and overlay render tree.
- Replaced the inline graph-canvas host in `frontend/src/App.tsx` with the memoized surface component and moved the viewport persistence path onto a ref-backed callback.
- Stabilized the graph-canvas action and overlay-controller boundary in `frontend/src/App.tsx` so ReactFlow and overlay consumers are not invalidated by new inline handler identities on unrelated shell renders.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "toggles between horizontal and user-adjusted canvas layouts|searches graph canvas nodes by title"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/GraphCanvasSurface.tsx
