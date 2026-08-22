---
id: development/20260821-003-FIX-index-refresh-home-content/refresh-home-on-index-rebuild
type: task
graph: development/20260821-003-FIX-index-refresh-home-content
title: Refresh Home body on index rebuild
description: handleRebuildIndex flushes pending home edits, then sets a force-reload flag that bypasses the home-sync preservation guard so the freshly indexed home body is pushed into the editor
tags:
    - implementation
status: Done
---
