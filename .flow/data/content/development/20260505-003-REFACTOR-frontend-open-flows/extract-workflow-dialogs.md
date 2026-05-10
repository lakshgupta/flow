---
id: development/20260505-003-REFACTOR-frontend-open-flows/extract-workflow-dialogs
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Extract workflow dialogs
description: Move the create-node, delete-document, and rename modal branches out of App.tsx behind memoized components with stable action bridges
tags:
    - performance
    - frontend
links:
    - node: development/20260505-003-REFACTOR-frontend-open-flows/extract-thread-panel-action-hook
      context: Continue moving large App.tsx adapter blocks into hooks after the remaining modal workflows are extracted
      relationships:
        - depends-on

---
- Added `frontend/src/components/WorkflowDialogs.tsx` to own the create-node, delete-document, and rename dialog branches that previously lived inline in `frontend/src/App.tsx`.
- Replaced the inline modal workflow JSX in `frontend/src/App.tsx` with memoized dialog components so those subtrees are no longer recreated inside the shell render path.
- Added stable ref-backed action bridges in `frontend/src/App.tsx` for dialog open-state changes, cancel actions, input updates, and confirm actions so the extracted dialogs are less sensitive to unrelated shell rerenders.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "deletes a node from the content tree|shows empty-graph create actions and creates a note into the selected graph|refreshes the empty canvas after creating a note from the graph tree menu"
- cd frontend && npm test -- src/App.test.tsx -t "renames a graph from the content tree|renames a node from the content tree"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/WorkflowDialogs.tsx