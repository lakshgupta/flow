---
id: development/20260530-004-FIX-canvas-refresh/note-root-cause
type: note
graph: development/20260530-004-FIX-canvas-refresh
title: Root cause — canvas not refreshing after file drop
description: handleRefreshGraphTree and reloadCanvas were parameters of useGraphCanvasSurfaceActions but missing from actionRefs, so the drop handler silently never called them
tags:
  - analysis
  - desktop
  - canvas
---

handleGraphCanvasFilesDropFromURIsBridge calls actionRefs.current.handleRefreshGraphTree() and
actionRefs.current.reloadCanvas() after creating notes. However, handleRefreshGraphTree and
reloadCanvas were not included in the actionRefs object created by useLatestRef. The calls
resolved to undefined and silently did nothing, so the canvas never refreshed after a file drop.

Fix: add both functions to the actionRefs object in useGraphCanvasSurfaceActions.
Also add cache: "no-store" to requestJSON to prevent browser/asset-server caching of API responses.

This was the final missing piece — all previous work (Wails binding, drop handlers, reloadCanvas
callback, graph tree refresh) was correctly wired, but the actionRefs omission meant the bridge
function never invoked them.
