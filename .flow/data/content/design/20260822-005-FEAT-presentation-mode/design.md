---
id: design/20260822-005-FEAT-presentation-mode/design
type: note
graph: design/20260822-005-FEAT-presentation-mode
title: 'Presentation mode: keyboard-driven node slides'
description: 'Design — status: Approved'
tags:
    - design
    - frontend
    - presentation
---

# Design: Presentation Mode

## Status

Approved (2026-08-22).

## Summary

A full-screen presentation mode for the graph view that shows one node at a time as a slide (rendered title + markdown body). Arrow keys traverse the graph like a deck: left/right move backward/forward along the traversal path, up/down cycle through multiple connected successors before committing to one, `p` toggles entry, Escape exits back to the graph. Frontend-only; no backend changes.

## Problem

The backlog calls for presenting a graph as slides. Today the only way to walk a graph is visually panning the canvas or clicking node-to-node — there is no focused, keyboard-driven way to present or read a graph linearly.

## Goals

1. Entry: pressing `p` while the graph canvas surface is active and no text input/search field has focus enters presentation mode starting from the selected node (or the first node in graph order if none selected). A toolbar button (Play icon) offers mouse entry.
2. Slide rendering: each node renders centered on a dimmed backdrop — title plus rendered markdown body (reusing existing document-preview rendering), with type/status badges, position counter (`3 / 17`), and edge-context hints where present. Command nodes show their `run` string instead of a body.
3. Traversal model:
   - Successors of the current node (outbound links/edges, ordered by canvas layer layout then title) are candidates; one is highlighted via footer chips.
   - Up/down rotate the highlight among candidates when there are several.
   - Right follows the highlighted candidate (pushing current onto a history stack); with no successors it is a no-op.
   - Left pops the history stack (back); at the root it is a no-op.
   - Traversal uses the already-loaded GraphCanvasResponse nodes/edges — zero new API calls.
4. Exit: Escape leaves presentation mode and re-selects the last-presented node on the canvas.
5. Guard rails: key handling ignores keystrokes while an editor/input/dialog has focus (same pattern as existing canvas shortcuts).

## Non-Goals

Editing content inside presentation mode (Enter opens the node normally, exiting the mode); animations beyond a light fade/slide transition; touch/gesture navigation; speaker notes; exporting decks.

## Architecture

- New hook `usePresentationMode(graphPath, nodes, edges)` owning: active flag, current id, candidate list, highlight index, history stack; pure reducer logic kept in `frontend/src/lib/presentationNavigation.ts` for unit testing.
- New component `PresentationOverlay.tsx` mounted from MiddleContent above the canvas shell; reuses markdown preview components and badge styles.
- Key handling added to the canvas-surface keyboard effect layer; toolbar button in the existing graph-canvas-toolbar.
- No Go/backend changes; no new endpoints.

## Control Flow

Press p on a graph → backdrop dims, first/selected node appears as a slide → down highlights among branches → right follows highlighted → left steps back → Escape returns to the canvas with that node selected.

## Edge Cases And Failure Modes

- Node with no successors: right is a no-op; counter still shows.
- Cycles (a→b→a): allowed; history grows, left unwinds.
- Graph changes while presenting: current node deleted → snap to nearest valid slide or exit gracefully.
- Single-node graph: mode works, both directions no-op.

## Testing Strategy

Vitest unit tests for the navigation reducer (order, highlight rotation, history pop, cycle safety, deletion fallback); component test for overlay render + Escape exit; manual pass in desktop build.

## Risks And Tradeoffs

- Layer-order default may surprise versus document order — mitigated later by an optional toggle if wanted; keeping v1 simple.
- Keyboard conflict risk with future shortcuts — `p` scoped to graph-canvas-active + non-input focus.

## Open Questions

None blocking. Entry key `p` approved as proposed.