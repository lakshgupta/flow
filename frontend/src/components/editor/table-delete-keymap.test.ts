import { describe, expect, it } from 'vitest'
import { Schema, type Node } from 'prosekit/pm/model'
import { EditorState, TextSelection, type Command, type Transaction } from 'prosekit/pm/state'
import { CellSelection, tableNodes } from 'prosemirror-tables'

import {
  handleBackspace,
  handleBackspaceAtTableStart,
  handleDelete,
  handleDeleteAtTableEnd,
  handleDeleteWholeTableSelection,
} from './table-delete-keymap'

// Mirrors the editor's table schema (prosekit/extensions/table): table cells
// contain block content and the cell content ends on a single paragraph.
const specs = tableNodes({ tableGroup: 'block', cellContent: 'block+', cellAttributes: {} })

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    table: { ...specs.table, content: 'tableRow+' },
    tableRow: { ...specs.table_row, content: '(tableCell | tableHeaderCell)*' },
    tableCell: { ...specs.table_cell },
    tableHeaderCell: { ...specs.table_header },
    text: { group: 'inline' },
  },
})

function makeCell(text: string) {
  return schema.nodes.tableCell.create(null, schema.nodes.paragraph.create(null, schema.text(text)))
}

function makeRow(cells: string[]) {
  return schema.nodes.tableRow.create(null, cells.map(makeCell))
}

// A `rows` x `cols` table whose cells read r{row}c{col}.
function makeTable(rows: number, cols: number) {
  const rowNodes = []
  for (let r = 0; r < rows; r++) {
    const cells = []
    for (let c = 0; c < cols; c++) {
      cells.push(`r${r}c${c}`)
    }
    rowNodes.push(makeRow(cells))
  }
  return schema.nodes.table.create(null, rowNodes)
}

function makeDoc(blocks: Node[]) {
  return schema.nodes.doc.create(null, blocks)
}

function makeState(doc: Node, pos: number): EditorState {
  return EditorState.create({ doc, selection: TextSelection.create(doc, pos, pos) })
}

function run(cmd: Command, state: EditorState): { result: boolean; tr: Transaction | null } {
  let tr: Transaction | null = null
  const result = cmd(state, (transaction) => {
    tr = transaction
  })
  return { result, tr }
}

// The nth table in the doc (0-indexed).
function tableRange(doc: Node, index = 0): { start: number; end: number; node: Node } {
  let current = -1
  let range: { start: number; end: number; node: Node } | null = null
  doc.forEach((node, offset) => {
    if (node.type.spec.tableRole === 'table') {
      current++
      if (current === index) {
        range = { start: offset, end: offset + node.nodeSize, node }
      }
    }
  })
  if (range === null) {
    throw new Error(`test document has no table at index ${index}`)
  }
  return range
}

function tableCount(doc: Node): number {
  let count = 0
  doc.forEach((node) => {
    if (node.type.spec.tableRole === 'table') {
      count++
    }
  })
  return count
}

// Position of the cell node at (rowIndex, colIndex) inside the table — the
// position a CellSelection expects.
function cellNodeStart(doc: Node, rowIndex: number, colIndex: number, tableIndex = 0): number {
  const { node, start } = tableRange(doc, tableIndex)
  let rowStart = start + 1
  for (let r = 0; r < rowIndex; r++) {
    rowStart += node.child(r).nodeSize
  }
  let pos = rowStart + 1
  for (let c = 0; c < colIndex; c++) {
    pos += node.child(rowIndex).child(c).nodeSize
  }
  return pos
}

// A text caret at the start of the given cell's content.
function cellTextStart(doc: Node, rowIndex: number, colIndex: number, tableIndex = 0): number {
  const start = cellNodeStart(doc, rowIndex, colIndex, tableIndex)
  return TextSelection.near(doc.resolve(start + 1), 1).from
}

// A text caret at the end of the given cell's content.
function cellTextEnd(doc: Node, rowIndex: number, colIndex: number, tableIndex = 0): number {
  const { node } = tableRange(doc, tableIndex)
  const start = cellNodeStart(doc, rowIndex, colIndex, tableIndex)
  const cell = node.child(rowIndex).child(colIndex)
  return TextSelection.near(doc.resolve(start + cell.nodeSize - 1), -1).from
}

