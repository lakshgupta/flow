---
id: development/20260822-002-FEAT-roadmap-batch-parallel-dev/plan
type: note
graph: development/20260822-002-FEAT-roadmap-batch-parallel-dev
title: 'Plan: roadmap and parallel batch development'
description: 'Plan — status: Completed (all tasks Done 2026-08-22)'
tags:
    - planning
    - roadmap
    - batch
links:
    - node: design/20260822-002-FEAT-roadmap-batch-parallel-dev/design
      context: Plan implements the approved roadmap/batch design
      relationships:
        - relates-to
---

# Plan: Roadmap Planning and Parallel Batch Development

## Status

Planned — implements approved design `design/20260822-002-FEAT-roadmap-batch-parallel-dev`.

## Summary

Build the roadmap substrate bottom-up: session-claim fields in the Markdown layer, the roadmap view builder in core, claim lifecycle logic, then the `flow roadmap` CLI surface, followed by skill content, tests, docs, and review. Two parallelizable tracks exist mid-plan: CLI work and skill authoring.

## Approach And Sequencing

1. **Markdown schema** — optional `session:` / `session-at:` frontmatter fields on task documents, round-trip safe. Purely additive; absent fields behave as today.
2. **Core view builder** — `RoadmapView`: load + validate documents, reuse `graph.BuildTaskLayerView`, group tasks by feature slug (first path segment under `development/`), classify each feature (`Planned/Open/In Progress/Completed` from existing status rules), compute readiness gaps (missing acceptance criteria, unresolved `question`-tagged blockers).
3. **Claim lifecycle** — `flow roadmap next --claim`: pick lowest-layer Ready unclaimed task (tie-break oldest updatedAt), mutate Markdown first (Running + session stamp), refresh index; stale claims >4h surface resume/revert/handoff instead of skipping silently.
4. **CLI** — register `flow roadmap` with `--graph`, `--next`, `--claim`, `--json`; human table default, machine JSON for agents; execution packet output for `--next`.
5. **Skill** — new §2.9 (roadmap + batch mode + stop conditions) and §2.2 amendments (mandatory acceptance-criteria + evidence-strategy lines).

Verification: core unit tests + cmd CLI tests + full `go test ./...`, then docs, then review.

## Assumptions

- Feature membership comes from graph edges to the roadmap note where present, falling back to all `development/*` sub-graphs when no roadmap note is named.
- Claims never block manual edits (Markdown stays writable); staleness handles abandoned claims.

## Risks

- Atomicity of claim under two concurrent CLIs — mitigated: Markdown-first write of the Running stamp acts as the lock; a lost race re-reads and re-picks.
- View builder duplicating layer logic — mitigated: must consume `BuildTaskLayerView`, not reimplement.

## Task Graph Map To Design

Goals 1–2 (roadmap note + batch protocol) → skill task; Goals 3–4 (cross-feature deps, flow roadmap) → view/CLI tasks; Goal 5 (packets + claim) → markdown/claim tasks; Goals 6–7 (claims, evidence) → markdown + skill tasks; Goal 8 (readiness reporting) → view builder; Goal 9 (stop conditions) → skill task.