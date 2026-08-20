import { createEditor } from 'prosekit/core'
import { TextSelection, type Selection } from 'prosekit/pm/state'
import { CellSelection } from 'prosemirror-tables'
import { afterEach, describe, expect, it } from 'vitest'

import { defineEditorExtension } from './define-editor-extension'
import { markdownToHTML } from '../../richText'

const TABLE_MARKDOWN = [
  'Intro text.',
  '',
  '| Alpha | Beta |',
  '| ----- | ---- |',
  '| One   | Two  |',
  '| Three | Four |',
  '',
  'After text.',
].join('\n')

describe('keyboard table deletion in the real editor', () => {
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

  type TableInfo = {
    start: number
    node: ReturnType<ReturnType<typeof createEditor>['view']['state']['doc']['child']>
  }

  function tableInfo(editor: ReturnType<typeof createEditor>): TableInfo {
    const doc = editor.view.state.doc
    let found: TableInfo | null = null
    doc.forEach((node, offset) => {
      if (found === null && node.type.spec.tableRole === 'table') {
        found = { start: offset, node }
      }
    })
    if (found === null) {
      throw new Error('document has no table')
    }
    return found
  }

  // Dimensions of the first table in the document.
  function tableDimensions(editor: ReturnType<typeof createEditor>): { rows: number; cols: number } {
    const { node } = tableInfo(editor)
    return { rows: node.childCount, cols: node.lastChild!.childCount }
  }

  function tableCount(editor: ReturnType<typeof createEditor>): number {
    let count = 0
    editor.view.state.doc.forEach((node) => {
      if (node.type.spec.tableRole === 'table') {
        count++
      }
    })
    return count
  }

  // Position of the cell node at (row, col) inside the table.
  function cellNodePos(editor: ReturnType<typeof createEditor>, row: number, col: number): number {
    const { start, node } = tableInfo(editor)
    let rowStart = start + 1
    for (let r = 0; r < row; r++) {
      rowStart += node.child(r).nodeSize
    }
    let pos = rowStart + 1
    for (let c = 0; c < col; c++) {
      pos += node.child(row).child(c).nodeSize
    }
    return pos
  }

  // Position of the text caret at the start of the cell's content.
  function cellContentStart(editor: ReturnType<typeof createEditor>, row: number, col: number): number {
    return TextSelection.near(editor.view.state.doc.resolve(cellNodePos(editor, row, col) + 1), 1).from
  }

  // Position of the text caret at the end of the cell's content.
  function cellContentEnd(editor: ReturnType<typeof createEditor>, row: number, col: number): number {
    const { node } = tableInfo(editor)
    const cell = node.child(row).child(col)
    return TextSelection.near(editor.view.state.doc.resolve(cellNodePos(editor, row, col) + cell.nodeSize - 1), -1).from
  }

  function setCaret(editor: ReturnType<typeof createEditor>, pos: number): void {
    const doc = editor.view.state.doc
    const selection: Selection = TextSelection.create(doc, pos, pos)
    editor.view.dispatch(editor.view.state.tr.setSelection(selection))
    editor.view.focus()
  }

  function pressKey(editor: ReturnType<typeof createEditor>, key: string): boolean {
    const view = editor.view
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    return view.someProp('handleKeyDown', (fn) => fn(view, event)) ?? false
  }

  it('deletes the table when Backspace is pressed at the start of the first cell', () => {
    const editor = mountEditor(TABLE_MARKDOWN)
    expect(tableCount(editor)).toBe(1)
    setCaret(editor, cellContentStart(editor, 0, 0))

    const handled = pressKey(editor, 'Backspace')

    expect(handled).toBe(true)
    expect(tableCount(editor)).toBe(0)
  })

  it('deletes the table when Delete is pressed at the end of the last cell', () => {
    const editor = mountEditor(TABLE_MARKDOWN)
    const { rows, cols } = tableDimensions(editor)
    setCaret(editor, cellContentEnd(editor, rows - 1, cols - 1))

    const handled = pressKey(editor, 'Delete')

    expect(handled).toBe(true)
    expect(tableCount(editor)).toBe(0)
  })

  it('keeps the table when Backspace is pressed mid-cell with text before the caret', () => {
    const editor = mountEditor(TABLE_MARKDOWN)
    setCaret(editor, cellContentStart(editor, 0, 0) + 2) // inside "One"

    const handled = pressKey(editor, 'Backspace')

    // The keymap only claims boundary Backspaces; mid-cell deletion falls
    // through to ProseMirror's native handling and the table survives.
    expect(handled).toBe(false)
    expect(tableCount(editor)).toBe(1)
  })

  it('keeps the table when Backspace is pressed at the start of a non-first cell', () => {
    const editor = mountEditor(TABLE_MARKDOWN)
    setCaret(editor, cellContentStart(editor, 0, 1))

    const handled = pressKey(editor, 'Backspace')

    // Nothing to delete at the start of the second cell; the table survives.
    expect(handled).toBe(false)
    expect(tableCount(editor)).toBe(1)
  })

  it('deletes the table when Backspace is pressed with a whole-table cell selection', () => {
    const editor = mountEditor(TABLE_MARKDOWN)
    const { rows, cols } = tableDimensions(editor)
    const doc = editor.view.state.doc
    const selection = CellSelection.create(doc, cellNodePos(editor, 0, 0), cellNodePos(editor, rows - 1, cols - 1))
    editor.view.dispatch(editor.view.state.tr.setSelection(selection))
    editor.view.focus()

    const handled = pressKey(editor, 'Backspace')

    expect(handled).toBe(true)
    expect(tableCount(editor)).toBe(0)
  })

  it('keeps the table when Backspace is pressed with a partial cell selection', () => {
    const editor = mountEditor(TABLE_MARKDOWN)
    const doc = editor.view.state.doc
    const selection = CellSelection.create(doc, cellNodePos(editor, 0, 0), cellNodePos(editor, 0, 1))
    editor.view.dispatch(editor.view.state.tr.setSelection(selection))
    editor.view.focus()

    const handled = pressKey(editor, 'Backspace')

    // Only the first row's cells are selected — the table stays.
    expect(tableCount(editor)).toBe(1)
    // The cells were cleared rather than the table deleted.
    expect(tableInfo(editor).node.child(0).child(0).textContent).toBe('')
  })
})
