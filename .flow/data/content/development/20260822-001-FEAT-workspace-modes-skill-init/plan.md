---
id: development/20260822-001-FEAT-workspace-modes-skill-init/plan
type: note
graph: development/20260822-001-FEAT-workspace-modes-skill-init
title: 'Plan: workspace modes for flow skill init'
description: 'Plan — status: Completed (all tasks Done 2026-08-22)'
tags:
    - planning
    - skills
    - modes
links:
    - node: design/20260822-001-FEAT-workspace-modes-skill-init/design
      context: Plan implements the approved workspace-modes design
      relationships:
        - relates-to
---

# Plan: Workspace Modes for `flow skill init`

## Status

Planned — implements approved design `design/20260822-001-FEAT-workspace-modes-skill-init`.

## Summary

Ship three mode variants (`dev`, `note`, `pm`) as compositions of the existing canonical skill plus new per-mode content files. No runtime enforcement anywhere: modes shape only what `flow skill init` writes.

## Approach And Sequencing

Two workstreams, then verification:

1. **Content** — author `packaging/skills/flow/modes/{dev,note,pm}.md`. Each mode file holds only the mode delta (stage table, workflows); shared sections come from the canonical SKILL.md at composition time. The `note` mode file carries the relaxed naming rule: free-form notebooks allowed instead of mandatory `YYYYMMDD-NNN-*`, supporting ad-hoc notes, books, design manuals, and software architecture docs.
2. **Code** — extend `skillcontent.go` with mode enumeration and deterministic composition (shared frontmatter/stage-routing header + shared sections from canonical skill + mode body), then wire `--mode` into `flow skill init` (default `dev`) and surface modes in `flow skill list`.

Verification follows: unit + cmd tests, then docs, then review.

## Assumptions

- Mode files are additive to the embed tree (`all:packaging/skills` already embeds any new subdirectory) — no build-tag changes needed.
- Naming relaxation needs zero app changes: `YYYYMMDD-NNN-*` is agent discipline from skill text, not CLI-enforced.
- Existing `flow skill content` keeps printing the full canonical skill regardless of mode.

## Risks

- Composition drift if mode files duplicate canonical sections — mitigated by authoring deltas only and testing that composed output contains no duplicated headings.

## Task Graph Map To Design

Goals 1→tasks 1–4; goal 3→task 3/4 stage tables live in mode files; goal 4 verified in review task; goal 2 (relaxed naming) lives inside task 1's `note.md` content.