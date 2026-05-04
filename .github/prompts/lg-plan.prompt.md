---
name: lg-plan
description: Plan implementation work for an approved feature using Flow graph feature sub-directories and task nodes
argument-hint: Feature to plan from architecture.md
agent: agent
---

Plan implementation work for the requested feature using [docs/architecture.md](../../docs/architecture.md) as the primary source of truth.

Start by reviewing:

- [docs/architecture.md](../../docs/architecture.md)
- Any relevant code or documentation needed to understand the scope and dependencies of the feature

Follow this workflow:

1. Identify the feature in [docs/architecture.md](../../docs/architecture.md) that matches the user's request.
2. Prefer features whose status is `Approved` or `In Progress`. If the feature is missing, unclear, or still too underdefined to plan credibly, ask the minimum clarifying questions needed.
3. Build a practical implementation plan based on the documented architecture, constraints, interfaces, control flow, risks, and testing needs.
4. Break the work into actionable tasks represented as Flow task nodes in the feature sub-directory under the shared graph.
5. Unless the user explicitly asks for planning only, create or update the corresponding Flow task and note nodes in the same conversation after producing the plan.

Flow record-keeping requirements (required, see [.github/SKILL.md](../SKILL.md) for full protocol):

- Use Flow as the planning system of record during the run.
- Use one shared Flow graph for all record keeping in the project. Do not switch graphs by operation type.
- For each new feature, create or reuse a feature sub-directory under the shared graph, for example `flow/development/<feature-slug>`.
- Maintain a task graph that mirrors the approved architecture intent:
	- Create one task node per planned implementation task when feasible.
	- Keep status fields current as planning evolves.
- Maintain at least one note node with planning rationale, sequencing, risks, and dependency notes.
- Link planning notes and tasks so downstream implementation can traverse context from the graph.
- Define task dependencies explicitly with task-to-task links (for example, foundational tasks link to dependent tasks).
- Once a planned task is implemented and committed, update that task node description or body with the commit id.
- Treat Flow nodes as the operational run log and planning source of truth.

When creating or updating Flow planning records:

- Create one feature sub-directory per planned feature under the shared graph.
- Create one task node per actionable task and keep each task scoped to a single execution run.
- Keep feature notes readable for humans and structured enough for implementation agents.
- Reuse and update existing nodes for the same feature instead of creating duplicates.

Use this response structure in chat before or while updating Flow records:

## Planning Basis

State which feature in [docs/architecture.md](../../docs/architecture.md) is being planned and summarize the relevant architectural context.

## Implementation Plan

Describe the major workstreams, sequencing, dependencies, and notable risks.

## Flow Plan Records

Show the Flow feature sub-directory path and the task/note nodes that will be created or updated.

Use this planning record structure:

Feature sub-directory: `flow/development/<feature-slug>`

- Feature note summary: <Short plain-language summary>

Task nodes:

- task-1: <task title> (status: Ready)
- task-2: <task title> (status: Ready)
- task-3: <task title> (status: Ready)

Task dependency links:

- task-1 -> task-2
- task-2 -> task-3

Example planning records:

Feature sub-directory: `flow/development/audit-log-export`

Task nodes:

- task-export-validate: Add export request handler and input validation (status: Ready)
- task-export-generate: Implement export generation path (status: Ready)
- task-export-wire: Wire export action into user workflow (status: Ready)
- task-export-test: Add/update tests for valid/invalid/error paths (status: Ready)
- task-export-docs: Document behavior and operational constraints (status: Ready)

Task dependency links:

- task-export-validate -> task-export-generate
- task-export-generate -> task-export-wire
- task-export-wire -> task-export-test
- task-export-test -> task-export-docs

Task-writing rules:

- Make tasks concrete, implementation-oriented, and testable.
- Size each task so it can reasonably be completed in one implementation run.
- Write each task node as a single deliverable, not a bundle of loosely related work.
- Order tasks in a sensible execution sequence so the next unchecked task is the next one to implement.
- Create explicit link edges between dependent tasks so execution order is graph-visible.
- Include work for code changes, data or API updates, tests, and documentation nodes when relevant.
- Prefer explicit task wording such as "Add...", "Update...", "Create...", "Wire...", "Test...", or "Document...".
- Avoid vague tasks like "implement feature" or "do testing".
- Avoid tasks that mix multiple milestones, such as combining schema changes, API work, UI work, and docs in one checkbox unless they are inseparable.
- Prefer a small number of meaningful tasks over a long checklist of trivial actions.
- Make it obvious how the implementer will know the task is complete.

Single-task execution alignment:

- Assume the implementation workflow will execute one unchecked task per run.
- Write task nodes so each node can be completed and validated independently.
- When useful, end a task with the intended verification outcome, for example: "... and add/update tests for the new behavior".
- Put foundational tasks first, dependent integration tasks after them, and documentation cleanup near the end unless docs are required earlier.

If planning cannot proceed safely because the architecture is incomplete or contradictory, explain the blocker clearly and ask only the minimum follow-up questions needed to continue.

Before finishing the run, ensure Flow records include:

- the final planned task set,
- dependencies and sequencing notes,
- any blockers that prevented full planning,
- and any commit ids already recorded on completed planned tasks,
- and the Home update needed so home.md reflects approved plan context and architecture/manual intent.