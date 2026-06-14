import { defaultBlockAt, defineKeymap, type PlainExtension } from 'prosekit/core'
import { TextSelection, type Command } from 'prosekit/pm/state'

function isCollapsedCodeBlockSelection(commandState: Parameters<Command>[0]): boolean {
  if (!commandState.selection.empty) {
    return false
  }

  const { $head } = commandState.selection
  return $head.parent.isTextblock && $head.parent.type.spec.code === true
}

const moveCursorAfterCodeBlock: Command = (state, dispatch, view) => {
  if (!view) {
    return false
  }
  if (!isCollapsedCodeBlockSelection(state)) {
    return false
  }

  const { $head } = state.selection
  const parent = $head.parent
  if ($head.parentOffset !== parent.content.size) {
    return false
  }

  const grandParent = $head.node(-1)
  const insertIndex = $head.indexAfter(-1)
  const position = $head.after()

  if (insertIndex < grandParent.childCount) {
    if (dispatch) {
      const transaction = state.tr
      transaction.setSelection(TextSelection.near(transaction.doc.resolve(position), 1))
      dispatch(transaction.scrollIntoView())
    }
    return true
  }

  const type = defaultBlockAt(grandParent.contentMatchAt(insertIndex))
  if (!type) {
    return false
  }

  // Always allow creating a new block, even if canReplaceWith fails (e.g., at end of document)
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

const moveCursorBeforeCodeBlock: Command = (state, dispatch, view) => {
  if (!view) {
    return false
  }
  if (!isCollapsedCodeBlockSelection(state)) {
    return false
  }

  const { $head } = state.selection
  if ($head.parentOffset !== 0) {
    return false
  }

  const grandParent = $head.node(-1)
  const currentIndex = $head.index(-1)
  const position = $head.before()

  if (currentIndex > 0) {
    if (dispatch) {
      const transaction = state.tr
      transaction.setSelection(TextSelection.near(transaction.doc.resolve(position), -1))
      dispatch(transaction.scrollIntoView())
    }
    return true
  }

  const type = defaultBlockAt(grandParent.contentMatchAt(currentIndex))
  if (!type) {
    return false
  }

  // Always allow creating a new block, even if canReplaceWith fails (e.g., at start of document)
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

export function defineCodeBlockExitKeymap(): PlainExtension {
  return defineKeymap({
    ArrowDown: moveCursorAfterCodeBlock,
    ArrowUp: moveCursorBeforeCodeBlock,
  })
}
