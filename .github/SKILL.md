# Skill: Flow-First Record Keeping

## Purpose
Use the Flow CLI for every record-keeping action in design, planning, and implementation work on this project.

## Graph Convention
- The parent graph directory is `.flow/data/content`.
- Design graph root is fixed as `design`.
- Development graph root is fixed as `development`.
- Sub-graph names are required to follow: `<type>-YYYYMMDD-NNN-<title>`.
- Valid type prefixes include `FEAT`, `FIX`, `REFACTOR`, `TEST`, `REVIEW`, `DOC`.
- `NNN` is a zero-padded incremental counter for directories created on that `YYYYMMDD` date.
- For each new design, create or reuse `design/<type>-YYYYMMDD-NNN-<title>`.
- Planning and implementation use the same suffix under `development/<type>-YYYYMMDD-NNN-<title>`.
- Do not use docs/backlog.md for planning; represent work as Flow task/note nodes and edges.

## Design Protocol (mandatory)
1. Resolve the work key from the request using `<type>-YYYYMMDD-NNN-<title>`.
2. Ensure `design/<type>-YYYYMMDD-NNN-<title>` exists by creating or updating nodes there.
3. Before reading node bodies, filter candidates using title/description/tags with `flow search`.
4. Read body content only after filtering (`flow node content`) to choose the right node.
5. Record design decisions as note nodes and connect them with context-rich edges.
6. For modifications, update existing node content and description in place (`flow node update --body --description`).

## Planning Protocol (mandatory)
1. Create or reuse planning sub-graph `development/<type>-YYYYMMDD-NNN-<title>`.
2. Create tasks from design outcomes with clear acceptance criteria.
3. Add explicit review and test tasks where needed for modularity and correctness.
4. Connect task dependencies using edges tagged with `depends-on`.
5. Keep task statuses current (`todo`, `doing`, `done`).

## Implementation Protocol (mandatory)
1. Start with tasks that have no incomplete dependency predecessors.
2. Update status transitions as work proceeds (`todo -> doing -> done`).
3. After each completed task, show the next ready task set based on dependency edges.
4. If requirements change, update both `design/<type>-YYYYMMDD-NNN-<title>` and `development/<type>-YYYYMMDD-NNN-<title>` before continuing.
5. Keep dependency links up to date so execution order stays explicit.

## CLI Workflow Example
```bash
# Design
flow create note --file overview --graph design/FEAT-20260501-001-parser-retry-budget --title "Parser retry budget design" --description "Decision log and constraints" --tag design --tag parser
flow search --graph design/FEAT-20260501-001-parser-retry-budget --type note --title parser --description retry --tag design --compact
flow node content --id design/FEAT-20260501-001-parser-retry-budget/overview --line-start 1 --line-end 200
flow node update --id design/FEAT-20260501-001-parser-retry-budget/overview --description "Updated constraints after perf analysis" --body "<updated design body>"
flow create note --file decision-queue --graph design/FEAT-20260501-001-parser-retry-budget --title "Queue design decision" --description "Why queue-based retry is introduced" --tag decision
flow node connect --from design/FEAT-20260501-001-parser-retry-budget/overview --to design/FEAT-20260501-001-parser-retry-budget/decision-queue --graph design/FEAT-20260501-001-parser-retry-budget --relationship evolves-from --context "Adds queueing to satisfy bounded retry latency"

# Planning
flow create task --file implement-queue --graph development/FEAT-20260501-001-parser-retry-budget --title "Implement retry queue" --description "Core queue implementation" --status todo --tag implementation
flow create task --file review-queue --graph development/FEAT-20260501-001-parser-retry-budget --title "Review queue implementation" --description "Code review and refactor pass" --status todo --tag review
flow create task --file test-retry --graph development/FEAT-20260501-001-parser-retry-budget --title "Test retry behavior" --description "Unit and integration coverage" --status todo --tag test
flow node connect --from development/FEAT-20260501-001-parser-retry-budget/implement-queue --to development/FEAT-20260501-001-parser-retry-budget/review-queue --graph development/FEAT-20260501-001-parser-retry-budget --relationship depends-on
flow node connect --from development/FEAT-20260501-001-parser-retry-budget/review-queue --to development/FEAT-20260501-001-parser-retry-budget/test-retry --graph development/FEAT-20260501-001-parser-retry-budget --relationship depends-on

# Implementation
flow node update --id development/FEAT-20260501-001-parser-retry-budget/implement-queue --status doing
flow node update --id development/FEAT-20260501-001-parser-retry-budget/implement-queue --status done
flow node edges --id development/FEAT-20260501-001-parser-retry-budget/implement-queue --graph development/FEAT-20260501-001-parser-retry-budget
flow node list --graph development/FEAT-20260501-001-parser-retry-budget --status todo --compact
```

## Completion Criteria
- Design decisions are captured as notes and connected with contextual edges under `design/<type>-YYYYMMDD-NNN-<title>`.
- Planning tasks, including review and test tasks, have explicit dependency links.
- Implementation status and next-ready tasks are derivable from task status plus dependency edges.
