---
id: development/20260824-001-FIX-toc-heading-rendering/root-cause
type: note
graph: development/20260824-001-FIX-toc-heading-rendering
title: TOC heading rendering fix
description: 'Fix run — status: Resolved; validated by frontend vitest + tsc'
tags:
    - fix
    - toc
---

Issue: table of contents entries sometimes show raw markup (HTML tags, emphasis markers, inline reference brackets) and indentation is wrong for documents whose headings do not start at h1 or skip levels.

Root cause 1: generateTOC (frontend/src/lib/docUtils.ts) captures the raw heading line text and the TOC component renders it verbatim, so any inline markdown/HTML in headings appears literally.

Root cause 2: TableOfContents indents by absolute heading level ((level - 1) * 1rem), so documents starting at h2/h3 are uniformly over-indented and level jumps (h1 -> h3) create disproportionate gaps.

Fix decision: strip inline markup to plain display text while keeping ids computed from raw text (must keep matching markdown-it-anchor slugs); compute relative nesting depth via an ancestor-level stack instead of absolute level.