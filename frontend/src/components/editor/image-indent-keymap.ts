import { defineKeymap, type PlainExtension } from 'prosekit/core'
import { lift, wrapIn } from 'prosemirror-commands'
import { TextSelection, type Command } from 'prosekit/pm/state'

/** Check if the current selection contains an image node that can be indented. */
function isImageSelected(commandState: Parameters<Command>[0]): boolean {
  const { selection } = commandState
  if (!selection.empty) {
    return false
  }

  // NodeSelection on an image (most common case when clicking an image)
  if (selection.constructor.name === 'NodeSelection') {
    const node = (selection as { node?: { type?: { name?: string } } }).node
    if (node?.type?.name === 'image') {
      return true
    }
  }

  // TextSelection: check if we're in a paragraph that contains only an image
  if (selection instanceof TextSelection) {
    const { $head } = selection
    const parent = $head.parent
    if (parent.type.name === 'paragraph' && parent.childCount === 1) {
      const child = parent.child(0)
      if (child.type.name === 'image') {
        return true
      }
    }
  }

  return false
}

/** Indent the selected image by wrapping it in a blockquote. */
const indentImage: Command = (state, dispatch) => {
  if (!isImageSelected(state)) {
    return false
  }

  const blockquoteType = state.schema.nodes.blockquote
  if (!blockquoteType) {
    return false
  }

  return wrapIn(blockquoteType)(state, dispatch)
}

/** Outdent the selected image by lifting it out of its wrapping blockquote. */
const outdentImage: Command = (state, dispatch) => {
  if (!isImageSelected(state)) {
    return false
  }

  return lift(state, dispatch)
}

export function defineImageIndentKeymap(): PlainExtension {
  return defineKeymap({
    Tab: indentImage,
    'Shift-Tab': outdentImage,
  })
}
