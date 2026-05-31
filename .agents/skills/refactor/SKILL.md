---
name: refactor
description: Refactor code to improve structure, reduce duplication, simplify logic, run tests, and update docs/architecture.md only if the documented architecture changes
user-invocable: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
argument-hint: Code, feature, file, or area to refactor
---

Refactor the requested code, feature, file, or area of the project.

Start by reviewing:

- The relevant code, tests, and documentation
- [docs/architecture.md](../../../docs/architecture.md) when architectural intent or system boundaries matter
- Any related diffs, known pain points, or user constraints for the refactor

Follow this workflow:

1. Identify the main refactoring goal before changing code, such as reducing duplication, simplifying logic, improving boundaries, clarifying naming, or removing unnecessary complexity.
2. Confirm the intended behavior from the current implementation, tests, and [docs/architecture.md](../../../docs/architecture.md) so the refactor does not introduce regressions.
3. Prefer behavior-preserving refactors unless the user explicitly asks for a behavioral change.
4. Refactor the code in focused steps, keeping changes proportional to the requested area.
5. Remove duplicate logic when it can be consolidated safely.
6. Simplify overly complex code when readability and maintainability improve without hiding important logic.
7. Ask the user before removing code that appears to be legacy, compatibility-related, or intentionally retained unless the conversation already makes removal safe.
8. Keep record keeping in Flow nodes for this workflow.
9. After the refactor is complete, run the most relevant available tests, lint checks, or targeted verification.
10. If the refactor changes documented responsibilities, boundaries, interfaces, or architectural structure compared with [docs/architecture.md](../../../docs/architecture.md), update the relevant architecture section after validation.

Flow record-keeping requirements (required, see [packaging/SKILL.md](../../../packaging/SKILL.md) for full protocol):

- Use Flow as the refactor run log.
- Use one shared Flow graph for all record keeping in the project. Do not switch graphs by operation type.
- For each new feature or refactor stream, create or reuse a feature sub-directory under the shared graph, for example `flow/development/<feature-slug>`.
- Keep at least one task node and one note node in the feature sub-directory:
	- Task node tracks the refactor objective and status transitions.
	- Note node records preserved behavior guarantees, structural changes, and validation results.
- If a completed refactor task is committed in git, update that task node description or body with the commit id.
- Link refactor notes and tasks to related implementation or design nodes when relevant.
- Define dependency links between refactor task nodes so order and prerequisites remain explicit.
- Treat Flow nodes as the canonical operational history for the refactor run.

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

State whether [docs/architecture.md](../../../docs/architecture.md) was updated because the refactor changed the documented architecture. If not, say that no architecture sync was needed.

## Legacy Code Check

Ask whether any suspected legacy code in the refactored area is safe to remove, or note that no likely legacy code was identified.

## Follow-Up

List any residual risk, remaining cleanup, or next recommended refactor step.

Implementation rules:

- Make the code changes instead of stopping at analysis unless the user explicitly asks for a refactor plan only.
- Focus on structure, readability, duplication, and maintainability.
- Preserve behavior unless the user approves a behavior change.
- Leave clear notes if the refactor is blocked by unclear requirements or hidden legacy constraints.

Before finishing the run, ensure Flow records include:

- what was refactored,
- what behavior was explicitly preserved,
- any follow-up cleanup tasks,
- and any commit id recorded on task nodes for completed refactor tasks,
- and the home.md update needed to keep architecture/manual guidance aligned with refactor outcomes.
