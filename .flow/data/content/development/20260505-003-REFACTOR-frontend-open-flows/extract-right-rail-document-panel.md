---
id: development/20260505-003-REFACTOR-frontend-open-flows/extract-right-rail-document-panel
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Extract right-rail document panel
description: Move the App.tsx right-rail document editor and TOC into a memoized component with stable action bridges to reduce unrelated rerenders
tags:
    - performance
    - frontend
links:
    - node: development/20260505-003-REFACTOR-frontend-open-flows/extract-graph-canvas-surface
      context: Continue extracting large App.tsx rendering surfaces after the right-rail document panel
      relationships:
        - depends-on
---

- Filled `frontend/src/components/DocumentEditorPane.tsx` with a memoized right-rail document editor panel so `App.tsx` no longer renders the full context-editor and TOC subtree inline.
    
- Added stable right-rail action bridges in `frontend/src/App.tsx` for maximize, close, delete, field updates, inline references, asset threading, document inspection, file drops, TOC resize, and TOC navigation.
    
- Reused `TableOfContents` inside the extracted panel so the right-rail document path stops duplicating the TOC markup.
    

Validation

- cd frontend && npm test -- src/App.test.tsx -t "shows a document icon after node selection and opens a thread root from it|opens a sidebar file in the center pane on single click and keeps it open when calendar is toggled"
    
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/DocumentEditorPane.tsx
