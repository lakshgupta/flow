# Skills

This document explains the agent skills Flow ships for guiding AI agents through project work. The full skill set — ten skill files covering design, planning, implementation, fixing, refactoring, testing, review, commit, graph engineering, and record keeping — is distributed through the `flow` binary and can be initialized into any workspace or agent home. This document covers what each skill is for, how an agent should use it, and the research that shaped the graph-engineering skill.

## Index

- [Overview](#overview)
- [The Skill Set](#the-skill-set)
- [The Record-Keeping Skill](#the-record-keeping-skill)
- [The Graph-Engineering Skill](#the-graph-engineering-skill)
- [How the Skills Work Together](#how-the-skills-work-together)
- [How Agents Pick Up Skills](#how-agents-pick-up-skills)
- [Research References](#research-references)
- [Related Documents](#related-documents)

## Overview

Flow is a local-first Markdown planning system. Agents (AI coding assistants) that work inside a Flow workspace need guidance to be effective:

1. **How to record work** — the conventions for naming graphs, creating notes/tasks/commands, connecting them with edges, and tracking status and commit ids so the workspace stays a reliable system of record.
2. **How to engineer the graph** — the discipline of treating the node/edge graph as a first-class, persistent, inspectable state: designing graph structure, executing work in dependency order, and committing only when the graph is coherent.
3. **The stage workflow** — which skill applies to which phase of work, so agents route requests to the correct protocol automatically.

All Flow skills live in a single canonical directory, `packaging/skills/`, which is both the agent-visible source of truth and the embed source for the binary. An installed `flow` binary carries every skill; `flow skill init` materializes them for an agent (see [How Agents Pick Up Skills](#how-agents-pick-up-skills)).

| Skill | File | Role |
|---|---|---|
| Flow (record-keeping) | `packaging/skills/flow/SKILL.md` | The mandatory protocol for **what** to record and **where** (naming, statuses, edges, commit ids). The default embedded skill; also addressable by its alias `record-keeping`. |
| Design | `packaging/skills/design/SKILL.md` | Design a feature proposal, get user approval, then update `docs/architecture.md`. |
| Plan | `packaging/skills/plan/SKILL.md` | Plan implementation work as Flow task nodes with `depends-on` links. |
| Implement | `packaging/skills/implement/SKILL.md` | Implement a planned feature from task nodes, updating node status. |
| Fix | `packaging/skills/fix/SKILL.md` | Fix a reported issue and run tests after the fix. |
| Refactor | `packaging/skills/refactor/SKILL.md` | Behavior-preserving structural cleanup. |
| Test | `packaging/skills/test/SKILL.md` | Run targeted validation and record outcomes. |
| Review | `packaging/skills/review/SKILL.md` | Review code for correctness, security, and architecture. |
| Commit | `packaging/skills/commit/SKILL.md` | Create commits with strong messages and sync Flow records. |
| Graph-engineering | `packaging/skills/graph-engineering/SKILL.md` | The workflow for **how** to think about and mutate the graph (reconnaissance, design, edit, execute, commit gate). |

Each skill file is a self-contained Markdown document with YAML frontmatter (`name`, `description`, `user-invocable`, `allowed-tools`, `argument-hint`) followed by the full stage-specific workflow instructions.

## The Record-Keeping Skill

**File:** [`packaging/skills/flow/SKILL.md`](../packaging/skills/flow/SKILL.md) — embedded at build time into the `flow` binary.

### Purpose

Make Flow the system of record for every design, planning, implementation, and commit action. The record-keeping skill answers "**what** do I write, and **where**?" — it is the contract that keeps the `.flow/data/content/` document structure consistent across agents and sessions.

It exists because Markdown files alone do not enforce structure. Without a shared protocol, agents would invent their own directory layouts, node names, and status vocabularies, and the workspace would fragment. The skill standardizes:

- **Graph convention** — two top-level graph roots, `design/` and `development/`, with mandatory sub-graph naming `YYYYMMDD-NNN-<type>-<title>` (types: `FEAT`, `BUG`, `FIX`, `REFACTOR`, `TEST`, `REVIEW`, `DOC`).
- **Node semantics** — notes capture decisions, tasks carry status, commands are executable. Frontmatter `type` decides which.
- **Edge semantics** — relationships like `depends-on`, `evolves-from`, and `related` connect nodes with context-rich edges.
- **Lifecycle** — task statuses (`Ready`, `Running`, `Done`, `Success`, `Failed`, `Interrupted`) and the rule that committed tasks record their git commit hash.

### How to use it

The skill defines three mandatory protocols, each with a concrete CLI workflow:

1. **Design protocol** — resolve the work key, ensure the `design/YYYYMMDD-NNN-<type>-<title>` sub-graph exists, filter candidates with `flow search` before reading bodies, record decisions as note nodes connected by context-rich edges, and update in place with `flow update --title --description`.
2. **Planning protocol** — create `development/YYYYMMDD-NNN-<type>-<title>`, turn design outcomes into tasks with acceptance criteria, add review/test tasks, and link task dependencies with `depends-on` edges.
3. **Implementation protocol** — start from tasks with no incomplete dependency predecessors, transition statuses (`Ready -> Running -> Done`), keep dependency links current, and record the git commit hash on each committed task node.

## The Graph-Engineering Skill

**File:** [`packaging/skills/graph-engineering/SKILL.md`](../packaging/skills/graph-engineering/SKILL.md) — embedded at build time.

### Purpose

Teach agents to engineer **through the graph** rather than through prose or chat transcripts. It answers "**why** and **how** do I structure and manipulate the graph?"

The core idea: a graph of typed nodes (`note`, `task`, `command`) and typed edges is a persistent, inspectable object that all agents share — not a visualization layer over prose. Work is done *on* the graph: weaknesses stay visible as graph state, dependencies drive execution order, and a feature is "done" only when its sub-graph is coherent.

### How to use it

The skill defines a five-phase workflow, always executed in order:

1. **Reconnaissance — read before you write.** Map the graph with `flow node list`, `flow search`, `flow node edges`, and `flow node neighbors`; answer connectivity questions with `flow graph path --from <id> --to <id>` (shortest path, any-direction by default; pass `--directed` to follow only declared edge direction). Identify unresolved weaknesses first — the graph is its own TODO list.
2. **Design the graph structure.** Choose the sub-graph and naming, pick the right node type per unit of work, and plan the edge set up front — keeping dependency edges sparse and real.
3. **Edit phase — one deliberate mutation at a time.** Create nodes, connect edges with explicit `--relationship` and `--context`, update statuses, and verify each mutation before moving on.
4. **Dependency-aware execution.** Start from layer-0 nodes, mark a task `Done` only when all `depends-on` predecessors are `Done`, and when an upstream node changes, re-open its downstream dependents to `Ready` (selective invalidation — a manual discipline).
5. **Commit gate — the graph must be coherent before work ships.** Verify every task is `Done` or a documented terminal state, no unresolved dependencies, no cycles, every edge has context, hash ids are recorded, and `home.md` reflects the delivered capability.

The skill also prescribes a **relationship vocabulary** (table of edge meanings), **edge hygiene rules**, and a **failure-modes table** for diagnosing broken graph states.

## How the Skills Work Together

The ten skills complement each other:

- **Record-keeping = the contract.** It tells every agent the canonical shape of the workspace: graph roots, naming, node types, statuses, and edge relationships.
- **Graph-engineering = the practice.** It tells agents how to *operate* on that graph: read before writing, design deliberately, execute in dependency order, and gate commits on graph coherence.
- **Stage skills (design, plan, implement, fix, refactor, test, review, commit) — the routing.** They map each phase of a feature's life to a concrete workflow, grounded in the record-keeping protocol.

## How Agents Pick Up Skills

Agents discover these skills through four channels:

1. **`AGENTS.md`** — the project's routing file maps work stages to the skill files in `packaging/skills/` (design, plan, implement, fix, refactor, test, review, commit, and graph engineering).
2. **`flow skill list` / `flow skill content`** — every skill is embedded in the `flow` binary at build time:
   ```bash
   flow skill list                             # enumerate embedded skills
   flow skill content                          # print the record-keeping skill (default)
   flow skill content --skill graph-engineering   # print the graph-engineering skill
   ```
   This is the most robust channel: even an agent that never reads the repo's skill files learns the protocol by running the CLI.
3. **`flow skill init`** — materializes the embedded skills into a target directory:
   ```bash
   flow skill init                     # write all skills to ~/.agents/skills/
   flow skill init --project           # write all skills to ./.agents/skills/
   flow skill init --skill design      # write only the design skill
   ```
   Existing files are left untouched unless `--force` is given. The global `~/.agents/skills/` directory is the conventional shared agent-skill location; the project `.agents/skills/` directory is generated output and must not be committed.
4. **`skills-lock.json`** — registers the skills as project-local skills so skill-tracking tooling treats them as part of the project's skill set.

Note on the current state: the graph-engineering skill, the full embedded skill set, and `flow skill list` / `flow skill init` were consolidated in the `20260805-001-FEAT-skills-packaging-init` change. Builds from commits that predate that change embed only `record-keeping` and `graph-engineering`, and `flow skill list` may report an unknown command.

## Research References

The graph-engineering design principles are drawn from four recent papers on graph-structured multi-agent systems:

| Paper | Key idea | Where Flow applies it |
|---|---|---|
| **Evolving Idea Graphs (EIG)** — Dong, Li & Lin (2026), *arXiv:2605.04922* | Represent a partially-formed idea as an evolving typed graph (nodes = claims, edges = support/conflict/dependency) used as the persistent shared state that agents read, edit, and eventually **commit**; a two-head controller separates *edit selection* from *commit readiness*. | Flow's graph-as-persistent-state principle, the reconnaissance phase, and the **commit gate** (phase 5) — "is this sub-graph coherent enough to ship?" maps to EIG's commit head. |
| **Execution Lineage** — Rosen & Rosen (2026), *arXiv:2605.06365* | Represent AI-native work as a DAG of artifact-producing computations with explicit dependencies, identity-based replay, and **selective invalidation** — when an upstream artifact changes, only downstream dependents recompute. | Flow's **dependency-aware execution** (phase 4): explicit `depends-on` edges, deterministic publication (a task is `Done` only when its predecessors are `Done`), and the manual selective-invalidation rule (re-open downstream dependents when an upstream node changes). |
| **Grade** — Zhao (2026), *arXiv:2606.22741* | Model an agent run as a two-layer graph: execution edges (what ran) and dependency edges (what each step relied on), with each dependency edge **graded** by how it is known — observed, declared, or inferred. | Flow's **edge hygiene** rules: don't conflate hard `links:` with soft `[[inline refs]]`; promote soft refs to hard edges only when they are genuine prerequisites. |
| **GraphAgents** — Stewart, Hage, Hsu & Buehler (2026), *arXiv:2602.07491* | Multi-agent pipeline guided by a knowledge graph in which specialized agents **traverse** the graph (BFS, DFS, shortest/top-N paths) to surface novel cross-domain connections. | Flow's **traversal for discovery** in the reconnaissance phase: `flow node neighbors` and `flow graph path --from <id> --to <id>`. |

### Note on arXiv identifiers

The papers above are cited by their arXiv HTML identifiers as provided. These identifiers are stable references for the design rationale; verify against the latest arXiv metadata before citing them externally.

## Related Documents

- [docs/architecture.md](architecture.md) — backend model and the "Development Workflow & Agent Skills" section.
- [docs/reference.md](reference.md) — workspace layout, node types, and graph directory conventions.
- [packaging/skills/flow/SKILL.md](../packaging/skills/flow/SKILL.md) — the record-keeping protocol itself.
- [packaging/skills/graph-engineering/SKILL.md](../packaging/skills/graph-engineering/SKILL.md) — the graph-engineering workflow itself.