import { defaultBlockAt, defineKeymap, type PlainExtension } from 'prosekit/core'
import { TextSelection, type Command } from 'prosekit/pm/state'
import type { EditorView } from 'prosekit/pm/view'
import type { Node, ResolvedPos } from 'prosekit/pm/model'

const DIAGRAM_LANGUAGE = 'mermaid'

function isCodeBlockSelection(commandState: Parameters<Command>[0]): boolean {
  if (!commandState.selection.empty) {
    return false
  }

  const { $head } = commandState.selection
  return $head.parent.isTextblock && $head.parent.type.spec.code === true
}

function isDiagramSelection(commandState: Parameters<Command>[0]): boolean {
  if (!isCodeBlockSelection(commandState)) {
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

// The mermaid code block right after the current textblock, or null when the
// next sibling is not a mermaid diagram.
function nextDiagramNode($head: ResolvedPos): { pos: number; node: Node } | null {
  const grandParent = $head.node(-1)
  const index = $head.indexAfter(-1)
  if (index >= grandParent.childCount) {
    return null
  }
  const next = grandParent.child(index)
  if (next.type.spec.code !== true) {
    return null
  }
  if ((next.attrs as { language?: string }).language !== DIAGRAM_LANGUAGE) {
    return null
  }
  return { pos: $head.after(), node: next }
}

// The mermaid code block right before the current textblock, or null when the
// previous sibling is not a mermaid diagram.
function prevDiagramNode($head: ResolvedPos): { pos: number; node: Node } | null {
  const grandParent = $head.node(-1)
  const index = $head.index(-1)
  if (index === 0) {
    return null
  }
  const prev = grandParent.child(index - 1)
  if (prev.type.spec.code !== true) {
    return null
  }
  if ((prev.attrs as { language?: string }).language !== DIAGRAM_LANGUAGE) {
    return null
  }
  return { pos: $head.before() - prev.nodeSize, node: prev }
}

// Place the caret at the nearest position near `pos`, biased into the diagram
// (or out of it) as requested. Returns false so the keymap can fall through.
function setCaretNear(state: Parameters<Command>[0], dispatch: Parameters<Command>[1] | undefined, pos: number, bias: 1 | -1): boolean {
  if (dispatch) {
    const transaction = state.tr
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(pos), bias))
    dispatch(transaction.scrollIntoView())
  }
  return true
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
  if (!isDiagramSelection(state)) {
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
  if (!isCodeBlockSelection(state)) {
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
  if (!isCodeBlockSelection(state)) {
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

// ArrowRight at the left edge of a collapsed diagram jumps to its right edge
// so the user can continue with Enter (or ArrowRight again) to write below it.
export const moveCaretToDiagramEndOnArrowRight: Command = (state, dispatch, view) => {
  if (!view) {
    return false
  }
  if (!isDiagramSelection(state)) {
    return false
  }
  if (!isDiagramSourceCollapsed(view, state.selection.$head.pos)) {
    return false
  }

  const { $head } = state.selection
  const parent = $head.parent
  if ($head.parentOffset !== 0 || parent.content.size === 0) {
    return false
  }

  return setCaretNear(state, dispatch, $head.after(), -1)
}

// ArrowLeft at the right edge of a collapsed diagram jumps back to its left
// edge so the user can continue with Backspace to move the section up.
export const moveCaretToDiagramStartOnArrowLeft: Command = (state, dispatch, view) => {
  if (!view) {
    return false
  }
  if (!isDiagramSelection(state)) {
    return false
  }
  if (!isDiagramSourceCollapsed(view, state.selection.$head.pos)) {
    return false
  }

  const { $head } = state.selection
  const parent = $head.parent
  if ($head.parentOffset !== parent.content.size || parent.content.size === 0) {
    return false
  }

  return setCaretNear(state, dispatch, $head.before(), 1)
}

// Backspace at the left edge of a mermaid diagram removes the block above,
// moving the whole section up one line (the paragraph that was above it is
// deleted, never merged into the diagram source). This applies whether the
// source editor is collapsed or open.
export const moveDiagramUpOnBackspace: Command = (state, dispatch, view) => {
  if (!view) {
    return false
  }
  if (!isDiagramSelection(state)) {
    return false
  }

  const { $head } = state.selection
  if ($head.parentOffset !== 0) {
    return false
  }

  const grandParent = $head.node(-1)
  const index = $head.index(-1)
  if (index === 0) {
    return false
  }

  if (dispatch) {
    const previousNode = grandParent.child(index - 1)
    const start = $head.before() - previousNode.nodeSize
    const end = $head.before()
    const transaction = state.tr
    transaction.delete(start, end)
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(start), 1))
    dispatch(transaction.scrollIntoView())
  }

  return true
}

// ArrowDown: step over the edges of a mermaid diagram. When the caret is in
// the textblock above, land on the left edge of the source; when already on
// the left edge of a collapsed diagram, jump to the right edge; when on the
// right edge (or at the end of any code block), move out to the block after
// it. With the source editor open the jump is skipped so arrow keys keep
// moving through the visible source text normally.
export const handleArrowDown: Command = (state, dispatch, view) => {
  if (!view) {
    return false
  }
  if (!state.selection.empty) {
    return false
  }

  const { $head } = state.selection

  if (isCodeBlockSelection(state)) {
    const parent = $head.parent
    const isCollapsedDiagram = isDiagramSelection(state) && isDiagramSourceCollapsed(view, $head.pos)
    if (isCollapsedDiagram && $head.parentOffset === 0 && parent.content.size > 0) {
      return moveCaretToDiagramEndOnArrowRight(state, dispatch, view)
    }
    if ($head.parentOffset === parent.content.size) {
      return moveCursorAfterCodeBlock(state, dispatch, view)
    }
    return false
  }

  if ($head.parent.isTextblock) {
    const diagram = nextDiagramNode($head)
    if (diagram !== null) {
      return setCaretNear(state, dispatch, diagram.pos, 1)
    }
  }

  return false
}

// ArrowUp: step over the edges of a mermaid diagram. When the caret is in the
// textblock below, land on the right edge of the source; when already on the
// right edge of a collapsed diagram, jump back to the left edge; when on the
// left edge (or at the start of any code block), move out to the block before
// it. With the source editor open the jump is skipped so arrow keys keep
// moving through the visible source text normally.
export const handleArrowUp: Command = (state, dispatch, view) => {
  if (!view) {
    return false
  }
  if (!state.selection.empty) {
    return false
  }

  const { $head } = state.selection

  if (isCodeBlockSelection(state)) {
    const parent = $head.parent
    const isCollapsedDiagram = isDiagramSelection(state) && isDiagramSourceCollapsed(view, $head.pos)
    if (isCollapsedDiagram && $head.parentOffset === parent.content.size && parent.content.size > 0) {
      return moveCaretToDiagramStartOnArrowLeft(state, dispatch, view)
    }
    if ($head.parentOffset === 0) {
      return moveCursorBeforeCodeBlock(state, dispatch, view)
    }
    return false
  }

  if ($head.parent.isTextblock) {
    const diagram = prevDiagramNode($head)
    if (diagram !== null) {
      return setCaretNear(state, dispatch, diagram.pos + diagram.node.nodeSize, -1)
    }
  }

  return false
}

export function defineCodeBlockExitKeymap(): PlainExtension {
  return defineKeymap({
    ArrowDown: handleArrowDown,
    ArrowUp: handleArrowUp,
    ArrowRight: moveCaretToDiagramEndOnArrowRight,
    ArrowLeft: moveCaretToDiagramStartOnArrowLeft,
    Backspace: moveDiagramUpOnBackspace,
    Enter: moveCursorOutOfDiagramOnEnter,
  })
}
