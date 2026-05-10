import { defaultBlockAt, defineKeymap, type PlainExtension } from 'prosekit/core'
import { TextSelection, type Command } from 'prosekit/pm/state'

function isCollapsedHeadingSelection(commandState: Parameters<Command>[0]): boolean {
  if (!commandState.selection.empty) {
    return false
  }

  const { $head } = commandState.selection
  return $head.parent.isTextblock && $head.parent.type.name === 'heading'
}

const moveCursorAfterHeading: Command = (state, dispatch) => {
  if (!isCollapsedHeadingSelection(state)) {
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
  if (!type || !grandParent.canReplaceWith(insertIndex, insertIndex, type)) {
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

export function defineHeadingExitKeymap(): PlainExtension {
  return defineKeymap({
    Enter: moveCursorAfterHeading,
  })
}