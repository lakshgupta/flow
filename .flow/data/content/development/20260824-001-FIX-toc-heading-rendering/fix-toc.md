---
id: development/20260824-001-FIX-toc-heading-rendering/fix-toc
type: task
graph: development/20260824-001-FIX-toc-heading-rendering
title: Fix TOC markup stripping and alignment
description: 'Strip inline markup from TOC entry text; normalize indent depth (commit: 7a3f00a)'
tags:
    - implementation
    - toc
status: Done
links:
    - node: development/20260824-001-FIX-toc-heading-rendering/root-cause
      context: Fix implements the root cause analysis recorded in the note
      relationships:
        - relates-to
---

Acceptance Criteria:
- generateTOC returns plain-text entries for headings containing HTML tags, emphasis markers, links, images, and inline reference tokens
- Heading ids stay computed from the raw heading text so anchor navigation keeps working
- TableOfContents indents by relative depth (h2-first documents start flush at level zero; level jumps do not over-indent)
- vitest suite passes including new docUtils tests

Evidence:
- npm test --run src/lib/docUtils.test.ts: 6/6 pass (new markup-stripping and raw-text-id tests)
- Full frontend vitest run: 313 passed; 1 pre-existing unrelated failure in RightRailViolationsPanel.test.tsx reproduced on clean tree via git stash
- npx tsc --noEmit: clean

Evidence Strategy: npm test in frontend with new unit tests for generateTOC markup stripping and TableOfContents depth normalization.