---
id: development/20260822-003-FEAT-jira-aha-ticket-sync/jira-client-interface
type: task
graph: development/20260822-003-FEAT-jira-aha-ticket-sync
title: Implement JiraClient interface with REST and fake
description: 'Implement JiraClient interface with REST and fake (Done 2026-08-22; evidence: internal/core/jira_test.go — httptest pagination, bearer token header, URL/host validation; go test ./... green). core.JiraIssue + JiraClient interface shaped for later Aha adapter; REST client paginates /rest/api/2/search.'
tags:
    - implementation
    - core
status: Done
links:
    - node: development/20260822-003-FEAT-jira-aha-ticket-sync/jira-config-storage
      context: Client consumes the integrations config
      relationships:
        - depends-on
---

