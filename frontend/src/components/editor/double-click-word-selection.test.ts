import { createEditor } from 'prosekit/core'
import { afterEach, describe, expect, it } from 'vitest'

import { defineEditorExtension } from './define-editor-extension'
import { wordRangeAt } from './double-click-word-selection'
import { markdownToHTML } from '../../richText'

describe('wordRangeAt', () => {
  it('returns the word containing the index', () => {
    expect(wordRangeAt('the quick fox', 5)).toEqual([4, 9]) // 'quick'
  })

  it('treats an index at the word end boundary as part of the word', () => {
    expect(wordRangeAt('the quick fox', 9)).toEqual([4, 9])
  })

  it('returns the first word for index 0', () => {
    expect(wordRangeAt('hello world', 0)).toEqual([0, 5])
  })

  it('handles punctuation around the word', () => {
    expect(wordRangeAt('(hello), world', 2)).toEqual([1, 6])
  })

  it('keeps internal apostrophes and hyphens in the word', () => {
    expect(wordRangeAt("don't stop, well-known", 1)).toEqual([0, 5])
    expect(wordRangeAt("don't stop, well-known", 18)).toEqual([12, 22])
  })

  it('handles non-ASCII letters', () => {
    expect(wordRangeAt('héllo wörld', 7)).toEqual([6, 11])
  })

  it('returns null for whitespace not adjacent to a word', () => {
    expect(wordRangeAt('a  b', 2)).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(wordRangeAt('', 0)).toBeNull()
  })
})

describe('defineDoubleClickWordSelection', () => {
  const mounted: Array<ReturnType<typeof createEditor>> = []

  afterEach(() => {
    for (const editor of mounted) {
      editor.unmount()
    }
    mounted.length = 0
  })

  function mountEditor(markdown: string) {
    const editor = createEditor({
      extension: defineEditorExtension(),
      defaultContent: markdownToHTML(markdown) || undefined,
    })
    const dom = document.createElement('div')
    editor.mount(dom)
    mounted.push(editor)
    return editor
  }

  function dispatchDoubleClick(
    editor: ReturnType<typeof createEditor>,
    pos: number,
  ): boolean {
    const view = editor.view
    if (view === null || view === undefined) {
      throw new Error('editor view not mounted')
    }
    const event = new MouseEvent('dblclick', { button: 0, bubbles: true })
    return view.someProp('handleDoubleClick', (fn) => fn(view, pos, event)) ?? false
  }

  function selectedText(editor: ReturnType<typeof createEditor>): string {
    const view = editor.view
    if (view === null || view === undefined) {
      throw new Error('editor view not mounted')
    }
    const { from, to } = view.state.selection
    return view.state.doc.textBetween(from, to, ' ')
  }

  it('selects the word under a double-click position', () => {
    const editor = mountEditor('The quick brown fox')
    const view = editor.view
    if (view === null || view === undefined) {
      throw new Error('editor view not mounted')
    }
    const doc = view.state.doc
    // Position of 'quick' (index 4..9 in the paragraph text).
    const pos = doc.resolve(1).start() + 5

    const handled = dispatchDoubleClick(editor, pos)
    expect(handled).toBe(true)
    expect(selectedText(editor)).toBe('quick')
  })

  it('selects the word at the start of a paragraph', () => {
    const editor = mountEditor('The quick brown fox')
    const view = editor.view
    if (view === null || view === undefined) {
      throw new Error('editor view not mounted')
    }
    const doc = view.state.doc
    const pos = doc.resolve(1).start() + 1

    const handled = dispatchDoubleClick(editor, pos)
    expect(handled).toBe(true)
    expect(selectedText(editor)).toBe('The')
  })

  it('selects the word at the end of a paragraph', () => {
    const editor = mountEditor('The quick brown fox')
    const view = editor.view
    if (view === null || view === undefined) {
      throw new Error('editor view not mounted')
    }
    const doc = view.state.doc
    const pos = doc.resolve(1).start() + doc.resolve(1).parent.textContent.length

    const handled = dispatchDoubleClick(editor, pos)
    expect(handled).toBe(true)
    expect(selectedText(editor)).toBe('fox')
  })

  it('selects a word inside a list item', () => {
    const editor = mountEditor('- item one\n- item two')
    const view = editor.view
    if (view === null || view === undefined) {
      throw new Error('editor view not mounted')
    }
    // Find the doc position of the text 'two' by walking the tree.
    const doc = view.state.doc
    let pos = -1
    doc.descendants((node, p) => {
      if (pos >= 0) {
        return false
      }
      if (node.isText && node.text?.includes('two')) {
        pos = p + (node.text.indexOf('two'))
        return false
      }
      return undefined
    })
    expect(pos).toBeGreaterThan(-1)

    const handled = dispatchDoubleClick(editor, pos)
    expect(handled).toBe(true)
    expect(selectedText(editor)).toBe('two')
  })

  it('does not handle double-clicks on non-text positions', () => {
    const editor = mountEditor('Just a paragraph')
    const view = editor.view
    if (view === null || view === undefined) {
      throw new Error('editor view not mounted')
    }
    // Position 0 sits on the document boundary, not inside a text block.
    const handled = dispatchDoubleClick(editor, 0)
    expect(handled).toBe(false)
  })
})
