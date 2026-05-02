---
name: lg-implement
description: Implement a planned feature from Flow task nodes, update node status, and sync architecture changes when implementation diverges
argument-hint: Feature sub-directory or feature name to implement
agent: agent
---

Implement the requested feature by using Flow task nodes in the shared graph feature sub-directory as the task list and [docs/architecture.md](../../docs/architecture.md) as the implementation design reference.

Start by reviewing:

- [docs/architecture.md](../../docs/architecture.md)
- The relevant code, tests, and documentation for the feature being implemented

Follow this workflow:

1. Find the matching feature sub-directory in the shared Flow graph using the provided feature name or sub-directory path.
2. Use Flow task nodes in that feature sub-directory as the execution checklist.
3. Use [docs/architecture.md](../../docs/architecture.md) to understand the intended behavior, interfaces, data flow, constraints, and testing requirements.
4. Select exactly one `todo` task node to implement in this run unless the user explicitly names a specific task.
5. Implement only that single task, validating the work before marking it complete.
6. After the task is fully completed, run the most relevant available tests, lint checks, or targeted verification for that task.
7. Only after successful implementation and validation, update the selected task node from `doing` to `done`.
8. If at least one task remains incomplete, keep the feature note status as `Open` or `In Progress`, depending on the state of the work.
9. If all task nodes for the feature are completed, update the feature note status to `Completed`.
10. If implementation reveals necessary changes that the user explicitly requested and those changes differ from [docs/architecture.md](../../docs/architecture.md), update the relevant architecture section after the affected task is finished.
11. At the end of the run, suggest the next best unchecked task for the same feature. If the feature is completed, suggest the next feature to implement instead.

Flow record-keeping requirements (required, see [.github/SKILL.md](../SKILL.md) for full protocol):

- Use Flow as the implementation run log.
- Use one shared Flow graph for all record keeping in the project. Do not switch graphs by operation type.
- For each new feature, create or reuse a feature sub-directory under the shared graph, for example `flow/development/<feature-slug>`.
- Keep at least one task node and one note node updated during the run:
	- Task node must reflect the single selected Flow task and move through `todo` -> `doing` -> `done`.
	- Note node must capture implementation decisions, touched files, validation commands, and outcomes.
- If the completed task is committed in git during or after this run, update that task node description or body with the commit id.
- Link task, note, and related command nodes to preserve execution context.
- Define and maintain dependency links between task nodes so blocked/ready state is visible from graph structure.
- If command documents exist for verification, prefer running them via `flow run <name>` when practical.
- Keep feature note and task-node status synchronized in Flow.

Status rules for the Flow feature note:

- A feature may start in `Planned` when created by the planning workflow.
- Move `Planned` to `Open` when implementation begins but no task has been completed yet.
- Use `Open` when no implementation task has been completed yet.
- Use `In Progress` when some task nodes are completed but work remains.
- Use `Completed` only when every feature task node is in `done`.

Architecture update rules:

- Do not rewrite architecture unnecessarily.
- Only update [docs/architecture.md](../../docs/architecture.md) when the implemented behavior or agreed design has materially changed from what is documented.
- Keep architecture updates descriptive, readable, and consistent with the existing section structure.
- Preserve the document's role as both human-readable documentation and implementation guidance.

Flow task update rules:

- Do not create duplicate feature sub-directories when one already exists.
- Preserve completed task nodes and prior progress.
- If you need to add a new implementation task because of user-approved scope changes, add it as a new task node in the same feature sub-directory.

If Flow planning nodes are missing, incomplete, or inconsistent with [docs/architecture.md](../../docs/architecture.md):

- Ask the minimum follow-up questions needed, or
- Explain that the feature should be planned first with Flow task nodes updated before implementation can proceed safely.

Use this response structure in chat while working:

## Implementation Target

Identify the Flow feature sub-directory being implemented and the corresponding design entry in [docs/architecture.md](../../docs/architecture.md).

## Execution Plan

Name the single task being attempted now, explain any dependencies, and state what validation will be run after the task is implemented.

## Progress Updates

Report whether the selected task node was completed, which Flow node was updated, what status change was applied to the feature note, and what tests or verification were run.

## Architecture Sync

State whether [docs/architecture.md](../../docs/architecture.md) was updated to reflect user-directed implementation changes. If not, say that no architecture sync was needed.

## Remaining Work

List the remaining unchecked tasks, blockers, and the recommended next task or next feature to implement.

Example progress update:

## Implementation Target

Implement `flow/development/audit-log-export` using the matching `Feature: Audit Log Export` design in [docs/architecture.md](../../docs/architecture.md).

## Execution Plan

Attempt the single Flow task node: `task-export-validate` (Add the export request handler and input validation for the approved audit log filters). Validate with targeted tests for valid and invalid filter inputs.

## Progress Updates

Completed the export request handler and input validation. Updated task node `task-export-validate` to `done` and changed feature status from `Planned` to `In Progress`. Ran targeted tests covering accepted filters, rejected filters, and malformed requests.

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
- Execute only one Flow task node per run unless the user explicitly instructs otherwise.
- Always run the most relevant available tests, linting, or targeted verification after a completed task.
- Update Flow task status immediately after a task is validated.
- Do not mark a task complete until the implementation for that task is actually done.
- If a task cannot be completed safely, leave it unchecked and explain the blocker.
- Keep edits focused on the requested feature and avoid unrelated refactors.

Run-completion record rules:

- Before ending the run, update Flow notes with what was shipped and what remains.
- Ensure remaining `todo`/`doing` task nodes are represented in Flow with accurate status and links.
- If a commit was created for a completed task, ensure that task node includes the commit id.
- When any task is completed, update home.md with the newly completed capability so home.md incrementally evolves into the architecture/manual document.