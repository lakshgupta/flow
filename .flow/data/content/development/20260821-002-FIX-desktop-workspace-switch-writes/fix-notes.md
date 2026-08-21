---
id: development/20260821-002-FIX-desktop-workspace-switch-writes/fix-notes
type: note
graph: development/20260821-002-FIX-desktop-workspace-switch-writes
title: Desktop writes must follow in-place workspace switch
description: Root cause and fix for Wails-bound mutations targeting the launch-time workspace
tags:
    - fix
    - desktop
---

## Reported Issue

With `flow -g desktop` (global mode), the app allows switching the workspace in-place from the sidebar dropdown. After switching, edits still failed to appear in the newly selected workspace's markdown.

## Root Cause

In desktop mode the Wails-bound `Backend` captured `workspace.Root` once at construction. The HTTP `apiHandler` swaps its root on `/api/workspace/select` (and on local-workspace deregistration falling back to global), so HTTP reads served the new workspace — but every Wails-bound **write** (`UpdateDocument`, `UpdateHome`, `CreateDocument`, uploads, …) kept targeting the launch-time root. Edits went to the original workspace even though the UI showed the switched one.

## Fix

- `internal/desktop/backend.go`: `Backend.root` is now a shared `*atomic.Value` holding `workspace.Root`, with `SetRoot` and a `resolvedRoot()` accessor. Because every `Backend` copy (including the one inside the `App` facade bound to Wails) shares the same store, a switch is visible to all bindings.
- `internal/httpapi/server.go`: `Options` gains `OnRootChanged func(root workspace.Root)`, invoked after the root is swapped in `handleSelectWorkspace` and `handleDeregisterLocalWorkspace`.
- `internal/desktop/runner_wails.go`: wires `OnRootChanged` to `app.backend.SetRoot(root)` so the desktop bindings follow the in-place switch.

## Validation

- New backend test `TestBackendSetRootRedirectsWritesToNewWorkspace`: document creation and home updates follow `SetRoot` in both directions (first → second → first workspace).
- New httpapi test `TestNewMuxOnRootChangedFiresOnWorkspaceSwitch`: the hook fires with the selected local root and again on global fallback.
- `go test ./...` — all packages pass; `go vet -tags wails ./internal/desktop/` — clean.
- Rebuilt `~/.local/bin/flow` with `wails production webkit2_41` tags and relaunched the desktop app (now on the repo workspace).