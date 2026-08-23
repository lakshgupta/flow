---
id: development/20260822-005-FEAT-presentation-mode/plan
type: note
graph: development/20260822-005-FEAT-presentation-mode
title: 'Plan: presentation mode'
description: 'Plan — status: Completed (all tasks Done 2026-08-22)'
tags:
    - planning
    - frontend
links:
    - node: design/20260822-005-FEAT-presentation-mode/design
      context: Plan implements the approved presentation-mode design
      relationships:
        - relates-to
---

# Plan: Presentation Mode

## Status

Planned — implements approved design design/20260822-005-FEAT-presentation-mode.

## Approach And Sequencing

Bottom-up with a pure core:

1. **Navigation reducer** (frontend/src/lib/presentationNavigation.ts) — pure state machine over graph nodes/edges: current id, ordered successor candidates, highlight index, history stack, enter/exit. All traversal rules (layer-then-title ordering, up/down rotation, right-follow, left-pop, cycle safety, deleted-current fallback) live here so they are unit-testable without React.
2. **Hook + overlay** — usePresentationMode wraps the reducer with React state and memoized candidate computation from GraphCanvasResponse; PresentationOverlay renders the dimmed backdrop, slide (title + rendered body or command run string), badges, counter, candidate chips.
3. **Wiring** — mount overlay from MiddleContent above the canvas shell; add p-entry (graph surface active, no input focus), Escape exit re-selecting the last node, Enter opens the current node normally; Play button in graph-canvas-toolbar.

Verification: vitest reducer units, overlay component test, full npm test, go build unaffected.

## Assumptions

- GraphCanvasResponse nodes/edges are sufficient data; no new API calls.
- Markdown preview components and badge styles can be reused as-is.

## Risks

- Key handling collisions with existing canvas search shortcuts — mitigated by scoping to non-input focus and testing both surfaces together.