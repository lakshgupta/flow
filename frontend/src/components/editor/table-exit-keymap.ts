import { defaultBlockAt, defineKeymap, type PlainExtension } from 'prosekit/core'
import { TextSelection, type Command } from 'prosekit/pm/state'
import type { ResolvedPos } from 'prosekit/pm/model'

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

// True when the resolved position sits inside a table node.
function isInsideTable($pos: ResolvedPos): boolean {
  for (let depth = $pos.depth; depth >= 0; depth--) {
    if ($pos.node(depth).type.spec.tableRole === 'table') {
      return true
    }
  }
  return false
}

// Insert a fresh default block (paragraph) right after the table and put the
// caret at its start. Mirrors the code-block exit keymap: always allow
// creating the block, even when canReplaceWith fails at the end of a document.
function insertParagraphAfterTable(state: Parameters<Command>[0], dispatch: Parameters<Command>[1] | undefined, tableDepth: number): boolean {
  const { $head } = state.selection
  const grandParent = $head.node(tableDepth - 1)
  const insertIndex = $head.indexAfter(tableDepth - 1)
  const position = $head.after(tableDepth)

  const type = defaultBlockAt(grandParent.contentMatchAt(insertIndex))
  if (!type) {
    return false
  }

  if (dispatch) {
    const node = type.createAndFill()
    if (!node) {
      return false
    }

    const transaction = state.tr
    transaction.replaceWith(position, position, node)
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(position), 1))
    dispatch(transaction.scrollIntoView())
  }

  return true
}

// Insert a fresh default block (paragraph) right before the table and put the
// caret at its start.
function insertParagraphBeforeTable(state: Parameters<Command>[0], dispatch: Parameters<Command>[1] | undefined, tableDepth: number): boolean {
  const { $head } = state.selection
  const grandParent = $head.node(tableDepth - 1)
  const currentIndex = $head.index(tableDepth - 1)
  const position = $head.before(tableDepth)

  const type = defaultBlockAt(grandParent.contentMatchAt(currentIndex))
  if (!type) {
    return false
  }

  if (dispatch) {
    const node = type.createAndFill()
    if (!node) {
      return false
    }

    const transaction = state.tr
    transaction.replaceWith(position, position, node)
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(position), 1))
    dispatch(transaction.scrollIntoView())
  }

  return true
}

// ArrowDown at the end of the last cell of a trailing table: the table keymap
// tries to move the caret to the position right after the table, but at the
// end of the document that position cannot hold a text caret, so it snaps back
// into the cell and the user can never write below the table. When the caret
// cannot move out, insert a paragraph after the table and land in it.
export const handleArrowDown: Command = (state, dispatch) => {
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

  // The caret must be at the end of the cell's last paragraph, in the last
  // cell of the last row, so ArrowDown is trying to leave the table (not move
  // between cells or paragraphs).
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

  // If the position right after the table can already hold the caret, move
  // there instead of inserting a paragraph. The table keymap usually handles
  // this case before we run; this only covers non-textblock followers.
  const position = $head.after(tableDepth)
  const nearSelection = TextSelection.near(state.doc.resolve(position), 1)
  if (nearSelection instanceof TextSelection && !nearSelection.eq(state.selection) && !isInsideTable(nearSelection.$head)) {
    if (dispatch) {
      dispatch(state.tr.setSelection(nearSelection).scrollIntoView())
    }
    return true
  }

  return insertParagraphAfterTable(state, dispatch, tableDepth)
}

// ArrowUp at the start of the first cell of a leading table: symmetric to
// handleArrowDown — insert a paragraph before the table when the caret cannot
// move out above it.
export const handleArrowUp: Command = (state, dispatch) => {
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

  const position = $head.before(tableDepth)
  const nearSelection = TextSelection.near(state.doc.resolve(position), -1)
  if (nearSelection instanceof TextSelection && !nearSelection.eq(state.selection) && !isInsideTable(nearSelection.$head)) {
    if (dispatch) {
      dispatch(state.tr.setSelection(nearSelection).scrollIntoView())
    }
    return true
  }

  return insertParagraphBeforeTable(state, dispatch, tableDepth)
}

export function defineTableExitKeymap(): PlainExtension {
  return defineKeymap({
    ArrowDown: handleArrowDown,
    ArrowUp: handleArrowUp,
  })
}