function firstCellStart(doc: Node, tableIndex = 0): number {
  return cellTextStart(doc, 0, 0, tableIndex)
}

function lastCellEnd(doc: Node, tableIndex = 0): number {
  const { node } = tableRange(doc, tableIndex)
  return cellTextEnd(doc, node.childCount - 1, node.lastChild!.childCount - 1, tableIndex)
}

describe('table delete keymap', () => {
  describe('Backspace at the start of the first cell', () => {
    it('deletes the whole table when it is preceded by a paragraph', () => {
      const doc = makeDoc([
        schema.nodes.paragraph.create(null, schema.text('Intro')),
        makeTable(2, 2),
        schema.nodes.paragraph.create(null, schema.text('After')),
      ])
      const { result, tr } = run(handleBackspaceAtTableStart, makeState(doc, firstCellStart(doc)))
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tableCount(tr!.doc)).toBe(0)
      expect(tr!.doc.child(0).type.name).toBe('paragraph')
      expect(tr!.doc.child(1).type.name).toBe('paragraph')
      expect(tr!.doc.child(1).textContent).toBe('After')
    })

    it('deletes the table when it is the only block, leaving a valid doc', () => {
      const doc = makeDoc([makeTable(1, 1)])
      const { result, tr } = run(handleBackspaceAtTableStart, makeState(doc, firstCellStart(doc)))
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tableCount(tr!.doc)).toBe(0)
      expect(tr!.doc.childCount).toBe(1)
      expect(tr!.doc.child(0).type.name).toBe('paragraph')
    })

    it('deletes the table when the first cell is empty', () => {
      // doc: table with an empty first cell, followed by a paragraph.
      const emptyCell = schema.nodes.tableCell.create(null, schema.nodes.paragraph.create())
      const table = schema.nodes.table.create(null, [
        schema.nodes.tableRow.create(null, [emptyCell]),
      ])
      const doc = makeDoc([table, schema.nodes.paragraph.create(null, schema.text('After'))])
      const { result, tr } = run(handleBackspaceAtTableStart, makeState(doc, firstCellStart(doc)))
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tableCount(tr!.doc)).toBe(0)
    })

    it('deletes only the table containing the caret when the doc has two tables', () => {
      const doc = makeDoc([makeTable(1, 1), makeTable(1, 1)])
      const { result, tr } = run(handleBackspaceAtTableStart, makeState(doc, firstCellStart(doc, 1)))
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tableCount(tr!.doc)).toBe(1)
      expect(tr!.doc.child(0).type.spec.tableRole).toBe('table')
    })

    it('does nothing at the start of a non-first cell', () => {
      const doc = makeDoc([makeTable(2, 2)])
      const { result, tr } = run(handleBackspaceAtTableStart, makeState(doc, cellTextStart(doc, 0, 1)))
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })

    it('does nothing at the start of a cell in a non-first row', () => {
      const doc = makeDoc([makeTable(2, 2)])
      const { result, tr } = run(handleBackspaceAtTableStart, makeState(doc, cellTextStart(doc, 1, 0)))
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })

    it('does nothing when there is text before the caret', () => {
      const doc = makeDoc([makeTable(1, 1)])
      const end = cellTextEnd(doc, 0, 0)
      const { result, tr } = run(handleBackspaceAtTableStart, makeState(doc, end))
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })

    it('does nothing when the caret is not in a table', () => {
      const doc = makeDoc([
        schema.nodes.paragraph.create(null, schema.text('Intro')),
        schema.nodes.paragraph.create(null, schema.text('After')),
      ])
      const { result, tr } = run(handleBackspaceAtTableStart, makeState(doc, 1))
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })

    it('does nothing for a non-empty selection', () => {
      const doc = makeDoc([makeTable(2, 2)])
      const state = EditorState.create({
        doc,
        selection: TextSelection.create(doc, cellTextStart(doc, 0, 0), cellTextEnd(doc, 0, 0)),
      })
      const { result, tr } = run(handleBackspaceAtTableStart, state)
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })
  })

  describe('Delete at the end of the last cell', () => {
    it('deletes the whole table', () => {
      const doc = makeDoc([
        schema.nodes.paragraph.create(null, schema.text('Intro')),
        makeTable(2, 2),
        schema.nodes.paragraph.create(null, schema.text('After')),
      ])
      const { result, tr } = run(handleDeleteAtTableEnd, makeState(doc, lastCellEnd(doc)))
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tableCount(tr!.doc)).toBe(0)
    })

    it('deletes the table when it is the only block, leaving a valid doc', () => {
      const doc = makeDoc([makeTable(1, 1)])
      const { result, tr } = run(handleDeleteAtTableEnd, makeState(doc, lastCellEnd(doc)))
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tableCount(tr!.doc)).toBe(0)
      expect(tr!.doc.childCount).toBe(1)
      expect(tr!.doc.child(0).type.name).toBe('paragraph')
    })

    it('does nothing at the end of a non-last cell', () => {
      const doc = makeDoc([makeTable(2, 2)])
      const { result, tr } = run(handleDeleteAtTableEnd, makeState(doc, cellTextEnd(doc, 0, 1)))
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })

    it('does nothing when the caret is not at the end of the cell content', () => {
      const doc = makeDoc([makeTable(1, 1)])
      const { result, tr } = run(handleDeleteAtTableEnd, makeState(doc, firstCellStart(doc)))
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })
  })

  describe('Backspace/Delete with a whole-table selection', () => {
    function wholeTableState(doc: Node): EditorState {
      const { node } = tableRange(doc)
      const anchor = cellNodeStart(doc, 0, 0)
      const head = cellNodeStart(doc, node.childCount - 1, node.lastChild!.childCount - 1)
      return EditorState.create({ doc, selection: CellSelection.create(doc, anchor, head) })
    }

    it('deletes the table via deleteCellSelection preemption', () => {
      const doc = makeDoc([
        schema.nodes.paragraph.create(null, schema.text('Intro')),
        makeTable(2, 2),
        schema.nodes.paragraph.create(null, schema.text('After')),
      ])
      const state = wholeTableState(doc)
      const { result, tr } = run(handleDeleteWholeTableSelection, state)
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tableCount(tr!.doc)).toBe(0)
    })

    it('deletes the table through the composite Backspace handler', () => {
      const doc = makeDoc([makeTable(2, 2)])
      const state = wholeTableState(doc)
      const { result, tr } = run(handleBackspace, state)
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tableCount(tr!.doc)).toBe(0)
    })

    it('deletes the table through the composite Delete handler', () => {
      const doc = makeDoc([makeTable(2, 2)])
      const state = wholeTableState(doc)
      const { result, tr } = run(handleDelete, state)
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tableCount(tr!.doc)).toBe(0)
    })

    it('leaves a partial cell selection alone', () => {
      const doc = makeDoc([makeTable(2, 2)])
      const selection = CellSelection.create(doc, cellNodeStart(doc, 0, 0), cellNodeStart(doc, 0, 1))
      const state = EditorState.create({ doc, selection })
      const { result, tr } = run(handleDeleteWholeTableSelection, state)
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })

    it('does nothing for a non-cell selection', () => {
      const doc = makeDoc([makeTable(2, 2)])
      const state = makeState(doc, firstCellStart(doc))
      const { result, tr } = run(handleDeleteWholeTableSelection, state)
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })
  })

  describe('composite handlers outside tables', () => {
    it('Backspace returns false when not in a table', () => {
      const doc = makeDoc([
        schema.nodes.paragraph.create(null, schema.text('Intro')),
        schema.nodes.paragraph.create(null, schema.text('After')),
      ])
      const { result, tr } = run(handleBackspace, makeState(doc, 1))
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })

    it('Delete returns false when not in a table', () => {
      const doc = makeDoc([
        schema.nodes.paragraph.create(null, schema.text('Intro')),
        schema.nodes.paragraph.create(null, schema.text('After')),
      ])
      const { result, tr } = run(handleDelete, makeState(doc, 1))
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })
  })
})
