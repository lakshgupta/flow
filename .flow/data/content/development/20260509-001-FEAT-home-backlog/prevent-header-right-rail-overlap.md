---
id: development/20260509-001-FEAT-home-backlog/prevent-header-right-rail-overlap
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Prevent header and right rail overlap
description: Keep the floating right-rail controls visually separated from the workspace shell header
status: Success
tags:
    - implementation
    - frontend
---

- Updated `frontend/src/styles.css` so the floating `.right-sidebar-icons` rail anchors below a dedicated header offset (`--workspace-header-rail-offset`) on desktop sizes.
- Added a responsive fallback for smaller screens to keep the previous compact top inset behavior.

Validation

- cd frontend && npm run build
