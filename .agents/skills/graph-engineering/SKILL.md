---
name: graph-engineering
description: Design, implement, and maintain Flow's node-edge graph (notes, tasks, commands, relationships, layers, canvas) using the Flow CLI, applying graph-engineering principles from graph-based agent research. Use this whenever the user asks to build, extend, or fix anything involving Flow nodes, edges, relationships, graph structure, dependency ordering, graph canvas layout, or graph-powered workflows — even if they describe the goal in plain words like "wire up the plan", "link these tasks", "make the dependencies explicit", or "organize this as a graph".
user-invocable: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
argument-hint: Graph feature, sub-graph, or workflow to engineer
---

Engineer Flow's graph as a first-class, persistent, inspectable state — not as prose or chat transcripts. Flow already treats Markdown on disk as the source of truth and derives a graph (canvas, layers, focused snapshots) from it. This skill teaches the discipline of *engineering through the graph*: every node edit and edge decision is a deliberate, validated graph mutation, and work is only committed when the graph is coherent.

Read [packaging/SKILL.md](../../../packaging/SKILL.md) for the mandatory record-keeping protocol (sub-graph naming, task statuses, commit-id recording) and [docs/architecture.md](../../../docs/architecture.md) for the backend model.

## Flow Graph Model

- **Nodes** — three canonical types, each a Markdown file under `.flow/data/content/<graph>/`:
  - `note` — free-form context, decisions, research (status-free).
  - `task` — status-driven work item (`Ready`, `Running`, `Done`, `Success`, `Failed`, `Interrupted`).
  - `command` — executable node with `name`, `run`, optional `env`.
- **Edges** — stored as `links:` entries in frontmatter: `node: <id>`, optional `context`, optional `relationships:`. Two edge kinds on the canvas:
  - `link` — a hard declared edge from a `links:` entry.
  - `reference` — a soft edge derived from `[[inline refs]]` in the body. Never conflate these: hard links are dependencies; soft refs are navigation only.
- **Graphs & sub-graphs** — directory prefixes: `design/<graph>`, `development/<graph>`, `manual/<graph>`. Sub-graph names follow `YYYYMMDD-NNN-<type>-<title>` (types: `FEAT`, `BUG`, `FIX`, `REFACTOR`, `TEST`, `REVIEW`, `DOC`).
- **Layers** — the index topologically orders tasks/commands by their `depends-on` edges. This is your executable plan: a node with unresolved dependencies sits in a later layer.

## CLI Toolkit

```bash
# Reconnaissance
flow search --graph <graph> --type <note|task|command> [--title ...] [--tag ...] [--compact]
flow node list --graph <graph> [--type <type>] [--status <status>] [--compact]
flow node read --id <node-id>
flow node edges --id <node-id>
flow node neighbors --id <node-id>
flow graph path --from <node-id> --to <node-id> [--directed]   # shortest path (any-direction unless --directed)
flow node content --id <node-id> [--line-start N --line-end M]

# Editing
flow create note|task|command --graph <graph> --file <file> --title <title> [--description ...] [--tag ...] [--status <status>]
flow create command --graph <graph> --file <file> --title <title> --name <name> --run "<shell cmd>" [--env KEY=VALUE]
flow node update --id <node-id> [--title ...] [--description ...] [--status ...] [--body ...] [--tag ...]
flow node connect --from <node-id> --to <node-id> --graph <graph> [--context <text>] [--relationship <tag>]
flow node disconnect --from <node-id> --to <node-id> --graph <graph>
flow delete --path <relative-path>

# Execution
flow run <command-name>        # run a command node
flow update --path <relative-path> --title <title>
```

Every command supports `--help`. `flow skill` prints skill content.

## Relationship Vocabulary

Use explicit, consistent edge relationships so the graph encodes *why* nodes are connected, not just that they are:

| Relationship | Meaning | Use for |
|---|---|---|
| `depends-on` | B drives A; A must be complete first | task/command ordering, execution layers |
| `relates-to` / `related` | contextual connection, no ordering | notes, cross-cutting context |
| `maps-to` | one node records/commits another | commit-notes → task mapping |
| `evolves-from` | refinement of a prior node | design decision chains |
| `supersedes` | replaces an earlier node | deprecation, rewrites |
| `conflicts-with` | contradictions to resolve | unresolved weakness tracking |
| `blocks` | inverse of depends-on (visible blocker) | status dashboards |

Write a `--context` on every edge explaining the relationship ("Adds queueing to satisfy bounded retry latency"). An edge without context is a maintainability debt.

## Workflow

Follow these phases in order. Do not edit the graph before you understand its current shape.

### 1. Reconnaissance — read before you write

The graph is a persistent shared state (EIG: the "idea graph" as the collaborative substrate). Map it before mutating it:

