---
id: development/20260506-001-FEAT-mermaid-diagrams/regression-mermaid-authoring
type: task
graph: development/20260506-001-FEAT-mermaid-diagrams
title: Regress Mermaid authoring
description: Add focused regression coverage for Mermaid slash insertion, preview rendering, and persistence
tags:
    - test
    - frontend
status: Success
---

- Added Mermaid readonly coverage in frontend/src/components/HomeCalendarPanel.test.tsx.
- Added editor-level regression coverage in frontend/src/components/editor/ui/slash-menu/slash-menu.test.tsx and frontend/src/components/editor/ui/code-block-view/code-block-view.test.tsx for slash insertion and editor preview.
- Executable validation: cd frontend && npm test -- src/components/RenderedMarkdown.test.tsx src/components/HomeCalendarPanel.test.tsx src/components/editor/ui/slash-menu/slash-menu.test.tsx src/components/editor/ui/code-block-view/code-block-view.test.tsx
- Executable validation: cd frontend && npm run build
- Attempted a real-backend Playwright authoring path, but the live slash autocomplete did not open under the existing Chromium harness, so the final committed regression stays at the editor/component level allowed by the task.