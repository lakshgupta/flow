---
id: development/20260509-001-FEAT-home-backlog/add-excalidraw-support
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Add Excalidraw support
description: 'Add Excalidraw authoring and rendering through code blocks and slash-menu insertion (commit: dbb71e2)'
tags:
    - implementation
    - frontend
status: Success
links:
    - node: development/20260509-001-FEAT-home-backlog/make-excalidraw-resizable
      context: Resizing depends on the embedded Excalidraw surface existing first.
      relationships:
        - depends-on
---

Implemented Excalidraw as a first-class code-block language similar to Mermaid across the editor code-block view, slash-menu insertion, and readonly markdown rendering.

- Added frontend/src/lib/excalidraw.ts to normalize scene parsing, serialization, and SVG export.
- Extended frontend/src/components/editor/ui/code-block-view/code-block-view.tsx to embed Excalidraw for excalidraw fenced blocks while keeping Mermaid behavior intact.
- Added an Excalidraw Diagram slash-menu action and focused regression coverage in the related frontend tests.
- Extended frontend/src/components/RenderedMarkdown.tsx and frontend/src/styles.css so readonly node/thread rendering hydrates Excalidraw previews and hides the raw JSON source after hydration.
- Added @excalidraw/excalidraw to the frontend dependency set and imported its stylesheet from frontend/src/main.tsx for build-compatible bundling.

Validation

- cd frontend && npm test -- src/components/RenderedMarkdown.test.tsx src/components/editor/ui/code-block-view/code-block-view.test.tsx src/components/editor/ui/slash-menu/slash-menu.test.tsx
- editor diagnostics: frontend/src/lib/excalidraw.ts, frontend/src/components/RenderedMarkdown.tsx, frontend/src/components/editor/ui/code-block-view/code-block-view.tsx, frontend/src/components/editor/ui/slash-menu/slash-menu.tsx, frontend/src/main.tsx, frontend/src/styles.css
- cd frontend && npm run build