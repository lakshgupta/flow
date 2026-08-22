---
id: development/20260821-005-FEAT-sidebar-contextual-toc/plan
type: note
graph: development/20260821-005-FEAT-sidebar-contextual-toc
title: Plan contextual sidebar table of contents
description: 'Implementation plan — status: Completed; approved design implemented and validated'
tags:
    - planning
    - toc
links:
    - node: design/20260821-001-FEAT-sidebar-contextual-toc/design
      context: Planning note follows the approved contextual sidebar TOC design
      relationships:
        - relates-to
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/implement-sidebar-toc-view
      context: Plan scopes the sidebar view implementation task
      relationships:
        - relates-to
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/wire-sidebar-toc-transitions
      context: Plan scopes navigation and thread transition wiring
      relationships:
        - relates-to
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/remove-editor-toc-surfaces
      context: Plan scopes removal of duplicated editor TOC surfaces
      relationships:
        - relates-to
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/test-sidebar-toc-navigation
      context: Plan scopes integration and regression coverage
      relationships:
        - relates-to
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/review-sidebar-toc
      context: Plan scopes final behavior and accessibility review
      relationships:
        - relates-to
---

## Planning Basis

Implement the approved Contextual Sidebar Table of Contents design at `design/20260821-001-FEAT-sidebar-contextual-toc/design`. The left sidebar becomes the single TOC surface for Home, opened documents, and selected thread documents. Graph expansion remains Content-tree-only. Center and right-rail editor TOCs are removed while center document properties remain.

## Implementation Plan

1. Add the sidebar Content/TOC view and reusable TOC presentation with an accessible back control.
2. Wire document selection, Home selection, thread activation, and heading navigation to the sidebar context.
3. Remove editor TOC panels, toggles, resize handlers, and obsolete document TOC ratio plumbing.
4. Add application/component regression coverage, then run frontend tests, typecheck, and visual checks.
5. Review the final implementation for preserved graph, editor, thread, and property behavior.

## Dependencies

- Sidebar view state and presentation precede transition wiring.
- Transition wiring and editor TOC removal both precede integration tests.
- Tests precede review.

## Assumptions And Risks

The existing `generateTOC` helper and editor scroll-target mechanism remain the source of heading navigation. Loading and no-heading states are explicit. The current Home improvement entry already records this capability, so no additional Home manual edit is needed during planning.

## Flow Records

The task nodes below are the authoritative implementation checklist. The planning note is linked to the approved design and each task; dependency links encode execution order.