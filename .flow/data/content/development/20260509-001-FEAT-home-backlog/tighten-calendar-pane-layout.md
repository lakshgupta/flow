---
id: development/20260509-001-FEAT-home-backlog/tighten-calendar-pane-layout
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Tighten calendar pane layout
description: Remove the dead gap between the center thread pane and the right rail when the calendar opens
tags:
    - fix
    - frontend
status: Success
links:
    - node: development/20260509-001-FEAT-home-backlog/review-dedupe-frontend
      context: Use the final task for bounded cleanup after the backlog fixes land.
      relationships:
        - depends-on
---

Adjusted the docked thread layout so the active center panel grows into the available width when the right rail opens, and removed the trailing docked gutter that kept the thread stack visually separated from the calendar rail.

Validation

- cd frontend && npx playwright test tests/editor-navigation.spec.ts --project=chromium --grep "keeps the thread stack flush against the calendar rail"
- cd frontend && npm run build