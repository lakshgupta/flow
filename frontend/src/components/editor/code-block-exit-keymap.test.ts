import { describe, expect, it } from 'vitest'
import { Schema, type Node } from 'prosekit/pm/model'
import { EditorState, TextSelection, type Command, type Transaction } from 'prosekit/pm/state'
import type { EditorView } from 'prosekit/pm/view'

import {
  deleteExcalidrawSection,
  handleArrowDown,
  handleArrowUp,
  moveCaretToDiagramEndOnArrowRight,
  moveCaretToDiagramStartOnArrowLeft,
  moveDiagramUpOnBackspace,
} from './code-block-exit-keymap'

const SOURCE = 'flowchart TD\n  A --> B'

// Mirrors the editor's schema (prosekit/extensions/code-block): codeBlock is a
// textblock with a `language` attribute and `spec.code === true`.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    codeBlock: {
      group: 'block',
      content: 'text*',
      code: true,
      defining: true,
      marks: '',
      attrs: { language: { default: '' } },
    },
    text: { group: 'inline' },
  },
})

// doc: p("Intro") + p("") + codeBlock(mermaid, SOURCE) + p("After")
function makeDocWithGap() {
  const para = schema.nodes.paragraph.create(null, schema.text('Intro'))
  const empty = schema.nodes.paragraph.create(null)
  const code = schema.nodes.codeBlock.create({ language: 'mermaid' }, schema.text(SOURCE))
  const after = schema.nodes.paragraph.create(null, schema.text('After'))
  return schema.nodes.doc.create(null, [para, empty, code, after])
}

// doc: p("Intro") + codeBlock(mermaid, SOURCE) + p("After")
function makeDocNoGap() {
  const para = schema.nodes.paragraph.create(null, schema.text('Intro'))
  const code = schema.nodes.codeBlock.create({ language: 'mermaid' }, schema.text(SOURCE))
  const after = schema.nodes.paragraph.create(null, schema.text('After'))
  return schema.nodes.doc.create(null, [para, code, after])
}

// The diagram source content range [start, end] inside the document. `start`
// is the first character position of the source, `end` the position right
// after its last character.
function diagramSourceRange(doc: Node): { start: number; end: number } {
  let range: { start: number; end: number } | null = null
  doc.forEach((node, offset) => {
    if (node.type.spec.code === true && node.attrs.language === 'mermaid') {
      range = { start: offset + 1, end: offset + node.nodeSize - 1 }
    }
  })
  if (range === null) {
    throw new Error('test document has no mermaid diagram')
  }
  return range
}

function makeState(doc: Node, pos: number): EditorState {
  return EditorState.create({ doc, selection: TextSelection.create(doc, pos, pos) })
}

// A minimal view whose domAtPos reports a diagram source wrapper that is
// either collapsed (hidden class) or open. Only the collapse-detection code
// path touches it.
function fakeView(collapsed: boolean): EditorView {
  const source = document.createElement('div')
  source.className = 'flow-diagram-block-source'
  if (collapsed) {
    source.classList.add('hidden')
  }
  return { domAtPos: () => ({ node: source, offset: 0 }) } as unknown as EditorView
}

function run(cmd: Command, state: EditorState, collapsed: boolean): { result: boolean; tr: Transaction | null } {
  let tr: Transaction | null = null
  const result = cmd(state, (transaction) => {
    tr = transaction
  }, fakeView(collapsed))
  return { result, tr }
}

const EXCALIDRAW_SCENE = '{"type":"excalidraw","version":2,"source":"https://excalidraw.com","flowTitle":"","elements":[],"appState":{},"files":{}}'

// doc: p("Intro") + codeBlock(excalidraw, SCENE) + p("After")
function makeExcalidrawDoc() {
  const para = schema.nodes.paragraph.create(null, schema.text('Intro'))
  const code = schema.nodes.codeBlock.create({ language: 'excalidraw' }, schema.text(EXCALIDRAW_SCENE))
  const after = schema.nodes.paragraph.create(null, schema.text('After'))
  return schema.nodes.doc.create(null, [para, code, after])
}

function excalidrawSourceRange(doc: Node): { start: number; end: number } {
  let range: { start: number; end: number } | null = null
  doc.forEach((node, offset) => {
    if (node.type.spec.code === true && node.attrs.language === 'excalidraw') {
      range = { start: offset + 1, end: offset + node.nodeSize - 1 }
    }
  })
  if (range === null) {
    throw new Error('test document has no excalidraw section')
  }
  return range
}

