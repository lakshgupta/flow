---
id: development/20260820-007-FIX-canvas-only-zoom/fix-notes
type: note
graph: development/20260820-007-FIX-canvas-only-zoom
title: Root cause and validation for canvas-only zoom
description: 'Touchpad pinch / Ctrl+wheel over the canvas zoomed the whole desktop app; capture-phase wheel handling on the canvas shell prevents page zoom and zooms the canvas even over overlay nodes (commit: bdb581b)'
tags:
    - bugfix
    - frontend
    - desktop
    - canvas
links:
    - node: development/20260820-007-FIX-canvas-only-zoom/fix-canvas-only-zoom
      context: Fix task
      relationships:
        - maps-to
---

## Root Cause

In the desktop app (Wails/WebKitGTK), a touchpad pinch over the graph canvas
zoomed the **whole app** — left and right panels included — instead of only
the canvas.

1. **Trackpad pinch arrives as Ctrl+wheel.** WebKitGTK (like Chrome) delivers
   touchpad pinch gestures to the page as `wheel` events with `ctrlKey` set.
   If nothing calls `preventDefault()`, the webview applies its page zoom to
   the entire UI.
2. **React Flow only guards its own pane.** The canvas zoom (`zoomOnScroll`)
   is handled by a wheel listener on the `.react-flow__pane` element, which
   zooms the canvas and calls `preventDefault()`. But graph nodes are rendered
   in `.graph-canvas-overlay` — an absolutely-positioned **sibling** rendered
   above the React Flow element (nodes have `pointer-events: auto`). Wheel
   events over a node never reach React Flow's pane handler, so the gesture
   fell through to the webview's page zoom: the canvas did not zoom and the
   whole app scaled instead.

## Fix

1. **Capture-phase wheel listener on the canvas shell**
   (`GraphCanvasSurface.tsx`): for any `ctrlKey`/`metaKey` wheel event inside
   the shell, call `event.preventDefault()` — stopping the webview's page
   zoom no matter what the gesture targets (pane, node, overlay, toolbar).
   React Flow's own bubble-phase handler is unaffected (preventDefault does
   not stop propagation) and still zooms the canvas for gestures over its
   pane.
2. **Manual canvas zoom for overlay targets**: when the event is NOT over the
   React Flow pane (i.e. over a graph node), zoom the canvas explicitly via a
   new `zoomCanvasByWheel` surface action. The math lives in a new pure module
   `frontend/src/lib/canvasZoom.ts`, mirroring React Flow's own wheel math
   (`wheelDelta`: `-deltaY * (deltaMode === 1 ? 0.05 : deltaMode ? 1 : 0.002)`,
   exponential zoom `zoom * 2^delta`), clamped to the canvas zoom bounds
   (`CANVAS_MIN_ZOOM = 0.5`, `CANVAS_MAX_ZOOM = 1.6` — now shared constants,
   also used by the ReactFlow `minZoom`/`maxZoom` props), and anchored so the
   flow point under the cursor stays fixed while zooming.

## Validation

- **Unit tests** (`src/lib/canvasZoom.test.ts`, 9 tests): zoom in/out step
  normalization for each `deltaMode`, anchoring (the flow point under the
  cursor maps back to the same screen coordinate before and after zoom),
  clamping at both zoom bounds, and no-op when the zoom cannot change.
- **Headless Chromium end-to-end** against the built app:
  - Ctrl+wheel over the empty pane: canvas 1 → 1.18 → (page zoom unchanged,
    `visualViewport.scale` 1, `documentElement.clientWidth` 1600).
  - Ctrl+wheel over a graph node (overlay): canvas 1.18 → 1.39 (previously
    nothing zoomed — the gesture was lost), clamped at the 1.6 max on further
    zoom in, zooms back out correctly; page zoom unchanged throughout.
  - Plain wheel over the pane keeps the pre-existing React Flow behavior
    (unchanged by this fix).
- Full frontend suite: **273/273 pass**; `tsc --noEmit` clean; graph validate
  clean.
