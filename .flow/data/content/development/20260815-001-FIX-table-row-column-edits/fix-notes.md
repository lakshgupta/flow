---
id: development/20260815-001-FIX-table-row-column-edits/fix-notes
type: note
graph: development/20260815-001-FIX-table-row-column-edits
title: Root cause and fix notes
tags:
    - fix
    - root-cause
    - editor
    - table
links:
    - node: development/20260815-001-FIX-table-row-column-edits/fix-table-row-column-edits
      context: Root cause and validation for the table row/column edit fix
      relationships:
        - relates-to
---

## Issue

"Unable to add/delete a column or a row in a table" (home.md Fix item).

## Root Causes

1. **No UI mounted for row/column editing.** The `TableHandle` component
   (`frontend/src/components/editor/ui/table-handle/`) existed but was never
   mounted in `RichTextEditor`, so there was no way to add or delete rows or
   columns from a table. The fix wires `<TableHandle />` into the editor
   (alongside `BlockHandle`).

2. **Slash-menu tables had no header row.** `/table` called
   `insertTable({ row: 3, col: 3 })` with the prosekit default `header: false`,
   creating tables whose first row is all `<td>`. turndown-plugin-gfm only
   serializes tables whose first row is all `<th>` ("Tables with no heading
   row are kept"), so such tables saved as raw `<table>` HTML instead of GFM
   markdown — degrading documents (visible in the mangled tables in
   `manual/gui.md` / `manual/tasks.md`). Fix: `header: true`.

3. **Delete Row/Column silently no-op at 1x1.** prosemirror-tables
   `deleteRow`/`deleteColumn` return `true` from `can` whenever the caret is
   in a table, even when deleting the last row/column; the dispatch version
   then returns `false` and does nothing. The handle showed the items enabled
   but clicking did nothing. Fix: the handle state derives the table shape
   (`TableMap` height/width) from the selection and reports
   `deleteTableRow`/`deleteTableColumn` as not executable at 1 row / 1 column.

## Fix

- `frontend/src/components/editor/ui/table-handle/table-handle.tsx`: compute
  table shape from the selection and gate delete row/column `canExec`.
- `frontend/src/components/editor/ui/slash-menu/slash-menu.tsx`: pass
  `header: true` to `insertTable`.
- `frontend/src/components/editor/RichTextEditor.tsx`: mount `<TableHandle />`
  (working-tree change kept as the enabler for row/column editing).
- New unit tests in `table-handle.test.tsx` (delete gating at 1x1, header
  table GFM round-trip).

## Validation

- `npx vitest run` for the new test file: 4/4 pass.
- Full frontend suite (`npm test`): 217/217 pass.
- `npx tsc --noEmit`: clean.
- Real-app browser verification (built binary + service):
  - `/table` now creates a 3x3 table with a header row (`th` cells) and saves
    as GFM markdown (`|  |  |  |` + separator), not raw HTML.
  - Deleting rows down to 1 row hides the Delete Row menu item (visible menu:
    Insert Above, Insert Below, Clear Contents, Delete Table).
  - Live add/delete of rows/columns via the handle works and persists.

## Residual Risk

- Existing headerless tables in documents already saved as raw HTML are not
  migrated; they still render and edit correctly but keep HTML serialization.
- Desktop (Wails/WebKitGTK) was not exercised here; the web service path was
  verified end to end.
