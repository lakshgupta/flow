---
id: development/20260509-001-FEAT-home-backlog/fix-heading-enter-exits
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Fix heading Enter exit
description: "Ensure Enter after an atx heading returns to normal paragraph text"
tags:
    - fix
    - frontend
status: Success
---

Added a dedicated Enter keymap for heading text blocks so pressing Enter at the end of a heading exits into a normal paragraph instead of continuing the heading style.

Validation

- cd frontend && npm test -- --run src/components/editor/RichTextEditor.shortcuts.test.tsx
