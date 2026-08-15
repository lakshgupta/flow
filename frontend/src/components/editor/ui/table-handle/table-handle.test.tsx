import { createEditor } from 'prosekit/core'
import { TextSelection } from 'prosekit/pm/state'
import { afterEach, describe, expect, it } from 'vitest'

import { defineEditorExtension } from '../../define-editor-extension'
import { editorHTMLToMarkdown, markdownToHTML } from '../../../../richText'
import { getTableHandleState } from './table-handle'

// Exercises the table handle state derivation with a real mounted editor.
// The important behavior under test: Delete Row/Column must be reported as
// not executable when the table has a single row or column, because
// prosemirror-tables silently no-ops in that case.
describe('table handle state', () => {
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

  // Place the caret on the first text position of the table's first cell.
  function selectFirstCell(editor: ReturnType<typeof createEditor>) {
    const view = editor.view
    if (view === null || view === undefined) {
      throw new Error('editor view not mounted')
    }
    const caret = TextSelection.near(view.state.doc.resolve(2), 1).from
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, caret)))
    expect(view.state.selection.$head.parent.isTextblock).toBe(true)
  }

  it('allows deleting a row and column in a 2x2 table', () => {
    const editor = mountEditor('| a | b |\n| - | - |\n| 1 | 2 |')
    selectFirstCell(editor)

    const state = getTableHandleState(editor)
    expect(state.deleteTableRow.canExec).toBe(true)
    expect(state.deleteTableColumn.canExec).toBe(true)
    expect(state.addTableRowBelow.canExec).toBe(true)
    expect(state.addTableColumnAfter.canExec).toBe(true)
  })

  it('disables deleting the only row of a 1-row table', () => {
    const editor = mountEditor('| a | b |\n| - | - |')
    selectFirstCell(editor)

    const state = getTableHandleState(editor)
    expect(state.deleteTableRow.canExec).toBe(false)
    expect(state.deleteTableColumn.canExec).toBe(true)
  })

  it('disables deleting the only column of a 1-column table', () => {
    const editor = mountEditor('| a |\n| - |\n| 1 |')
    selectFirstCell(editor)

    const state = getTableHandleState(editor)
    expect(state.deleteTableRow.canExec).toBe(true)
    expect(state.deleteTableColumn.canExec).toBe(false)
  })

  it('serializes a table created with insertTable(header: true) back to GFM markdown', () => {
    const editor = mountEditor('')
    const view = editor.view
    if (view === null || view === undefined) {
      throw new Error('editor view not mounted')
    }

    // Mirror the slash menu's insertTable call (header row enabled).
    editor.commands.insertTable({ row: 3, col: 2, header: true })

    const markdown = editorHTMLToMarkdown(editor.getDocHTML())
    // A header table must round-trip as GFM markdown, not raw HTML.
    expect(markdown).toContain('|  |')
    expect(markdown).toContain('| --- | --- |')
    expect(markdown).not.toContain('<table>')
  })
})
