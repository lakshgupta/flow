---
id: development/20260511-001-FIX-home-backlog-followup/narrow-right-icon-rail
type: task
graph: development/20260511-001-FIX-home-backlog-followup
title: Narrow right icon rail
description: 'Reduce right rail width so it consumes less horizontal space (commit: da88b5c)'
tags:
    - implementation
    - frontend
status: Success
links:
    - node: development/20260511-001-FIX-home-backlog-followup/prevent-thread-right-rail-overlap
      relationships:
        - depends-on
---

- Reduced the fixed right icon rail width, icon button size, and reserved overlap space in the docked right sidebar.
- Kept the existing docked rail structure intact so later overlap and contrast tasks can build on the narrower baseline.

Validation

- cd frontend && npm run build
- Attempted: cd frontend && npm test -- src/App.test.tsx -t "shows a document icon after node selection and opens a thread root from it" (blocked by an unrelated JSON import attribute error in the test environment)