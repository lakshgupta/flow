---
id: development/20260822-003-FEAT-jira-aha-ticket-sync/cli-sync-jira
type: task
graph: development/20260822-003-FEAT-jira-aha-ticket-sync
title: Add flow sync jira CLI command
description: 'Add flow sync jira CLI command (Done 2026-08-22; evidence: cmd/flow/sync_test.go — end-to-end mirror against httptest server, JSON output, missing-config error). Defaults to configured projects, --project override repeatable, credentials from FLOW_JIRA_API_TOKEN env var only.'
tags:
    - implementation
    - cli
status: Done
links:
    - node: development/20260822-003-FEAT-jira-aha-ticket-sync/sync-orchestration
      context: CLI invokes sync orchestration
      relationships:
        - depends-on
---

