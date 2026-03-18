---
name: lg-refactor
description: Refactor code to improve structure, reduce duplication, simplify logic, run tests, and update docs/architecture.md only if the documented architecture changes
argument-hint: Code, feature, file, or area to refactor
agent: agent
---

Refactor the requested code, feature, file, or area of the project.

Start by reviewing:

- The relevant code, tests, and documentation
- [docs/architecture.md](../../docs/architecture.md) when architectural intent or system boundaries matter
- Any related diffs, known pain points, or user constraints for the refactor

Follow this workflow:

1. Identify the main refactoring goal before changing code, such as reducing duplication, simplifying logic, improving boundaries, clarifying naming, or removing unnecessary complexity.
2. Confirm the intended behavior from the current implementation, tests, and [docs/architecture.md](../../docs/architecture.md) so the refactor does not introduce regressions.
3. Prefer behavior-preserving refactors unless the user explicitly asks for a behavioral change.
4. Refactor the code in focused steps, keeping changes proportional to the requested area.
5. Remove duplicate logic when it can be consolidated safely.
6. Simplify overly complex code when readability and maintainability improve without hiding important logic.
7. Ask the user before removing code that appears to be legacy, compatibility-related, or intentionally retained unless the conversation already makes removal safe.
8. Do not update [docs/backlog.md](../../docs/backlog.md) as part of this workflow.
9. After the refactor is complete, run the most relevant available tests, lint checks, or targeted verification.
10. If the refactor changes documented responsibilities, boundaries, interfaces, or architectural structure compared with [docs/architecture.md](../../docs/architecture.md), update the relevant architecture section after validation.

Refactoring rules:

- Favor small, coherent structural improvements over broad rewrites.
- Prefer extraction, consolidation, naming improvements, and clearer control flow over cosmetic churn.
- Keep public behavior stable unless the user explicitly approves behavior changes.
- Do not mix unrelated cleanup into the refactor.
- Do not remove apparently unused or legacy code without user confirmation when intent is unclear.

Validation rules:

- Always run the most relevant available tests, linting, or targeted verification after the refactor.
- If no automated tests exist for the affected area, perform the best available targeted verification and say what was checked.
- Do not claim the refactor is safe if validation has not been performed.

Use this response structure in chat while working:

## Refactor Target

Summarize the area being refactored, the current pain points, and the intended preserved behavior.

## Refactor Plan

Describe the structural changes being made and why they improve the code.

## Changes Made

Summarize the completed refactoring changes, including any duplication removed or logic simplified.

## Validation

Report the tests, lint checks, or targeted verification that were run after the refactor and the result.

## Architecture Sync

State whether [docs/architecture.md](../../docs/architecture.md) was updated because the refactor changed the documented architecture. If not, say that no architecture sync was needed.

## Legacy Code Check

Ask whether any suspected legacy code in the refactored area is safe to remove, or note that no likely legacy code was identified.

## Follow-Up

List any residual risk, remaining cleanup, or next recommended refactor step.

Example response:

## Refactor Target

Refactor the export request normalization flow to remove duplicated validation logic between the API handler and the background export job while preserving the current behavior described in [docs/architecture.md](../../docs/architecture.md).

## Refactor Plan

Extract the shared normalization and validation logic into a single helper, simplify the branching with early returns, and keep the entry-point responsibilities limited to request parsing and orchestration.

## Changes Made

Moved the shared normalization logic into a common helper, updated both call sites to use it, and simplified the control flow to reduce nested conditionals. No functional behavior was intentionally changed.

## Validation

Ran the targeted tests covering export validation and request normalization. The updated tests pass and both entry points still accept the same supported inputs.

## Architecture Sync

No architecture sync was needed because the refactor did not change the documented responsibilities or behavior in [docs/architecture.md](../../docs/architecture.md).

## Legacy Code Check

There appears to be an older normalization helper that may now be obsolete. Is that legacy code safe to remove, or is it still needed for compatibility?

## Follow-Up

If this shared helper remains stable, the next useful cleanup is to standardize export error mapping across both entry points.

Implementation rules:

- Make the code changes instead of stopping at analysis unless the user explicitly asks for a refactor plan only.
- Focus on structure, readability, duplication, and maintainability.
- Preserve behavior unless the user approves a behavior change.
- Leave clear notes if the refactor is blocked by unclear requirements or hidden legacy constraints.