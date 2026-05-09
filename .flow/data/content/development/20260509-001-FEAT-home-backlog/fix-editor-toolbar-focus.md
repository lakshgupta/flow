---
id: development/20260509-001-FEAT-home-backlog/fix-editor-toolbar-focus
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Fix editor toolbar focus activation
description: Restore slash and heading shortcuts on first click into the markdown editor
tags:
    - fix
    - frontend
status: Ready
links:
    - node: development/20260509-001-FEAT-home-backlog/fix-code-block-exit
      context: Continue through the editor bug backlog in order.
      relationships:
        - depends-on
---

Fix the initial focus or selection regression so editor commands and markdown shortcuts work immediately after clicking into a node editor.