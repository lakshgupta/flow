---
id: development/20260511-002-FIX-home-backlog-refresh/restore-node-colors-dark
type: task
graph: development/20260511-002-FIX-home-backlog-refresh
title: Restore node colors in dark mode
description: Make graph node tints readable in the dark theme
tags:
    - fix
    - frontend
status: Done
links:
    - node: development/20260511-002-FIX-home-backlog-refresh/fix-slash-diagram-trigger
      relationships:
        - depends-on
---

- Added dark-theme overrides for colored graph rows so tagged graphs keep a visible surface tint instead of fading into the sidebar chrome.
- Added stronger dark-theme border and background treatment for tinted graph canvas nodes so their assigned graph color remains readable against dark surfaces.

Validation

- cd frontend && npm run build
- Reviewed the rendered graph tint treatment in the live browser surface after the shared palette and dark-mode CSS changes.