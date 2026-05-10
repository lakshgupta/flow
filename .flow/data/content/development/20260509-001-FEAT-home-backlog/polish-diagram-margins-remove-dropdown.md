---
id: development/20260509-001-FEAT-home-backlog/polish-diagram-margins-remove-dropdown
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Polish diagram sections and remove dropdown
description: Tighten Mermaid/Excalidraw section spacing and remove unnecessary language selector controls from dedicated diagram sections
status: Success
tags:
    - implementation
    - frontend
---

- Updated `frontend/src/components/editor/ui/code-block-view/code-block-view.tsx` to remove the language dropdown from dedicated Mermaid and Excalidraw section headers.
- Updated `frontend/src/components/editor/ui/code-block-view/code-block-view.test.tsx` assertions to confirm the dropdown is absent in these sections.
- Refined `frontend/src/styles.css` spacing for diagram section container, header, body, and Excalidraw margins to produce a sleeker layout.

Validation

- cd frontend && npm test -- src/components/editor/ui/code-block-view/code-block-view.test.tsx
- cd frontend && npm run build
