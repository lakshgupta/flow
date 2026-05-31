---
id: development/20260509-001-FEAT-home-backlog/fix-code-block-exit
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Fix code block cursor escape
description: 'Allow the caret to move out of fenced code blocks after pasted code content (commit: 29984e6)'
tags:
    - fix
    - frontend
status: Success
links:
    - node: development/20260509-001-FEAT-home-backlog/tighten-calendar-pane-layout
      context: Address the layout issue after editor navigation correctness is restored.
      relationships:
        - depends-on
---

Added explicit ArrowUp and ArrowDown escape behavior at code-block boundaries so the caret can leave fenced blocks even when they sit at the document edge, and covered the trailing-block path with a real editor regression.

Validation

- cd frontend && npm test -- src/components/editor/RichTextEditor.shortcuts.test.tsx
- cd frontend && npm run build