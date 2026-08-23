---
id: design/20260822-006-FEAT-pdf-export/design
type: note
graph: design/20260822-006-FEAT-pdf-export
title: Node, graph, and selection PDF export
description: 'Design — status: Approved'
tags:
    - design
    - export
    - pdf
---

# Design: Node, Graph, and Selection PDF Export

## Status

Approved (2026-08-22).

## Summary

Add **Export as PDF** for a single node (v1), **Export Graph as Book** (v2), and **Export Selection** for multi-selected nodes. Files are named by the title of the node or graph. Command nodes' `run` strings appear verbatim in an appendix. Entry points exist on the node card, in the editor, in the content tree, and for canvas multi-selections.

## Goals

1. **Node PDF (v1):** One click to a faithful PDF of the node's title, metadata badges, and rendered markdown body. File name is the sanitized node title (e.g., `Fix login timeout.pdf`). Triggered from the node card `…` menu, the central editor `…` menu, and the content-tree row context menu for that node.
2. **Selection PDF (v1, same mechanism):** When multiple nodes are selected on the canvas with `Cmd/Ctrl+click` (multi-select already supports this), an `Export selection as PDF` action appears on the selection's context menu and in the content-tree bulk-action bar. The PDF contains only the selected nodes, ordered by the same deterministic canvas order used for the book (topmost-first for links, mention order for references), with a one-line header noting the selection size. File name is the first selected node's title plus a suffix (e.g., `Fix login timeout + 2 more.pdf`), falling back to the graph title when the selection is heterogeneous.
3. **Graph Book PDF (v2):** Single PDF with cover (graph title + date), auto-generated TOC with page numbers, one chapter per node in deterministic canvas order, page breaks between chapters, tags index, and an **appendix** listing every command node's `run` string verbatim grouped by graph.

## Non-Goals

- Full page-size/orientation pickers or watermarks in v1 (browser print → Save as PDF already offers those).
- Editing the PDF after export; live sync.
- Exporting the canvas bitmap.

## User Experience

- **Node:** right-click or `…` on the node card, `…` in the editor header, or right-click the node's row in the content-tree → `Export as PDF` → system print dialog → save.
- **Selection:** `Cmd/Ctrl+click` to multi-select nodes on the canvas → right-click the selection → `Export selection as PDF` (also surfaced as a footer action when 2+ nodes are selected). Same flow; contents limited to the selection.
- **Graph (v2):** `…` on the graph header in the content tree → `Export graph as PDF (book)` → file picker → save as the graph title.

## Architecture

- **Frontend (v1, node + selection):** `frontend/src/lib/exportPdf.ts` with `printNodesAsPdf(nodeIds)` — opens a hidden `about:blank` iframe, writes a minimal HTML shell with `@media print` rules reusing `presentation-body` / `thread-panel-rendered-markdown` typography, injects each node's `body` via `markdownToHTML` (or `run` for command nodes when no body), then calls `iframe.contentWindow.print()`. Reused from the content-tree path which resolves node ids from the clicked row or the current selection set.
- **Backend (v2, graph book):** `GET /api/graphs/:graph/export.pdf?order=canvas` streams the book PDF (cover, TOC, chapters, tags index, command appendix). Renders via Markdown→HTML plus `chromedp` headless Chrome; streams with `Content-Disposition: attachment` using the graph title as the filename.

## Data and Interfaces

- No new persisted fields. Filenames are sanitized titles. Selection export is read-only and order-deterministic.

## Control Flow

- Node/selection: click Export → fetch each selected `DocumentResponse` body (cached if present) → build print iframe → `print()` → user saves.
- Graph book v2: click Export book → backend streams PDF → frontend triggers download.

## Edge Cases

- Mermaid/code blocks/images: print stylesheet `overflow: visible` and `break-inside: avoid`.
- Empty node or empty graph/selection: placeholder page.

## Testing Strategy

- Vitest for the export HTML builder; manual print preview on Chrome/Firefox; Playwright screenshot of the print iframe vs on-screen slide.

## Risks

- Browser print fidelity depends on user print settings — accepted for v1.

## Open Questions

None blocking. Appendix inclusion confirmed.