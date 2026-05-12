---
id: design/20260511-001-FIX-home-backlog-followup/overview
type: note
graph: design/20260511-001-FIX-home-backlog-followup
title: Home backlog follow-up design
description: Owner mapping and execution strategy for the May 11 home.md backlog fixes
tags:
    - design
    - frontend
---

Current backlog items are all frontend follow-up fixes rooted in three local surfaces: diagram code-block node views, workspace shell layout styling, and graph/editor state synchronization.

Execution order:
1. Diagram node controls and navigation correctness.
2. Excalidraw rendering and persistence correctness.
3. Graph canvas color inheritance.
4. Right-rail and breadcrumb layout polish.
5. Editor cursor-jump stabilization.
6. Final regression validation.

Validation strategy:
- Prefer owning Vitest suites per task before broader frontend build coverage.
- Use Playwright and full frontend build during final regression when the touched surface warrants it.