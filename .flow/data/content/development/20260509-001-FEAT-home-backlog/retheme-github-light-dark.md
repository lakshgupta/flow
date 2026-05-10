---
id: development/20260509-001-FEAT-home-backlog/retheme-github-light-dark
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Retheme to GitHub-like light and dark
description: Shift shell and semantic design tokens toward GitHub-style light and dark color systems
status: Success
tags:
    - implementation
    - frontend
---

- Updated `frontend/src/styles.css` base and dark semantic tokens (`--background`, `--foreground`, `--primary`, `--border`, chart colors, semantic surfaces, edge colors, and status colors) to align with GitHub-like palettes.
- Adjusted page atmospheric gradients for both light and dark modes to match the updated token direction.

Validation

- cd frontend && npm run build
