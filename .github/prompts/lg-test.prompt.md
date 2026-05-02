---
name: lg-test
description: Run targeted validation for a feature or change set, record outcomes, and create follow-up tasks for failures
argument-hint: Feature, area, or change set to test
agent: agent
---

Test the requested feature, area, or change set in this workspace.

Start by reviewing:

- The relevant code, tests, and recent changes
- [docs/architecture.md](../../docs/architecture.md) for expected behavior and constraints when needed
- The relevant Flow feature note and task nodes in the shared graph when testing maps to planned or in-progress tasks

Follow this workflow:

1. Identify the highest-value validation targets for the requested scope.
2. Prefer targeted tests first, then broader suites only when needed.
3. Run the most relevant available tests, lint checks, or verification commands.
4. Record pass/fail outcomes and isolate any failures with concrete evidence.
5. If failures are found, create or update follow-up Flow tasks with clear repro details and expected behavior.
6. Do not claim validation is complete if required checks were not run.

Flow record-keeping requirements (required, see [.github/SKILL.md](../SKILL.md) for full protocol):

- Use Flow as the testing ledger.
- Use one shared Flow graph for all record keeping in the project. Do not switch graphs by operation type.
- For each new feature or testing stream, create or reuse a feature sub-directory under the shared graph, for example `flow/development/<feature-slug>`.
- Keep at least one task node and one note node in the feature sub-directory:
  - Task node tracks testing execution status (`todo`, `doing`, `done`).
  - Note node captures executed commands, test outputs, pass/fail summary, and failure diagnostics.
- If a tested task is implemented and committed, update that task node description or body with the commit id.
- Link test notes to related implementation/fix/refactor nodes whenever possible.
- For failed checks, add linked remediation task nodes with explicit acceptance criteria.
- Define dependency links between remediation tasks when one failure must be resolved before another.
- Treat Flow nodes as the primary operational test history.

Validation rules:

- Prefer deterministic, reproducible checks over manual ad-hoc claims.
- If some checks cannot be run, explain exactly why and what was run instead.
- Distinguish clearly between passed, failed, and skipped checks.

Use this response structure in chat while working:

## Test Target

Summarize the feature, area, or change set being validated.

## Test Plan

List the checks that will be run and why they were chosen.

## Results

Report each executed check and outcome (`pass`, `fail`, or `skipped`).

## Failures And Follow-Up

If failures exist, summarize root signal and list the follow-up tasks that were recorded.

## Flow Record Sync

State which Flow nodes were created or updated and how they map to this testing run.

## Next Step

Recommend the next test or remediation action.

Implementation rules:

- Run tests and report actual outcomes; do not fabricate results.
- Keep testing scoped to the requested area unless broader validation is necessary.
- Record all meaningful testing decisions and outcomes in Flow before ending the run.
- Record any commit ids added to completed task nodes when tests are part of a commit-ready workflow.
- Record the home.md update needed so validated behavior is reflected in the evolving architecture/manual document.
