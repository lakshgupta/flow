# Skills

This document explains the two agent skills Flow ships for guiding AI agents through project work: the **record-keeping skill** and the **graph-engineering skill**. It covers what each skill is for, how an agent should use it, and the research that shaped the design.

## Index

- [Overview](#overview)
- [The Record-Keeping Skill](#the-record-keeping-skill)
- [The Graph-Engineering Skill](#the-graph-engineering-skill)
- [How the Two Skills Work Together](#how-the-two-skills-work-together)
- [How Agents Pick Up Skills](#how-agents-pick-up-skills)
- [Research References](#research-references)
- [Related Documents](#related-documents)

## Overview

Flow is a local-first Markdown planning system. Agents (AI coding assistants) that work inside a Flow workspace need two kinds of guidance to be effective:

1. **How to record work** — the conventions for naming graphs, creating notes/tasks/commands, connecting them with edges, and tracking status and commit ids so the workspace stays a reliable system of record.
2. **How to engineer the graph** — the discipline of treating the node/edge graph as a first-class, persistent, inspectable state: designing graph structure, executing work in dependency order, and committing only when the graph is coherent.

These two concerns are captured in two skill files:

| Skill | File | Role |
|---|---|---|
| Record-keeping | `packaging/SKILL.md` | The mandatory protocol for **what** to record and **where** (naming, statuses, edges, commit ids). Lives at `packaging/`, embedded into the binary. |
| Graph-engineering | `.agents/skills/graph-engineering/SKILL.md` | The workflow for **how** to think about and mutate the graph (reconnaissance, design, edit, execute, commit gate). Lives in `.agents/skills/` and is also embedded into the binary. |

Both skills are embedded into the Flow binary and can be printed from any workspace with `flow skill content` (see [How Agents Pick Up Skills](#how-agents-pick-up-skills)).

## The Record-Keeping Skill

**File:** [`packaging/SKILL.md`](../packaging/SKILL.md) — embedded at build time into the `flow` binary.

### Purpose

Make Flow the system of record for every design, planning, implementation, and commit action. The record-keeping skill answers "**what** do I write, and **where**?" — it is the contract that keeps the workspace's `.flow/data/content/` structure consistent across agents and sessions.

It exists because Markdown files alone do not enforce structure. Without a shared protocol, agents would invent their own directory layouts, node names, and status vocabularies, and the workspace would fragment. The skill standardizes:

- **Graph convention** — two top-level graph roots, `design/` and `development/`, with mandatory sub-graph naming `YYYYMMDD-NNN-<type>-<title>` (types: `FEAT`, `BUG`, `FIX`, `REFACTOR`, `TEST`, `REVIEW`, `DOC`).
- **Node semantics** — notes capture decisions, tasks carry status, commands are executable. Frontmatter `type` decides which.
- **Edge semantics** — relationships like `depends-on`, `evolves-from`, and `related` connect nodes with context-rich edges.
- **Lifecycle** — task statuses (`Ready`, `Running`, `Done`, `Success`, `Failed`, `Interrupted`) and the rule that committed tasks record their git commit id.

### How to use it

The skill defines three mandatory protocols, each with a concrete CLI workflow:

1. **Design protocol** — resolve the work key, ensure the `design/YYYYMMDD-NNN-<type>-<title>` sub-graph exists, filter candidates with `flow search` before reading bodies, record decisions as note nodes connected by context-rich edges, and update in place with `flow node update --body --description`.
2. **Planning protocol** — create `development/YYYYMMDD-NNN-<type>-<title>`, turn design outcomes into tasks with acceptance criteria, add review/test tasks, and link task dependencies with `depends-on` edges.
3. **Implementation protocol** — start from tasks with no incomplete dependency predecessors, transition statuses (`Ready -> Running -> Done`), keep dependency links current, and record the git commit id on each committed task node.

Agents follow this skill by running the Flow CLI (for example `flow create task --graph development/... --status Ready`) rather than writing Markdown files by hand, so every mutation also refreshes the derived index.

## The Graph-Engineering Skill

**File:** [`.agents/skills/graph-engineering/SKILL.md`](../.agents/skills/graph-engineering/SKILL.md) — embedded at build time and also present as a project skill.

### Purpose

Teach agents to engineer **through the graph** rather than through prose or chat transcripts. Where the record-keeping skill is the *protocol* (what to write where), the graph-engineering skill is the *practice* (how to think about the graph as living state). It answers "**why** and **how** do I structure and mutate the graph?"

The core idea: a graph of typed nodes (`note`, `task`, `command`) and typed edges is a persistent, inspectable object that all agents share — not a visualization layer over prose. Work is done *on* the graph: weaknesses stay visible as graph state, dependencies drive execution order, and a feature is "done" only when its sub-graph is coherent.

### How to use it

The skill defines a five-phase workflow, always executed in order:

1. **Reconnaissance — read before you write.** Map the graph with `flow node list`, `flow search`, `flow node edges`, and `flow node neighbors`; answer connectivity questions with `flow graph path --from <id> --to <id>` (shortest path, any-direction by default; pass `--directed` to follow only declared edge direction). Identify unresolved weaknesses first (stuck `Ready` tasks, `Failed`/`Interrupted` tasks, dangling links, `conflicts-with` edges) — the graph is its own TODO list.
2. **Design the graph structure.** Choose the sub-graph and naming, pick the right node type per unit of work, and plan the edge set up front — keeping dependency edges sparse and real.
3. **Edit phase — one deliberate mutation at a time.** Create nodes, connect edges with explicit `--relationship` and `--context`, update statuses, and verify each mutation before moving on.
4. **Dependency-aware execution.** Start from layer-0 nodes, mark a task `Done` only when all `depends-on` predecessors are `Done`, and when an upstream node changes, re-open its downstream dependents to `Ready` (selective invalidation — a manual discipline, Flow does not auto-invalidate).
5. **Commit gate — the graph must be coherent before work ships.** Verify every task is `Done` or a documented terminal state, no unresolved dependencies, no cycles, every edge has context, commit ids are recorded, and `home.md` reflects the delivered capability.

The skill also prescribes a **relationship vocabulary** (a table of edge meanings from `depends-on` to `conflicts-with`), **edge hygiene rules** (never create edges to nonexistent nodes, never conflate hard `links:` with soft `[[inline refs]]`), and a **failure-modes table** (symptom → likely graph cause → fix) for diagnosing broken graph states.

## How the Two Skills Work Together

The two skills are complementary halves of the same discipline:

- **Record-keeping = the contract.** It tells every agent the canonical shape of the workspace: graph roots, naming, node types, statuses, edge relationships, and commit-id recording. Without it, agents drift into inconsistent structures.
- **Graph-engineering = the practice.** It tells agents how to *operate* on that graph: read before writing, design deliberately, execute in dependency order, and gate commits on graph coherence. Without it, agents treat the graph as a passive filing system instead of the executable plan it is.

Agents use them in sequence during a feature's life: the record-keeping skill governs *each mutation* (`flow create`, `flow node connect`, `flow node update`), while the graph-engineering skill governs the *overall workflow* (reconnaissance → design → edit → execute → commit gate) that those mutations are embedded in.

## How Agents Pick Up Skills

Agents discover these skills through three channels:

1. **`AGENTS.md`** — the project's stage routing file points agents at the skill files in `.agents/skills/` for each phase of work (design, plan, implement, fix, refactor, test, review, commit, and graph engineering).
2. **`flow skill content`** — both skills are embedded in the `flow` binary at build time and can be printed from any workspace:
   ```bash
   flow skill content                       # prints the record-keeping skill (default)
   flow skill content --skill graph-engineering   # prints the graph-engineering skill
   ```
   This is the most robust channel: even an agent that never reads the repo's skill files learns the protocol by running the CLI.
3. **`skills-lock.json`** — registers the skills as project-local skills so skill-tracking tooling treats them as part of the project's skill set.

Note on the current state: the graph-engineering skill, the `flow skill content --skill` flag, and both binary embeds were added together in one working-tree change, and the `flow graph path` traversal command was added in the change after that. If this document is read from a build made from commits that predate those changes, `flow skill content --skill graph-engineering` will report an unknown skill and `flow graph path` will report an unknown command. The default `flow skill content` (record-keeping) is unaffected — it has been embedded since the binary first shipped the protocol.

## Research References

The graph-engineering skill's design principles are drawn from four recent papers on graph-structured multi-agent systems:

| Paper | Key idea | Where Flow applies it |
|---|---|---|
| **Evolving Idea Graphs (EIG)** — Dong, Li & Lin (2026), *arXiv:2605.04922* | Represent a partially-formed idea as an evolving typed graph (nodes = claims, edges = support/conflict/dependency) used as the persistent shared state that agents read, edit, and eventually **commit**; a two-head controller separates *edit selection* from *commit readiness*. | Flow's graph-as-persistent-state principle, the reconnaissance phase, and the **commit gate** (phase 5) — "is this sub-graph coherent enough to ship?" mirrors EIG's commit head. The **relationship vocabulary** (support/conflict/dependency) maps to Flow's `depends-on` / `conflicts-with` edges. |
| **Execution Lineage** — Rosen & Rosen (2026), *arXiv:2605.06365* | Represent AI-native work as a DAG of artifact-producing computations with explicit dependencies, identity-based replay, and **selective invalidation** — when an upstream artifact changes, only downstream dependents recompute. | Flow's **dependency-aware execution** (phase 4): explicit `depends-on` edges, deterministic publication (a task is `Done` only when its predecessors are `Done`), and the manual selective-invalidation rule (re-open downstream dependents when an upstream node changes). |
| **Grade** — Zhao (2026), *arXiv:2606.22741* | Model an agent run as a two-layer graph: *execution edges* (what ran) and *dependency edges* (what each step relied on), with each dependency edge **graded** by how it is known — observed, declared, or inferred. Sparse observed edges carry signal; inferred full-history graphs collapse into run size. | Flow's **edge hygiene** rules: hard `links:` entries are declared/observed dependencies while `[[inline refs]]` are soft inferred references — never conflate the two, promote soft refs to hard edges only when they are genuine prerequisites, and keep dependency edges sparse and meaningful. |
| **GraphAgents** — Stewart, Hage, Hsu & Buehler (2026), *arXiv:2602.07491* | Multi-agent pipeline guided by a knowledge graph in which specialized agents **traverse** the graph (BFS, DFS, shortest/top-N paths) between extracted keywords to surface novel cross-domain connections. | Flow's **traversal for discovery**: before implementing in an unfamiliar area, explore the graph via `flow node neighbors`, `flow graph path --from <id> --to <id>` (shortest-path traversal between nodes), and `flow search` — exploration is a graph operation, not a search over prose. |

The record-keeping skill predates these papers and encodes the workspace convention layer that graph-engineering operates on; the graph-engineering skill is the research-informed layer that turns that convention into deliberate graph practice.

### Note on arXiv identifiers

The papers above are cited by their arXiv HTML identifiers as provided (for example `2605.04922`). These identifiers are used here as stable references for the design rationale; they should be treated as living links — verify against the latest arXiv metadata before citing them externally.

## Related Documents

- [docs/architecture.md](architecture.md) — backend model and the "Development Workflow & Agent Skills" section.
- [docs/reference.md](reference.md) — workspace layout, node types, and graph directory conventions.
- [packaging/SKILL.md](../packaging/SKILL.md) — the record-keeping protocol itself.
- [.agents/skills/graph-engineering/SKILL.md](../.agents/skills/graph-engineering/SKILL.md) — the graph-engineering workflow itself.
