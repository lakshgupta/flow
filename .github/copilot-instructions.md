# Project Guidelines

## Default Workflow

- When the user does not explicitly choose a prompt, infer the correct stage of work and follow this project workflow: design, plan, implement or fix or refactor, test, review, then commit.
- Treat the `lg-*` prompt files in [.github/prompts](prompts) as the source of truth for stage-specific behavior even when the user does not invoke them explicitly.
- Reuse the matching prompt workflow by default rather than reinterpreting the process from scratch.
- For record-keeping behavior, follow [.github/SKILL.md](.github/SKILL.md) as the authoritative protocol when prompt wording differs.

## Prompt Routing

- New feature design or behavior change: follow [lg-design.prompt.md](prompts/lg-design.prompt.md)
- Feature planning and Flow task-node creation: follow [lg-plan.prompt.md](prompts/lg-plan.prompt.md)
- Feature implementation from Flow task nodes: follow [lg-implement.prompt.md](prompts/lg-implement.prompt.md)
- Issue fixing: follow [lg-fix.prompt.md](prompts/lg-fix.prompt.md)
- Behavior-preserving structural cleanup: follow [lg-refactor.prompt.md](prompts/lg-refactor.prompt.md)
- Validation and test execution: follow [lg-test.prompt.md](prompts/lg-test.prompt.md)
- Code review: follow [lg-review.prompt.md](prompts/lg-review.prompt.md)
- Commit creation and Flow record sync: follow [lg-commit.prompt.md](prompts/lg-commit.prompt.md)

## Flow Record Keeping

- Follow the [Flow skill](.github/SKILL.md) for all record keeping: use Flow graph task/note nodes as the system of record for every phase of work.
- Store graph records under `.flow/data/content`.
- Design records must use `design/YYYYMMDD-NNN-<type>-<title>`.
- Planning and implementation records must use `development/YYYYMMDD-NNN-<type>-<title>`.
- Sub-graph naming pattern is mandatory: `YYYYMMDD-NNN-<type>-<title>` (for example `20260501-001-FEAT-parser-retry-budget`).
- `NNN` is the zero-padded incremental count of directories created on that date.
- For design updates, filter candidate nodes by title/description/tags first, then inspect body content.
- Define and maintain task dependencies with explicit `depends-on` links.
- Refer to [.github/SKILL.md](.github/SKILL.md) for the full CLI workflow and mandatory protocol.

## Persistent Rules

- Keep [docs/architecture.md](../docs/architecture.md) as the approved design source for feature work, including the arrangement and structure of UI components.
- For UI look and feel, refer to [DESIGN.md](../DESIGN.md) for visual language, component styling, and design guidelines.
- Keep Flow `design/YYYYMMDD-NNN-<type>-<title>` and `development/YYYYMMDD-NNN-<type>-<title>` sub-graphs and task/note nodes as the execution source of truth for planned feature work.
- Run relevant validation after code changes whenever feasible.
- Keep changes focused and prefer root-cause fixes over superficial patches.

## Stage Selection

- When the correct stage is unclear, ask the minimum question needed to determine whether the task is design, planning, implementation, fix, refactor, review, or commit work.
- If the user skips the stage name but the intent is clear, apply the corresponding `lg-*` prompt workflow automatically.

