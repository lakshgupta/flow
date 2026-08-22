---
id: development/20260822-001-FEAT-workspace-modes-skill-init/init-and-global-offer-agents
type: task
graph: development/20260822-001-FEAT-workspace-modes-skill-init
title: Offer AGENTS.md setup from flow init and global skill init
description: 'Offer AGENTS.md setup from flow init and global skill init (Done 2026-08-22; evidence: cmd/flow/init_setup_test.go — interactive install/mode-choice/skip paths, global-init offer inside workspaces, silence outside; full suite green). flow init ends with an offer: install skill+guide (1), pick modes then install (2), or skip; global flow skill init offers the same setup when cwd has .flow or AGENTS.md, non-interactive runs print a --local hint and never write.'
status: Done
---

