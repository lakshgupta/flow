---
id: development/20260821-005-FEAT-sidebar-contextual-toc/commit-sidebar-contextual-toc
type: note
graph: development/20260821-005-FEAT-sidebar-contextual-toc
title: Commit contextual sidebar TOC
description: 'Commit scope and validation for the contextual sidebar TOC feature and its bidirectional return navigation (commit: af082f8)'
tags:
    - commit
links:
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/implement-sidebar-toc-view
      context: Commit records the sidebar TOC view implementation
      relationships:
        - maps-to
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/wire-sidebar-toc-transitions
      context: Commit records the document, Home, and thread transition wiring
      relationships:
        - maps-to
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/remove-editor-toc-surfaces
      context: Commit records removal of duplicated editor TOC surfaces
      relationships:
        - maps-to
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/test-sidebar-toc-navigation
      context: Commit records the completed regression coverage
      relationships:
        - maps-to
    - node: development/20260821-005-FEAT-sidebar-contextual-toc/review-sidebar-toc
      context: Commit records the completed implementation review
      relationships:
        - maps-to
    - node: development/20260821-006-FIX-sidebar-toc-return-navigation/implement-sidebar-toc-return-navigation
      context: Commit records bidirectional TOC return navigation
      relationships:
        - maps-to
---

This commit includes the completed tasks implement-sidebar-toc-view, wire-sidebar-toc-transitions, remove-editor-toc-surfaces, test-sidebar-toc-navigation, review-sidebar-toc, and implement-sidebar-toc-return-navigation. It moves Home, document, and thread heading navigation into the left sidebar, adds Content/TOC return controls, removes duplicated editor TOCs and obsolete TOC ratio persistence, preserves legacy SQLite compatibility, and updates tests and architecture records. Validation: npm test (293 passed); npx tsc --noEmit; go test ./...; npm run build; git diff --check. Commit: af082f8. Excluded: none of the current changes.