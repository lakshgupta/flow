---
id: development/20260505-003-REFACTOR-frontend-open-flows/extract-empty-graph-surface
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Extract empty graph surface
description: Move the empty-graph create and drag-drop surface out of App.tsx behind a memoized component with stable action bridges
tags:
    - performance
    - frontend
links:
    - node: development/20260505-003-REFACTOR-frontend-open-flows/extract-settings-dialog
      context: Continue extracting always-mounted App.tsx UI branches after the empty-graph surface
      relationships:
        - depends-on

---
- Added `frontend/src/components/GraphEmptyState.tsx` to own the empty-graph create actions, drag-drop state, and pending/error feedback.
- Replaced the inline empty-graph branch in `frontend/src/App.tsx` with the memoized empty-graph component.
- Reused the existing graph-canvas action bridges so create and drag-drop behavior do not depend on fresh inline handlers in the shell.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "shows empty-graph create actions and creates a note into the selected graph|refreshes the empty canvas after creating a note from the graph tree menu"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/GraphEmptyState.tsx
