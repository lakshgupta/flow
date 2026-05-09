---
id: development/20260509-001-FEAT-home-backlog/fix-excalidraw-persistence-and-diagram-sections
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Fix Excalidraw persistence and diagram sections
description: Preserve Excalidraw scene data and present Mermaid and Excalidraw as dedicated diagram sections in the editor
tags:
    - fix
    - frontend
status: Success
---

Stopped the Excalidraw editor node view from persisting its mount-time empty sync before the user interacts, which preserves previously saved drawings instead of wiping them on reopen. Also reworked the Mermaid and Excalidraw editor presentation so both appear as dedicated diagram sections with specialized chrome instead of generic fenced-code block UI.

Validation

- cd frontend && npm test -- src/components/editor/ui/code-block-view/code-block-view.test.tsx
- cd frontend && npm run build