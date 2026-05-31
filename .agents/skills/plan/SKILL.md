---
name: plan
description: Plan implementation work for features using docs/architecture.md as the source of truth and Flow graph sub-directories/task nodes for record-keeping
user-invocable: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
argument-hint: Feature to plan
---

Plan implementation work for the requested feature in this workspace.

Start by reviewing:

- [docs/architecture.md](../../../docs/architecture.md) for the approved feature design, including architecture, data models, interfaces, control flow, and testing strategy
- The relevant code, tests, and documentation for the feature being planned
- Existing Flow records for any prior work on this feature

Follow this workflow:

1. Identify the requested feature in [docs/architecture.md](../../../docs/architecture.md) and confirm that its design is approved and stable enough to plan against.
2. Build a practical implementation plan that respects the approved architecture, dependencies between tasks, and testing strategy.
3. Break the work into concrete, actionable Flow task nodes that map directly to the implementation requirements described in [docs/architecture.md](../../../docs/architecture.md).
4. Document the plan in the project's shared Flow graph under a feature sub-directory (for example, `flow/development/<feature-slug>`).
5. If the feature does not have an approved design yet, direct the user to run the design workflow first rather than planning from an underspecified design.

Flow record-keeping requirements (required, see [packaging/SKILL.md](../../../packaging/SKILL.md) for full protocol):

- Use Flow as the planning execution environment.
- Use one shared Flow graph for all record keeping in the project. Do not switch graphs by operation type.
- For each new feature, create a feature sub-directory under the shared graph, for example `flow/development/<feature-slug>`.
- Build the task graph to mirror the architecture's implementation decomposition:
	- Create a task node for each actionable implementation step.
	- Create at least one note node capturing the plan summary, assumptions, risks, and how the task graph maps to the architecture.
- Link task nodes together with explicit dependency edges so execution order is unambiguous.
- Link the planning note to its feature task nodes, architecture sections, and any related design or review material.
- Keep task nodes concrete, implementation-oriented, and sized for single-run execution.
- Use action-oriented language in task descriptions: "Add," "Update," "Test," "Wire," "Document."
- Ensure each task includes enough specificity that an implement agent can select and execute it without additional research.
- Treat Flow task nodes as the authoritative implementation checklist.

Use this response structure in chat while working:

## Planning Basis

Summarize the relevant feature in [docs/architecture.md](../../../docs/architecture.md) being planned, including its current status and key design points.

## Implementation Plan

Give a brief, high-level overview of workstreams, sequencing, dependencies, and risks.

## Flow Plan Records

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

Execution alignment rules:

- Assume one task will be executed per implementation run.
- Verify that Flow records (tasks, dependencies, notes) are complete and linked before concluding.
- Ensure home.md receives a note about the newly planned capability for future reference.