1. `flow node list --graph <graph> --compact` to enumerate nodes.
2. `flow search` to filter candidates by title/description/tag before reading bodies.
3. `flow node edges --id <id>` and `flow node neighbors --id <id>` to map the local neighborhood of every node you plan to touch; `flow graph path --from <id> --to <id>` to find the shortest connection when the relationship between two nodes is not obvious.
4. Identify unresolved weaknesses first: `Ready` tasks with no `depends-on`, `Failed`/`Interrupted` tasks, dangling links (links to ids that don't exist), and any `conflicts-with` edges. These are the graph's own TODO list.

### 2. Design the graph structure

Decide the shape before creating anything:

- Choose the sub-graph (`design/…` for proposals, `development/…` for planning/implementation) and a valid `YYYYMMDD-NNN-<type>-<title>` name.
- Decide which node type each unit of work deserves: a decision or context record → `note`; an actionable unit → `task`; a repeatable operation → `command`.
- Plan the edge set up front: which edges are `depends-on` (ordering) vs `relates-to` (context). Keep dependency edges sparse and real — a dense dependency layer carries no signal (Grade: full-history dependency graphs collapse into run size).

### 3. Edit phase — one deliberate mutation at a time

Make discrete, validated graph edits (EIG: role-local edits on a snapshot, merged deliberately):

1. `flow create` each node with correct `id`, `type`, `graph`, `title`, and `description`.
2. `flow node connect` edges with an explicit `--relationship` and `--context`.
3. `flow node update` to adjust statuses/titles/bodies rather than rewriting files by hand.
4. After each mutation, verify the result: `flow node read --id <id>` and re-run `flow node edges` on the affected neighborhood.

### 4. Dependency-aware execution (Execution Lineage)

The graph is also an execution substrate. Honor it:

- **Selective invalidation**: when a node that others `depends-on` changes (status, description, body), re-open its downstream dependents to `Ready` — they may no longer be valid against the new upstream state. Preserve unrelated branches untouched. Flow does **not** auto-invalidate; this is a manual discipline you must apply whenever you edit an upstream node. It is what prevents stale "Done" tasks riding on outdated inputs.
- **Deterministic publication**: a task is only `Done` when every `depends-on` predecessor is `Done`. Do not mark a task complete against an unblocked graph.
- **Layers as the plan**: use `depends-on` edges to build the execution order; the topological layer view is your checklist. Start with layer-0 nodes.

### 5. Commit gate — the graph must be coherent before work ships

Before declaring a feature complete (EIG's commit head: "is this graph mature enough to synthesize?"):

1. Every task node in the feature sub-graph is `Done` or a documented terminal state.
2. No unresolved `depends-on` edges point at non-`Done` nodes.
3. No cycles (the layer builder rejects cycles — `task link cycle detected`). If one exists, find the offending edge with `flow node edges` and fix it.
4. Every edge carries a relationship and context.
5. Commit ids are recorded on committed task nodes (`flow node update --id <id> --description "… (commit: <sha>)"`).
6. `home.md` reflects the delivered capability.

## Design Principles (from graph-based agent research)

- **Graph over transcript** (EIG): agents should coordinate through node/edge state, not conversation history. If a decision matters, it belongs in a node with edges — not only in the chat.
- **Weaknesses stay localized** (EIG): keep unsupported claims, missing evidence, and unmet dependencies visible as graph state (`Ready` tasks, `conflicts-with` edges) rather than absorbing them into prose. The graph is the status board.
- **Explicit dependencies** (Execution Lineage): a node must declare what it consumes. When the shape of a workflow is being decided, prefer explicit `depends-on` edges over implied ordering.
- **Local visibility** (Execution Lineage): each node should only reference what it actually depends on. Don't link a task to everything in the graph.
- **Sparse, observed edges** (Grade): hard `links:` carry the signal; `[[inline refs]]` are soft. When a soft reference becomes a real prerequisite, promote it to a hard `depends-on` edge with context — and only then.
- **Traversal for discovery** (GraphAgents): before implementing in an unfamiliar area, traverse: `flow node neighbors` from the entry point, `flow graph path` between entry and target nodes for the shortest connection, `flow search` across tags, and read the neighborhood. Exploration is a graph operation.

## Edge Hygiene Rules

- Never add a `links:` entry to a node id that does not exist. The canvas does not drop unresolved targets — it renders them as synthetic reference nodes (circle shape when cross-graph), so a typo'd target pollutes the canvas with a node you never intended to create. Verify targets with `flow node list`/`flow search` before connecting.
- Do not create edges to collapse the distinction between hard links and inline refs. Promote soft refs to hard deps only when they are genuine prerequisites.
- One edge per relationship, deduplicated. Reconnecting the same pair with the same relationship is a no-op; use `flow node connect` idempotently.
- When a node is deleted, remove or re-target edges that pointed at it.

## Common Failure Modes

| Symptom | Likely graph cause | Fix |
|---|---|---|
| `task link cycle detected` | a `depends-on` cycle among tasks/commands | inspect `flow node edges` in the loop, remove the redundant edge |
| Task stuck "Ready" forever | missing/inverted `depends-on` edges | verify the dependency direction with `flow node neighbors` |
| Stale Done tasks | upstream changed, dependents not invalidated | re-open dependents to `Ready` (selective invalidation) |
| Unexpected extra nodes on the canvas | `links:` targets that don't exist render as synthetic reference nodes | `flow search` the target, re-target or remove the link |
| Nothing shows in a graph view | nodes outside the selected graph scope | check `graph` frontmatter matches the selected scope |

## Response Structure

While working, report progress in this shape:

## Graph Reconnaissance
Summarize the current graph state (nodes, edges, weaknesses found).

## Graph Design
Explain the chosen sub-graph, node types, and edge plan, and how it maps to the requested outcome.

## Edits Made
List each `flow create` / `flow node connect` / `flow node update` performed with rationale.

## Validation
Report layer ordering, cycle checks, and edge hygiene verification results.

## Remaining Work
Any nodes left in `Ready`, blockers, or follow-ups for the next run.
