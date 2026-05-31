---
id: development/20260509-001-FEAT-home-backlog/enable-mermaid-image-excalidraw-resize
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Enable diagram and image resizing
description: Ensure image, Mermaid, and Excalidraw sections are resizable with direct editor affordances
tags:
    - implementation
    - frontend
status: Success
---

- Added Mermaid preview resize interactions in `frontend/src/components/editor/ui/code-block-view/code-block-view.tsx` with a dedicated drag handle and constrained height range.
- Added Mermaid resize shell and handle styling in `frontend/src/styles.css`.
- Extended `frontend/src/components/editor/ui/code-block-view/code-block-view.test.tsx` to assert Mermaid resize control rendering.
- Image and Excalidraw resize support remained active via existing image node-view and Excalidraw resize controls.

Validation

- cd frontend && npm test -- src/components/editor/ui/code-block-view/code-block-view.test.tsx
- cd frontend && npm run build
