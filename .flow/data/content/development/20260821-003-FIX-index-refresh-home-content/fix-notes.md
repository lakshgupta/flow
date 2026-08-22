---
id: development/20260821-003-FIX-index-refresh-home-content/fix-notes
type: note
graph: development/20260821-003-FIX-index-refresh-home-content
title: Index refresh must also refresh the Home page content
description: Root cause and fix for the Home editor keeping stale content after an index rebuild
tags:
    - fix
    - home
    - index
---

## Reported Issue

Refreshing the index (Settings → Refresh index, or the sidebar action) did not refresh the Home page content shown in the editor.

## Root Cause

Home content flows from `graphTree.home` into `homeFormState` via an effect. The effect preserves the in-editor body whenever the Home editor is mounted with non-empty content differing from the server state — a guard that protects pending edits during incidental graphTree refreshes (e.g. document saves). An explicit index rebuild also reloads `graphTree`, so while the user is on the Home surface the guard discarded the freshly indexed home body and kept showing the stale in-editor content.

## Fix

- `frontend/src/App.tsx`: added `forceHomeReloadRef`. The home-sync effect consumes the flag and skips the preservation guard when set, taking the server content wholesale.
- `handleRebuildIndex` now: 1) flushes any pending in-editor home edits (`flushPendingHomeSave`) so unsaved work is persisted first, 2) POSTs `/api/index/rebuild`, 3) sets `forceHomeReloadRef` before `refreshShellViews` so the fresh home body is pushed into the editor.

## Validation

- New frontend test `rebuilds the index and refreshes the Home body in the editor`: rebuilds the index while the Home editor is mounted and asserts the refreshed body reaches the editor.
- Existing rebuild test still passes. `tsc --noEmit` clean; full frontend suite 294 passed (36 files).
- Rebuilt the frontend bundle and the desktop binary (`~/.local/bin/flow`, wails tags) and restarted the desktop app.