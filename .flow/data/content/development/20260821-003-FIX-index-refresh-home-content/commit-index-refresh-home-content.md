---
id: development/20260821-003-FIX-index-refresh-home-content/commit-index-refresh-home-content
type: note
graph: development/20260821-003-FIX-index-refresh-home-content
title: Commit index refresh Home fix
description: Commit scope and validation for the completed index-refresh Home-content fix
tags:
    - commit
links:
    - node: development/20260821-003-FIX-index-refresh-home-content/refresh-home-on-index-rebuild
      context: Commit records the completed Home reload implementation
      relationships:
        - maps-to
    - node: development/20260821-003-FIX-index-refresh-home-content/test-home-refresh
      context: Commit records the regression test validating Home content refresh
      relationships:
        - maps-to
---

This commit includes the completed tasks refresh-home-on-index-rebuild and test-home-refresh. It flushes pending Home edits before rebuilding the index, force-reloads freshly indexed Home content into the mounted editor, and adds regression coverage. Validation: npm test -- --run src/App.test.tsx (58 passed). Excluded: none of the current changes.