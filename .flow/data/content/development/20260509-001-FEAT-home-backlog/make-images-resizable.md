---
id: development/20260509-001-FEAT-home-backlog/make-images-resizable
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Make images resizable
description: Register the production editor image node view so inserted images expose the resize handle
tags:
    - fix
    - frontend
status: Success
---

Registered the custom image node view in the production editor extension so the existing resizable image component is actually mounted for inserted images instead of staying example-only code.

Validation

- cd frontend && npm test -- src/components/editor/define-editor-extension.test.ts
- cd frontend && npm run build