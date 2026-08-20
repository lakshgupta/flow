---
id: development/20260820-003-FIX-autosave-canvas-flicker/fix-notes
type: note
graph: development/20260820-003-FIX-autosave-canvas-flicker
title: Root cause and validation for autosave canvas flicker
tags:
    - bugfix
    - frontend
    - performance
links:
    - node: development/20260820-003-FIX-autosave-canvas-flicker/fix-autosave-canvas-flicker
      context: Fix task
      relationships:
        - maps-to
---

## Root Cause

Every document autosave (400ms after typing stops, or every 4s during
continuous typing) called setGraphCanvasReloadToken, which triggers the graph
canvas effect: setGraphCanvasLoading(true) swaps the visible canvas for a
pulsing skeleton card, then refetches /api/graph-canvas and re-applies node
positions. With the document editor open beside the canvas (right-rail mode,
or the graph surface visible while a save lands), the canvas visibly
skeleton-flashes and re-renders on every save — the 'text screen flickers'
report. The refetch also fired when the canvas was not even mounted (center
mode), wasting a request per save.

Verified headless in Chromium against the built app: during typing + save
with the doc in the right rail, the middle shell swapped to .skeleton-card
once per save (1 flash in the probe window) and issued a /api/graph-canvas
request; editor text DOM stayed stable (no wholesale replacement, no scroll
reset).

## Fix

frontend/src/App.tsx — handleSaveDocument no longer bumps
graphCanvasReloadToken unconditionally. The in-place
updateGraphCanvasDocumentEntry already applies node content (title,
description preview, tags, status, color) to the canvas, so a routine text
save needs no reload. The token is only bumped when the save changed
something the in-place update cannot represent: the node's graph (moved) or
its link set (edges). Added a nodeLinksEqual helper (order-insensitive
compare of node/context/relationships).

frontend/src/components/editor/RichTextEditor.tsx — the renderedHTML memo no
longer depends on the inlineReferences array identity: the parent recreates
that array on every autosave echo with identical content, and re-running
markdownToHTML over the whole document on each save stalled rendering on
larger documents. The render key fully encodes the references, so the memo
now recomputes only when the key or value changes.

## Validation

- Rebuilt frontend + binary; headless Chromium, doc open in right rail with
  canvas visible: typing + save now produces 0 skeleton flashes and 0
  /api/graph-canvas refetches (previously 1+ each). Saved content still
  persists to disk.
- Full frontend suite: 231/231 pass. tsc --noEmit clean.