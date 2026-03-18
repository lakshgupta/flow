---
name: lg-implement
description: Implement a planned feature from docs/backlog.md, check off completed tasks, update feature status, and sync architecture changes when implementation diverges
argument-hint: Feature ID or feature name to implement
agent: agent
---

Implement the requested feature by using [docs/backlog.md](../../docs/backlog.md) as the task list and [docs/architecture.md](../../docs/architecture.md) as the implementation design reference.

Start by reviewing:

- [docs/backlog.md](../../docs/backlog.md)
- [docs/architecture.md](../../docs/architecture.md)
- The relevant code, tests, and documentation for the feature being implemented

Follow this workflow:

1. Find the matching feature entry in [docs/backlog.md](../../docs/backlog.md) using the provided feature ID or feature name.
2. Use the feature entry tasks as the execution checklist.
3. Use [docs/architecture.md](../../docs/architecture.md) to understand the intended behavior, interfaces, data flow, constraints, and testing requirements.
4. Select exactly one unchecked task to implement in this run unless the user explicitly names a specific task.
5. Implement only that single task, validating the work before marking it complete.
6. After the task is fully completed, run the most relevant available tests, lint checks, or targeted verification for that task.
7. Only after successful implementation and validation, update [docs/backlog.md](../../docs/backlog.md) and change that task from `- [ ]` to `- [x]`.
8. If at least one task remains incomplete, keep the feature status as `Open` or `In Progress`, depending on the state of the work.
9. If all tasks for the feature are completed, update the feature status to `Completed`.
10. If implementation reveals necessary changes that the user explicitly requested and those changes differ from [docs/architecture.md](../../docs/architecture.md), update the relevant architecture section after the affected task is finished.
11. At the end of the run, suggest the next best unchecked task for the same feature. If the feature is completed, suggest the next feature to implement instead.

Status rules for the backlog feature entry:

- A feature may start in `Planned` when created by the planning workflow.
- Move `Planned` to `Open` when implementation begins but no task has been completed yet.
- Use `Open` when no implementation task has been completed yet.
- Use `In Progress` when some tasks are completed but work remains.
- Use `Completed` only when every task in the feature entry is checked off.

Architecture update rules:

- Do not rewrite architecture unnecessarily.
- Only update [docs/architecture.md](../../docs/architecture.md) when the implemented behavior or agreed design has materially changed from what is documented.
- Keep architecture updates descriptive, readable, and consistent with the existing section structure.
- Preserve the document's role as both human-readable documentation and implementation guidance.

Backlog update rules:

- Do not create a duplicate feature entry if one already exists.
- Keep the existing feature ID in the format `FEAT-YYYYMMDD-dddd`.
- Preserve completed tasks and prior progress.
- If you need to add a new implementation task because of user-approved scope changes, append it to the same feature entry instead of creating a second feature.

If the backlog entry is missing, incomplete, or inconsistent with [docs/architecture.md](../../docs/architecture.md):

- Ask the minimum follow-up questions needed, or
- Explain that the feature should be planned first with the backlog entry updated before implementation can proceed safely.

Use this response structure in chat while working:

## Implementation Target

Identify the backlog feature entry being implemented and the corresponding design entry in [docs/architecture.md](../../docs/architecture.md).

## Execution Plan

Name the single task being attempted now, explain any dependencies, and state what validation will be run after the task is implemented.

## Progress Updates

Report whether the selected task was completed, which backlog checkbox was updated, what status change was applied to the feature entry, and what tests or verification were run.

## Architecture Sync

State whether [docs/architecture.md](../../docs/architecture.md) was updated to reflect user-directed implementation changes. If not, say that no architecture sync was needed.

## Remaining Work

List the remaining unchecked tasks, blockers, and the recommended next task or next feature to implement.

Example progress update:

## Implementation Target

Implement `FEAT-20260315-0001: Audit Log Export` using the matching `Feature: Audit Log Export` design in [docs/architecture.md](../../docs/architecture.md).

## Execution Plan

Attempt the single backlog task: `Add the export request handler and input validation for the approved audit log filters.` Validate with targeted tests for valid and invalid filter inputs.

## Progress Updates

Completed the export request handler and input validation. Updated the matching backlog checkbox to `- [x]` and changed feature status from `Planned` to `In Progress`. Ran targeted tests covering accepted filters, rejected filters, and malformed requests.

## Architecture Sync

No architecture sync was needed because the implementation matches the approved design in [docs/architecture.md](../../docs/architecture.md).

## Remaining Work

Remaining unchecked tasks:

- Implement export generation using the documented export format and storage flow.
- Wire the export action into the user-facing workflow described in the architecture.
- Add or update tests covering valid export requests, invalid filters, and export failure handling.
- Document the export behavior and any operational constraints required by the feature.

Recommended next task: `Implement export generation using the documented export format and storage flow.`

Implementation rules:

- Make the code changes instead of stopping at a proposed plan unless the user explicitly asks for planning only.
- Execute only one backlog task per run unless the user explicitly instructs otherwise.
- Always run the most relevant available tests, linting, or targeted verification after a completed task.
- Update [docs/backlog.md](../../docs/backlog.md) immediately after a task is validated.
- Do not mark a task complete until the implementation for that task is actually done.
- If a task cannot be completed safely, leave it unchecked and explain the blocker.
- Keep edits focused on the requested feature and avoid unrelated refactors.