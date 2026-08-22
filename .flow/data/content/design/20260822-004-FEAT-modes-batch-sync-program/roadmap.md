---
id: design/20260822-004-FEAT-modes-batch-sync-program/roadmap
type: note
graph: design/20260822-004-FEAT-modes-batch-sync-program
title: 'Program roadmap: modes, parallel batch development, ticket sync'
description: 'Roadmap — status: Planned (3 approved designs, dev not started)'
tags:
    - design
    - roadmap
links:
    - node: design/20260822-001-FEAT-workspace-modes-skill-init/design
      context: Modes are the packaging substrate; batch skill content ships via mode composition
      relationships:
        - relates-to
    - node: design/20260822-002-FEAT-roadmap-batch-parallel-dev/design
      context: 'Core program member: batch planning and parallel execution'
      relationships:
        - relates-to
    - node: design/20260822-003-FEAT-jira-aha-ticket-sync/design
      context: Ticket mirrors provide external context for planned work
      relationships:
        - relates-to
---

# Roadmap: Flow Modes, Parallel Batch Development, and Ticket Sync

## Status

Planned — three approved designs, development not started.

## Purpose

Program roadmap recorded with the roadmap pattern this program itself introduces: one note linking multiple approved feature designs; execution order to be expressed as cross-feature `depends-on` edges when task graphs are planned.

## Members

1. `design/20260822-001-FEAT-workspace-modes-skill-init` — modes for `flow skill init` (`dev`, `note` with relaxed naming, `pm`). Foundation: the other two ship their skill content through mode composition.
2. `design/20260822-002-FEAT-roadmap-batch-parallel-dev` — batch planning + `flow roadmap` / `roadmap next --claim`, parallel multi-agent execution, execution packets, structured evidence.
3. `design/20260822-003-FEAT-jira-aha-ticket-sync` — read-only Jira mirrors under `external/jira/` (Jira first), later Aha.

## Sequencing Rationale

Modes first (skill packaging substrate), then roadmap/batch dev (largest core+CLI surface), then Jira sync (independent integration; can proceed in parallel with 002 once its client interface is stubbed).

## Shared Risks

- Frontmatter schema additions (session fields) touch indexing — coordinate with 003's stable-id requirement.
- Skill content growth: keep composed mode files lean.

## Open Questions

None blocking; all three designs approved 2026-08-22.