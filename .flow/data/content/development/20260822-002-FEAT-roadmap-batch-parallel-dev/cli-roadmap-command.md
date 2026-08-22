---
id: development/20260822-002-FEAT-roadmap-batch-parallel-dev/cli-roadmap-command
type: task
graph: development/20260822-002-FEAT-roadmap-batch-parallel-dev
title: Add flow roadmap CLI command
description: 'Add flow roadmap CLI command (Done 2026-08-22; evidence: cmd/flow/roadmap.go + TestFlowRoadmap* suite). Flags: --graph slug filter, --next execution packet, --claim mutation with Running+session stamp, --session token (hostname-derived default), --stale-hours, --json.'
tags:
    - implementation
    - cli
status: Done
links:
    - node: development/20260822-002-FEAT-roadmap-batch-parallel-dev/build-roadmap-view
      context: CLI renders the roadmap view
      relationships:
        - depends-on
    - node: development/20260822-002-FEAT-roadmap-batch-parallel-dev/implement-claim-lifecycle
      context: CLI --claim invokes the claim lifecycle
      relationships:
        - depends-on
---

