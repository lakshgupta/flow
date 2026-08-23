---
id: development/20260822-006-FEAT-pdf-export/plan
type: note
graph: development/20260822-006-FEAT-pdf-export
title: 'Plan: Node, graph, and selection PDF export'
description: 'Plan — status: Completed (all tasks Done 2026-08-22)'
tags:
    - planning
    - export
links:
    - node: design/20260822-006-FEAT-pdf-export/design
      context: Plan implements the approved PDF export design
      relationships:
        - relates-to
---

# Plan: Node, graph, and selection PDF export

## Approach And Sequencing

v1 (node + selection via content tree / canvas multi-select) ships first using a frontend-only print-iframe; v2 graph-as-book (backend streaming PDF with cover/TOC/appendix) is deferred but the ordering contract (topmost-first links, mention-order references) is shared with presentation mode.

1. `exportPdf` lib — `frontend/src/lib/exportPdf.ts` with `printNodesAsPdf(nodeIds, title, bodies)` building a hidden `about:blank` iframe, writing a minimal HTML shell with `@media print` rules reusing presentation/thread typography, injecting each node's body via `markdownToHTML` (or `run` for command nodes), sanitizing the filename from the node/graph title, then calling `print()`. Vitest for HTML builder.
2. Content-tree wiring — right-click context menu on node rows and graph headers offers `Export as PDF`; for graphs defers to the v2 book flow but shares the same lib for now.
3. Canvas wiring — node card `…` menu and multi-selection context menu (Cmd/Ctrl+click) offer `Export as PDF` / `Export selection as PDF`, collecting selected ids in canvas order.
4. End-to-end validation — `npm test`, `npm run build`, `go build ./cmd/flow`, and manual print-preview parity check on Chrome/Firefox.

## Task Graph

- export-pdf-lib → integrate-content-tree-export, integrate-canvas-selection-export → test-export