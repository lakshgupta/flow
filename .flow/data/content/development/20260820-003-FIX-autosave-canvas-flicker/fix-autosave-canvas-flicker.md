---
id: development/20260820-003-FIX-autosave-canvas-flicker/fix-autosave-canvas-flicker
type: task
graph: development/20260820-003-FIX-autosave-canvas-flicker
title: Stop graph canvas reload flicker on every autosave
description: Every document save bumps graphCanvasReloadToken, replacing the visible canvas with a loading skeleton and refetching; reload only when the save changed the graph or links
tags:
    - bugfix
    - frontend
    - performance
status: Done
---

