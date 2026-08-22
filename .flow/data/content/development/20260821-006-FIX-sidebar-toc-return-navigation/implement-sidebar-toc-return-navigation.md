---
id: development/20260821-006-FIX-sidebar-toc-return-navigation/implement-sidebar-toc-return-navigation
type: task
graph: development/20260821-006-FIX-sidebar-toc-return-navigation
title: Implement bidirectional sidebar TOC navigation
description: 'Add Show table of contents control in Content mode and make the active document/Home row return to the current TOC. Validation: npm test (293 passed); npx tsc --noEmit; git diff --check.'
tags:
    - implementation
status: Done
links:
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/wire-sidebar-toc-transitions
      context: Extends the completed TOC transition wiring with a return path
      relationships:
        - depends-on
---

