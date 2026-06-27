---
title: Optimize home page transition performance
type: task
status: Done
tags:
  - performance
  - frontend
  - navigation
links:
  - "20260627-004-FIX-home-transition-perf"
---

The home page transition was slow due to two bottlenecks:
1. `handleSelectHome` awaited `flushPendingActiveEditorSave()` which blocked on requestAnimationFrame delays and network saves
2. `MiddleContent` unmounted the graph canvas and mounted HomeSurface (with ProseKit editor) on every navigation, recreating the expensive editor each time

## Changes

**App.tsx:**
- Removed `await flushPendingActiveEditorSave()` from `handleSelectHome` and `handleSelectGraph`
- Sync editor state synchronously via `syncDocumentBodyFromActiveEditor()` and `syncHomeBodyFromEditor()`
- Cancel auto-save timers to prevent stale saves
- Move all state updates inside `startTransition` for single non-urgent render
- Fire pending saves in background without blocking navigation

**MiddleContent.tsx:**
- Keep `HomeSurface` always mounted in DOM (hidden via `display: none` when inactive)
- Graph canvas still mounts/unmounts conditionally (ReactFlow doesn't stay in background)
- ProseKit editor created once, reused on every home visit

**App.test.tsx:**
- Updated test assertion to check HomeSurface is hidden (not absent) when graph canvas is active

## Validation
- `npm run build` passes
- `npm test` passes (114/114 tests including previously flaky one)
