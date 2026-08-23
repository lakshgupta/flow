---
id: development/20260822-005-FEAT-presentation-mode/keybinding-toolbar-wiring
type: task
graph: development/20260822-005-FEAT-presentation-mode
title: Wire p/Escape/arrows into canvas and add toolbar entry
description: 'Wire p/Escape/arrows into canvas and add toolbar entry (Done 2026-08-22; evidence: tsc clean, npm test 38 files/308 tests green). MiddleContent mounts the hook + overlay: p enters on graph surface with non-input focus, Escape exits and re-selects the last-presented node via handleNodeClick, Enter opens via handleNodeDoubleClick, Play button added to graph-canvas-toolbar via optional presentationEnter prop.'
tags:
    - frontend
status: Done
links:
    - node: development/20260822-005-FEAT-presentation-mode/hook-and-overlay
      context: Wiring mounts the hook-driven overlay
      relationships:
        - depends-on
---

