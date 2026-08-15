import { describe, expect, it } from 'vitest'
import { Schema, type Node } from 'prosekit/pm/model'
import { EditorState, TextSelection, type Command, type Transaction } from 'prosekit/pm/state'
import { tableNodes } from 'prosemirror-tables'

import { handleArrowDown, handleArrowUp } from './table-exit-keymap'

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

// The first table in the doc.
function tableRange(doc: Node): { start: number; end: number; node: Node } {
  let range: { start: number; end: number; node: Node } | null = null
  doc.forEach((node, offset) => {
    if (range === null && node.type.spec.tableRole === 'table') {
      range = { start: offset, end: offset + node.nodeSize, node }
    }
  })
  if (range === null) {
    throw new Error('test document has no table')
  }
  return range
}

// Start position of the cell at (rowIndex, colIndex) inside the table.
function cellStart(doc: Node, rowIndex: number, colIndex: number): number {
  const { node, start } = tableRange(doc)
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

// A text caret at the end of the given cell's content.
function cellTextEnd(doc: Node, rowIndex: number, colIndex: number): number {
  const { node } = tableRange(doc)
  const start = cellStart(doc, rowIndex, colIndex)
  const cell = node.child(rowIndex).child(colIndex)
  return TextSelection.near(doc.resolve(start + cell.nodeSize - 1), -1).from
}

// A text caret at the start of the given cell's content.
function cellTextStart(doc: Node, rowIndex: number, colIndex: number): number {
  const start = cellStart(doc, rowIndex, colIndex)
  return TextSelection.near(doc.resolve(start + 1), 1).from
}

function lastCellEnd(doc: Node): number {
  const { node } = tableRange(doc)
  return cellTextEnd(doc, node.childCount - 1, node.lastChild!.childCount - 1)
}

function firstCellStart(doc: Node): number {
  return cellTextStart(doc, 0, 0)
}

describe('table exit keymap', () => {
  describe('ArrowDown at the end of a trailing table', () => {
    // doc: p("Intro") + table(2x2) — the table is the last block.
    const doc = makeDoc([schema.nodes.paragraph.create(null, schema.text('Intro')), makeTable(2, 2)])
    const caret = lastCellEnd(doc)

    it('inserts a paragraph after the table and moves the caret into it', () => {
      const { result, tr } = run(handleArrowDown, makeState(doc, caret))
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tr!.doc.childCount).toBe(3)
      expect(tr!.doc.child(2).type.name).toBe('paragraph')
      // The caret sits at the start of the new paragraph's content.
      const $head = tr!.selection.$head
      expect($head.parent.type.name).toBe('paragraph')
      expect($head.pos).toBe(tr!.doc.child(0).nodeSize + tr!.doc.child(1).nodeSize + 1)
    })

    it('keeps the table intact', () => {
      const { tr } = run(handleArrowDown, makeState(doc, caret))
      expect(tr!.doc.child(1).type.name).toBe('table')
      expect(tr!.doc.child(1).childCount).toBe(2)
    })
  })

  describe('ArrowDown at the end of a table followed by a paragraph', () => {
    const doc = makeDoc([
      schema.nodes.paragraph.create(null, schema.text('Intro')),
      makeTable(2, 2),
      schema.nodes.paragraph.create(null, schema.text('After')),
    ])
    const caret = lastCellEnd(doc)

    it('moves the caret into the following paragraph without inserting', () => {
      const { result, tr } = run(handleArrowDown, makeState(doc, caret))
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tr!.doc.childCount).toBe(3)
      expect(tr!.selection.$head.parent.type.name).toBe('paragraph')
      expect(tr!.selection.$head.parent.textContent).toBe('After')
    })
  })

  describe('ArrowDown at the end of a table followed by another table', () => {
    const doc = makeDoc([makeTable(1, 1), makeTable(1, 1)])
    // Caret at the end of the first table's only cell.
    const caret = cellTextEnd(doc, 0, 0)

    it('inserts a paragraph between the two tables', () => {
      const { result, tr } = run(handleArrowDown, makeState(doc, caret))
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tr!.doc.child(1).type.name).toBe('paragraph')
      expect(tr!.doc.child(2).type.name).toBe('table')
    })
  })

  describe('ArrowDown does not leave the table from an interior position', () => {
    it('stays inside the table when the caret is in the first row of a two-row table', () => {
      // Caret at the end of the last cell of the first row.
      const doc = makeDoc([makeTable(2, 2)])
      const endOfFirstRow = cellTextEnd(doc, 0, 1)
      const { result, tr } = run(handleArrowDown, makeState(doc, endOfFirstRow))
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })

    it('stays inside the table when the caret is at the end of a non-last cell of the last row', () => {
      // Caret at the end of the first cell (of two) in the last row.
      const doc = makeDoc([makeTable(2, 2)])
      const caret = cellTextEnd(doc, 1, 0)
      const { result, tr } = run(handleArrowDown, makeState(doc, caret))
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })

    it('does nothing when the caret is not in a table', () => {
      const doc = makeDoc([
        schema.nodes.paragraph.create(null, schema.text('Intro')),
        schema.nodes.paragraph.create(null, schema.text('After')),
      ])
      const { result, tr } = run(handleArrowDown, makeState(doc, doc.content.size - 1))
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })

    it('does nothing for a non-empty selection', () => {
      const doc = makeDoc([schema.nodes.paragraph.create(null, schema.text('Intro')), makeTable(2, 2)])
      const state = EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1, lastCellEnd(doc)),
      })
      const { result, tr } = run(handleArrowDown, state)
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })
  })

  describe('ArrowUp at the start of a leading table', () => {
    // doc: table(2x2) + p("After") — the table is the first block.
    const doc = makeDoc([makeTable(2, 2), schema.nodes.paragraph.create(null, schema.text('After'))])
    const caret = firstCellStart(doc)

    it('inserts a paragraph before the table and moves the caret into it', () => {
      const { result, tr } = run(handleArrowUp, makeState(doc, caret))
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tr!.doc.child(0).type.name).toBe('paragraph')
      expect(tr!.doc.child(1).type.name).toBe('table')
      // The caret sits at the start of the new paragraph's content.
      const $head = tr!.selection.$head
      expect($head.parent.type.name).toBe('paragraph')
      expect($head.parent.textContent).toBe('')
      expect($head.pos).toBe(1)
    })
  })

  describe('ArrowUp at the start of a table with a paragraph above', () => {
    const doc = makeDoc([
      schema.nodes.paragraph.create(null, schema.text('Intro')),
      makeTable(2, 2),
      schema.nodes.paragraph.create(null, schema.text('After')),
    ])
    const caret = firstCellStart(doc)

    it('moves the caret into the paragraph above without inserting', () => {
      const { result, tr } = run(handleArrowUp, makeState(doc, caret))
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tr!.doc.childCount).toBe(3)
      expect(tr!.selection.$head.parent.textContent).toBe('Intro')
    })
  })

  describe('ArrowUp does not leave the table from an interior position', () => {
    it('stays inside the table when the caret is in the last row of a two-row table', () => {
      const doc = makeDoc([makeTable(2, 2)])
      const caret = lastCellEnd(doc)
      const { result, tr } = run(handleArrowUp, makeState(doc, caret))
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })

    it('does nothing when the caret is not in a table', () => {
      const doc = makeDoc([
        schema.nodes.paragraph.create(null, schema.text('Intro')),
        schema.nodes.paragraph.create(null, schema.text('After')),
      ])
      const { result, tr } = run(handleArrowUp, makeState(doc, 1))
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })
  })
})
