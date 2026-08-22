---
id: development/20260821-005-FEAT-sidebar-contextual-toc/test-sidebar-toc-navigation
type: task
graph: development/20260821-005-FEAT-sidebar-contextual-toc
title: Test sidebar TOC navigation
description: 'Cover document, Home, and thread transitions, Back navigation, graph expansion, empty headings, heading scrolling, and absence of editor TOCs. Results: npm test (293 passed); npx tsc --noEmit; go test ./...; npm run build all passed.'
tags:
    - test
status: Done
links:
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/wire-sidebar-toc-transitions
      context: Integration tests require document and thread transitions to be wired
      relationships:
        - depends-on
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/remove-editor-toc-surfaces
      context: Integration tests require duplicated editor TOCs to be removed
      relationships:
        - depends-on
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/implement-sidebar-toc-view
      context: Integration tests require the sidebar TOC view implementation
      relationships:
        - depends-on
---

