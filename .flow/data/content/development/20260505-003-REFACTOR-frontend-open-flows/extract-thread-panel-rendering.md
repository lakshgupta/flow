---
id: development/20260505-003-REFACTOR-frontend-open-flows/extract-thread-panel-rendering
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Extract thread panel rendering
description: Move the App.tsx thread panel subtree into a memoized component with stable action bridges to reduce unrelated rerenders
tags:
    - performance
    - frontend
links:
    - node: development/20260505-003-REFACTOR-frontend-open-flows/extract-right-rail-document-panel
      context: Continue extracting large App.tsx editor surfaces after the thread panel stack
      relationships:
        - depends-on

---
- Extracted the inline thread stack from `frontend/src/App.tsx` into `frontend/src/components/ThreadPanels.tsx` so the main shell no longer rebuilds the entire panel subtree inline.
- Added stable callback bridges in `frontend/src/App.tsx` for thread activation, navigation, editor updates, TOC/properties toggles, and resize events so the memoized thread stack is not invalidated by new inline handler identities.
- Kept thread state ownership in `App.tsx`, preserving the existing document/thread orchestration while narrowing the render surface.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "follows inline references by appending and replacing thread panels|shows a loading tail instead of stale content while following a delayed thread reference|lets an earlier thread panel become the active editor and save its edits|preserves multiple blank lines after switching nodes and back"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/ThreadPanels.tsx