---
id: development/20260511-002-FIX-home-backlog-refresh/backlog-plan
type: note
graph: development/20260511-002-FIX-home-backlog-refresh
title: Home backlog refresh plan
description: Task plan and dependency order for the five current home.md backlog entries
tags:
    - planning
    - frontend
---

This plan covers the five unchecked backlog entries currently listed in .flow/data/home.md.

Tasks are sequenced to land visual graph fixes first, then diagram insertion and interaction fixes, then a broader shell polish pass, with a final regression task after all implementation commits. Each implementation task is expected to ship in its own commit, and the matching backlog line should be removed from .flow/data/home.md in that same commit.