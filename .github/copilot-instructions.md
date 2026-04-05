# Project Guidelines

## Default Workflow

- When the user does not explicitly choose a prompt, infer the correct stage of work and follow this project workflow: design, plan, implement or fix or refactor, review, then commit.
- Treat the `lg-*` prompt files in [.github/prompts](prompts) as the source of truth for stage-specific behavior even when the user does not invoke them explicitly.
- Reuse the matching prompt workflow by default rather than reinterpreting the process from scratch.

## Prompt Routing

- New feature design or behavior change: follow [lg-design.prompt.md](prompts/lg-design.prompt.md)
- Feature planning and backlog creation: follow [lg-plan.prompt.md](prompts/lg-plan.prompt.md)
- Feature implementation from backlog: follow [lg-implement.prompt.md](prompts/lg-implement.prompt.md)
- Issue fixing: follow [lg-fix.prompt.md](prompts/lg-fix.prompt.md)
- Behavior-preserving structural cleanup: follow [lg-refactor.prompt.md](prompts/lg-refactor.prompt.md)
- Code review: follow [lg-review.prompt.md](prompts/lg-review.prompt.md)
- Commit creation and backlog cleanup: follow [lg-commit.prompt.md](prompts/lg-commit.prompt.md)

## Persistent Rules

- Keep [docs/architecture.md](../docs/architecture.md) as the approved design source for feature work.
- For UI design work, refer to the UI Design Guidelines in [docs/architecture.md](../docs/architecture.md).
- Keep [docs/backlog.md](../docs/backlog.md) as the execution source of truth for planned feature work.
- Use backlog feature IDs in the format `FEAT-YYYYMMDD-dddd`.
- Run relevant validation after code changes whenever feasible.
- Keep changes focused and prefer root-cause fixes over superficial patches.

## Stage Selection

- When the correct stage is unclear, ask the minimum question needed to determine whether the task is design, planning, implementation, fix, refactor, review, or commit work.
- If the user skips the stage name but the intent is clear, apply the corresponding `lg-*` prompt workflow automatically.

