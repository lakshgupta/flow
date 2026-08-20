---
id: development/20260820-007-FIX-canvas-only-zoom/fix-canvas-only-zoom
type: task
graph: development/20260820-007-FIX-canvas-only-zoom
title: Restrict touchpad zoom to the canvas in the desktop app
description: 'Trackpad pinch / Ctrl+wheel over the graph canvas zooms the whole app (including left/right panels) instead of only the canvas. Canvas node overlay sits above the React Flow pane, so wheel events over nodes never reach React Flow''s zoom handler and the webview''s page zoom takes over (commit: bdb581b)'
status: Done
---

