---
id: development/20260821-004-FIX-mutation-feedback-timeout/commit-mutation-feedback-timeout
type: note
graph: development/20260821-004-FIX-mutation-feedback-timeout
title: Commit mutation feedback timeout fix
description: 'Commit scope and validation for the completed mutation feedback dismissal fix (commit: dfc2e5c)'
tags:
    - commit
links:
    - node: development/20260821-004-FIX-mutation-feedback-timeout/auto-dismiss-mutation-feedback
      context: Commit records the centralized mutation-success timeout implementation
      relationships:
        - maps-to
    - node: development/20260821-004-FIX-mutation-feedback-timeout/test-mutation-feedback-dismissal
      context: Commit records the regression test for disappearing success feedback
      relationships:
        - maps-to
---

This commit includes the completed tasks auto-dismiss-mutation-feedback and test-mutation-feedback-dismissal. It clears mutationSuccess after 2 seconds with timer cleanup and verifies that Index refreshed feedback disappears. Validation: npm test -- --run src/App.test.tsx (58 passed); npx tsc --noEmit (passed). Commit: dfc2e5c. Excluded: current unrelated edits to .flow/data/home.md.