import { defineKeymap, type PlainExtension } from 'prosekit/core'
import { CellSelection, TableMap, deleteTable, findTable } from 'prosemirror-tables'
import type { Command } from 'prosekit/pm/state'

type TableRole = 'table' | 'row' | 'cell' | 'header_cell'

function isCellRole(role: unknown): role is 'cell' | 'header_cell' {
  return role === 'cell' || role === 'header_cell'
}

// Depth of the table node and of the cell (or header cell) containing the
// caret, or null when the caret is not inside a table.
function findTableDepths(state: Parameters<Command>[0]): { tableDepth: number; cellDepth: number } | null {
  const { $head } = state.selection
  let tableDepth = -1
  let cellDepth = -1
  for (let depth = $head.depth; depth >= 0; depth--) {
    const role = $head.node(depth).type.spec.tableRole as TableRole | undefined
    if (role === 'table') {
      tableDepth = depth
    } else if (isCellRole(role)) {
      cellDepth = depth
    }
  }
  if (tableDepth < 0 || cellDepth < 0) {
    return null
  }
  return { tableDepth, cellDepth }
}

// True when the selection is a CellSelection that covers every cell of its
// table (Mod-A inside a table produces this). Deleting should then remove the
// whole table rather than just clearing the selected cells.
function isWholeTableSelection(state: Parameters<Command>[0]): boolean {
  const selection = state.selection
  if (!(selection instanceof CellSelection)) {
    return false
  }
  const table = selection.$anchorCell.node(-1)
  const map = TableMap.get(table)
  const tableStart = selection.$anchorCell.start(-1)
  const rect = map.rectBetween(
    selection.$anchorCell.pos - tableStart,
    selection.$headCell.pos - tableStart,
  )
  return rect.left === 0 && rect.top === 0 && rect.right === map.width && rect.bottom === map.height
}

// Backspace at the very start of the first cell of a table: delete the whole
// table (the caret cannot move out above it, so Backspace would otherwise do
// nothing). Mirrors the behavior of Backspace at the start of other block
// nodes.
const handleBackspaceAtTableStart: Command = (state, dispatch) => {
  if (!state.selection.empty) {
    return false
  }

  const { $head } = state.selection
  const parent = $head.parent
  if (!parent.isTextblock || $head.parentOffset !== 0) {
    return false
  }

  const depths = findTableDepths(state)
  if (depths === null) {
    return false
  }
  const { tableDepth, cellDepth } = depths

  // The caret must be in the first cell of the first row of the table.
  if ($head.index(cellDepth) !== 0) {
    return false
  }
  const rowDepth = cellDepth - 1
  if ($head.index(rowDepth) !== 0) {
    return false
  }
  if ($head.index(tableDepth) !== 0) {
    return false
  }

  if (dispatch) {
    const tableStart = $head.before(tableDepth)
    const tableEnd = $head.after(tableDepth)
    dispatch(state.tr.delete(tableStart, tableEnd).scrollIntoView())
  }
  return true
}

// Delete (forward) at the very end of the last cell of a table: delete the
// whole table, symmetric to handleBackspaceAtTableStart.
const handleDeleteAtTableEnd: Command = (state, dispatch) => {
  if (!state.selection.empty) {
    return false
  }

  const { $head } = state.selection
  const parent = $head.parent
  if (!parent.isTextblock || $head.parentOffset !== parent.content.size) {
    return false
  }

  const depths = findTableDepths(state)
  if (depths === null) {
    return false
  }
  const { tableDepth, cellDepth } = depths

  // The caret must be in the last cell of the last row of the table.
  if ($head.indexAfter(cellDepth) !== $head.node(cellDepth).childCount) {
    return false
  }
  const rowDepth = cellDepth - 1
  if ($head.indexAfter(rowDepth) !== $head.node(rowDepth).childCount) {
    return false
  }
  if ($head.indexAfter(tableDepth) !== $head.node(tableDepth).childCount) {
    return false
  }

  if (dispatch) {
    const tableStart = $head.before(tableDepth)
    const tableEnd = $head.after(tableDepth)
    dispatch(state.tr.delete(tableStart, tableEnd).scrollIntoView())
  }
  return true
}

// Backspace/Delete with the whole table selected: remove the table. Without
// this, prosemirror-tables' deleteCellSelection would only clear the cell
// contents.
const handleDeleteWholeTableSelection: Command = (state, dispatch) => {
  if (!isWholeTableSelection(state)) {
    return false
  }
  return deleteTable(state, dispatch)
}

// Backspace/Delete in a table where the caret would leave the table (start of
// the first cell / end of the last cell) also delete the whole table.
const handleBackspace: Command = (state, dispatch) => {
  if (handleDeleteWholeTableSelection(state, dispatch)) {
    return true
  }
  return handleBackspaceAtTableStart(state, dispatch)
}

const handleDelete: Command = (state, dispatch) => {
  if (handleDeleteWholeTableSelection(state, dispatch)) {
    return true
  }
  return handleDeleteAtTableEnd(state, dispatch)
}

// True when the caret sits inside a table — used to keep the whole-table
// selection check cheap for the common non-table case.
function isInsideTableState(state: Parameters<Command>[0]): boolean {
  return findTable(state.selection.$head) !== undefined
}

export function defineTableDeleteKeymap(): PlainExtension {
  return defineKeymap({
    Backspace: handleBackspace,
    Delete: handleDelete,
  })
}

export {
  findTableDepths,
  isWholeTableSelection,
  isInsideTableState,
  handleBackspaceAtTableStart,
  handleDeleteAtTableEnd,
  handleDeleteWholeTableSelection,
  handleBackspace,
  handleDelete,
}