// A view whose domAtPos has no source editor wrapper — excalidraw sections
// have no visible source, so the keymap treats them as always collapsed.
function fakeViewNoSource(): EditorView {
  return { domAtPos: () => ({ node: document.createElement('div'), offset: 0 }) } as unknown as EditorView
}

describe('excalidraw section keymap', () => {
  const doc = makeExcalidrawDoc()
  const { start, end } = excalidrawSourceRange(doc)

  it('ArrowDown from the paragraph above lands at the start of the hidden scene text', () => {
    const caret = doc.child(0).nodeSize - 1
    const { result, tr } = run(handleArrowDown, makeState(doc, caret), true)
    expect(result).toBe(true)
    expect(tr!.selection.$head.pos).toBe(start)
  })

  it('ArrowUp from the paragraph below lands at the end of the hidden scene text', () => {
    const caret = doc.content.size - 1
    const { result, tr } = run(handleArrowUp, makeState(doc, caret), true)
    expect(result).toBe(true)
    expect(tr!.selection.$head.pos).toBe(end)
  })

  it('Backspace at the left edge of the section deletes the whole section', () => {
    const { result, tr } = run(deleteExcalidrawSection, makeState(doc, start), true)
    expect(result).toBe(true)
    expect(tr).not.toBeNull()
    const types = tr!.doc.content.content.map((child) => child.type.name)
    expect(types).toEqual(['paragraph', 'paragraph'])
    expect(tr!.doc.content.child(0).textContent).toBe('Intro')
    expect(tr!.doc.content.child(1).textContent).toBe('After')
  })

  it('Delete at the right edge of the section deletes the whole section', () => {
    const { result, tr } = run(deleteExcalidrawSection, makeState(doc, end), true)
    expect(result).toBe(true)
    const types = tr!.doc.content.content.map((child) => child.type.name)
    expect(types).toEqual(['paragraph', 'paragraph'])
  })

  it('Delete at the end of the paragraph above the section deletes the section', () => {
    const caret = doc.child(0).nodeSize - 1
    const { result, tr } = run(deleteExcalidrawSection, makeState(doc, caret), true)
    expect(result).toBe(true)
    const types = tr!.doc.content.content.map((child) => child.type.name)
    expect(types).toEqual(['paragraph', 'paragraph'])
  })

  it('Backspace at the start of the paragraph below the section deletes the section', () => {
    const boundary = doc.child(0).nodeSize + doc.child(1).nodeSize
    // Mirror the editor's navigation: the caret normalizes into the following
    // paragraph (TextSelection.near with bias 1).
    const state = EditorState.create({ doc, selection: TextSelection.near(doc.resolve(boundary), 1) })
    const { result, tr } = run(deleteExcalidrawSection, state, true)
    expect(result).toBe(true)
    const types = tr!.doc.content.content.map((child) => child.type.name)
    expect(types).toEqual(['paragraph', 'paragraph'])
  })

  it('does not delete when the caret is inside the scene text away from the edges', () => {
    const middle = Math.floor((start + end) / 2)
    const { result, tr } = run(deleteExcalidrawSection, makeState(doc, middle), true)
    expect(result).toBe(false)
    expect(tr).toBeNull()
  })

  it('Backspace keeps mermaid behavior and does not delete the mermaid section', () => {
    const mermaidDoc = makeDocWithGap()
    const sourceStart = diagramSourceRange(mermaidDoc).start
    const { result, tr } = run(moveDiagramUpOnBackspace, makeState(mermaidDoc, sourceStart), true)
    expect(result).toBe(true)
    // The empty paragraph above is removed, the mermaid section stays.
    expect(tr!.doc.content.content.map((child) => child.type.name)).toEqual(['paragraph', 'codeBlock', 'paragraph'])
  })
})

