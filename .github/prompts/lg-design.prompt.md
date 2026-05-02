name: design
description: Design a feature proposal, get user approval, then update docs/architecture.md with an indexed architecture spec
argument-hint: Feature to design
agent: agent
---

Design the requested feature for this workspace.

Start by reviewing the relevant code and documentation to understand the current system, constraints, and terminology.

Follow this workflow:

1. If the request is ambiguous or underspecified, ask only the minimum clarifying questions needed to produce a credible design.
2. Produce a design proposal in chat first. Do not edit [docs/architecture.md](../../docs/architecture.md) before the user explicitly approves the design.
3. Keep the proposal concrete enough that it can guide implementation, while still being easy for a human reader to scan and review.
4. Ask for explicit approval at the end. Use clear approval language such as: "Approve this design and update architecture.md."
5. Only after explicit approval in the same conversation, update [docs/architecture.md](../../docs/architecture.md).

Flow record-keeping requirements (required, see [.github/SKILL.md](../SKILL.md) for full protocol):

- Use the Flow workspace as the execution log for this design run.
- Use one shared Flow graph for all record keeping in the project. Do not switch graphs by operation type.
- For each new feature, create or reuse a feature sub-directory under the shared graph, for example `flow/development/<feature-slug>`.
- Keep at least one task node and one note node in the feature sub-directory:
	- Task node tracks the current design task and status (`todo`, `doing`, `done`).
	- Note node captures design summary, assumptions, decisions, open questions, and approval state.
- If a task from this feature is later implemented and committed, update that task node description or body with the commit id.
- Prefer updating existing nodes over creating duplicates when rerunning the same design thread.
- Keep relationships explicit with node links (for example, note links to task, and task links to related docs).
- Define task dependencies explicitly with task-to-task links so downstream runs can resolve execution order from the graph.
- Treat Flow nodes as the primary run log; architecture.md remains the approved design artifact.

The proposal should cover the items that matter for the feature.

Use the same section names as the approved feature template in [docs/architecture.md](../../docs/architecture.md) whenever they apply so the content can be moved into the document with minimal rewriting.

When updating [docs/architecture.md](../../docs/architecture.md):

- Keep the content descriptive enough that an LLM or engineer can implement the feature from the document.
- Keep the writing readable for humans. Prefer clear prose, short sections, and direct language over dense specification style.
- Maintain an `Index` section at the top of the file with links to every top-level section.
- If the file is empty, create a complete architecture document for the approved feature.
- If the file already has content, preserve useful existing material and integrate the new feature into the appropriate sections instead of duplicating content.
- Use stable, specific section headings so future changes can extend the document cleanly.
- Include implementation-relevant detail, but avoid dumping code unless a short snippet is necessary to clarify an interface or flow.

Use this response structure for the in-chat proposal. Match these headings exactly:

### Feature: <Feature Name>

#### Status

Use `Proposed` until the user approves the design.

#### Summary

Summarize the feature request, affected area, and assumptions.

#### Problem

Describe the problem being solved and why the change is needed.

#### Goals

List the intended outcomes.

#### Non-Goals

List what this design does not try to solve.

#### User Experience

Describe the user-visible workflow, behavior, or configuration changes.

#### Architecture

Describe the major components, responsibilities, and boundaries involved.

#### Data And Interfaces

Describe data models, APIs, events, files, or contracts that change.

#### Control Flow

Describe the main runtime flow, lifecycle, or sequence of operations.

#### Edge Cases And Failure Modes

Describe validation rules, exceptional paths, and fallback behavior.

#### Testing Strategy

Describe how the feature should be validated.

#### Risks And Tradeoffs

Call out meaningful alternatives, constraints, and likely failure cases.

#### Open Questions

List unresolved issues that affect the design or implementation.

## Approval

Ask for explicit approval to update [docs/architecture.md](../../docs/architecture.md). If information is still missing, ask the minimum follow-up questions instead of pretending the design is complete.

Before finishing the run, ensure Flow records are updated to reflect:

- final proposal status,
- outstanding open questions,
- whether architecture.md was updated after approval,
- and any commit ids already recorded on related completed task nodes,
- and the corresponding Home update needed so home.md continues evolving toward architecture/manual quality.