---
id: development/20260802-002-FEAT-graph-path-traversal/commit-notes
type: note
graph: development/20260802-002-FEAT-graph-path-traversal
title: Commit mapping for graph path traversal
tags:
    - commit
    - feat
links:
    - node: development/20260802-002-FEAT-graph-path-traversal/graph-path
      context: Notes on graph path traversal
      relationships:
        - maps-to
---

## Commit Scope

This commit adds the `flow graph path` shortest-path traversal command together with the graph-engineering skill and its documentation. The skill is what makes the traversal command discoverable by agents, so the implementation, docs, and CLI integration tests ship together.

## Changes Included

- `internal/graph/path.go` (new): `FindShortestPath` runs a breadth-first search over the workspace graph built from declared frontmatter `links:` and resolved inline reference targets, skipping the home node. Default any-direction traversal; `--directed` follows edges only in their declared direction. Edge kinds (`link`/`reference`) are preserved through reverse traversal instead of degrading to `reverse`.
- `internal/graph/path_test.go` (new): 7 unit tests covering link chains, direct-edge preference, undirected reference traversal, same-node, no-connection, unknown-node errors, and home-node skipping.
- `cmd/flow/main.go`: new `graph` subcommand with the `path` handler (`--from`, `--to`, `--directed`, `--format json|markdown`), root help, and markdown/JSON rendering reusing the `deriveRole` convention; plus the `flow skill content --skill` flag for printing the embedded graph-engineering skill.
- `cmd/flow/main_test.go`: CLI integration tests for `graph path` (markdown output, JSON output, inline-reference traversal asserting `kind: reference`, unknown-node error) using a shared `writeGraphPathWorkspaceForTest` seeding helper.
- `docs/skill.md` (new): documents both the record-keeping and graph-engineering skills, how agents pick them up, and the research references behind the graph-engineering design.
- `.agents/skills/graph-engineering/SKILL.md` (new): the graph-engineering workflow (reconnaissance, design, edit, dependency-aware execution, commit gate) whose CLI toolkit includes `flow graph path`.
- `skillcontent.go` / `skillcontent_test.go`: embed the graph-engineering skill into the binary and add `SkillMarkdownByName`.
- `skills-lock.json`, `AGENTS.md`: register and route the graph-engineering skill.

## Validation Status

- ✅ `go build ./...` clean
- ✅ `go vet ./cmd/flow/ ./internal/graph/` clean
- ✅ `go test ./internal/graph/ ./cmd/flow/ .` — all packages pass (7 graph path unit tests, 4 CLI integration tests, skill content tests)
- ✅ Live end-to-end check of `flow graph path` against the real workspace (markdown and JSON output)
- ✅ Code reviewed

## Flow Task Mapping

- development/20260802-002-FEAT-graph-path-traversal/graph-path.md -> Done

## Excluded from Commit

Unrelated working-tree changes left uncommitted: `.flow/config/flow.yaml`, `.flow/data/home.md`, various `.flow/data/content/*` record-keeping edits from earlier tasks, `frontend/package.json` + `package-lock.json` and `internal/buildinfo/VERSION` version bumps, the `flow` binary, and the excalidraw screenshots.
