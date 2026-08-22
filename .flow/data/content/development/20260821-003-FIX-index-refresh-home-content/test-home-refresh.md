---
id: development/20260821-003-FIX-index-refresh-home-content/test-home-refresh
type: task
graph: development/20260821-003-FIX-index-refresh-home-content
title: Test Home refresh after rebuild
description: Frontend test rebuilds the index while the Home editor is mounted and asserts the refreshed body reaches the editor
tags:
    - test
status: Done
links:
    - node: development/20260821-003-FIX-index-refresh-home-content/refresh-home-on-index-rebuild
      context: Test exercises the force-reload behavior added by the implementation
      relationships:
        - depends-on
---
