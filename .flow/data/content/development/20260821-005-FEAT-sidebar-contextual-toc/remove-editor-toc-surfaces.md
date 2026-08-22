---
id: development/20260821-005-FEAT-sidebar-contextual-toc/remove-editor-toc-surfaces
type: task
graph: development/20260821-005-FEAT-sidebar-contextual-toc
title: Remove editor TOC surfaces
description: 'Remove Home, center-thread, and right-rail TOC markup, toggles, resize handlers, and obsolete documentTOCRatio plumbing while retaining document properties. Validation: npx tsc --noEmit; go test ./...; npm test (293 passed); npm run build. Commit: af082f8'
tags:
    - implementation
status: Done
links:
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/implement-sidebar-toc-view
      context: Editor TOC removal follows the new sidebar TOC destination
      relationships:
        - depends-on
---

