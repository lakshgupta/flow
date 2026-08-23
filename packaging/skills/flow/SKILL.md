---
name: flow
description: Complete Flow workspace workflow — mandatory record-keeping protocol, the stage workflows (design, plan, implement, fix, refactor, test, review, commit), and graph engineering (nodes, edges, dependencies, layers, canvas) as a first-class persistent state. Use for any work in a Flow workspace
user-invocable: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
argument-hint: Work stage or feature (design, plan, implement, fix, refactor, test, review, commit, or graph engineering)
---

# Skill: Flow — Complete Workspace Workflow

This single skill is the entire Flow agent protocol. It is a self-contained Markdown document: read the section that matches the current stage of work, and follow the mandatory record-keeping protocol (Section 1) for every action.

Everything the skill references lives in the Flow workspace itself — the `.flow/` directory, the Flow CLI, and the graph nodes recorded there. There is no separate documentation file to consult: approved designs are recorded as note nodes in the graph, and `home.md` is the evolving workspace manual.

<!-- flow:modes:routing-start -->
## How to Use This Skill

| Work | Section |
|---|---|
| Record-keeping protocol (naming, statuses, edges, commit ids) — mandatory for all work | [1. Record Keeping Protocol](#1-record-keeping-protocol) |
| Feature design proposal recorded as a design note node | [2.1 Design](#21-design) |
| Planning implementation as Flow task nodes | [2.2 Plan](#22-plan) |
| Implementing a planned feature from task nodes | [2.3 Implement](#23-implement) |
| Fixing a reported issue | [2.4 Fix](#24-fix) |
| Behavior-preserving structural cleanup | [2.5 Refactor](#25-refactor) |
| Targeted validation and test execution | [2.6 Test](#26-test) |
| Code review | [2.7 Review](#27-review) |
| Commit creation and Flow record sync | [2.8 Commit](#28-commit) |
| Roadmap planning and parallel batch development | [2.9 Roadmap](#29-roadmap) |
| Graph structure, node/edge engineering, dependency ordering, canvas | [3. Graph Engineering](#3-graph-engineering) |
<!-- flow:modes:routing-end -->

## 1. Record Keeping Protocol

### Purpose

Use the Flow CLI for every record-keeping action in design, planning, and implementation work on this project.

### Why the Graph Is the Artifact

The graph is not bookkeeping; it is the work product. Anything that matters and lives only in the chat or in an agent's transcript cannot be inspected, versioned, or replayed — if a decision matters, it belongs in a node with edges. The full rationale (prompt graph engineering's four conditions: explicit structure, separation of structure and content, executable semantics, and first-class artifact status) and the coherence test that verifies them live in [Phase 6 of Section 3](#phase-6-coherence-test--the-four-conditions-arxiv-260727578).

### Graph Convention

- The parent graph directory is `.flow/data/content`.
- Design graph root is fixed as `design`.
- Development graph root is fixed as `development`.
- Sub-graph names are required to follow: `YYYYMMDD-NNN-<type>-<title>`.
- Valid type prefixes include `FEAT`, `BUG`, `FIX`, `REFACTOR`, `TEST`, `REVIEW`, `DOC`.
- `NNN` is a zero-padded incremental counter for directories created on that `YYYYMMDD` date.
- For each new design, create or reuse `design/YYYYMMDD-NNN-<type>-<title>`.
- Planning and implementation use the same suffix under `development/YYYYMMDD-NNN-<type>-<title>`.
- Do not use a backlog file for planning; represent work as Flow task/note nodes and edges.

### Design Protocol (mandatory)

1. Resolve the work key from the request using `YYYYMMDD-NNN-<type>-<title>`.
2. Ensure `design/YYYYMMDD-NNN-<type>-<title>` exists by creating or updating nodes there.
3. Before reading node bodies, filter candidates using title/description/tags with `flow search`.
4. Read body content only after filtering (`flow node content`) to choose the right node.
5. Record design decisions as note nodes and connect them with context-rich edges.
6. For modifications, update existing node content and description in place (`flow node update --body --description`).

### Planning Protocol (mandatory)

1. Create or reuse planning sub-graph `development/YYYYMMDD-NNN-<type>-<title>`.
2. Create tasks from design outcomes with clear acceptance criteria.
3. Add explicit review and test tasks where needed for modularity and correctness.
4. Connect task dependencies using edges tagged with `depends-on`.
5. Keep task statuses current (`Ready`, `Running`, `Done`, `Success`, `Failed`, `Interrupted`).

### Implementation Protocol (mandatory)

1. Start with tasks that have no incomplete dependency predecessors.
2. Update status transitions as work proceeds (`Ready -> Running -> Done`, then terminal outcomes as needed).
3. After each completed task, show the next ready task set based on dependency edges.
4. If requirements change, update both `design/YYYYMMDD-NNN-<type>-<title>` and `development/YYYYMMDD-NNN-<type>-<title>` before continuing.
5. Keep dependency links up to date so execution order stays explicit.
6. Once a completed task is included in a git commit, update that task node description or body with the commit id.

### The Design Note

Approved designs are recorded as note nodes in the `design/YYYYMMDD-NNN-<type>-<title>` sub-graph. The design note is the canonical record of what the feature is supposed to do — plan and implement stages read it as their design source. Use the CLI to create and maintain it — the [CLI Workflow Example](#cli-workflow-example) below shows the exact commands (`flow create note --file design ...`, `flow node update --id .../design --body ...`).

Record the proposal body using the headings from Section 2.1 so the note can guide implementation directly. `home.md` remains the evolving workspace manual for shipped capability (see [2.8 Commit](#28-commit)); the design note holds the per-feature design detail.

Design-note update rules (shared by all stages):

- Do not rewrite the design note unnecessarily.
- Only update it when the implemented behavior, validated fix, or refactored structure materially changes the documented design or expected behavior.
- Keep updates descriptive, readable, and consistent with the existing section structure.
- Preserve the note's role as both human-readable documentation and implementation guidance.

### CLI Workflow Example

```bash
# Design
flow create note --file design --graph design/20260501-001-FEAT-parser-retry-budget --title "Parser retry budget design" --description "Design proposal — status: Proposed" --tag design --tag parser
flow search --graph design/20260501-001-FEAT-parser-retry-budget --type note --title parser --description retry --tag design --compact
flow node content --id design/20260501-001-FEAT-parser-retry-budget/design --line-start 1 --line-end 200
flow node update --id design/20260501-001-FEAT-parser-retry-budget/design --description "Design proposal — status: Approved" --body "<updated design body>"
flow create note --file decision-queue --graph design/20260501-001-FEAT-parser-retry-budget --title "Queue design decision" --description "Why queue-based retry is introduced" --tag decision
flow node connect --from design/20260501-001-FEAT-parser-retry-budget/design --to design/20260501-001-FEAT-parser-retry-budget/decision-queue --graph design/20260501-001-FEAT-parser-retry-budget --relationship evolves-from --context "Adds queueing to satisfy bounded retry latency"

# Planning
flow create task --file implement-queue --graph development/20260501-001-FEAT-parser-retry-budget --title "Implement retry queue" --description "Core queue implementation" --status Ready --tag implementation
flow create task --file review-queue --graph development/20260501-001-FEAT-parser-retry-budget --title "Review queue implementation" --description "Code review and refactor pass" --status Ready --tag review
flow create task --file test-retry --graph development/20260501-001-FEAT-parser-retry-budget --title "Test retry behavior" --description "Unit and integration coverage" --status Ready --tag test
flow node connect --from development/20260501-001-FEAT-parser-retry-budget/implement-queue --to development/20260501-001-FEAT-parser-retry-budget/review-queue --graph development/20260501-001-FEAT-parser-retry-budget --relationship depends-on
flow node connect --from development/20260501-001-FEAT-parser-retry-budget/review-queue --to development/20260501-001-FEAT-parser-retry-budget/test-retry --graph development/20260501-001-FEAT-parser-retry-budget --relationship depends-on

# Implementation
flow node update --id development/20260501-001-FEAT-parser-retry-budget/implement-queue --status Running
flow node update --id development/20260501-001-FEAT-parser-retry-budget/implement-queue --status Done
flow node update --id development/20260501-001-FEAT-parser-retry-budget/implement-queue --description "Core queue implementation (commit: abc1234)"
flow node edges --id development/20260501-001-FEAT-parser-retry-budget/implement-queue --graph development/20260501-001-FEAT-parser-retry-budget
flow node list --graph development/20260501-001-FEAT-parser-retry-budget --status Ready --compact
```

### Completion Criteria

- Design decisions are captured as notes and connected with contextual edges under `design/YYYYMMDD-NNN-<type>-<title>`.
- Planning tasks, including review and test tasks, have explicit dependency links.
- Implementation status and next-ready tasks are derivable from task status plus dependency edges.
- Task nodes that were implemented and committed include the corresponding git commit id in node content.

<!-- flow:modes:stages-start -->
## 2. Stage Workflows

### Shared Validation Rules

Always run the most relevant available tests, linting, or targeted verification after any change; if no automated tests exist for the affected area, perform the best available targeted verification and say what was checked; never claim a stage complete if validation was not performed. Each stage below adds its stage-specific rules.

### 2.1 Design

Design the requested feature for this workspace.

Start by reviewing the relevant code and the existing Flow graph to understand the current system, constraints, and terminology.

Follow this workflow:

1. If the request is ambiguous or underspecified, ask only the minimum clarifying questions needed to produce a credible design.
2. Produce a design proposal in chat first. Do not record it in the graph before the user explicitly approves the design.
3. Keep the proposal concrete enough that it can guide implementation, while still being easy for a human reader to scan and review.
4. Ask for explicit approval at the end. Use clear approval language such as: "Approve this design and record it as the design note."
5. Only after explicit approval in the same conversation, record the approved design as a note node (the design note) in `design/YYYYMMDD-NNN-<type>-<title>`.

Flow record-keeping requirements (required; see [Section 1](#1-record-keeping-protocol) for the full protocol):

- Record the design run in the shared Flow graph: one feature sub-directory per feature (`design/YYYYMMDD-NNN-<type>-<title>`), with at least one task node (status `Ready`, `Running`, `Done`, `Success`, `Failed`, `Interrupted`) and one note node — the design note — holding the design summary, assumptions, decisions, open questions, and approval state.
- Link nodes with explicit edges, define task-to-task dependencies, and record the git commit id on task nodes once their work is committed.
- Prefer updating existing nodes over creating duplicates when rerunning the same design thread.
- Treat Flow nodes as the primary run log; the design note is the approved design artifact.

The design note body should cover the items that matter for the feature, using the headings below so the content can guide implementation with minimal rewriting.

When recording the design note (`flow create note --file design ...` / `flow node update --id .../design --body ...`):

- Keep the content descriptive enough that an agent or engineer can implement the feature from the note.
- Keep the writing readable for humans. Prefer clear prose, short sections, and direct language over dense specification style.
- Use stable, specific headings so future changes can extend the note cleanly.
- Include implementation-relevant detail, but avoid dumping code unless a short snippet is necessary to clarify an interface or flow.

Use this response structure for the in-chat proposal. Match these headings exactly — they become the design note body:

#### Feature: <Feature Name>

##### Status

Use `Proposed` until the user approves the design; after approval, record `Approved` in the design note description.

##### Summary

Summarize the feature request, affected area, and assumptions.

##### Problem

Describe the problem being solved and why the change is needed.

##### Goals

List the intended outcomes.

##### Non-Goals

List what this design does not try to solve.

##### User Experience

Describe the user-visible workflow, behavior, or configuration changes.

##### Architecture

Describe the major components, responsibilities, and boundaries involved.

##### Data And Interfaces

Describe data models, APIs, events, files, or contracts that change.

##### Control Flow

Describe the main runtime flow, lifecycle, or sequence of operations.

##### Edge Cases And Failure Modes

Describe validation rules, exceptional paths, and fallback behavior.

##### Testing Strategy

Describe how the feature should be validated.

##### Risks And Tradeoffs

Call out meaningful alternatives, constraints, and likely failure cases.

##### Open Questions

List unresolved issues that affect the design or implementation.

#### Approval

Ask for explicit approval to record the design note. If information is still missing, ask the minimum follow-up questions instead of pretending the design is complete.

Before finishing the run, ensure Flow records are updated to reflect:

- final proposal status,
- outstanding open questions,
- whether the design note was recorded or updated after approval,
- and any commit ids already recorded on related completed task nodes,
- and the corresponding home.md update needed so home.md continues evolving toward a workspace manual.

### 2.2 Plan

Plan implementation work for the requested feature in this workspace.

Start by reviewing:

- The approved design note for the feature — find it with `flow search --graph design --type note --title <feature>` or `flow node content --id design/YYYYMMDD-NNN-<type>-<title>/design`
- The relevant code, tests, and documentation for the feature being planned
- Existing Flow records for any prior work on this feature

Follow this workflow:

1. Read the feature's design note and confirm that its design is approved (status recorded as `Approved`) and stable enough to plan against.
2. Build a practical implementation plan that respects the approved design, dependencies between tasks, and testing strategy.
3. Break the work into concrete, actionable Flow task nodes that map directly to the implementation requirements described in the design note.
4. Document the plan in the project's shared Flow graph under a feature sub-directory (for example, `development/YYYYMMDD-NNN-<type>-<title>`).
5. If the feature does not have an approved design note yet, direct the user to run the design workflow first rather than planning from an underspecified design.

Flow record-keeping requirements (required; see [Section 1](#1-record-keeping-protocol) for the full protocol):

- Plan in the shared Flow graph: one feature sub-directory per feature (`development/YYYYMMDD-NNN-<type>-<title>`), with a task node per actionable implementation step and at least one note node capturing the plan summary, assumptions, risks, and how the task graph maps to the design note.
- Link task nodes with explicit dependency edges so execution order is unambiguous, and link the planning note to the design note and to feature task nodes.
- Treat Flow task nodes as the authoritative implementation checklist; keep tasks concrete, sized for single-run execution, and written in action-oriented language ("Add", "Update", "Test", "Wire", "Document").

Use this response structure in chat while working:

#### Planning Basis

Summarize the relevant design note being planned, including its approval state and key design points.

#### Implementation Plan

Give a brief, high-level overview of workstreams, sequencing, dependencies, and risks.

#### Flow Plan Records

List the specific records created or updated:

- Feature sub-directory: the path in the shared Flow graph
- Note: the planning note node and its summary
- Task nodes: each task node with its description, initial status, and parent-child links
- Dependencies: each task-to-task dependency link

Task-writing rules:

- Write tasks that are concrete, implementation-oriented, and testable.
- Size tasks for single-run execution.
- Use action-oriented language ("Add", "Update", "Test", "Wire", "Document").
- Map explicit task dependencies within the graph.
- Every task body must include an **Acceptance Criteria** section — each criterion checkable by a test, a command, or a concrete verification, never by adjectives.
- Every task body must include an **Evidence Strategy** line stating how the acceptance criteria will be proven at close time (which tests run, what output or commit ids get recorded).

Execution alignment rules:

- Assume one task will be executed per implementation run.
- Verify that Flow records (tasks, dependencies, notes) are complete and linked before concluding.
- Ensure home.md receives a note about the newly planned capability for future reference.

### 2.3 Implement

Implement the requested feature by using Flow task nodes in the shared graph feature sub-directory as the task list and the feature's design note as the implementation design reference.

Start by reviewing:

- The approved design note (`flow node content --id design/YYYYMMDD-NNN-<type>-<title>/design`)
- The relevant code, tests, and documentation for the feature being implemented

Follow this workflow:

1. Find the matching feature sub-directory in the shared Flow graph using the provided feature name or sub-directory path.
2. Use Flow task nodes in that feature sub-directory as the execution checklist.
3. Use the design note to understand the intended behavior, interfaces, data flow, constraints, and testing requirements.
4. Select exactly one `Ready` task node to implement in this run unless the user explicitly names a specific task.
5. Implement only that single task, validating the work before marking it complete.
6. After the task is fully completed, run the most relevant available tests, lint checks, or targeted verification for that task.
7. Only after successful implementation and validation, update the selected task node from `Running` to `Done`.
8. If at least one task remains incomplete, keep the feature note status as `Open` or `In Progress`, depending on the state of the work.
9. If all task nodes for the feature are completed, update the feature note status to `Completed`.
10. If implementation reveals necessary changes that the user explicitly requested and those changes differ from the design note, update the relevant design note section after the affected task is finished.
11. At the end of the run, suggest the next best unchecked task for the same feature. If the feature is completed, suggest the next feature to implement instead.

Flow record-keeping requirements (required; see [Section 1](#1-record-keeping-protocol) for the full protocol):

- Keep the single selected task node moving through `Ready` -> `Running` -> `Done`, and the feature note node capturing implementation decisions, touched files, validation commands, and outcomes.
- Link task, note, and command nodes; maintain dependency links so blocked/ready state is visible from graph structure; record the git commit id on the task node once its work is committed.
- If command documents exist for verification, prefer running them via `flow run <name>` when practical.
- Keep feature note and task-node status synchronized in Flow.

Status rules for the Flow feature note:

- A feature may start in `Planned` when created by the planning workflow.
- Move `Planned` to `Open` when implementation begins but no task has been completed yet.
- Use `Open` when no implementation task has been completed yet.
- Use `In Progress` when some task nodes are completed but work remains.
- Use `Completed` only when every feature task node is in `Done`.

Design note update rules:

- Follow the shared [design-note update rules](#the-design-note) in Section 1.
- For this stage, update the design note only when the implemented behavior or agreed design has materially changed from what is documented.

Flow task update rules:

- Do not create duplicate feature sub-directories when one already exists.
- Preserve completed task nodes and prior progress.
- If you need to add a new implementation task because of user-approved scope changes, add it as a new task node in the same feature sub-directory.

If Flow planning nodes are missing, incomplete, or inconsistent with the design note:

- Ask the minimum follow-up questions needed, or
- Explain that the feature should be planned first with Flow task nodes updated before implementation can proceed safely.

Use this response structure in chat while working:

#### Implementation Target

Identify the Flow feature sub-directory being implemented and the corresponding design note.

#### Execution Plan

Name the single task being attempted now, explain any dependencies, and state what validation will be run after the task is implemented.

#### Progress Updates

Report whether the selected task node was completed, which Flow node was updated, what status change was applied to the feature note, and what tests or verification were run.

#### Design Record Sync

State whether the design note was updated to reflect user-directed implementation changes. If not, say that no design note update was needed.

#### Remaining Work

List the remaining unchecked tasks, blockers, and the recommended next task or next feature to implement.

Implementation rules:

- Make the code changes instead of stopping at a proposed plan unless the user explicitly asks for planning only.
- Execute only one Flow task node per run unless the user explicitly instructs otherwise.
- Follow the [shared validation rules](#shared-validation-rules) in Section 2 after completing a task.
- Update Flow task status immediately after a task is validated.
- Do not mark a task complete until the implementation for that task is actually complete.
- If a task cannot be completed safely, leave it unchecked and explain the blocker.
- Keep edits focused on the requested feature and avoid unrelated refactors.

Run-completion record rules:

- Before ending the run, update Flow notes with what was shipped and what remains.
- Ensure remaining `Ready`/`Running` task nodes are represented in Flow with accurate status and links.
- If a commit was created for a completed task, ensure that task node includes the commit id.
- When any task is completed, update home.md with the newly completed capability so home.md incrementally evolves into the workspace manual.

### 2.4 Fix

Fix the reported issue in this workspace.

Start by reviewing:

- The user-reported issue, failing behavior, error, or regression
- The relevant design note nodes for intended behavior and system design (`flow search --graph design --type note` / `flow node content`)
- The relevant code, tests, and documentation involved in the issue

Follow this workflow:

1. Identify the root cause of the issue before changing code whenever feasible.
2. Use the design note to confirm the intended behavior, interfaces, constraints, and design assumptions.
3. Implement the smallest credible fix that addresses the root cause without introducing unrelated refactors.
4. After the fix is in place, run the most relevant available tests, lint checks, or targeted verification for the changed behavior.
5. Keep record keeping in Flow nodes for this workflow.
6. If the completed fix changes the intended design, documented behavior, interfaces, or constraints compared with the design note, update the relevant design note section after the fix is validated.
7. If the issue cannot be fixed safely because the expected behavior is unclear or the current design is contradictory, ask the minimum follow-up questions needed to continue.

Flow record-keeping requirements (required; see [Section 1](#1-record-keeping-protocol) for the full protocol):

- Record the fix in the shared Flow graph: one feature sub-directory per fix stream (`development/YYYYMMDD-NNN-<type>-<title>`), with a task node tracking the fix lifecycle and status (`Ready`, `Running`, `Done`, `Success`, `Failed`, `Interrupted`) and a note node recording root cause, fix decision, risk notes, and validation outcomes.
- Link fix notes, tasks, and related nodes; define dependency links between fix tasks; record the git commit id on task nodes once their work is committed.
- Treat Flow nodes as the primary operational record for debugging and resolution history.

Design note update rules:

- Follow the shared [design-note update rules](#the-design-note) in Section 1.
- For this stage, update the design note only when the validated fix materially changes the documented design or expected behavior.

Validation rules:

- Follow the [shared validation rules](#shared-validation-rules) in Section 2.
- For this stage, do not claim the issue is fixed if validation has not been performed.

Use this response structure in chat while working:

#### Issue Target

Summarize the reported issue, affected area, and expected behavior.

#### Root Cause

Explain the most likely or confirmed root cause based on the code and design note review.

#### Fix Plan

Describe the change being made and how it addresses the issue without causing unrelated regressions.

#### Validation

Report the tests, lint checks, or targeted verification that were run after the fix and the result.

#### Design Record Sync

State whether the design note was updated because the fix changed the recorded design or intended behavior. If not, say that no design note update was needed.

#### Follow-Up

List any residual risk, remaining uncertainty, or next recommended step.

Implementation rules:

- Make the code changes instead of stopping at analysis unless the user explicitly asks for diagnosis only.
- Focus on the reported issue and avoid unrelated cleanup.
- Prefer root-cause fixes over defensive patches that hide the problem.
- Leave clear notes if the issue remains partially unresolved or blocked by missing requirements.

Before finishing the run, ensure Flow records clearly show:

- whether the issue is resolved, partially resolved, or blocked,
- what validation was executed,
- what follow-up fix task is next,
- and any commit id recorded on task nodes for completed fix tasks,
- and the home.md update needed to reflect completed fix behavior in the workspace manual narrative.

### 2.5 Refactor

Refactor the requested code, feature, file, or area of the project.

Start by reviewing:

- The relevant code, tests, and documentation
- The relevant design note nodes when architectural intent or system boundaries matter
- Any related diffs, known pain points, or user constraints for the refactor

Follow this workflow:

1. Identify the main refactoring goal before changing code, such as reducing duplication, simplifying logic, improving boundaries, clarifying naming, or removing unnecessary complexity.
2. Confirm the intended behavior from the current implementation, tests, and the design note so the refactor does not introduce regressions.
3. Prefer behavior-preserving refactors unless the user explicitly asks for a behavioral change.
4. Refactor the code in focused steps, keeping changes proportional to the requested area.
5. Remove duplicate logic when it can be consolidated safely.
6. Simplify overly complex code when readability and maintainability improve without hiding important logic.
7. Ask the user before removing code that appears to be legacy, compatibility-related, or intentionally retained unless the conversation already makes removal safe.
8. Keep record keeping in Flow nodes for this workflow.
9. After the refactor is complete, run the most relevant available tests, lint checks, or targeted verification.
10. If the refactor changes documented responsibilities, boundaries, interfaces, or structural design compared with the design note, update the relevant design note section after validation.

Flow record-keeping requirements (required; see [Section 1](#1-record-keeping-protocol) for the full protocol):

- Record the refactor in the shared Flow graph: one feature sub-directory per refactor stream (`development/YYYYMMDD-NNN-<type>-<title>`), with a task node tracking the refactor objective and status transitions and a note node recording preserved behavior guarantees, structural changes, and validation results.
- Link refactor notes and tasks to related nodes, define dependency links between refactor tasks, and record the git commit id on task nodes once their work is committed.
- Treat Flow nodes as the canonical operational history for the refactor run.

Refactoring rules:

- Favor small, coherent structural improvements over broad rewrites.
- Prefer extraction, consolidation, naming improvements, and clearer control flow over cosmetic churn.
- Keep public behavior stable unless the user explicitly approves behavior changes.
- Do not mix unrelated cleanup into the refactor.
- Do not remove apparently unused or legacy code without user confirmation when intent is unclear.

Validation rules:

- Follow the [shared validation rules](#shared-validation-rules) in Section 2.
- For this stage, do not claim the refactor is safe if validation has not been performed.

Use this response structure in chat while working:

#### Refactor Target

Summarize the area being refactored, the current pain points, and the intended preserved behavior.

#### Refactor Plan

Describe the structural changes being made and why they improve the code.

#### Changes Made

Summarize the completed refactoring changes, including any duplication removed or logic simplified.

#### Validation

Report the tests, lint checks, or targeted verification that were run after the refactor and the result.

#### Design Record Sync

State whether the design note was updated because the refactor changed the recorded design. If not, say that no design note update was needed.

#### Legacy Code Check

Ask whether any suspected legacy code in the refactored area is safe to remove, or note that no likely legacy code was identified.

#### Follow-Up

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
- and the home.md update needed to keep workspace-manual guidance aligned with refactor outcomes.

### 2.6 Test

Test the requested feature, area, or change set in this workspace.

Start by reviewing:

- The relevant code, tests, and recent changes
- The relevant design note nodes for expected behavior and constraints when needed
- The relevant Flow feature note and task nodes in the shared graph when testing maps to planned or in-progress tasks

Follow this workflow:

1. Identify the highest-value validation targets for the requested scope.
2. Prefer targeted tests first, then broader suites only when needed.
3. Run the most relevant available tests, lint checks, or verification commands.
4. Record pass/fail outcomes and isolate any failures with concrete evidence.
5. If failures are found, create or update follow-up Flow tasks with clear repro details and expected behavior.
6. Do not claim validation is complete if required checks were not run.

Flow record-keeping requirements (required; see [Section 1](#1-record-keeping-protocol) for the full protocol):

- Record the testing run in the shared Flow graph: one feature sub-directory per testing stream (`development/YYYYMMDD-NNN-<type>-<title>`), with a task node tracking execution status (`Ready`, `Running`, `Done`, `Success`, `Failed`, `Interrupted`) and a note node capturing executed commands, test outputs, pass/fail summary, and failure diagnostics.
- Link test notes to related implementation/fix/refactor nodes, and record the git commit id on task nodes once their work is committed.
- For failed checks, add linked remediation task nodes with explicit acceptance criteria, defining dependency links when one failure must be resolved before another.
- Treat Flow nodes as the primary operational test history.

Validation rules:

- Prefer deterministic, reproducible checks over manual ad-hoc claims.
- If some checks cannot be run, explain exactly why and what was run instead.
- Distinguish clearly between passed, failed, and skipped checks.

Use this response structure in chat while working:

#### Test Target

Summarize the feature, area, or change set being validated.

#### Test Plan

List the checks that will be run and why they were chosen.

#### Results

Report each executed check and outcome (`pass`, `fail`, or `skipped`).

#### Failures And Follow-Up

If failures exist, summarize root signal and list the follow-up tasks that were recorded.

#### Flow Record Sync

State which Flow nodes were created or updated and how they map to this testing run.

#### Next Step

Recommend the next test or remediation action.

Implementation rules:

- Run tests and report actual outcomes; do not fabricate results.
- Keep testing scoped to the requested area unless broader validation is necessary.
- Record all meaningful testing decisions and outcomes in Flow before ending the run.
- Record any commit ids added to completed task nodes when tests are part of a commit-ready workflow.
- Record the home.md update needed so validated behavior is reflected in the evolving workspace manual.

### 2.7 Review

Review the requested code, feature, change, or area of the project.

Start by reviewing:

- The relevant code, tests, and documentation
- The relevant design note nodes when architectural intent or system boundaries matter
- Any related diffs, changed files, or issue context if they are available

Follow this workflow:

1. Review the code with a code-review mindset focused on correctness, maintainability, clarity, and operational risk.
2. Check whether the implementation follows strong coding practices for the language and project conventions in the repository.
3. Check for security issues, including unsafe input handling, data exposure, broken trust boundaries, insecure defaults, injection risks, access-control gaps, or misuse of secrets.
4. Check whether the design could be improved, including unclear responsibilities, poor boundaries, weak abstractions, or design choices that conflict with the design note.
5. Check for duplicate code that should be consolidated or extracted.
6. Check whether the code can be simplified further without reducing clarity or changing behavior.
7. Ask the user whether there is legacy code in the reviewed area that is safe to remove or intentionally kept for compatibility. Do this when that context is not already clear from the repository or conversation.
8. If you identify issues, prioritize findings by severity and user impact.
9. If no issues are found, state that explicitly and mention any residual risk or testing gaps.

Flow record-keeping requirements (required; see [Section 1](#1-record-keeping-protocol) for the full protocol):

- Record the review in the shared Flow graph: one feature sub-directory per review stream (`development/YYYYMMDD-NNN-<type>-<title>`), with a task node tracking review progress and status and a note node capturing findings, severities, residual risks, and recommended actions.
- Link review findings to related implementation, fix, or refactor nodes, define dependency links between review follow-up tasks, and record the git commit id on task nodes once their work is committed.
- Prefer one linked note per major finding when that improves traceability.
- Treat Flow nodes as the primary record of review outcomes and follow-ups.

Review rules:

- Prefer identifying root problems over surface-level style commentary.
- Focus first on bugs, regressions, security problems, architectural risks, and maintainability issues.
- Do not propose removals of apparently unused or legacy code as a required change until the user confirms it is safe to remove.
- Keep suggestions practical and proportional to the code under review.
- Avoid nitpicks unless they point to a real maintainability or correctness problem.

Use this response structure:

#### Findings

List findings first, ordered by severity.

For each finding include:

- Severity: High, Medium, or Low
- Area: security, architecture, duplication, simplification, correctness, maintainability, or testing
- Explanation of the issue
- Why it matters
- Recommended fix or direction

If there are no findings, say: `No material findings.`

#### Legacy Code Check

Ask whether there is any legacy code in the reviewed area that can be removed, or note that no likely legacy code was identified.

#### Residual Risks

Call out any uncertainty, untested paths, missing context, or assumptions that limit confidence in the review.

#### Summary

Give a short overall assessment of code quality and the most important next step.

Before finishing the run, ensure Flow records include:

- final finding set (or explicit no-findings outcome),
- prioritized follow-up tasks,
- unresolved review risks,
- and any commit ids recorded on related completed task nodes,
- and the home.md update needed so reviewed outcomes are reflected in the workspace manual.

### 2.8 Commit

Commit the requested completed work for this workspace.

Start by reviewing:

- The relevant changes in the working tree and staged changes
- The relevant design note nodes and Flow records when implementation decisions or design context are needed for the commit body
- The relevant code and tests so the commit message reflects the actual delivered work

Follow this workflow:

1. Identify the matching feature sub-directory and task nodes in Flow using the provided feature name or sub-directory path.
2. Determine which completed (`Done`) task nodes are fully represented by the current changes being committed.
3. Review the implementation details and design context needed to write a precise commit message and body.
4. If the working tree includes unrelated changes, avoid committing them unless the user explicitly asks to include them.
5. Only proceed if the commit cleanly maps to one or more fully completed Flow task nodes.
6. If the changes represent only part of a task, or if the mapping from changes to Done task nodes is ambiguous, do not create the commit. Explain the mismatch and ask the user to finish the task or clarify scope first.
7. Before creating the commit, update Flow notes to record the exact task-node-to-commit mapping.
8. Do not delete Flow task nodes; preserve them as execution history and mark any commit-tracking node as Done.
9. After creating the commit, update each committed task node with the final git commit id in the task node description or body.
10. Create a strong commit message with a concise subject line and a body.
11. In the commit body, summarize the Flow task nodes implemented by the commit and the key implementation decisions.
12. If there is nothing meaningful to commit, explain why and do not create an empty or misleading commit.

Flow record-keeping requirements (required; see [Section 1](#1-record-keeping-protocol) for the full protocol):

- Record the commit in the shared Flow graph: one feature sub-directory per feature (`development/YYYYMMDD-NNN-<type>-<title>`), with a task node tracking commit readiness and a note node capturing commit scope, included task mapping, validation status, and any excluded changes.
- Record the final commit id on every task node fully covered by the commit and keep the note-node commit mapping synchronized with the task-node commit ids.
- Link commit records to related implementation/review nodes, and preserve dependency links between committed and remaining task nodes.

Commit message rules:

- Write a concise, descriptive subject line.
- Use an imperative subject line, for example: `Add audit log export validation`.
- Keep the subject focused on the main outcome of the commit.
- Use the body to explain what was implemented and which design or implementation decisions matter for future readers.
- Base the body on completed Flow task node text, but rewrite it into clear commit prose rather than copying raw node labels.
- Mention relevant constraints, tradeoffs, or design decisions when they help explain the change.

Safety rules:

- Do not use destructive git commands.
- Do not amend an existing commit unless the user explicitly asks for it.
- Do not create a commit if tests or validation for the completed work have obviously not been run and the change requires them. In that case, run the relevant validation first or explain the blocker.
- Do not create a commit for partial-task progress.
- Keep the commit focused and avoid bundling unrelated work.

Use this response structure in chat while working:

#### Commit Target

Identify the feature sub-directory and the completed Flow task nodes being committed.

#### Commit Plan

Explain what will be included in the commit, why the selected changes fully satisfy the chosen Done task nodes, what Flow record updates will happen, and any validation or staging decisions.

#### Commit Message

Show the proposed commit subject and body.

#### Flow Record Sync

State which Flow task/note nodes were updated with commit mapping and the commit id recorded on each committed task node.

#### Result

Report whether the commit was created successfully. If no commit was created, explain which task-completion requirement blocked it. Note any remaining uncommitted work.

Implementation rules:

- Make the commit instead of stopping at a proposed message unless the user explicitly asks for commit drafting only.
- Only commit work that fully completes one or more Done Flow task nodes.
- Ensure the commit body reflects the actual implemented work rather than generic summaries.
- Use Flow task text as source material, but produce a human-readable commit body.
- Keep the commit and Flow record sync synchronized.
- Do not finish the commit run until committed task nodes include the commit id.

Before finishing the run, ensure Flow records include:

- what was committed,
- what Flow record updates occurred,
- which committed task nodes were updated with commit ids,
- what work remains uncommitted,
- and the home.md update needed so committed capabilities are reflected in the workspace manual.

### 2.9 Roadmap

Plan many features up front, record them fully, and develop them together — including parallel execution by multiple agent sessions.

#### Roadmap Planning (batch plan)

Use when the user names several features at once or asks to "plan ahead":

1. Run the Design stage (2.1) for each feature; every design note must reach `Approved` before its tasks are planned.
2. Create one roadmap note (for example `design/YYYYMMDD-NNN-FEAT-<program-title>/roadmap`) listing members, sequencing rationale, and shared risks.
3. Connect the roadmap note to each member design note with `relates-to --context "<member role>"`.
4. Run the Plan stage (2.2) per feature so each member has a complete development task graph. Feature note status stays `Planned` until batch development starts — planning is committed; development start is deliberately deferred.
5. Record real cross-feature ordering as `depends-on` edges between task nodes in different sub-graphs.

#### Roadmap Status and Execution Packets

Use `flow roadmap [--graph <slug>] [--json]` to inspect: per-feature progress (`Planned/Open/In Progress/Completed`), readiness gaps (tasks missing acceptance criteria, open `question`-tagged notes), and the next-ready queue ordered by dependency layer then age. Use `flow roadmap --next` to print a self-contained execution packet for the next ready task — a cold session must implement from the packet without re-reading the graph.

#### Parallel Batch Development

Use when the user says to start/develop all planned features together:

1. Each agent session runs `flow roadmap next --claim --session <token>`. The claim atomically marks the chosen lowest-layer ready task `Running` and stamps `session:`/`session-at:` frontmatter.
2. Implement exactly the claimed task from its packet; validate; record an **Evidence** section in the task body (tests run + outputs, repro-test SHAs for bugs, before/after suites for refactors) and the commit id once committed.
3. Mark it `Done`, then re-run `flow roadmap next --claim` for the next unit of work.
4. One claimed task per session. Never hand-edit another session's Running claim.
5. Stale claims (>4h by default, tunable via `--stale-hours`) are surfaced with resume/revert/handoff options instead of blocking the queue.

Batch mode stop conditions — pause and align with the user when any of these holds:

- a task fails validation twice in a row,
- an assumption recorded in the design was invalidated by implementation findings,
- a cross-feature `depends-on` target is not `Done`,
- the ready set empties while open questions remain.

<!-- flow:modes:stages-end -->
## 3. Graph Engineering

Engineer Flow's graph as a first-class, persistent, inspectable state — not as prose or chat transcripts. Flow already treats Markdown on disk as the source of truth and derives a graph (canvas, layers, focused snapshots) from it. This section teaches the discipline of *engineering through the graph*: every node edit and edge decision is a deliberate, validated graph mutation, and work is only committed when the graph is coherent.

Read [Section 1](#1-record-keeping-protocol) for the mandatory record-keeping protocol (sub-graph naming, task statuses, commit-id recording). The graph model below is the design reference for how the workspace works.

### 3.1 Flow Graph Model

- **Nodes** — three canonical types, each a Markdown file under `.flow/data/content/<graph>/`:
  - `note` — free-form context, decisions, research (status-free). Approved designs live as note nodes (the design note).
  - `task` — status-driven work item (`Ready`, `Running`, `Done`, `Success`, `Failed`, `Interrupted`).
  - `command` — executable node with `name`, `run`, optional `env`.
- **Edges** — stored as `links:` entries in frontmatter: `node: <id>`, optional `context`, optional `relationships:`. Two edge kinds on the canvas:
  - `link` — a hard declared edge from a `links:` entry.
  - `reference` — a soft edge derived from `[[inline refs]]` in the body. Never conflate these: hard links are dependencies; soft refs are navigation only.
- **Graphs & sub-graphs** — directory prefixes: `design/<graph>`, `development/<graph>`, `manual/<graph>`. Sub-graph names follow `YYYYMMDD-NNN-<type>-<title>` (types: `FEAT`, `BUG`, `FIX`, `REFACTOR`, `TEST`, `REVIEW`, `DOC`).
- **Layers** — the index topologically orders tasks/commands by their `depends-on` edges. This is your executable plan: a node with unresolved dependencies sits in a later layer.

### 3.2 CLI Toolkit

```bash
# Reconnaissance
flow search --graph <graph> --type <note|task|command> [--title ...] [--tag ...] [--compact]
flow node list --graph <graph> [--status <status>] [--tag <tag>] [--compact]
flow node read --id <node-id>
flow node edges --id <node-id>
flow node neighbors --id <node-id>
flow graph path --from <node-id> --to <node-id> [--directed]   # shortest path (any-direction unless --directed)
flow graph validate [--graph <sub-graph>] [--format json]        # static edge-type compatibility check for one sub-graph (exits non-zero on errors)
flow node content --id <node-id> [--line-start N --line-end M]

# Editing
flow create note|task|command --graph <graph> --file <file> --title <title> [--description ...] [--tag ...] [--status <status>] [--body ...]
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

### 3.3 Relationship Vocabulary

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

### 3.4 Workflow

Follow these phases in order. Do not edit the graph before you understand its current shape.

#### Phase 1: Reconnaissance — read before you write

The graph is a persistent shared state (EIG: the "idea graph" as the collaborative substrate). Map it before mutating it:

1. `flow node list --graph <graph> --compact` to enumerate nodes.
2. `flow search` to filter candidates by title/description/tag before reading bodies.
3. `flow node edges --id <id>` and `flow node neighbors --id <id>` to map the local neighborhood of every node you plan to touch; `flow graph path --from <id> --to <id>` to find the shortest connection when the relationship between two nodes is not obvious.
4. Identify unresolved weaknesses first: `Ready` tasks with no `depends-on`, `Failed`/`Interrupted` tasks, dangling links (links to ids that don't exist), and any `conflicts-with` edges. These are the graph's own TODO list.

#### Phase 2: Design the graph structure

Decide the shape before creating anything:

- Choose the sub-graph (`design/…` for proposals, `development/…` for planning/implementation) and a valid `YYYYMMDD-NNN-<type>-<title>` name.
- Decide which node type each unit of work deserves: a decision or context record → `note` (including the design note); an actionable unit → `task`; a repeatable operation → `command`.
- Plan the edge set up front: which edges are `depends-on` (ordering) vs `relates-to` (context). Keep dependency edges sparse and real — a dense dependency layer carries no signal (Grade: full-history dependency graphs collapse into run size).

#### Phase 3: Edit phase — one deliberate mutation at a time

Make discrete, validated graph edits (EIG: role-local edits on a snapshot, merged deliberately):

1. `flow create` each node with correct `id`, `type`, `graph`, `title`, and `description`. Use `description` as the one-line summary and `body` (content outside the frontmatter) as the full human-readable detail of the node. Both `description` and `body` are indexed for search (`flow search` matches title, description, and body); keep summaries concise and put substantive detail in the body.
2. `flow node connect` edges with an explicit `--relationship` and `--context`.
3. `flow node update` to adjust statuses/titles/bodies rather than rewriting files by hand.
4. After each mutation, verify the result: `flow node read --id <id>` and re-run `flow node edges` on the affected neighborhood.

#### Phase 4: Dependency-aware execution (Execution Lineage)

The graph is also an execution substrate. Honor it:

- **Selective invalidation**: when a node that others `depends-on` changes (status, description, body), re-open its downstream dependents to `Ready` — they may no longer be valid against the new upstream state. Preserve unrelated branches untouched. Flow does **not** auto-invalidate; this is a manual discipline you must apply whenever you edit an upstream node. It is what prevents stale "Done" tasks riding on outdated inputs.
- **Deterministic publication**: a task is only `Done` when every `depends-on` predecessor is `Done`. Do not mark a task complete against an unblocked graph.
- **Layers as the plan**: use `depends-on` edges to build the execution order; the topological layer view is your checklist. Start with layer-0 nodes.

#### Phase 5: Commit gate — the graph must be coherent before work ships

Before declaring a feature complete (EIG's commit head: "is this graph mature enough to synthesize?"):

1. Every task node in the feature sub-graph is `Done` or a documented terminal state.
2. No unresolved `depends-on` edges point at non-`Done` nodes.
3. No cycles (the layer builder rejects cycles — `task link cycle detected`). If one exists, find the offending edge with `flow node edges` and fix it.
4. Every edge carries a relationship and context.
5. Commit ids are recorded on committed task nodes (`flow node update --id <id> --description "… (commit: <sha>)"`).
6. `home.md` reflects the delivered capability.

#### Phase 6: Coherence test — the four conditions (arXiv 2607.27578)

Adapted from prompt graph engineering's necessary-and-sufficient conditions (Macedo, "What makes prompts a graph"), these are the membership checks that separate an explicit graph from a script or transcript:

- **Explicit structure (G1):** every piece of the work is represented as a node/edge — nothing exists only in the chat or in an agent's run transcript.
- **Separation of structure and content (G2):** structural edits (links, statuses, ids) never require rewriting node bodies, and body edits never require re-wiring the graph. Frontmatter is structure; body is content.
- **Executable semantics (G3):** the execution order is derivable from `depends-on` edges (the layer view) — the graph, not human memory, decides what runs next.
- **First-class artifact (G4):** the graph is versioned (git), inspectable (`flow node read` / `flow node edges` / `flow search`), and carries commit ids on completed tasks — consumable by any future run or tool, not just the one that produced it.

Fail any condition and the work has retreated into script/transcript territory: nothing to inspect, nothing to replay, nothing to optimize.

#### Phase 7: Graph maturity — membership is binary, quality is gradual

A graph that passes the four conditions is a legitimate, if modest, instance of the discipline; what separates a minimal graph from a mature one is graded (arXiv 2607.27578):

| Level | Characteristics |
|---|---|
| Minimal | nodes + edges exist, statuses tracked, no dangling links |
| Structured | every edge carries a relationship and context; node types match their role (note/task/command) |
| Executable | the layer order is a real checklist; command nodes run; no cycles; edge-type rules hold |
| Artifact-grade | git-versioned, commit ids recorded, `home.md` reflects capability, fully verifiable |

Aim for at least the Executable level before declaring a feature complete; Artifact-grade is the norm for shipped work.

### 3.5 Design Principles (from graph-based agent research)

- **Graph over transcript** (EIG): agents should coordinate through node/edge state, not conversation history. If a decision matters, it belongs in a node with edges — not only in the chat.
- **Weaknesses stay localized** (EIG): keep unsupported claims, missing evidence, and unmet dependencies visible as graph state (`Ready` tasks, `conflicts-with` edges) rather than absorbing them into prose. The graph is the status board.
- **Explicit dependencies** (Execution Lineage): a node must declare what it consumes. When the shape of a workflow is being decided, prefer explicit `depends-on` edges over implied ordering.
- **Local visibility** (Execution Lineage): each node should only reference what it actually depends on. Don't link a task to everything in the graph.
- **Sparse, observed edges** (Grade): hard `links:` carry the signal; `[[inline refs]]` are soft. When a soft reference becomes a real prerequisite, promote it to a hard `depends-on` edge with context — and only then.
- **Traversal for discovery** (GraphAgents): before implementing in an unfamiliar area, traverse: `flow node neighbors` from the entry point, `flow graph path` between entry and target nodes for the shortest connection, `flow search` across tags, and read the neighborhood. Exploration is a graph operation.

### 3.6 Edge Hygiene Rules

- Never add a `links:` entry to a node id that does not exist. The canvas does not drop unresolved targets — it renders them as synthetic reference nodes (circle shape when cross-graph), so a typo'd target pollutes the canvas with a node you never intended to create. Verify targets with `flow node list`/`flow search` before connecting.
- Do not create edges to collapse the distinction between hard links and inline refs. Promote soft refs to hard deps only when they are genuine prerequisites.
- One edge per relationship, deduplicated. Reconnecting the same pair with the same relationship is a no-op; use `flow node connect` idempotently.
- When a node is deleted, remove or re-target edges that pointed at it.
- **Type-compatible edges** (verification): the node type and relationship must agree — `depends-on` only from task/command to task/command; `maps-to` from a note to the task it records; `evolves-from`/`supersedes` between notes or between a task and its replacement. A `depends-on` pointing at a `note` is a warning that the relationship is really `relates-to`. These rules are statically checkable; run `flow graph validate` over the sub-graph before commit. Errors exit non-zero; warnings are advisory and never block indexing.

### 3.7 Common Failure Modes

| Symptom | Likely graph cause | Fix |
|---|---|---|
| `task link cycle detected` | a `depends-on` cycle among tasks/commands | inspect `flow node edges` in the loop, remove the redundant edge |
| Task stuck "Ready" forever | missing/inverted `depends-on` edges | verify the dependency direction with `flow node neighbors` |
| Stale Done tasks | upstream changed, dependents not invalidated | re-open dependents to `Ready` (selective invalidation) |
| Unexpected extra nodes on the canvas | `links:` targets that don't exist render as synthetic reference nodes | `flow search` the target, re-target or remove the link |
| Nothing shows in a graph view | nodes outside the selected graph scope | check `graph` frontmatter matches the selected scope |

### 3.8 Response Structure

While working, report progress in this shape:

#### Graph Reconnaissance

Summarize the current graph state (nodes, edges, weaknesses found).

#### Graph Design

Explain the chosen sub-graph, node types, and edge plan, and how it maps to the requested outcome.

#### Edits Made

List each `flow create` / `flow node connect` / `flow node update` performed with rationale.

#### Validation

Report layer ordering, cycle checks, and edge hygiene verification results.

#### Remaining Work

Any nodes left in `Ready`, blockers, or follow-ups for the next run.
