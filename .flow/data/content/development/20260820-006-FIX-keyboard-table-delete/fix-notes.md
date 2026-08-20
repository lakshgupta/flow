---
id: development/20260820-006-FIX-keyboard-table-delete/fix-notes
type: note
graph: development/20260820-006-FIX-keyboard-table-delete
title: Root cause and validation for keyboard table deletion
description: 'Delete/Backspace had no way to remove a table; added a table-delete keymap covering table-start, table-end, and whole-table cell selection (commit: TBD)'
tags:
    - bugfix
    - frontend
    - editor
links:
    - node: development/20260820-006-FIX-keyboard-table-delete/fix-keyboard-table-delete
      context: Fix task
      relationships:
        - maps-to
---

## Root Cause

There was **no way to delete a table** from the keyboard, and the only button
was effectively undiscoverable:

1. **Keyboard Delete/Backspace only cleared cell content.** ProseMirror's
   tables plugin binds `Backspace`/`Delete` to `deleteCellSelection`, which
   empties the selected cells but never removes the table node. At the start
   of the first cell, Backspace did nothing at all (the caret cannot join out
   of the isolating table). Verified headless: Backspace at the start of the
   first cell left the table count at 1, and Mod-A-style whole-table selections
   only cleared the cells.
2. **The "Delete Table" button was hidden in the hover handle.** The
   table-handle popover (row/column handle) contains a working "Delete Table"
   item, but it only appears on hover over the tiny table handle — the user
   could not find it, and it is not reachable from the keyboard.

## Fix

Added `frontend/src/components/editor/table-delete-keymap.ts`, registered last
in `defineEditorExtension` so it has the highest keymap priority (later
keymaps run first in prosekit's keymap facet, and the keymap plugin's
`handleKeyDown` runs before the tables plugin's `handleKeyDown` — verified via
plugin-order inspection). Three paths now delete the whole table:

1. **Backspace at the start of the first cell** — caret at offset 0 of the
   first paragraph of the first cell of the first row: delete the table
   (mirrors Obsidian/Typora behavior).
2. **Delete at the end of the last cell** — caret at the end of the last
   paragraph of the last cell of the last row: delete the table (symmetric).
3. **Backspace/Delete with a whole-table `CellSelection`** — selection
   covering every cell (via handles or drag): `deleteTable` instead of the
   default cell-clearing `deleteCellSelection`. Partial cell selections are
   left alone (they still clear the selected cells only).

Boundary checks (`parentOffset`, first/last cell/row via `$head.index(depth)`
semantics) make the keymap decline every other case — mid-cell Backspace still
deletes a character, and non-boundary cells keep their native behavior.

## Validation

- **Unit tests** (`table-delete-keymap.test.ts`, 20 tests): table start/end
  deletion (including empty first cell, table as the only block, and the
  two-table case), whole-table `CellSelection` deletion, partial-selection
  passthrough, non-table documents, and composite `Backspace`/`Delete`
  handlers.
- **Real-editor integration tests** (`table-delete-integration.test.tsx`, 6
  tests): mount the actual `defineEditorExtension()` via `createEditor`, set
  real ProseMirror selections, and dispatch real `KeyboardEvent('keydown')`
  through `view.someProp('handleKeyDown')` — the full keymap + plugin ordering
  chain. Backspace@start, Delete@end, and whole-table `CellSelection` all
  delete the table; mid-cell and non-first-cell Backspaces leave it intact.
- **Headless Chromium end-to-end** against the built binary:
  - Backspace at start of first cell → table 1 → 0 (persists)
  - Delete at end of last cell → table 1 → 0
  - Backspace mid-cell → only a character deleted, table survives
  - Backspace at start of a non-first cell → nothing, table survives
- Full frontend suite: **264/264 pass**; `tsc --noEmit` clean; graph validate
  clean.
