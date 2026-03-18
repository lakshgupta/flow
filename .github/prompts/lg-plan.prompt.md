---
name: lg-plan
description: Plan implementation work for an approved feature in docs/architecture.md and add a backlog entry with a FEAT-YYYYMMDD-dddd ID and checkbox tasks
argument-hint: Feature to plan from architecture.md
agent: agent
---

Plan implementation work for the requested feature using [docs/architecture.md](../../docs/architecture.md) as the primary source of truth.

Start by reviewing:

- [docs/architecture.md](../../docs/architecture.md)
- [docs/backlog.md](../../docs/backlog.md)
- Any relevant code or documentation needed to understand the scope and dependencies of the feature

Follow this workflow:

1. Identify the feature in [docs/architecture.md](../../docs/architecture.md) that matches the user's request.
2. Prefer features whose status is `Approved` or `In Progress`. If the feature is missing, unclear, or still too underdefined to plan credibly, ask the minimum clarifying questions needed.
3. Build a practical implementation plan based on the documented architecture, constraints, interfaces, control flow, risks, and testing needs.
4. Break the work into actionable tasks that can be tracked in [docs/backlog.md](../../docs/backlog.md). Each task must use a markdown checkbox and be scoped so it can be implemented in a single execution run.
5. Unless the user explicitly asks for planning only, update [docs/backlog.md](../../docs/backlog.md) in the same conversation after producing the plan.

When creating or updating the backlog entry:

- Create one feature entry per planned feature.
- Assign the feature an ID in the exact format `FEAT-YYYYMMDD-dddd`.
- Use the current date for `YYYYMMDD`.
- Use a four-digit sequence for `dddd`, starting at `0001` for the first feature entry on that date and incrementing to avoid collisions with existing backlog entries.
- If the same feature already has a backlog entry, update that entry instead of creating a duplicate.
- Keep the backlog readable for humans and structured enough for an implementation agent to follow.
- If [docs/backlog.md](../../docs/backlog.md) is empty, initialize it with a simple backlog document before adding the feature entry.

Use this response structure in chat before or while updating the backlog:

## Planning Basis

State which feature in [docs/architecture.md](../../docs/architecture.md) is being planned and summarize the relevant architectural context.

## Implementation Plan

Describe the major workstreams, sequencing, dependencies, and notable risks.

## Backlog Entry

Show the backlog entry content that will be added or updated in [docs/backlog.md](../../docs/backlog.md).

Use this backlog entry structure:

## FEAT-YYYYMMDD-dddd: <Feature Name>

- Status: Planned
- Source: <Architecture section or feature heading>
- Summary: <Short plain-language summary>

### Tasks

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

Example backlog entry:

## FEAT-20260315-0001: Audit Log Export

- Status: Planned
- Source: Feature: Audit Log Export
- Summary: Allow authorized users to export audit log data with the filters defined in the approved architecture.

### Tasks

- [ ] Add the export request handler and input validation for the approved audit log filters.
- [ ] Implement export generation using the documented export format and storage flow.
- [ ] Wire the export action into the user-facing workflow described in the architecture.
- [ ] Add or update tests covering valid export requests, invalid filters, and export failure handling.
- [ ] Document the export behavior and any operational constraints required by the feature.

Task-writing rules:

- Make tasks concrete, implementation-oriented, and testable.
- Size each task so it can reasonably be completed in one implementation run.
- Write each task as a single deliverable, not a bundle of loosely related work.
- Order tasks in a sensible execution sequence so the next unchecked task is the next one to implement.
- Include work for code changes, data or API updates, tests, and documentation when relevant.
- Prefer explicit task wording such as "Add...", "Update...", "Create...", "Wire...", "Test...", or "Document...".
- Avoid vague tasks like "implement feature" or "do testing".
- Avoid tasks that mix multiple milestones, such as combining schema changes, API work, UI work, and docs in one checkbox unless they are inseparable.
- Prefer a small number of meaningful tasks over a long checklist of trivial actions.
- Make it obvious how the implementer will know the task is done.

Single-task execution alignment:

- Assume the implementation workflow will execute one unchecked task per run.
- Write tasks so each checkbox can be completed, validated, and checked off independently.
- When useful, end a task with the intended verification outcome, for example: "... and add/update tests for the new behavior".
- Put foundational tasks first, dependent integration tasks after them, and documentation cleanup near the end unless docs are required earlier.

If planning cannot proceed safely because the architecture is incomplete or contradictory, explain the blocker clearly and ask only the minimum follow-up questions needed to continue.