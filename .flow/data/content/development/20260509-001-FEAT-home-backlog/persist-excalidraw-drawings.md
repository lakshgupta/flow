---
id: development/20260509-001-FEAT-home-backlog/persist-excalidraw-drawings
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Persist Excalidraw drawings
description: Persist the first real Excalidraw scene change into the graph-backed note content so drawings reopen from the same graph directory
tags:
    - implementation
    - frontend
status: Success
---

- Adjusted `frontend/src/components/editor/ui/code-block-view/code-block-view.tsx` so mount-time empty Excalidraw syncs are still ignored, but the first non-empty scene update is persisted immediately even if the outer shell interaction flag was not set first.
- Kept Excalidraw storage graph-backed by continuing to serialize the scene into the note's markdown code block, which saves alongside the note in the same graph directory.
- Extended `frontend/src/components/editor/ui/code-block-view/code-block-view.test.tsx` with a regression covering the first non-empty scene update path.

Validation

- cd frontend && npm test -- src/components/editor/ui/code-block-view/code-block-view.test.tsx
- cd frontend && npm run build