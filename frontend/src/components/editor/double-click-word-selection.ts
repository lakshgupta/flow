import { defineDoubleClickHandler, type PlainExtension } from 'prosekit/core'
import { TextSelection } from 'prosekit/pm/state'

// A word is a run of letters, numbers, or underscores with internal
// apostrophes (straight or curly) and hyphens, e.g. "don't", "well-known",
// "café". Punctuation attached to the edges (",", ".", "(", ")") stays out of
// the selection, matching native double-click behavior.
const WORD_RE = /[\p{L}\p{N}_]+(?:['’\-][\p{L}\p{N}_]+)*/gu

// Offsets (relative to `text`) of the word containing `index`, or null when
// `index` is not on a word. An index exactly at the word's end boundary is
// treated as part of that word.
export function wordRangeAt(text: string, index: number): [number, number] | null {
  WORD_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WORD_RE.exec(text))) {
    const start = match.index
    const end = match.index + match[0].length
    if (index >= start && index <= end) {
      return [start, end]
    }
    if (start > index) {
      break
    }
  }
  return null
}

// ProseMirror's own double-click handling lets the browser's native word
// selection run, but the view's DOM flush on selectionchange resets it, so
// double-clicking a word in the editor selects nothing (or the whole
// paragraph when the click sequence registers as a triple click). Select the
// word under the cursor deterministically instead.
export function defineDoubleClickWordSelection(): PlainExtension {
  return defineDoubleClickHandler((view, pos, event) => {
    if (event.button !== 0) {
      return false
    }
    const { doc } = view.state
    if (pos < 0 || pos > doc.content.size) {
      return false
    }

    const $pos = doc.resolve(pos)
    const parent = $pos.parent
    // Only apply word selection inside text blocks (paragraphs, headings,
    // list items, table cells, code blocks). Let node-level double-clicks
    // (images, tables, etc.) fall through to the default handler.
    if (!parent.isTextblock) {
      return false
    }

    const text = parent.textContent
    const offset = pos - $pos.start()
    if (offset < 0 || offset > text.length) {
      return false
    }

    const range = wordRangeAt(text, offset)
    if (!range) {
      return false
    }

    const from = $pos.start() + range[0]
    const to = $pos.start() + range[1]
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(doc, from, to)).scrollIntoView(),
    )
    return true
  })
}
