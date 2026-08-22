---
id: development/20260822-003-FEAT-jira-aha-ticket-sync/jira-config-storage
type: task
graph: development/20260822-003-FEAT-jira-aha-ticket-sync
title: Add integrations config for Jira host and project keys
description: 'Add integrations config for Jira host and project keys (Done 2026-08-22; evidence: go build + cmd/config tests green). config.Workspace gains integrations.jira {host, projects} with validation; flow configure gains --jira-host/--jira-project (repeatable); credentials documented as FLOW_JIRA_API_TOKEN env var, never persisted.'
tags:
    - implementation
    - config
status: Done
---

