---
id: development/20260822-001-FEAT-workspace-modes-skill-init/init-writes-agents-guide
type: task
graph: development/20260822-001-FEAT-workspace-modes-skill-init
title: flow skill init --local writes managed AGENTS.md section
description: 'flow skill init --local writes managed AGENTS.md section (Done 2026-08-22; evidence: cmd/flow/agents_guide_test.go — create/append-non-clobber/idempotent/mode-switch + interactive rewrite/append/print/exit/re-prompt/EOF paths; full suite green). Marker-managed block (flow:agents:start/end) replaced on re-init; existing non-Flow content triggers a 4-option prompt when stdin is a terminal, silent append when not. This repo''s AGENTS.md rewritten as the canonical dev-mode example (roadmap stage, modes, --local, jira sync).'
tags:
    - cli
status: Done
---

