---
id: development/20260511-002-FIX-home-backlog-refresh/polish-workspace-shell
type: task
graph: development/20260511-002-FIX-home-backlog-refresh
title: Polish workspace shell
description: 'Refresh spacing, icon treatment, and layout polish across the workspace shell (commit: 4db1a56)'
tags:
    - fix
    - frontend
status: Success
links:
    - node: development/20260511-002-FIX-home-backlog-refresh/run-home-backlog-regression
      relationships:
        - depends-on
---

- Tightened the outer shell spacing and refined the sidebar, workspace header, center editor card, and right rail so the chrome reads as one deliberate system instead of a stack of equally heavy pills.
- Added more atmospheric shell backdrops and slightly crisper active/hover treatments while keeping the existing layout model and interactions intact.

Validation

- cd frontend && npm run build
- Reviewed the rendered workspace shell in the live browser surface after reloading the app.