---
id: development/20260506-001-FEAT-mermaid-diagrams/review-mermaid
type: task
graph: development/20260506-001-FEAT-mermaid-diagrams
title: Review Mermaid integration
description: Check Mermaid integration risks and summarize the canonical authoring choice
tags:
    - review
    - frontend
status: Success
---

- Canonical authoring model: fenced code block with language mermaid.
- Slash-menu item is a convenience inserter, not a distinct storage format, and it inserts an empty mermaid block rather than starter content.
- Mermaid preview appears in readonly thread/node rendering, Home calendar excerpts, and the editor code-block node view.
- Mermaid rendering now pads the generated SVG viewBox and pixel max-width in the shared renderer while preserving Mermaid's percentage width, which fixes right-edge label clipping without distorting the diagram width semantics.