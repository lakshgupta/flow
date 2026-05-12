---
id: development/20260511-001-FIX-home-backlog-followup/add-diagram-delete-actions
type: task
graph: development/20260511-001-FIX-home-backlog-followup
title: Add diagram delete actions
description: Add a delete control for Mermaid and Excalidraw diagram sections
tags:
    - implementation
    - frontend
status: Done
links:
    - node: development/20260511-001-FIX-home-backlog-followup/fix-diagram-cursor-exit
      relationships:
        - depends-on
---

- Added delete actions to the Mermaid and Excalidraw code-block views so users can remove those embedded sections directly from the editor.
- Kept the diagram language selector in the same action strip so embedded blocks still expose their block language.

Validation

- cd frontend && npm test -- src/components/editor/ui/code-block-view/code-block-view.test.tsx
- cd frontend && npm run build