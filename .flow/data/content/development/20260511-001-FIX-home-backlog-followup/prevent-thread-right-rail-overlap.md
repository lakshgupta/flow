---
id: development/20260511-001-FIX-home-backlog-followup/prevent-thread-right-rail-overlap
type: task
graph: development/20260511-001-FIX-home-backlog-followup
title: Prevent thread and rail overlap
description: 'Keep the thread view clear of the right icon rail (commit: 7ff4c4b)'
tags:
    - fix
    - frontend
status: Success
links:
    - node: development/20260511-001-FIX-home-backlog-followup/tighten-top-breadcrumb
      relationships:
        - depends-on
---

- Reserved explicit right-side clearance for docked thread stacks so the active thread panel no longer expands under the fixed icon rail.
- Applied the same clearance to dense and ultra thread widths to keep the overlap fix consistent across thread density modes.

Validation

- cd frontend && npm run build