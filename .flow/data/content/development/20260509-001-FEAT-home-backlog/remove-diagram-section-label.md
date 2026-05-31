---
id: development/20260509-001-FEAT-home-backlog/remove-diagram-section-label
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Remove diagram section label
description: Drop the visible Special section kicker from Mermaid and Excalidraw editor sections
tags:
    - implementation
    - frontend
status: Success
---

- Removed the visible `Special section` kicker from the specialized Mermaid and Excalidraw code-block node view header in `frontend/src/components/editor/ui/code-block-view/code-block-view.tsx`.
- Updated the focused node-view regression in `frontend/src/components/editor/ui/code-block-view/code-block-view.test.tsx` to assert that the label no longer renders.

Validation

- cd frontend && npm test -- src/components/editor/ui/code-block-view/code-block-view.test.tsx