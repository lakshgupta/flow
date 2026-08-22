---
id: design/20260822-001-FEAT-workspace-modes-skill-init/design
type: note
graph: design/20260822-001-FEAT-workspace-modes-skill-init
title: Workspace modes for flow skill init (dev / note / pm)
description: 'Design — status: Approved'
tags:
    - design
    - skills
    - modes
---

# Design: Workspace Modes for `flow skill init`

## Status

Approved (2026-08-22).

## Summary

Flow serves distinct contexts: code development, general note-taking, and external ticket tracking. A workspace picks a mode; `flow skill init --mode <mode>` materializes the skill variant matching it. The canonical merged skill remains the single source; modes are compositions of its sections, not forks.

## Problem

The full skill assumes software development (stages, commits, validation). A user running Flow as a note-taking app or as a ticket-tracking surface gets irrelevant protocol and misses relevant guidance. One-size skill content makes non-dev usage feel wrong.

## Modes

| Mode | Flag | Contents |
|---|---|---|
| Development | `--mode dev` | Full current skill: record keeping, all stages incl. new roadmap/batch section, graph engineering |
| Notes | `--mode note` | Lightened record keeping (notes only), capture/organize/link/search workflows, canvas usage. No dev stages, no commit gate |
| Tracked work | `--mode pm` | Note baseline + read-only discipline for synced external nodes (Jira/Aha) and linking tickets into plans |

No flag defaults to `dev` (backward compatible).

## Goals

1. Mode files under `packaging/skills/flow/modes/<mode>.md`; `flow skill init --mode X` composes shared sections + mode file and writes the result.
2. Notes mode relaxes the `YYYYMMDD-NNN-*` sub-graph naming: free-form notebooks are allowed. Future notes-mode use cases: ad-hoc notes, writing books, design manuals, software architecture documentation.
3. Each generated skill carries its own stage table so AGENTS.md-style routing stays accurate per mode.
4. Modes shape agent skill content only — they do not restrict CLI or app capabilities.

## Non-Goals

- Runtime mode enforcement; multiple modes in one install (re-init to switch); UI changes.

## Architecture

- `packaging/skills/flow/modes/` added to the embed tree (`skillcontent.go`).
- `flow skill init` gains `--mode`; composition is deterministic string assembly of shared + mode sections.
- `flow skill list` reports available modes.

## Testing Strategy

Composition unit tests; embed tests updated; CLI test for `--mode` output files.

## Risks And Tradeoffs

- Divergence between canonical sections and composed output — mitigated: composition is build-time from one source; no hand-maintained copies.