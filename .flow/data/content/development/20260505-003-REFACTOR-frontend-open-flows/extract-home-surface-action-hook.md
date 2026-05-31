---
id: development/20260505-003-REFACTOR-frontend-open-flows/extract-home-surface-action-hook
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Extract Home surface action hook
description: Move the Home surface action bridge setup out of App.tsx into a dedicated hook while preserving the HomeSurface action contract
tags:
    - performance
    - frontend
links:
    - node: development/20260505-003-REFACTOR-frontend-open-flows/extract-sidebar-surface
      context: Continue moving shell-owned sidebar and workspace wiring out of App.tsx after the Home surface adapter
      relationships:
        - depends-on
---

- Added `frontend/src/hooks/useHomeSurfaceActions.ts` to own the stable action adapter that previously lived inline in `frontend/src/App.tsx` for `HomeSurface`.
- Replaced the large Home surface action-ref and callback block in `frontend/src/App.tsx` with a single hook call while preserving TOC toggling, editor updates, inline references, asset threading, scroll-target clearing, TOC resize, and TOC navigation.
- Kept the existing `HomeSurface` prop contract unchanged so the Home surface remains memoized without additional shell-owned handler churn.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "shows a document table of contents on the Home surface and persists resize|switches to the Home workspace from a Graph and renders the HomeRichTextEditor properly"
- editor diagnostics: frontend/src/App.tsx, frontend/src/hooks/useHomeSurfaceActions.ts