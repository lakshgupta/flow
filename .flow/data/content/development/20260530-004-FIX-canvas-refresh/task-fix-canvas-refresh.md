---
id: development/20260530-004-FIX-canvas-refresh/task-fix-canvas-refresh
type: task
graph: development/20260530-004-FIX-canvas-refresh
title: Fix canvas not refreshing after drag-drop file notes are created
description: The drop handler's canvas reload calls were silently no-ops because handleRefreshGraphTree and reloadCanvas were missing from actionRefs
tags:
  - fix
  - desktop
  - canvas
status: Done
---

<p>Commit: 9495949</p>
