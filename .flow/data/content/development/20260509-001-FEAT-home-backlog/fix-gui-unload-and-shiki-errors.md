---
id: development/20260509-001-FEAT-home-backlog/fix-gui-unload-and-shiki-errors
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Fix GUI unload and Shiki errors
description: Remove recurring GUI console errors from unload permissions policy violations and Shiki parser failures for diagram code blocks
status: Success
tags:
    - implementation
    - frontend
    - backend
---

- Updated `frontend/src/components/editor/define-editor-extension.ts` so Shiki highlighting is scoped away from regular code blocks (`nodeTypes: ['mathBlock']`), which prevents parser resolution attempts for non-bundled diagram languages such as `excalidraw`.
- Added a regression assertion in `frontend/src/components/editor/define-editor-extension.test.ts` to lock the Shiki configuration.
- Updated `internal/httpapi/server.go` to emit `Permissions-Policy: unload=(self)` for GUI responses so browser policy violations about unload handlers are not emitted.

Validation

- cd frontend && npm test -- src/components/editor/define-editor-extension.test.ts
- cd frontend && npm run build
- cd . && go test ./internal/httpapi (fails in current workspace due pre-existing malformed-markdown fixture expectations unrelated to these changes)
