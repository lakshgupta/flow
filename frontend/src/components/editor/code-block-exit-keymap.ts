import { defaultBlockAt, defineKeymap, type PlainExtension } from 'prosekit/core'
import { TextSelection, type Command } from 'prosekit/pm/state'
import type { EditorView } from 'prosekit/pm/view'

const DIAGRAM_LANGUAGE = 'mermaid'

function isCollapsedCodeBlockSelection(commandState: Parameters<Command>[0]): boolean {
  if (!commandState.selection.empty) {
    return false
  }

  const { $head } = commandState.selection
  return $head.parent.isTextblock && $head.parent.type.spec.code === true
}

function isCollapsedDiagramSelection(commandState: Parameters<Command>[0]): boolean {
  if (!isCollapsedCodeBlockSelection(commandState)) {
    return false
  }

  const { $head } = commandState.selection
  return ($head.parent.attrs as { language?: string }).language === DIAGRAM_LANGUAGE
}

// Mermaid diagrams hide their source editor behind a collapsed section. When
// the caret sits inside the code block text of a collapsed diagram it is not
// visible, so Enter must create a paragraph next to the section instead of
// editing the source. When the source editor is open the caret is visible and
// Enter keeps inserting source lines.
function isDiagramSourceCollapsed(view: EditorView, pos: number): boolean {
  const domAtPos = view.domAtPos(pos)
  const element = domAtPos.node instanceof Element
    ? domAtPos.node
    : domAtPos.node instanceof Text
      ? domAtPos.node.parentElement
      : null
  const sourceWrapper = element?.closest('.flow-diagram-block-source')
  if (sourceWrapper === null || sourceWrapper === undefined) {
    return false
  }

  return sourceWrapper.classList.contains('hidden')
}

const insertParagraphAfter: Command = (state, dispatch) => {
  const { $head } = state.selection
  const grandParent = $head.node(-1)
  const insertIndex = $head.indexAfter(-1)
  const position = $head.after()

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

const insertParagraphBefore: Command = (state, dispatch) => {
  const { $head } = state.selection
  const grandParent = $head.node(-1)
  const currentIndex = $head.index(-1)
  const position = $head.before()

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

// Enter next to a collapsed mermaid diagram creates a paragraph on the other
// side of the section: at the start of the block the whole section moves down
// to the next line; at the end the caret lands on a fresh line after it.
const moveCursorOutOfDiagramOnEnter: Command = (state, dispatch, view) => {
  if (!view) {
    return false
  }
  if (!isCollapsedDiagramSelection(state)) {
    return false
  }
  if (!isDiagramSourceCollapsed(view, state.selection.$head.pos)) {
    return false
  }

  const { $head } = state.selection
  const parent = $head.parent
  if ($head.parentOffset === 0) {
    return insertParagraphBefore(state, dispatch)
  }
  if ($head.parentOffset === parent.content.size) {
    return insertParagraphAfter(state, dispatch)
  }

  return false
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
    Enter: moveCursorOutOfDiagramOnEnter,
  })
}
