---
id: development/20260822-002-FEAT-roadmap-batch-parallel-dev/implement-claim-lifecycle
type: task
graph: development/20260822-002-FEAT-roadmap-batch-parallel-dev
title: Implement claim lifecycle (claim/stale/resume/revert/handoff)
description: 'Implement claim lifecycle (Done 2026-08-22; evidence: TestClaimIsStale + TestSelectClaimCandidate + cmd claim tests). SelectClaimCandidate skips claimed packets; ClaimIsStale enforces 4h default threshold; session/session-at patch fields plumbed through core.UpdateDocumentPatch -> workspace.DocumentPatch -> TaskMetadata; stale claims surface resume/revert/handoff options instead of blocking.'
tags:
    - implementation
    - core
status: Done
links:
    - node: development/20260822-002-FEAT-roadmap-batch-parallel-dev/add-session-fields
      context: Claims stamp the session frontmatter fields
      relationships:
        - depends-on
---

