import { createEditor } from 'prosekit/core'
import { TextSelection } from 'prosekit/pm/state'
import { afterEach, describe, expect, it } from 'vitest'

import { defineEditorExtension } from './define-editor-extension'
import { editorHTMLToMarkdown, markdownToHTML } from '../../richText'

// Exercises the real keydown chain (prosemirror-tables tableEditing →
// baseKeymap → table-exit-keymap) with a mounted editor, which the unit tests
// for the keymap commands alone cannot cover.
describe('table exit through the keydown chain', () => {
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

  function dispatchKey(editor: ReturnType<typeof createEditor>, key: string): boolean {
    const view = editor.view
    if (view === null || view === undefined) {
      throw new Error('editor view not mounted')
    }
    const event = new KeyboardEvent('keydown', { key, bubbles: true })
    return view.someProp('handleKeyDown', (fn) => fn(view, event)) ?? false
  }

  it('creates a paragraph after a trailing table on ArrowDown from the last cell', () => {
    const editor = mountEditor('| a | b |\n| - | - |\n| 1 | 2 |')
    const view = editor.view
    if (view === null || view === undefined) {
      throw new Error('editor view not mounted')
    }

    // Place the caret at the end of the last cell's text (the last valid text
    // position in the document).
    const docSize = view.state.doc.content.size
    const caret = TextSelection.near(view.state.doc.resolve(docSize), -1).from
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, caret)))
    expect(view.state.selection.$head.parent.type.name).toBe('paragraph')

    const handled = dispatchKey(editor, 'ArrowDown')
    expect(handled).toBe(true)

    const markdown = editorHTMLToMarkdown(editor.getDocHTML())
    expect(markdown).toContain('| 1 | 2 |')
    // A new empty paragraph was created after the table.
    expect(markdown.lastIndexOf('| 1 | 2 |') < markdown.lastIndexOf('<p><br></p>')).toBe(true)
    // The caret moved out of the table into the new paragraph.
    expect(view.state.selection.$head.parent.type.name).toBe('paragraph')
  })

  it('keeps the caret in the table when ArrowDown is pressed in the first row', () => {
    const editor = mountEditor('| a | b |\n| - | - |\n| 1 | 2 |')
    const view = editor.view
    if (view === null || view === undefined) {
      throw new Error('editor view not mounted')
    }

    // Caret at the end of the first row's last cell — ArrowDown should move
    // into the row below, not exit the table.
    const table = view.state.doc.child(0)
    const firstRowEnd = 1 + table.child(0).nodeSize
    const caret = TextSelection.near(view.state.doc.resolve(firstRowEnd - 1), -1).from
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, caret)))

    dispatchKey(editor, 'ArrowDown')
    const markdown = editorHTMLToMarkdown(editor.getDocHTML())
    // The table was not modified and no paragraph was added after it.
    expect(markdown).not.toContain('<p><br></p>')
    expect(markdown).toContain('| 1 | 2 |')
    // The caret moved into the second row instead of leaving the table.
    expect(view.state.selection.$head.parent.type.name).toBe('paragraph')
  })
})
