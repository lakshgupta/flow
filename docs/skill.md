# Skills

This document explains the agent skill Flow ships for guiding AI agents through project work, and how you use it day to day. The skill set — the complete workspace workflow covering design, planning, implementation, fixing, refactoring, testing, review, commit, roadmap batching, graph engineering, and record keeping — is distributed as a **single merged skill** through the `flow` binary and can be initialized into any workspace or agent home. This document covers what the skill contains, how to install it, how agents load it automatically, and the research that shaped the graph-engineering section.

## Index

- [Overview](#overview)
- [Skill Structure](#skill-structure)
- [Record Keeping (Section 1)](#record-keeping-section-1)
- [Stage Workflows (Section 2)](#stage-workflows-section-2)
- [Graph Engineering (Section 3)](#graph-engineering-section-3)
- [Using The Skills](#using-the-skills)
- [How Agents Pick Up the Skill](#how-agents-pick-up-the-skill)
- [Research References](#research-references)
- [Related Documents](#related-documents)

## Overview

Flow is a local-first Markdown planning system. Agents (AI coding assistants) that work inside a Flow workspace need guidance to be effective:

1. **How to record work** — the conventions for naming graphs, creating notes/tasks/commands, connecting them with edges, and tracking status and commit ids so the workspace stays a reliable system of record.
2. **How to engineer the graph** — the discipline of treating the node/edge graph as a first-class, persistent, inspectable state: designing graph structure, executing work in dependency order, and committing only when the graph is coherent.
3. **The stage workflow** — which section of the skill applies to which phase of work, so agents route requests to the correct protocol automatically.

All Flow skill content lives in a single canonical directory, `packaging/skills/`, which is both the agent-visible source of truth and the embed source for the binary. An installed `flow` binary carries the skill; `flow skill init` materializes it for an agent (see [How Agents Pick Up the Skill](#how-agents-pick-up-the-skill)).

| Skill | File | Role |
|---|---|---|
| Flow | `packaging/skills/flow/SKILL.md` | The complete Flow agent protocol: the mandatory record-keeping contract (Section 1), the stage workflows design/plan/implement/fix/refactor/test/review/commit plus roadmap batching (Section 2), and graph engineering (Section 3). Composed per workspace mode at init time. Also addressable by its alias `record-keeping`. |

The skill file is a self-contained Markdown document with YAML frontmatter (`name`, `description`, `user-invocable`, `allowed-tools`, `argument-hint`) followed by a stage-routing table and the full workflow instructions as internal sections.

## Skill Structure

The single skill is organized into three parts:

| Section | Contents |
|---|---|
| 1. Record Keeping Protocol | The mandatory contract for **what** to record and **where** (naming, statuses, edges, commit ids). |
| 2. Stage Workflows | One subsection per stage: 2.1 Design, 2.2 Plan, 2.3 Implement, 2.4 Fix, 2.5 Refactor, 2.6 Test, 2.7 Review, 2.8 Commit, plus 2.9 Roadmap (batch planning and parallel batch development with session claims via `flow roadmap`). |
| 3. Graph Engineering | The discipline for **how** to think about and mutate the graph: graph model, CLI toolkit, relationship vocabulary, a seven-phase workflow, edge hygiene rules, and failure modes. |

### Workspace modes

`flow skill init --mode <name>` composes the skill for the workspace's purpose. Modes are repeatable and combine — `--mode note --mode pm` produces one skill containing both variants; any selection that includes `dev` yields the full canonical skill:

| Mode | Purpose |
|---|---|
| `dev` (default) | Full development workflow: record keeping, all stage workflows including roadmap/batch development, graph engineering. |
| `note` | Lightened notes-only variant for general note taking (ad-hoc notes, books, design manuals, architecture docs); relaxes the `YYYYMMDD-NNN-*` naming convention in favor of free-form notebooks; drops development stages and commit gates. |
| `pm` | Notes baseline plus read-only discipline for externally synced ticket nodes (`external/jira/...`): never edit mirrors, link them into plans instead. |

Mode files live under `packaging/skills/flow/modes/`; composition replaces only the marked stage-routing and stage-workflow regions of the canonical skill, keeping shared sections (record keeping, graph engineering) verbatim.

A stage-routing table at the top of the file maps each kind of work to its section, so an agent can jump straight to the relevant protocol.

## Record Keeping (Section 1)

### Purpose

Make Flow the system of record for every design, planning, implementation, and commit action. The record-keeping protocol answers "**what** do I write, and **where**?" — it is the contract that keeps the `.flow/data/content/` document structure consistent across agents and sessions.

It exists because Markdown files alone do not enforce structure. Without a shared protocol, agents would invent their own directory layouts, node names, and status vocabularies, and the workspace would fragment. The protocol standardizes:

- **Graph convention** — two top-level graph roots, `design/` and `development/`, with mandatory sub-graph naming `YYYYMMDD-NNN-<type>-<title>` (types: `FEAT`, `BUG`, `FIX`, `REFACTOR`, `TEST`, `REVIEW`, `DOC`).
- **Node semantics** — notes capture decisions, tasks carry status, commands are executable. Frontmatter `type` decides which.
- **Edge semantics** — relationships like `depends-on`, `evolves-from`, and `related` connect nodes with context-rich edges.
- **Lifecycle** — task statuses (`Ready`, `Running`, `Done`, `Success`, `Failed`, `Interrupted`) and the rule that committed tasks record their git commit hash.

### How to use it

The protocol defines three mandatory sub-protocols, each with a concrete CLI workflow:

1. **Design protocol** — resolve the work key, ensure the `design/YYYYMMDD-NNN-<type>-<title>` sub-graph exists, filter candidates with `flow search` before reading bodies, record decisions as note nodes connected by context-rich edges, and update in place with `flow node update --body --description`.
2. **Planning protocol** — create `development/YYYYMMDD-NNN-<type>-<title>`, turn design outcomes into tasks with acceptance criteria, add review/test tasks, and link task dependencies with `depends-on` edges.
3. **Implementation protocol** — start from tasks with no incomplete dependency predecessors, transition statuses (`Ready -> Running -> Done`), keep dependency links current, and record the git commit hash on each committed task node.

## Stage Workflows (Section 2)

Each stage subsection in the skill is self-contained: it opens by describing what to review, lists the stage workflow steps, restates the record-keeping requirements specific to that stage, and prescribes a chat response structure the agent should follow while working. The nine stages:

1. **Design (2.1)** — produce a feature proposal in chat, get user approval, then record the approved design as a design note node in `design/YYYYMMDD-NNN-<type>-<title>` (the graph is the design record; `home.md` is the evolving workspace manual).
2. **Plan (2.2)** — build a practical implementation plan from the approved architecture and record it as Flow task nodes with dependency edges. Every task body carries an acceptance-criteria section and an evidence-strategy line.
3. **Implement (2.3)** — implement exactly one `Ready` task node per run, validate it, record an evidence section (tests run, outputs, commit ids), and advance its status to `Done`. Batch mode (see Roadmap) extends this across features.
4. **Fix (2.4)** — identify root cause, apply the smallest credible fix, and validate before closing.
5. **Refactor (2.5)** — behavior-preserving structural cleanup with explicit validation.
6. **Test (2.6)** — run targeted validation, record pass/fail outcomes, and create follow-up tasks for failures.
7. **Review (2.7)** — review for correctness, security, architecture, duplication, and simplification; report findings by severity.
8. **Commit (2.8)** — commit only work that fully maps to `Done` task nodes, write a strong message, and sync commit ids into Flow records.
9. **Roadmap (2.9)** — plan several features up front as approved designs plus full task graphs linked by a roadmap note, then develop them together — including parallel execution by multiple agent sessions using session claims.

## Graph Engineering (Section 3)

### Purpose

Teach agents to engineer **through the graph** rather than through prose or chat transcripts. It answers "**why** and **how** do I structure and manipulate the graph?"

The core idea: a graph of typed nodes (`note`, `task`, `command`) and typed edges is a persistent, inspectable object that all agents share — not a visualization layer over prose. Approved designs live in the graph as design note nodes, so the workspace is fully self-contained (CLI + skill + `.flow/`). Work is done *on* the graph: weaknesses stay visible as graph state, dependencies drive execution order, and a feature is "done" only when its sub-graph is coherent.

### How to use it

The section defines a seven-phase workflow, always executed in order:

1. **Reconnaissance — read before you write.** Map the graph with `flow node list`, `flow search`, `flow node edges`, and `flow node neighbors`; answer connectivity questions with `flow graph path --from <id> --to <id>` (shortest path, any-direction by default; pass `--directed` to follow only declared edge direction). Identify unresolved weaknesses first — the graph is its own TODO list.
2. **Design the graph structure.** Choose the sub-graph and naming, pick the right node type per unit of work, and plan the edge set up front — keeping dependency edges sparse and real.
3. **Edit phase — one deliberate mutation at a time.** Create nodes, connect edges with explicit `--relationship` and `--context`, update statuses, and verify each mutation before moving on.
4. **Dependency-aware execution.** Start from layer-0 nodes, mark a task `Done` only when all `depends-on` predecessors are `Done`, and when an upstream node changes, re-open its downstream dependents to `Ready` (selective invalidation — a manual discipline).
5. **Commit gate — the graph must be coherent before work ships.** Verify every task is `Done` or a documented terminal state, no unresolved dependencies, no cycles, every edge has context, hash ids are recorded, and `home.md` reflects the delivered capability. `flow graph validate` statically checks edge-type compatibility (errors exit non-zero; warnings are advisory).
6. **Coherence test — membership is binary.** Check the four necessary-and-sufficient conditions that separate an explicit graph from a script or transcript: explicit structure (G1), separation of structure and content (G2), executable semantics (G3), and first-class artifact status (G4).
7. **Graph maturity — quality is gradual.** Beyond the binary test, grade the graph on a scale from Minimal → Structured → Executable → Artifact-grade, aiming for at least Executable before declaring a feature complete.

The section also prescribes a **relationship vocabulary** (table of edge meanings), **edge hygiene rules**, a **coherence test** (the four conditions from prompt graph engineering), and a **failure-modes table** for diagnosing broken graph states.

## Using The Skills

A typical session flow, from setup to daily use:

### 1. Set up a workspace (once)

```bash
flow init
```

After initializing workspace files, an interactive terminal offers to install the agent skill and `AGENTS.md` guidance right away: install with the default `dev` mode, choose specific modes, or skip. Non-interactive runs print a `flow skill init --local` hint instead and never write anything.

You can do the same later (or for a non-Flow project directory) with:

```bash
flow skill init --local            # install into ./.agents/skills/ + AGENTS.md guide
flow skill init                    # install into ~/.agents/skills/ (global)
```

- `--local` (alias `--project`) writes `.agents/skills/` in the current workspace **and** adds a marker-managed Flow section to its `AGENTS.md`.
- If `AGENTS.md` already has content of its own, you choose: rewrite the file, append after your content, print the block first, or exit unchanged. Content outside Flow's markers is never touched; re-running updates only the managed block.
- Modes compose: `flow skill init --local --mode note --mode pm`. Run `flow skill init --help` to see each mode's purpose.

### 2. Work normally — agents load the skill automatically

With the skill installed, every supported coding agent discovers it via `.agents/skills/`, and the `AGENTS.md` routing table tells it which stage protocol applies to what you asked. You speak in outcomes; the agent routes:

| You say | Agent runs |
|---|---|
| "design X", "we should add X" | §2.1 Design — proposal in chat, records on approval |
| "plan X", "break X into tasks" | §2.2 Plan — task graph in `development/...` |
| "implement <task>", "continue X" | §2.3 Implement — one task per run, validated |
| "fix <issue>" / "refactor" / "test this" | §2.4–2.6 |
| "review this" / "commit" | §2.7–2.8 |

### 3. Plan ahead, develop together

```bash
flow roadmap                       # all features: progress, readiness gaps, next-ready queue
flow roadmap --next                # self-contained packet for the next ready task
flow roadmap next --claim --session alix   # claim it: Running + session stamp
```

Ask the agent to plan several features at once ("plan these three features") — designs get approved and full task graphs recorded while feature notes stay `Planned`. Later, "start development of all planned features" runs batch mode: claim → implement → evidence → Done → repeat, across every planned feature, ordered by dependency layers. Multiple agents can work in parallel safely: claims prevent collisions, and stale claims older than four hours surface resume/revert/handoff options.

### 4. Keep external context fresh (`pm` mode)

```bash
flow configure --jira-host https://example.atlassian.net --jira-project PROJ
flow sync jira
```

Tickets mirror into `external/jira/<PROJECT>/` as read-only notes. Link them into plans; never edit mirrors by hand.

## How Agents Pick Up the Skill

Agents discover the skill through four channels:

1. **`AGENTS.md`** — local installs write a marker-managed Flow section into the workspace `AGENTS.md`, routing work stages to the matching sections of the installed skill at `.agents/skills/flow/SKILL.md` (design, plan, implement, fix, refactor, test, review, commit, roadmap batching, and graph engineering). This is the deterministic channel: virtually every agent reads `AGENTS.md` at session start, so routing does not depend on description matching.
2. **`flow skill list` / `flow skill content`** — the skill is embedded in the `flow` binary at build time:
   ```bash
   flow skill list                             # enumerate embedded skills (flow) and modes
   flow skill content                          # print the merged skill (default)
   flow skill content --skill flow             # print the merged skill explicitly
   flow skill content --skill record-keeping   # alias for flow
   ```
   This is the most robust fallback: even an agent that never reads the repo's skill file learns the protocol by running the CLI.
3. **`flow skill init`** — materializes the embedded skill into a target directory:
   ```bash
   flow skill init                     # write the skill to ~/.agents/skills/
   flow skill init --local             # write the skill to ./.agents/skills/ (+ AGENTS.md guide)
   flow skill init --project           # same as --local
   ```
   Existing files are left untouched unless `--force` is given. The global `~/.agents/skills/` directory is the conventional shared agent-skill location; the project `.agents/skills/` directory is generated output and must not be committed. In a Flow workspace, a global install still offers one-time workspace-local setup when run interactively; outside a workspace it stays silent.
4. **`skills-lock.json`** — registers the skill as a project-local skill so skill-tracking tooling treats it as part of the project's skill set.

### The install-once lifecycle

Installing the skill is a one-time action; after that, discovery and loading are automatic in any runtime that supports skills:

1. **Install once.** `flow skill init` writes the embedded skill to a conventional location (channel 3 above): `~/.agents/skills/flow/SKILL.md` covers every workspace on the machine, while `--local` writes `./.agents/skills/flow/SKILL.md` plus the `AGENTS.md` managed section for a single workspace. Re-running is safe — identical files are skipped and `--force` overwrites; the `AGENTS.md` block is idempotent too.
2. **Auto-discovery.** The `.agents/skills/` directory is the open cross-runtime convention for portable skills. Cursor, OpenAI Codex, OpenCode, Gemini CLI, GitHub Copilot / VS Code, Cline, and similar tools read it at the project level, so an installed skill appears in their skill lists with no further wiring. One exception: **Claude Code** natively reads `.claude/skills/` rather than `.agents/skills/`; use a bridge such as `npx skills` (which manages copies/symlinks across runtimes) or copy the `SKILL.md` manually if you run Claude Code.
3. **Auto-loading is description-driven.** The runtime surfaces the skill with its frontmatter `description` as the trigger. When a task matches the description — any work in a Flow workspace — the agent loads the full skill; unrelated tasks leave it unloaded, keeping context costs down. The `AGENTS.md` routing table backs this up deterministically, and `user-invocable: true` lets a user force-load the skill by name at any time as a final fallback.
4. **Re-init after updates.** The skill is embedded into the `flow` binary at build time, so the installed copy is a snapshot. After upgrading Flow, re-run `flow skill init --force` to refresh global and project installs; the `AGENTS.md` managed block refreshes too.

Note on the current state: the ten-skill set was consolidated into a single merged skill (record keeping, stage workflows, and graph engineering in one file). Older `flow` binaries still embed the legacy ten-skill set; `flow skill list` on such builds reports the legacy skill names. The `record-keeping` alias continues to resolve to `flow`.

## Research References

The graph-engineering design principles are drawn from five recent papers on graph-structured systems, and the skill's workflow mechanics were further shaped by practical prior art credited in [Inspiration from prior art](#inspiration-from-prior-art):

| Paper | Key idea | Where Flow applies it |
|---|---|---|
| **Prompt Graph Engineering** — Macedo (2026), [arXiv:2607.27578](https://arxiv.org/abs/2607.27578) | Necessary-and-sufficient conditions that make a prompt a graph: explicit structure, separation of structure and content, executable semantics, and first-class artifact status — with graded quality beyond binary membership. | Flow's **coherence test** (phase 6) and **graph maturity** (phase 7): the four conditions and the Minimal → Structured → Executable → Artifact-grade scale. |
| **Evolving Idea Graphs (EIG)** — Dong, Li & Lin (2026), [arXiv:2605.04922](https://arxiv.org/abs/2605.04922) | Represent a partially-formed idea as an evolving typed graph (nodes = claims, edges = support/conflict/dependency) used as the persistent shared state that agents read, edit, and eventually **commit**; a two-head controller separates *edit selection* from *commit readiness*. | Flow's graph-as-persistent-state principle, the reconnaissance phase, and the **commit gate** (phase 5) — "is this sub-graph coherent enough to ship?" maps to EIG's commit head. |
| **Execution Lineage** — Rosen & Rosen (2026), [arXiv:2605.06365](https://arxiv.org/abs/2605.06365) | Represent AI-native work as a DAG of artifact-producing computations with explicit dependencies, identity-based replay, and **selective invalidation** — when an upstream artifact changes, only downstream dependents recompute. | Flow's **dependency-aware execution** (phase 4): explicit `depends-on` edges, deterministic publication (a task is `Done` only when its predecessors are `Done`), and the manual selective-invalidation rule (re-open downstream dependents when an upstream node changes). |
| **GRADE** — Zhao (2026), [arXiv:2606.22741](https://arxiv.org/abs/2606.22741) | Model an agent run as a two-layer graph: execution edges (what ran) and dependency edges (what each step relied on), with each dependency edge **graded** by how it is known — observed, declared, or inferred. | Flow's **edge hygiene** rules: don't conflate hard `links:` with soft `[[inline refs]]`; promote soft refs to hard edges only when they are genuine prerequisites. |
| **GraphAgents** — Stewart, Hage, Hsu & Buehler (2026), [arXiv:2602.07491](https://arxiv.org/abs/2602.07491) | Multi-agent pipeline guided by a knowledge graph in which specialized agents **traverse** the graph (BFS, DFS, shortest/top-N paths) to surface novel cross-domain connections. | Flow's **traversal for discovery** in the reconnaissance phase: `flow node neighbors` and `flow graph path --from <id> --to <id>`. |

### Note on arXiv identifiers

All five papers above were verified to exist on arXiv; the linked abstract pages are the canonical sources for each identifier. Use them as the primary references for the design rationale.

### Inspiration from prior art

Beyond the papers above, three practical sources shaped the skill's design. Each is credited with what was adopted, adapted, or deliberately left out:

| Source | Key idea | Where Flow applies it |
|---|---|---|
| **[Grove](https://github.com/alxshelepenok/grove)** (alxshelepenok/grove, `docs/skills/`) | A formal state machine for agent development: self-contained **execution packets** (`grove next` / `grove packet`), a machine-checkable **Definition of Ready**, typed **evidence records** per work-item type, assumptions/questions as first-class graph citizens, explicit **alignment triggers** (stop conditions), and **session claims** with stale detection plus resume/revert/handoff. | Roadmap batching adopted the strongest parts: `flow roadmap --next` emits self-contained execution packets; readiness gaps report missing acceptance criteria and open questions; task bodies carry acceptance criteria + evidence strategy with structured `Evidence:` lines per task type; batch mode has explicit stop conditions; claims stamp `session`/`session-at` frontmatter with 4-hour staleness surfacing resume/revert/handoff. Deliberately **not** adopted: Grove's single JSON lockfile, hard DoR gates, fitness functions, and Cynefin machinery — Flow keeps Markdown as the source of truth and never blocks writes at the index level. |
| **[AGENTS.md](https://agents.md)** convention | A community-standard project file that coding agents read at session start for deterministic instructions and routing, independent of any single vendor. | Flow's deterministic skill-discovery channel: local installs write a marker-managed Flow section into the workspace `AGENTS.md` routing work stages to the installed skill, so loading does not rely on description matching alone. |
| **Open agent-skills directory convention** (`.agents/skills/<name>/SKILL.md`, supported by Cursor, OpenAI Codex, OpenCode, Gemini CLI, Copilot/VS Code, Cline; Claude Code via bridges such as `npx skills`) | Portable skill packages with YAML frontmatter (`name`, `description`, …) where auto-loading is driven by the description field. | Flow's packaging and distribution model: the merged `SKILL.md` with frontmatter schema, the install-once lifecycle via `flow skill init`, cross-runtime discovery through `.agents/skills/`, and re-init-after-upgrade semantics. |

## Related Documents

- [docs/architecture.md](architecture.md) — backend model and the "Development Workflow & Agent Skills" section.
- [docs/reference.md](reference.md) — workspace layout, node types, and graph directory conventions.
- [packaging/skills/flow/SKILL.md](../packaging/skills/flow/SKILL.md) — the complete agent skill itself.
