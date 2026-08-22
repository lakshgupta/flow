---
id: development/20260821-004-FIX-mutation-feedback-timeout/auto-dismiss-mutation-feedback
type: task
graph: development/20260821-004-FIX-mutation-feedback-timeout
title: Auto-dismiss mutation success feedback
description: 'Add a centralized timer that clears mutationSuccess after the feedback window and cleans up on replacement or unmount (commit: dfc2e5c)'
tags:
    - implementation
status: Done
links:
    - node: development/20260821-004-FIX-mutation-feedback-timeout/test-mutation-feedback-dismissal
      context: Regression test depends on the timeout behavior being implemented
      relationships:
        - depends-on
---
