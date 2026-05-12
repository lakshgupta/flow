---
id: development/20260511-001-FIX-home-backlog-followup/tighten-top-breadcrumb
type: task
graph: development/20260511-001-FIX-home-backlog-followup
title: Tighten top breadcrumb
description: Reduce the width footprint of the top breadcrumb section
tags:
    - implementation
    - frontend
status: Done
links:
    - node: development/20260511-001-FIX-home-backlog-followup/align-right-rail-icon-contrast
      relationships:
        - depends-on
---

- Tightened the workspace header breadcrumb by reducing breadcrumb gaps, type size, and separator icon size.
- Kept the breadcrumb structure unchanged while shrinking its horizontal footprint in the top shell header.

Validation

- cd frontend && npm run build