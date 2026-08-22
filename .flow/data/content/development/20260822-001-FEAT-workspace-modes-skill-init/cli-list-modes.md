---
id: development/20260822-001-FEAT-workspace-modes-skill-init/cli-list-modes
type: task
graph: development/20260822-001-FEAT-workspace-modes-skill-init
title: Surface modes in flow skill list and help
description: 'Surface modes in flow skill list and help (Done 2026-08-22; evidence: go test ./... green). flow skill list prints ''modes: dev, note, pm''; skill content and init help text reference modes. Canonical content output unchanged.'
tags:
    - implementation
    - cli
status: Done
links:
    - node: development/20260822-001-FEAT-workspace-modes-skill-init/extend-skillcontent
      context: Mode listing reads SkillModes()
      relationships:
        - depends-on
---

