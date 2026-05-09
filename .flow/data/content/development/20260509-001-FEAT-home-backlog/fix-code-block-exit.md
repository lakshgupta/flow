---
id: development/20260509-001-FEAT-home-backlog/fix-code-block-exit
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Fix code block cursor escape
description: Allow the caret to move out of fenced code blocks after pasted code content
tags:
    - fix
    - frontend
status: Ready
links:
    - node: development/20260509-001-FEAT-home-backlog/tighten-calendar-pane-layout
      context: Address the layout issue after editor navigation correctness is restored.
      relationships:
        - depends-on
---

Fix the caret trapping behavior around code blocks and add focused editor coverage for leaving the block.