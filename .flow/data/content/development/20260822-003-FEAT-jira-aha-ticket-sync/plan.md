---
id: development/20260822-003-FEAT-jira-aha-ticket-sync/plan
type: note
graph: development/20260822-003-FEAT-jira-aha-ticket-sync
title: 'Plan: Jira ticket sync'
description: 'Plan — status: Completed (all tasks Done 2026-08-22)'
tags:
    - planning
    - jira
    - integration
links:
    - node: design/20260822-003-FEAT-jira-aha-ticket-sync/design
      context: Plan implements the approved ticket-sync design
      relationships:
        - relates-to
---

# Plan: External Ticket Sync (Jira first)

## Status

Planned — implements approved design `design/20260822-003-FEAT-jira-aha-ticket-sync`.

## Summary

Ship one-way Jira → Flow mirroring: configuration storage, a client interface with REST implementation, Markdown-first sync orchestration into `external/jira/<PROJECT>/`, the `flow sync jira` command, tests, docs, and review. The pm-mode discipline documentation depends cross-feature on the workspace-modes content task (001) — the program's first real cross-graph dependency.

## Approach And Sequencing

1. **Config storage** — extend workspace settings + `flow configure` with an integrations section (Jira host, project keys). Credentials never stored: read from environment variable at sync time.
2. **Client interface** — small `JiraClient` interface in internal/core with a REST implementation (fetch issues per project key, pagination) and a fake for tests. Aha later implements the same shape.
3. **Sync orchestration** — diff fetched issues against mirrored notes; create/update bodies; deletions tag nodes archived-source instead of deleting; stable node ids derived from issue keys so links survive refreshes; last-synced line in body.
4. **CLI** — `flow sync jira [--project <key>] [--json]`.
5. **pm-mode discipline** — pm.md mode file documents read-only mirrored-node rules; depends-on 001's author-mode-content task (cross-feature).

Verification: golden-file diff→mutation tests, fake-client unit tests, cmd tests, full suite, then docs, then review.

## Assumptions

- Explicit sync only in this increment (no webhooks, no scheduler).
- Read-only mirrors: no Flow-side edits are ever written back to Jira.

## Risks

- Large projects and rate limits — mitigated: project-key scoping, explicit invocation, pagination.
- Mirrored-note id collisions with agent-created ids — mitigated: issue-key-derived ids namespaced under the external root.

## Task Graph Map To Design

Goals 1–2 (external root + note shape) → orchestration task; Goal 3 (one-way sync + tags) → client/orchestration tasks; Goal 4 (archive-tagging) → orchestration; Goal 5 (CLI + env credentials) → config/CLI tasks; Goal 6 (pm mode) → pm-mode-discipline task (cross-feature edge to 001).