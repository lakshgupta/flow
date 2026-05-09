---
id: development/20260509-001-FEAT-home-backlog/tighten-calendar-pane-layout
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Tighten calendar pane layout
description: Remove the dead gap between the center thread pane and the right rail when the calendar opens
tags:
    - fix
    - frontend
status: Ready
links:
    - node: development/20260509-001-FEAT-home-backlog/review-dedupe-frontend
      context: Use the final task for bounded cleanup after the backlog fixes land.
      relationships:
        - depends-on
---

Adjust the center and right pane sizing logic so the center surface slides left cleanly when the calendar opens.