---
id: development/20260505-003-REFACTOR-frontend-open-flows/extract-thread-panel-action-hook
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Extract thread panel action hook
description: Move the thread-panel action bridge setup out of App.tsx into a dedicated hook while preserving the ThreadPanels action contract
tags:
    - performance
    - frontend
links:
    - node: development/20260505-003-REFACTOR-frontend-open-flows/extract-graph-canvas-action-hook
      context: Continue moving large App.tsx bridge setup into dedicated hooks after the thread-panel adapter
      relationships:
        - depends-on
---

- Added `frontend/src/hooks/useThreadPanelActions.ts` to own the stable thread-panel action adapter that previously lived inline in `frontend/src/App.tsx`.
- Replaced the large thread-panel action-ref and callback block in `frontend/src/App.tsx` with a single hook call while preserving the existing `ThreadPanels` action surface.
- Simplified the ref-backed thread adapter by updating one current ref object per render instead of mutating each handler slot individually.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "opens graph documents as thread roots in the center view and persists the full drag-end arrangement|follows inline references by appending and replacing thread panels|lets an earlier thread panel become the active editor and save its edits|preserves multiple blank lines after switching nodes and back"
- editor diagnostics: frontend/src/App.tsx, frontend/src/hooks/useThreadPanelActions.ts