describe('mermaid diagram navigation keymap', () => {
  describe('ArrowUp from the paragraph below', () => {
    const doc = makeDocWithGap()
    // Caret at the end of the paragraph below the diagram.
    const caret = doc.content.size - 1
    const sourceEnd = diagramSourceRange(doc).end

    it('lands the caret at the end of the source when the source editor is open', () => {
      const { result, tr } = run(handleArrowUp, makeState(doc, caret), false)
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tr!.selection.$head.pos).toBe(sourceEnd)
    })

    it('lands the caret at the end of the source when the source editor is collapsed', () => {
      const { result, tr } = run(handleArrowUp, makeState(doc, caret), true)
      expect(result).toBe(true)
      expect(tr!.selection.$head.pos).toBe(sourceEnd)
    })

    it('falls through when there is no diagram above', () => {
      const plainDoc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Intro')),
        schema.nodes.paragraph.create(null, schema.text('After')),
      ])
      const { result, tr } = run(handleArrowUp, makeState(plainDoc, plainDoc.content.size - 1), false)
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })
  })

  describe('ArrowDown from the paragraph above', () => {
    const doc = makeDocNoGap()
    // Caret at the end of the paragraph right above the diagram.
    const caret = doc.child(0).nodeSize - 1
    const sourceStart = diagramSourceRange(doc).start

    it('lands the caret at the start of the source when the source editor is open', () => {
      const { result, tr } = run(handleArrowDown, makeState(doc, caret), false)
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      expect(tr!.selection.$head.pos).toBe(sourceStart)
    })

    it('lands the caret at the start of the source when the source editor is collapsed', () => {
      const { result, tr } = run(handleArrowDown, makeState(doc, caret), true)
      expect(result).toBe(true)
      expect(tr!.selection.$head.pos).toBe(sourceStart)
    })

    it('falls through without crashing when there is no block below', () => {
      const plainDoc = schema.nodes.doc.create(null, [
        schema.nodes.paragraph.create(null, schema.text('Intro')),
        schema.nodes.paragraph.create(null, schema.text('Last')),
      ])
      const { result, tr } = run(handleArrowDown, makeState(plainDoc, plainDoc.content.size - 1), false)
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })
  })

  describe('Backspace at the start of the source', () => {
    const doc = makeDocWithGap()
    const sourceStart = diagramSourceRange(doc).start

    it('deletes the block above, moving the section up, when the source is open', () => {
      const { result, tr } = run(moveDiagramUpOnBackspace, makeState(doc, sourceStart), false)
      expect(result).toBe(true)
      expect(tr).not.toBeNull()
      // The empty paragraph between Intro and the diagram is removed.
      expect(tr!.doc.child(0).type.name).toBe('paragraph')
      expect(tr!.doc.child(1).type.name).toBe('codeBlock')
      // The caret lands at the new start of the source.
      expect(tr!.selection.$head.pos).toBe(diagramSourceRange(tr!.doc).start)
    })

    it('deletes the block above when the source is collapsed', () => {
      const { result, tr } = run(moveDiagramUpOnBackspace, makeState(doc, sourceStart), true)
      expect(result).toBe(true)
      expect(tr!.doc.child(1).type.name).toBe('codeBlock')
    })

    it('does nothing when the diagram is the first block', () => {
      const leadingDoc = schema.nodes.doc.create(null, [
        schema.nodes.codeBlock.create({ language: 'mermaid' }, schema.text(SOURCE)),
        schema.nodes.paragraph.create(null, schema.text('After')),
      ])
      const { result, tr } = run(moveDiagramUpOnBackspace, makeState(leadingDoc, diagramSourceRange(leadingDoc).start), false)
      expect(result).toBe(false)
      expect(tr).toBeNull()
    })
  })

  describe('edge jumps are collapsed-only', () => {
    const doc = makeDocWithGap()
    const { start, end } = diagramSourceRange(doc)

    describe('ArrowRight at the start of the source', () => {
      it('jumps to the end of the source when collapsed', () => {
        const { result, tr } = run(moveCaretToDiagramEndOnArrowRight, makeState(doc, start), true)
        expect(result).toBe(true)
        expect(tr!.selection.$head.pos).toBe(end)
      })

      it('does not jump when the source editor is open', () => {
        const { result, tr } = run(moveCaretToDiagramEndOnArrowRight, makeState(doc, start), false)
        expect(result).toBe(false)
        expect(tr).toBeNull()
      })
    })

    describe('ArrowLeft at the end of the source', () => {
      it('jumps to the start of the source when collapsed', () => {
        const { result, tr } = run(moveCaretToDiagramStartOnArrowLeft, makeState(doc, end), true)
        expect(result).toBe(true)
        expect(tr!.selection.$head.pos).toBe(start)
      })

      it('does not jump when the source editor is open', () => {
        const { result, tr } = run(moveCaretToDiagramStartOnArrowLeft, makeState(doc, end), false)
        expect(result).toBe(false)
        expect(tr).toBeNull()
      })
    })
  })
})
