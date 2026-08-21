---
id: development/20260821-002-FIX-desktop-workspace-switch-writes/test-switched-root-writes
type: task
graph: development/20260821-002-FIX-desktop-workspace-switch-writes
title: Test switched-root write path
description: Backend test proves document + home writes follow SetRoot in both directions; httpapi test proves OnRootChanged fires on select and global fallback
tags:
    - test
status: Done
links:
    - node: development/20260821-002-FIX-desktop-workspace-switch-writes/wire-workspace-switch-notification
      context: Tests exercise the switched-root behavior made possible by the wiring
      relationships:
        - depends-on
---

