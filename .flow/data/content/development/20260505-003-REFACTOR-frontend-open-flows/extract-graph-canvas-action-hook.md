---
id: development/20260505-003-REFACTOR-frontend-open-flows/extract-graph-canvas-action-hook
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Extract graph canvas action hook
description: Move the graph-canvas overlay and surface action bridge setup out of App.tsx into a dedicated hook while preserving the GraphCanvas surface contracts
tags:
    - performance
    - frontend
links:
    - node: development/20260505-003-REFACTOR-frontend-open-flows/extract-right-rail-document-action-hook
      context: Continue moving remaining surface-specific App.tsx adapter blocks into hooks after the graph-canvas adapter
      relationships:
        - depends-on
---

- Added `frontend/src/hooks/useGraphCanvasSurfaceActions.ts` to own the stable overlay-action and surface-action adapters that previously lived inline in `frontend/src/App.tsx`.
- Replaced the large graph-canvas action-ref and callback block in `frontend/src/App.tsx` with a single hook call while preserving the `GraphCanvasSurface` and overlay-controller action contracts.
- Rewired the empty-graph surface to reuse the extracted graph-canvas hook actions so create and drag-drop behavior continue sharing the same stable adapter boundary.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "opens graph documents as thread roots in the center view and persists the full drag-end arrangement|toggles between horizontal and user-adjusted canvas layouts|searches graph canvas nodes by title"
- editor diagnostics: frontend/src/App.tsx, frontend/src/hooks/useGraphCanvasSurfaceActions.ts