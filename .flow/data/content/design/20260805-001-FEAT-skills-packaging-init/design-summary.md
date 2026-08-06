---
id: design/20260805-001-FEAT-skills-packaging-init/design-summary
type: note
graph: design/20260805-001-FEAT-skills-packaging-init
title: 'Design: single skills source embedded in the flow binary'
tags:
    - design
    - skills
    - packaging
    - cli
links:
    - node: design/20260805-001-FEAT-skills-packaging-init/design-task
      context: Design proposed and approved; task tracks design run
      relationships:
        - related
---

# Design: single canonical skills source embedded in the flow binary

## Problem

Skills are split across `.agents/skills/` (9 workflow skills) and `packaging/SKILL.md` (record-keeping protocol). Only two skills are embedded (`record-keeping`, `graph-engineering`) via two separate `//go:embed` directives in `skillcontent.go`. An installed `flow` binary cannot distribute the full skill set to an agent, so a new user must manually copy skill files.

## Decisions (approved by user)

- Canonical location: **`packaging/skills/`** — single source of truth for all Flow skills, embedded at build time, and the source for `flow skill init`.
- Init target: **global + project** — `flow skill init` writes to the global agent skills dir (`~/.agents/skills/`) by default; `--project` writes to the current workspace's `.agents/skills/` instead.

## Proposed Structure

```
packaging/skills/
  flow/SKILL.md               record-keeping protocol (moved from packaging/SKILL.md)
  design/SKILL.md
  plan/SKILL.md
  implement/SKILL.md
  fix/SKILL.md
  refactor/SKILL.md
  test/SKILL.md
  review/SKILL.md
  commit/SKILL.md
  graph-engineering/SKILL.md
```

`skillcontent.go` switches from two string embeds to one `embed.FS`:
- `SkillMarkdownByName(name)` keeps `flow skill content --skill <name>` working
- `SkillNames()` lists all embedded skills
- new `flow skill list` subcommand enumerates embedded skills

New CLI:
- `flow skill init [--project] [--force]` — writes embedded skills to global `~/.agents/skills/` (default) or the workspace's `.agents/skills/` (`--project`); skips existing files unless `--force`.

## Status

Approved — docs/architecture.md updated (Development Workflow & Agent Skills section now documents `packaging/skills/`, the single embed, and `flow skill init`/`list`). Home backlog item "Install skills.md automatically in ~/.agents/skills/" is delivered by the init command.

