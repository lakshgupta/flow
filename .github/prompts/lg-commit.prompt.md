---
name: lg-commit
description: Commit completed work with a strong commit message and body based on Flow task nodes and implementation decisions
argument-hint: Feature sub-directory or feature name to commit
agent: agent
---

Commit the requested completed work for this workspace.

Start by reviewing:

- The relevant changes in the working tree and staged changes
- [docs/architecture.md](../../docs/architecture.md) when implementation decisions or architecture context are needed for the commit body
- The relevant code and tests so the commit message reflects the actual delivered work

Follow this workflow:

1. Identify the matching feature sub-directory and task nodes in Flow using the provided feature name or sub-directory path.
2. Determine which completed (`done`) task nodes are fully represented by the current changes being committed.
3. Review the implementation details and architectural context needed to write a precise commit message and body.
4. If the working tree includes unrelated changes, avoid committing them unless the user explicitly asks to include them.
5. Only proceed if the commit cleanly maps to one or more fully completed Flow task nodes.
6. If the changes represent only part of a task, or if the mapping from changes to done task nodes is ambiguous, do not create the commit. Explain the mismatch and ask the user to finish the task or clarify scope first.
7. Before creating the commit, update Flow notes to record the exact task-node-to-commit mapping.
8. Do not delete Flow task nodes; preserve them as execution history and mark any commit-tracking node as done.
10. Create a strong commit message with a concise subject line and a body.
11. In the commit body, summarize the Flow task nodes implemented by the commit and the key implementation decisions.
12. If there is nothing meaningful to commit, explain why and do not create an empty or misleading commit.

Flow record-keeping requirements (required, see [.github/SKILL.md](../SKILL.md) for full protocol):

- Use Flow as the commit-run record.
- Use one shared Flow graph for all record keeping in the project. Do not switch graphs by operation type.
- For each new feature, create or reuse a feature sub-directory under the shared graph, for example `flow/development/<feature-slug>`.
- Keep at least one task node and one note node in the feature sub-directory:
	- Task node tracks commit readiness and completion status.
	- Note node captures commit scope, included task mapping, validation status, and any excluded changes.
- Link commit records to related implementation/review nodes so traceability is preserved.
- Preserve and update dependency links between committed and remaining task nodes to keep execution order explicit.
- When possible, record the final commit identifier in the note node after commit creation.

Commit message rules:

- Write a concise, descriptive subject line.
- Use an imperative subject line, for example: `Add audit log export validation`.
- Keep the subject focused on the main outcome of the commit.
- Use the body to explain what was implemented and which design or implementation decisions matter for future readers.
- Base the body on completed Flow task node text, but rewrite it into clear commit prose rather than copying raw node labels.
- Mention relevant constraints, tradeoffs, or architectural decisions when they help explain the change.

Safety rules:

- Do not use destructive git commands.
- Do not amend an existing commit unless the user explicitly asks for it.
- Do not create a commit if tests or validation for the completed work have obviously not been run and the change requires them. In that case, run the relevant validation first or explain the blocker.
- Do not create a commit for partial-task progress.
- Keep the commit focused and avoid bundling unrelated work.

Use this response structure in chat while working:

## Commit Target

Identify the feature sub-directory and the completed Flow task nodes being committed.

## Commit Plan

Explain what will be included in the commit, why the selected changes fully satisfy the chosen done task nodes, what Flow record updates will happen, and any validation or staging decisions.

## Commit Message

Show the proposed commit subject and body.

## Flow Record Sync

State which Flow task/note nodes were updated with commit mapping and commit identifier.

## Result

Report whether the commit was created successfully. If no commit was created, explain which task-completion requirement blocked it. Note any remaining uncommitted work.

Example response:

## Commit Target

Commit completed work for `flow/development/audit-log-export`, covering done task nodes for request validation and export generation.

## Commit Plan

Include the validated export changes in a single commit. The current changes fully satisfy done task nodes for validation and export generation, and the commit note will record the node-to-commit mapping while preserving remaining task nodes for unfinished work.

## Commit Message

Subject: Add audit log export validation and generation

Body:
Implement the completed audit log export tasks for request validation and export generation.

Normalize and validate approved export filters before processing requests, then generate exports using the documented storage flow. Keep the request handling and generation responsibilities separated so the export path stays aligned with the approved architecture.

This commit covers completed Flow task nodes for validation and generation, while leaving remaining task nodes open in the feature sub-directory.

## Flow Record Sync

Updated note node `note-commit` with commit identifier and mapped task nodes `task-export-validate` and `task-export-generate`.

## Result

Created the commit successfully. Remaining uncommitted work: user workflow wiring and final documentation updates.

Implementation rules:

- Make the commit instead of stopping at a proposed message unless the user explicitly asks for commit drafting only.
- Only commit work that fully completes one or more done Flow task nodes.
- Ensure the commit body reflects the actual implemented work rather than generic summaries.
- Use Flow task text as source material, but produce a human-readable commit body.
- Keep the commit and Flow record sync synchronized.

Before finishing the run, ensure Flow records include:

- what was committed,
- what Flow record updates occurred,
- what work remains uncommitted,
- and the home.md update needed so committed capabilities are reflected in the architecture/manual document.