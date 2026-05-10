---
id: development/20260509-001-FEAT-home-backlog/make-excalidraw-resizable
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Make Excalidraw resizable
description: 'Allow the embedded Excalidraw surface to be resized without breaking editor layout (commit: d60ab54)'
tags:
    - implementation
    - frontend
status: Success
links:
    - node: development/20260509-001-FEAT-home-backlog/fix-editor-toolbar-focus
      context: Proceed to the next backlog item after Excalidraw feature work is complete.
      relationships:
        - depends-on
---

Implemented a resizable Excalidraw editor shell by persisting the diagram height inside the stored Excalidraw JSON source instead of trying to extend the editor code-block schema.

- Extended frontend/src/lib/excalidraw.ts to normalize a persisted Excalidraw height, clamp it to a bounded range, and rewrite that height without disturbing the scene payload.
- Updated frontend/src/components/editor/ui/code-block-view/code-block-view.tsx so the Excalidraw node view renders with the stored height, exposes a bottom drag handle, and writes the resized height back into the code block content on pointer release.
- Added focused helper coverage in frontend/src/lib/excalidraw.test.ts and resize interaction coverage in frontend/src/components/editor/ui/code-block-view/code-block-view.test.tsx.
- Refined frontend/src/styles.css so the Excalidraw surface fills the resized shell and the resize affordance only appears when the editor is active.

Validation

- cd frontend && npm test -- src/lib/excalidraw.test.ts src/components/editor/ui/code-block-view/code-block-view.test.tsx
- cd frontend && npm run build