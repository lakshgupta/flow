---
id: development/20260822-005-FEAT-presentation-mode/hook-and-overlay
type: task
graph: development/20260822-005-FEAT-presentation-mode
title: Add usePresentationMode hook and PresentationOverlay component
description: 'Add usePresentationMode hook and PresentationOverlay component (Done 2026-08-22; evidence: PresentationOverlay.test.tsx 4 tests + reducer suite green). Hook: reducer state, graphUpdated on refresh, lazy body fetch via GET /api/documents/<id> cached per session, active-mode keydown contract (esc/arrows/enter), p-entry gated on non-input focus. Overlay: backdrop dialog, badges, title, RenderedMarkdown body or command run string, candidate chips with highlight + context tooltips, counter, hints.'
tags:
    - frontend
status: Done
links:
    - node: development/20260822-005-FEAT-presentation-mode/navigation-reducer
      context: Hook and overlay consume the reducer
      relationships:
        - depends-on
---

