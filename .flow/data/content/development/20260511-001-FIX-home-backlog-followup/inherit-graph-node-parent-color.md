---
id: development/20260511-001-FIX-home-backlog-followup/inherit-graph-node-parent-color
type: task
graph: development/20260511-001-FIX-home-backlog-followup
title: Inherit graph node parent color
description: Use the closest parent graph directory color for graph canvas node tinting
tags:
    - implementation
    - frontend
status: Done
links:
    - node: development/20260511-001-FIX-home-backlog-followup/narrow-right-icon-rail
      relationships:
        - depends-on
---

- Switched graph canvas node tinting to resolve colors from the closest parent directory before falling back to the node's own graph path.
- Added a graph canvas regression that covers nested graph nodes inheriting the parent directory color.

Validation

- cd frontend && npm test -- src/lib/graphCanvasUtils.test.ts src/lib/graphColors.test.ts
- cd frontend && npm run build