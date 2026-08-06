---
id: development/20260802-002-FEAT-graph-path-traversal/graph-path
type: task
graph: development/20260802-002-FEAT-graph-path-traversal
title: Implement flow graph path shortest-path traversal
description: 'Add flow graph path --from <id> --to <id> for shortest-path traversal between nodes (commit: 47fd493)'
tags:
    - feat
    - graph
    - cli
status: Done
---

Add `flow graph path --from <node-id> --to <node-id>` to find the shortest path between two nodes in the workspace graph.

Implementation (`internal/graph/path.go`):

- Build the graph from declared frontmatter `links:` and resolved inline reference targets, skipping the home node — the same edge model as the canvas.
- Run a breadth-first search so the result is always the shortest path; direct edges are naturally preferred.
- Default **any-direction** traversal so "what connects X to Y" works regardless of edge orientation; `--directed` follows edges only in their declared direction.
- Preserve the declared edge kind (`link`/`reference`) through reverse traversals instead of degrading to `reverse`.
- Return a typed `ShortestPathResult` (nodes with type/role/graph/title/status, edges with kind + context) that serializes cleanly to JSON.

CLI wiring (`cmd/flow/main.go`):

- New `flow graph <subcommand>` runner with `path` registered; `--from`, `--to`, `--directed`, and `--format <json|markdown>` flags.
- Markdown rendering reuses the `deriveRole` convention (`note -> context`, `task -> work`, `command -> decision`).
- Root help and subcommand help updated.

Tests:

- `internal/graph/path_test.go`: 7 unit tests (link chains, direct-edge preference, undirected reference traversal, same-node, no-connection, unknown-node, home-node skipping).
- `cmd/flow/main_test.go`: 4 CLI integration tests (markdown output, JSON output, inline-reference traversal asserting `kind: reference`, unknown-node error) sharing the `writeGraphPathWorkspaceForTest` seeding helper.

Docs & skill wiring:

- `docs/skill.md` and `.agents/skills/graph-engineering/SKILL.md` document the command for agent discovery (reconnaissance and traversal-for-discovery phases).
- `skillcontent.go`/`skillcontent_test.go` embed the graph-engineering skill and expose `flow skill content --skill graph-engineering`.

Validation: `go build ./...`, `go vet`, and `go test ./internal/graph/ ./cmd/flow/ .` all pass; live CLI check against the real workspace works in markdown and JSON.
