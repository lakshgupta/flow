---
id: design/20260511-002-FIX-home-backlog-refresh/overview
type: note
graph: design/20260511-002-FIX-home-backlog-refresh
title: Home backlog refresh design
description: Owner mapping and execution strategy for the refreshed May 11 home.md backlog
tags:
    - design
    - frontend
---

Current backlog items stay within four local surfaces: graph color tokens and tinted node styling, editor slash-menu insertion for diagram blocks, Excalidraw code-block interaction, and overall shell spacing and chrome polish.

Execution order:
1. Increase graph node color visibility in light mode.
2. Restore graph node tint visibility in dark mode.
3. Fix Mermaid and Excalidraw slash-menu insertion.
4. Restore Excalidraw editor interaction and drawing.
5. Polish the workspace shell styling.
6. Final regression validation.

Validation strategy:
- Prefer owner-scoped Vitest suites for graph color, slash menu, code-block view, and app shell changes.
- Run a frontend build after each task.
- Finish with broad frontend unit coverage and a frontend build.