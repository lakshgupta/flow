---
name: lg-fix
description: Fix a reported issue, run tests after the fix, and update docs/architecture.md only if the fix changes the documented architecture
argument-hint: Issue to fix
agent: agent
---

Fix the reported issue in this workspace.

Start by reviewing:

- The user-reported issue, failing behavior, error, or regression
- [docs/architecture.md](../../docs/architecture.md) for relevant intended behavior and system design
- The relevant code, tests, and documentation involved in the issue

Follow this workflow:

1. Identify the root cause of the issue before changing code whenever feasible.
2. Use [docs/architecture.md](../../docs/architecture.md) to confirm the intended behavior, interfaces, constraints, and design assumptions.
3. Implement the smallest credible fix that addresses the root cause without introducing unrelated refactors.
4. After the fix is in place, run the most relevant available tests, lint checks, or targeted verification for the changed behavior.
5. Keep record keeping in Flow nodes for this workflow.
6. If the completed fix changes the intended architecture, documented behavior, interfaces, or constraints compared with [docs/architecture.md](../../docs/architecture.md), update the relevant architecture section after the fix is validated.
7. If the issue cannot be fixed safely because the expected behavior is unclear or the current architecture is contradictory, ask the minimum follow-up questions needed to continue.

Flow record-keeping requirements (required, see [.github/SKILL.md](../SKILL.md) for full protocol):

- Use Flow as the issue-fix run log.
- Use one shared Flow graph for all record keeping in the project. Do not switch graphs by operation type.
- For each new feature or fix stream, create or reuse a feature sub-directory under the shared graph, for example `flow/development/<feature-slug>`.
- Keep at least one task node and one note node in the feature sub-directory:
	- Task node tracks the fix lifecycle and status (`todo`, `doing`, `done`).
	- Note node records root cause, fix decision, risk notes, and validation outcomes.
- Link fix notes, tasks, and related nodes so context remains traceable.
- Define dependency links between fix-related task nodes so prerequisite order is explicit.
- Treat Flow nodes as the primary operational record for debugging and resolution history.

Architecture update rules:

- Do not rewrite architecture unnecessarily.
- Only update [docs/architecture.md](../../docs/architecture.md) when the validated fix materially changes the documented design or expected behavior.
- Keep architecture updates descriptive, readable, and consistent with the existing section structure.
- Preserve the document's role as both human-readable documentation and implementation guidance.

Validation rules:

- Always run the most relevant available tests, linting, or targeted verification after applying the fix.
- If no automated tests exist for the affected area, perform the best available targeted verification and say what was checked.
- Do not claim the issue is fixed if validation has not been performed.

Use this response structure in chat while working:

## Issue Target

Summarize the reported issue, affected area, and expected behavior.

## Root Cause

Explain the most likely or confirmed root cause based on the code and architecture review.

## Fix Plan

Describe the change being made and how it addresses the issue without causing unrelated regressions.

## Validation

Report the tests, lint checks, or targeted verification that were run after the fix and the result.

## Architecture Sync

State whether [docs/architecture.md](../../docs/architecture.md) was updated because the fix changed the documented architecture or intended behavior. If not, say that no architecture sync was needed.

## Follow-Up

List any residual risk, remaining uncertainty, or next recommended step.

Example response:

## Issue Target

Fix the export endpoint failure when an empty filter set is submitted. The expected behavior is that the request should fall back to the default export scope defined in [docs/architecture.md](../../docs/architecture.md) instead of returning a server error.

## Root Cause

The request handler assumes at least one filter is always present and passes `null` into the export builder, which later raises an exception. The architecture describes empty filters as a valid request shape, so the implementation is narrower than the intended behavior.

## Fix Plan

Update request normalization so an empty filter set resolves to the documented default scope before export generation begins. Keep the change confined to the request validation and normalization path.

## Validation

Ran the targeted tests for export request validation and added coverage for empty filters. The updated tests pass, and the endpoint now accepts empty filter input without error.

## Architecture Sync

No architecture sync was needed because the fix restored behavior that already matches [docs/architecture.md](../../docs/architecture.md).

## Follow-Up

Consider adding a regression test for malformed filter payloads if that case is not already covered.

Implementation rules:

- Make the code changes instead of stopping at analysis unless the user explicitly asks for diagnosis only.
- Focus on the reported issue and avoid unrelated cleanup.
- Prefer root-cause fixes over defensive patches that hide the problem.
- Leave clear notes if the issue remains partially unresolved or blocked by missing requirements.

Before finishing the run, ensure Flow records clearly show:

- whether the issue is resolved, partially resolved, or blocked,
- what validation was executed,
- what follow-up fix task is next,
- and the home.md update needed to reflect completed fix behavior in the architecture/manual narrative.