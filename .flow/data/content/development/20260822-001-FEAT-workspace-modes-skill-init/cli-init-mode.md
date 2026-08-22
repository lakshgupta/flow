---
id: development/20260822-001-FEAT-workspace-modes-skill-init/cli-init-mode
type: task
graph: development/20260822-001-FEAT-workspace-modes-skill-init
title: Wire --mode into flow skill init
description: 'Wire --mode into flow skill init (Done 2026-08-22; evidence: go test ./... green, go build OK). --mode composes the flow skill via SkillMarkdownForMode (default dev, canonical); unknown mode errors with available list; help text updated. Root-cause fix in core.ParseModeRequest: global surface-mode parsing stops at the first positional arg so subcommands can own their own --mode flag (approved UX: flow skill init --mode dev).'
tags:
    - implementation
    - cli
status: Done
links:
    - node: development/20260822-001-FEAT-workspace-modes-skill-init/extend-skillcontent
      context: Init flag writes composed output from skillcontent functions
      relationships:
        - depends-on
---

