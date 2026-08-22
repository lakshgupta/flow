---
id: design/20260822-002-FEAT-roadmap-batch-parallel-dev/design
type: note
graph: design/20260822-002-FEAT-roadmap-batch-parallel-dev
title: Roadmap planning and parallel batch development
description: 'Design — status: Approved'
tags:
    - design
    - roadmap
    - batch
    - cli
links:
    - node: design/20260822-001-FEAT-workspace-modes-skill-init/design
      context: Batch-mode skill section is distributed through the dev mode composition
      relationships:
        - relates-to
---

# Design: Roadmap Planning and Parallel Batch Development

## Status

Approved (2026-08-22). Incorporates research amendments from Grove (github.com/alxshelepenok/grove): execution packets, machine-checkable readiness reporting, typed evidence, explicit alignment triggers.

## Summary

Add a roadmap workflow on top of the per-feature stages: one planning pass records multiple feature designs and their full task graphs up front (feature notes stay `Planned`), and batch mode later develops all planned features together — including parallel execution by multiple agent sessions, ordered by the global cross-graph dependency layer view.

## Problem

Today's workflow is strictly serial per feature: design → plan → implement, one task per run. There is no way to pre-plan a batch of features, and no safe way for two agents to pick up work simultaneously. The cross-graph layer engine exists (`BuildTaskLayerView`) but nothing exposes it.

## Goals

1. Roadmap note under `design/YYYYMMDD-NNN-FEAT-<batch-title>` linked by `relates-to` edges to each member design note; membership derived from edges, not hardcoded lists.
2. Batch planning protocol (new skill §2.9): one run produces approved designs plus fully wired task graphs for N features; tasks created `Ready`, feature notes marked `Planned` (planning is committed; development start deferred — EIG two-head separation).
3. Cross-feature dependencies as real `depends-on` edges between task nodes in different development sub-graphs.
4. `flow roadmap` command: planned features, approval state, ready/blocked counts, next actionable layer, readiness gaps.
5. `flow roadmap next [--claim]`: emits a self-contained execution packet (task body, acceptance criteria, design-note excerpt, dependency state) so a cold agent session needs zero graph re-reading.
6. Parallel-safe claims: `--claim` atomically marks the chosen task `Running` and stamps optional frontmatter `session:` / `session-at:` fields; never hands out a task claimed by another live session; stale claims (>4h, confirmed threshold) surface `resume / revert / handoff` options.
7. Structured evidence: Done tasks record an `Evidence:` section per task type — feature: test/typecheck output + commit SHA; bug: repro-test-before/repro-test-after SHAs; refactor: green-suite-before/after. Extends the existing commit-id rule.
8. Readiness reporting (soft grove-style DoR): missing acceptance criteria and unresolved `question`-tagged notes are reported as gaps, never hard blocks (Markdown stays writable).
9. Explicit stop conditions for batch runs: validation fails twice, a tagged assumption is invalidated, a `depends-on` target is not Done, or the ready set empties while questions remain open.

## Non-Goals

- Concurrent writes to the same task (claims prevent rather than merge).
- Automatic scheduling, dates, or capacity estimation.
- UI changes this pass (canvas already renders cross-graph layers).

## User Experience

Multiple sessions run the same loop: `flow roadmap next --claim` → implement → validate → evidence → `Done` → recompute layers. Parallelism across features falls out of layer-0 ready tasks in different sub-graphs sharing no dependency path. WIP guidance: one claimed task per session.

## Architecture

- Skill: new §2.9 (roadmap + batch mode), §2.2 gains mandatory acceptance-criteria + evidence-strategy lines, §2.3 gains batch mode entry point.
- Core (internal/core): roadmap view builder — load documents, build `TaskLayerView`, group by feature slug, classify feature state from existing status rules, compute readiness gaps, produce packet.
- CLI: `flow roadmap [--graph <g>] [--next] [--claim] [--json]`. Read-only except the claim mutation.

## Control Flow

Claim loop: load → validate → layer view → filter to roadmap members → lowest-layer Ready unclaimed task (tie-break oldest updatedAt) → stamp Running+session → emit packet. Stale claim handling: Running + session-at older than 4h → report resume/revert/handoff options instead of skipping silently.

## Edge Cases And Failure Modes

- Cross-feature cycle: layer builder already rejects; roadmap surfaces offending ids.
- Feature added mid-execution: its unstarted tasks join the queue naturally.
- Unapproved member design: flagged; its tasks skipped by batch mode.
- Empty/exhausted roadmap: clear "nothing ready" output, not an error.

## Testing Strategy

Unit tests for view builder (grouping, layering, cycles, mixed statuses, claim/stale logic); CLI tests for output shapes; temp-workspace dry run with a two-feature toy roadmap and two concurrent claims.

## Risks And Tradeoffs

- Batch mode adds complexity to the most-used stage — mitigated: single-task-per-run stays default; batch is opt-in.
- Frontmatter session fields are a small schema addition — justified: claims need structure (G2), not prose.
- Rejected alternatives: dedicated `roadmap/` root (fragments two-root convention); hard DoR gates (fights Markdown-as-truth).

## Open Questions

None blocking. Stale threshold 4h confirmed as initial value.