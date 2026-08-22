---
id: development/20260822-003-FEAT-jira-aha-ticket-sync/sync-orchestration
type: task
graph: development/20260822-003-FEAT-jira-aha-ticket-sync
title: Implement Jira sync orchestration
description: 'Implement Jira sync orchestration (Done 2026-08-22; evidence: internal/workspace/sync_jira_test.go — create/update/archive-tag/idempotency, go test ./... green). Markdown-first diff into external/jira/<PROJECT>/; issue-key-derived stable ids; archived-source tag instead of deletion; last-synced line excluded from change comparison; index rebuilt after mutations.'
tags:
    - implementation
    - core
status: Done
links:
    - node: development/20260822-003-FEAT-jira-aha-ticket-sync/jira-client-interface
      context: Orchestration fetches through the client interface
      relationships:
        - depends-on
---

