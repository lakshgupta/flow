---
id: development/20260805-001-REFACTOR-wails-v2-13-update/commit-notes
type: note
graph: development/20260805-001-REFACTOR-wails-v2-13-update
title: Commit mapping for Wails v2.13.0 update
tags:
    - commit
    - refactor
links:
    - node: development/20260805-001-REFACTOR-wails-v2-13-update/update-wails
      context: Task implemented by this commit
      relationships:
        - maps-to
---

## Commit Scope

Upgrade `github.com/wailsapp/wails/v2` from `v2.12.0` to `v2.13.0` for the desktop build. `v2.13.0` ships only fixes and documentation; the Wails v2 API is unchanged, so `internal/desktop/runner_wails.go` requires no edits.

## Changes Included

- `go.mod` / `go.sum`: wails `v2.12.0` → `v2.13.0`, plus `go mod tidy` transitive bumps (`golang.org/x/crypto`, `golang.org/x/net`, `golang.org/x/sys`). Wails moves into the direct `require` block.
- `.flow/data/content/development/20260802-002-FEAT-graph-path-traversal/{graph-path,commit-notes}.md`: reworded the literal inline-reference token (double-bracket `references`) in body prose to "inline reference targets", since the validator parses any double-bracket token as a workspace reference and it blocked record creation.

## Validation Status

- ✅ `go build ./...` clean
- ✅ `go build -tags wails ./internal/desktop/` clean
- ✅ `go vet ./internal/desktop/` clean
- ✅ `go test ./...` full suite passes
- ✅ `flow create` record-keeping validation passes

## Flow Task Mapping

- development/20260805-001-REFACTOR-wails-v2-13-update/update-wails.md -> Done

## Excluded from Commit

Unrelated working-tree changes left uncommitted: `.flow/config/flow.yaml`, `.flow/data/home.md`, assorted modified `.flow/data/content/*` record files from earlier tasks, `frontend/package.json`/`package-lock.json`, `internal/buildinfo/VERSION`, the `flow` binary, and the excalidraw screenshots.

