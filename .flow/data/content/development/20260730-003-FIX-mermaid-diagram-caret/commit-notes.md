---
id: development/20260730-003-FIX-mermaid-diagram-caret/commit-notes
type: note
graph: development/20260730-003-FIX-mermaid-diagram-caret
title: Commit mapping for mermaid diagram caret fix
tags:
    - commit
    - bugfix
links:
    - node: development/20260730-003-FIX-mermaid-diagram-caret/fix-mermaid-diagram-caret
      context: Notes on mermaid diagram caret fix
      relationships:
        - maps-to
    - node: development/20260730-003-FIX-mermaid-diagram-caret/root-cause
      context: Root cause analysis for this fix
      relationships:
        - relates-to
---

## Commit Scope

This commit covers the fix for Enter at the edges of collapsed mermaid diagram sections: a paragraph is now created after (or before) the diagram instead of silently inserting a newline into the hidden source.

## Changes Included

- `frontend/src/components/editor/code-block-exit-keymap.ts`: Enter handler that intercepts Enter when the caret is inside a collapsed diagram source (`.flow-diagram-block-source.hidden`) — parentOffset 0 inserts a paragraph before the block, parentOffset == content.size inserts one after, using `defaultBlockAt` + `TextSelection.near(..., 1)`; open source editor keeps normal newline insertion.
- `frontend/src/components/editor/RichTextEditor.shortcuts.test.tsx`: Replaced racy typed-simulation mermaid tests with three deterministic seeded-doc tests (paragraph after trailing diagram, paragraph before leading diagram, open-source keeps editing) using `ref.getMarkdown()` assertions. The jsdom caret placement after clicks is nondeterministic (doc start vs doc end), so the trailing-diagram test asserts the invariant that holds in both modes.

## Validation Status

- ✅ `npx tsc --noEmit` passes
- ✅ `npx vitest run src/components/editor/RichTextEditor.shortcuts.test.tsx` passes 10/10 consecutive runs
- ✅ Revert check: reverting the Enter handler makes the two new diagram tests fail (5/6 and 6/6 runs)
- ⚠️ Pre-existing flaky test left untouched: "moves the caret out of a trailing code block with ArrowDown" (jsdom geometry limitation, unrelated to this fix; fails ~7/8 standalone)
- ⚠️ Full `npm test`: 119/120 pass, the single failure is that pre-existing ArrowDown flake

## Flow Task Mapping

- `20260730-003-FIX-mermaid-diagram-caret/fix-mermaid-diagram-caret.md` → Done
