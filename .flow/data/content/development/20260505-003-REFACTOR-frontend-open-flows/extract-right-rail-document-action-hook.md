---
id: development/20260505-003-REFACTOR-frontend-open-flows/extract-right-rail-document-action-hook
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Extract right-rail document action hook
description: Move the right-rail document action bridge setup out of App.tsx into a dedicated hook while preserving the DocumentEditorPane action contract
tags:
    - performance
    - frontend
links:
    - node: development/20260505-003-REFACTOR-frontend-open-flows/extract-home-surface-action-hook
      context: Continue moving surface-specific App.tsx adapter blocks into hooks after the right-rail document adapter
      relationships:
        - depends-on
---

- Added `frontend/src/hooks/useRightRailDocumentActions.ts` to own the stable action adapter that previously lived inline in `frontend/src/App.tsx` for `DocumentEditorPane`.
- Replaced the large right-rail document action-ref and callback block in `frontend/src/App.tsx` with a single hook call while preserving maximize, close, delete, editor update, inline reference, asset threading, file drop, document inspection, and TOC interactions.
- Kept the existing `DocumentEditorPane` prop contract unchanged so the right-rail document surface remains memoized without additional shell-owned handler churn.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "shows a document icon after node selection and opens a thread root from it|opens a sidebar file in the center pane on single click and keeps it open when calendar is toggled"
- editor diagnostics: frontend/src/App.tsx, frontend/src/hooks/useRightRailDocumentActions.ts