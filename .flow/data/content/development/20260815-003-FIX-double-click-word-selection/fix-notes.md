---
id: development/20260815-003-FIX-double-click-word-selection/fix-notes
type: note
graph: development/20260815-003-FIX-double-click-word-selection
title: Root cause and validation for double-click word selection
tags:
    - bugfix
    - editor
    - frontend
links:
    - node: development/20260815-003-FIX-double-click-word-selection/fix-double-click-word-selection
      context: Fix task
      relationships:
        - maps-to
---

## Root Cause

Double-clicking a word in the editor did not select the word. Reproduced in a
headless Chromium against the built app: a pure double-click left the DOM
selection empty, and a click-then-double-click (three clicks) selected the
whole paragraph.

Isolation experiments showed the browser's native word selection works in a
plain contenteditable and even on a clone of the editor's own `.ProseMirror`
element, but not on the live element. The live ProseMirror view resets the
browser's native word selection: its `selectionchange` handler (`DOMObserver`)
flushes and re-syncs the DOM selection, orphaning the browser's native word
selection. When three clicks register, ProseMirror's `defaultTripleClick`
additionally selects the whole containing text block.

## Fix

`frontend/src/components/editor/double-click-word-selection.ts` — new
`defineDoubleClickWordSelection()` extension using prosekit's
`defineDoubleClickHandler` (`handleDoubleClick` editor prop). On a left-button
double-click inside a text block it resolves the click position, computes the
word boundaries around it (Unicode-aware; internal apostrophes/hyphens count
as part of the word; trailing punctuation excluded), and dispatches a
`TextSelection` over that word, returning `true` to prevent the default
handling. Non-text positions (document boundary, node selections) return
`false` so default behavior (e.g. node selection) is preserved. Triple-click
keeps selecting the whole paragraph, matching common editor behavior.

Wired into `defineEditorExtension` in `define-editor-extension.ts`.

## Validation

- New unit tests (`double-click-word-selection.test.ts`): `wordRangeAt`
  boundary cases + mounted-editor handler tests (word mid/start/end of
  paragraph, inside a list item, non-text positions).
- `define-editor-extension.test.ts` updated for the new extension.
- Full frontend suite: 230/230 pass (was 217). `tsc --noEmit` clean.
- Headless-browser verification against the rebuilt app: double-click on
  "sentence"/"several"/"selection" selects exactly that word; home document
  words ("Backlog", "Improvements") select correctly; selection persists.
  Triple-click still selects the whole paragraph.
