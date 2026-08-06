---
id: development/20260805-001-REFACTOR-wails-v2-13-update/update-wails
type: task
graph: development/20260805-001-REFACTOR-wails-v2-13-update
title: Update Wails to v2.13.0
description: 'Upgrade github.com/wailsapp/wails/v2 from v2.12.0 to v2.13.0 and verify the desktop build (commit: c9cf1c2)'
tags:
    - refactor
    - deps
    - wails
status: Done
links:
    - node: development/20260805-001-REFACTOR-wails-v2-13-update/commit-notes
      context: Commit mapping and validation record
      relationships:
        - maps-to
---

# Update Wails to v2.13.0

## Description

Upgrade the desktop dependency `github.com/wailsapp/wails/v2` from `v2.12.0` to `v2.13.0`.

`v2.13.0` is a minor release: bug fixes and documentation only, no breaking API changes. The Wails options surface used by `internal/desktop/runner_wails.go` (`options.App`, `options.assetserver`, `options.linux`, `runtime.Quit`) is unchanged, so no code edits were required.

## Changes

- `go.mod`: bump `github.com/wailsapp/wails/v2` to `v2.13.0` (moves from indirect to direct require); transitive bumps for `golang.org/x/crypto`, `golang.org/x/net`, `golang.org/x/sys`, plus `go.sum` regeneration via `go mod tidy`.
- No source changes: `internal/desktop/runner_wails.go` and the `wails` build-tagged files compile unchanged.

## Verification

- `go build ./...` clean
- `go build -tags wails ./internal/desktop/` clean (desktop binary path compiles against v2.13.0)
- `go test ./...` full suite passes
- `go vet ./internal/desktop/` clean

## Status

Done

