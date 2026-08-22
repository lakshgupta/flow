---
id: design/20260822-003-FEAT-jira-aha-ticket-sync/design
type: note
graph: design/20260822-003-FEAT-jira-aha-ticket-sync
title: External ticket sync (Jira first, then Aha)
description: 'Design — status: Approved'
tags:
    - design
    - integration
    - jira
    - sync
links:
    - node: design/20260822-001-FEAT-workspace-modes-skill-init/design
      context: Synced-node read-only discipline is documented in the pm mode skill variant
      relationships:
        - relates-to
---

# Design: External Ticket Sync (Jira first, then Aha)

## Status

Approved (2026-08-22). Priority confirmed: Jira first.

## Summary

Pull external tickets into the graph as read-only mirrored nodes so Flow plans can link real tracked work with descriptions visible in Flow.

## Problem

Tracked work lives in Jira/Aha; Flow plans cannot reference it except by pasted URLs. Users want connected tickets with their descriptions inside Flow's graph, canvas, and search.

## Goals

1. New graph root `external/jira/<PROJECT>/` (later `external/aha/<workspace>/`) alongside design/development.
2. One ticket = one note node: title, description, status, URL, labels as tags. Body refreshed from the API on sync.
3. One-way sync (external → Flow). Mirrored nodes tagged `synced`; agents treat them as reference — plans connect via `relates-to`, never edit them.
4. Deletions in source mark nodes with an archived-source tag instead of deleting, preserving edge integrity.
5. CLI: `flow sync jira` (add/update/mark-archived). Config via `flow configure`: host, project keys, credentials read from environment variables — never stored in the repo.
6. The `pm` skill mode documents synced-node discipline.

## Non-Goals

- Two-way sync or write-back to Jira/Aha.
- Webhooks / real-time updates (explicit sync only, initially).
- Aha support in the first increment (Jira first per user decision).

## Architecture

- Core (internal/core): sync orchestration — fetch issues, diff against mirrored notes, apply Markdown-first mutations, refresh index.
- Transport adapter for Jira REST lives behind a small client interface so Aha can be added later.
- Mirrored node ids stable across syncs (derived from issue key) so links survive refreshes.

## Control Flow

`flow sync jira` → fetch → diff → create/update/annotate nodes → index refresh. Conflicts impossible by construction (Flow never writes back).

## Testing Strategy

Client interface faked in unit tests; golden-file tests for diff→mutation mapping; manual smoke against a sandbox project.

## Risks And Tradeoffs

- Rate limits and large projects — mitigated: explicit sync, project-key scoping.
- Stale mirrors between syncs — accepted; each node records last-synced time in body.