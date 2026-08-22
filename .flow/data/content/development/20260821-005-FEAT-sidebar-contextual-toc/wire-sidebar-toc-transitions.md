---
id: development/20260821-005-FEAT-sidebar-contextual-toc/wire-sidebar-toc-transitions
type: task
graph: development/20260821-005-FEAT-sidebar-contextual-toc
title: Wire sidebar TOC transitions
description: 'Switch the sidebar to the active Home/document/thread TOC on navigation, keep graph expansion in Content mode, and preserve heading scroll behavior. Validation: npm test (293 passed), including document, Home, thread, Back navigation, and graph expansion coverage. Commit: af082f8'
tags:
    - implementation
status: Done
links:
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/implement-sidebar-toc-view
      context: Transition wiring requires the sidebar Content/TOC view to exist
      relationships:
        - depends-on
---

