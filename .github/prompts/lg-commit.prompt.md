---
name: lg-commit
description: Commit completed work with a strong commit message and body based on backlog tasks and implementation decisions, then clean up the committed backlog entry
argument-hint: Feature ID or feature name to commit
agent: agent
---

Commit the requested completed work for this workspace.

Start by reviewing:

- The relevant changes in the working tree and staged changes
- [docs/backlog.md](../../docs/backlog.md) for the matching feature entry and completed tasks
- [docs/architecture.md](../../docs/architecture.md) when implementation decisions or architecture context are needed for the commit body
- The relevant code and tests so the commit message reflects the actual delivered work

Follow this workflow:

1. Identify the matching feature entry in [docs/backlog.md](../../docs/backlog.md) using the provided feature ID or feature name.
2. Determine which completed and already checked tasks in that feature entry are fully represented by the current changes being committed.
3. Review the implementation details and architectural context needed to write a precise commit message and body.
4. If the working tree includes unrelated changes, avoid committing them unless the user explicitly asks to include them.
5. Only proceed if the commit cleanly maps to one or more fully completed checked tasks.
6. If the changes represent only part of a task, or if the mapping from changes to checked tasks is ambiguous, do not create the commit. Explain the mismatch and ask the user to finish the task or clarify scope first.
7. Before creating the commit, update [docs/backlog.md](../../docs/backlog.md) to remove the completed task entries covered by this commit.
8. If removing those completed tasks leaves the feature entry with no remaining tasks, delete the entire feature entry from [docs/backlog.md](../../docs/backlog.md).
9. Include the backlog cleanup in the same commit so the repository state matches the committed work.
10. Create a strong commit message with a concise subject line and a body.
11. In the commit body, summarize the backlog tasks implemented by the commit and the key implementation decisions.
12. If there is nothing meaningful to commit, explain why and do not create an empty or misleading commit.

Commit message rules:

- Write a concise, descriptive subject line.
- Use an imperative subject line, for example: `Add audit log export validation`.
- Keep the subject focused on the main outcome of the commit.
- Use the body to explain what was implemented and which design or implementation decisions matter for future readers.
- Base the body on the completed task text from [docs/backlog.md](../../docs/backlog.md), but rewrite it into clear commit prose rather than copying raw checkboxes.
- Mention relevant constraints, tradeoffs, or architectural decisions when they help explain the change.

Backlog cleanup rules:

- Only remove completed checked task entries that are actually and fully covered by the commit.
- Do not remove unchecked tasks.
- Do not remove partially implemented tasks.
- Do not delete a feature entry if unchecked or uncommitted work still remains.
- If all tasks in the feature entry have already been completed and are included in the commit, remove the entire feature entry.
- Do not create or update [docs/backlog.md](../../docs/backlog.md) outside the scope of the committed feature.

Safety rules:

- Do not use destructive git commands.
- Do not amend an existing commit unless the user explicitly asks for it.
- Do not create a commit if tests or validation for the completed work have obviously not been run and the change requires them. In that case, run the relevant validation first or explain the blocker.
- Do not create a commit for partial-task progress.
- Keep the commit focused and avoid bundling unrelated work.

Use this response structure in chat while working:

## Commit Target

Identify the feature entry and the completed checked tasks being committed.

## Commit Plan

Explain what will be included in the commit, why the selected changes fully satisfy the chosen checked tasks, what backlog cleanup will happen, and any validation or staging decisions.

## Commit Message

Show the proposed commit subject and body.

## Backlog Cleanup

State which completed tasks were removed from [docs/backlog.md](../../docs/backlog.md), or whether the entire feature entry was deleted.

## Result

Report whether the commit was created successfully. If no commit was created, explain which task-completion requirement blocked it. Note any remaining uncommitted work.

Example response:

## Commit Target

Commit completed work for `FEAT-20260315-0001: Audit Log Export`, covering the checked tasks for request validation and export generation.

## Commit Plan

Include the validated export changes and the matching backlog cleanup in a single commit. The current changes fully satisfy the checked validation and export generation tasks, so those task entries can be removed from [docs/backlog.md](../../docs/backlog.md). Keep the feature entry because user workflow wiring and documentation tasks are still unfinished.

## Commit Message

Subject: Add audit log export validation and generation

Body:
Implement the completed audit log export tasks for request validation and export generation.

Normalize and validate approved export filters before processing requests, then generate exports using the documented storage flow. Keep the request handling and generation responsibilities separated so the export path stays aligned with the approved architecture.

This commit covers the completed backlog work for validation and generation, while leaving the remaining user workflow and documentation tasks in the backlog.

## Backlog Cleanup

Removed the completed checked validation and export generation tasks from [docs/backlog.md](../../docs/backlog.md). The feature entry remains because unchecked tasks are still pending.

## Result

Created the commit successfully. Remaining uncommitted work: user workflow wiring and final documentation updates.

Implementation rules:

- Make the commit instead of stopping at a proposed message unless the user explicitly asks for commit drafting only.
- Only commit work that fully completes one or more checked backlog tasks.
- Ensure the commit body reflects the actual implemented work rather than generic summaries.
- Use backlog task text as source material, but produce a human-readable commit body.
- Keep the commit and backlog cleanup synchronized.