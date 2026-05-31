---
id: development/20260505-003-REFACTOR-frontend-open-flows/extract-home-surface
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Extract Home surface
description: Move the Home editor and TOC branch out of App.tsx behind a memoized component with stable action bridges
tags:
    - performance
    - frontend
links:
    - node: development/20260505-003-REFACTOR-frontend-open-flows/extract-empty-graph-surface
      context: Continue extracting always-mounted App.tsx graph surfaces after the Home branch
      relationships:
        - depends-on
---

- Added `frontend/src/components/HomeSurface.tsx` to own the Home editor, TOC toggle, TOC panel, and fresh-workspace guide rendering.
- Replaced the inline Home surface branch in `frontend/src/App.tsx` with the memoized Home surface component.
- Added stable Home action bridges in `frontend/src/App.tsx` for TOC toggling, editor updates, inline references, asset threading, TOC resizing, and TOC navigation.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "shows a document table of contents on the Home surface and persists resize|switches to the Home workspace from a Graph and renders the HomeRichTextEditor properly"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/HomeSurface.tsx
