---
id: development/20260511-001-FIX-home-backlog-followup/align-right-rail-icon-contrast
type: task
graph: development/20260511-001-FIX-home-backlog-followup
title: Align right rail icon contrast
description: Match right rail icon contrast with the left sidebar controls
tags:
    - implementation
    - frontend
status: Done
links:
    - node: development/20260511-001-FIX-home-backlog-followup/fix-editor-cursor-jump
      relationships:
        - depends-on
---

- Shifted the right rail icon buttons from a muted translucent treatment to the same solid surface, border, and foreground contrast used by the left-side shell controls.
- Kept the active-state behavior intact while making the default icon contrast consistent with the left panel.

Validation

- cd frontend && npm run build