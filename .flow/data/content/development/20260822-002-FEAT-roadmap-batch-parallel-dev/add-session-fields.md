---
id: development/20260822-002-FEAT-roadmap-batch-parallel-dev/add-session-fields
type: task
graph: development/20260822-002-FEAT-roadmap-batch-parallel-dev
title: Add optional session/session-at fields to task documents
description: 'Add optional session/session-at fields to task documents (Done 2026-08-22; evidence: go test ./... green). TaskMetadata gains session + session-at (yaml session/session-at, omitempty); round-trip parse/serialize verified including absent-field omission; unclaimed tasks unchanged.'
tags:
    - implementation
status: Done
---

