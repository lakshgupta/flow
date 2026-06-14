import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from './RichTextEditor'
import { editorHTMLToMarkdown } from '../../richText'

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => null,
}))

vi.mock('react-day-picker', () => ({
  DayPicker: () => null,
}))

vi.mock('react-day-picker/style.css', () => ({}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => children,
  DialogContent: ({ children }: { children: ReactNode }) => children,
  DialogTitle: ({ children }: { children: ReactNode }) => children,
}))

const mockSetContent = vi.fn()
const mockGetDocHTML = vi.fn()
const mockFocus = vi.fn()
const mockInsertText = vi.fn()
const mockDispatch = vi.fn()
const mockPosAtCoords = vi.fn(() => ({ pos: 1 }))
const mockSetSelection = vi.fn(() => 'transaction')
let capturedDocChange: (() => void) | null = null
let mockEditorViewDOMHTML = ''
let latestMockEditorState: { doc: { content?: { size?: number } }; selection?: { anchor: number; head: number }; tr: { setSelection: typeof mockSetSelection } } | null = null

vi.mock('prosekit/pm/state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('prosekit/pm/state')>()

  return {
    ...actual,
    TextSelection: {
      ...actual.TextSelection,
      create: vi.fn(() => 'selection'),
    },
  }
})

vi.mock('./ui/block-handle', () => ({
  BlockHandle: () => null,
}))

vi.mock('./define-editor-extension', () => ({
  defineEditorExtension: () => ({ mocked: true }),
}))

vi.mock('./ui/drop-indicator', () => ({
  DropIndicator: () => null,
}))

vi.mock('./ui/inline-menu', () => ({
  InlineMenu: () => null,
}))

vi.mock('./ui/reference-menu/reference-menu', () => ({
  default: () => null,
}))

vi.mock('./ui/slash-menu', () => ({
  SlashMenu: () => null,
}))

vi.mock('prosekit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('prosekit/core')>()

  return {
    ...actual,
    createEditor: vi.fn(() => {
      const dom = document.createElement('div')
      dom.innerHTML = mockEditorViewDOMHTML
        const state = {
          doc: { content: { size: 12 } },
          selection: { anchor: 1, head: 1 },
          tr: {
            setSelection: mockSetSelection,
          },
        }
        latestMockEditorState = state

      return {
        setContent: mockSetContent,
        getDocHTML: mockGetDocHTML,
        view: {
          dom,
          dispatch: mockDispatch,
          focus: mockFocus,
          posAtCoords: mockPosAtCoords,
            state,
        },
        commands: {
          insertText: mockInsertText,
        },
        mount: vi.fn(),
      }
    }),
  }
})

vi.mock('prosekit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('prosekit/react')>()

  return {
    ...actual,
    ProseKit: ({ children }: { children: ReactNode }) => children,
    useDocChange: (callback: () => void) => {
      capturedDocChange = callback
    },
  }
})

describe('RichTextEditor', () => {
  beforeEach(() => {
    capturedDocChange = null
    mockEditorViewDOMHTML = ''
    latestMockEditorState = null
    mockSetContent.mockReset()
    mockGetDocHTML.mockReset()
    mockFocus.mockReset()
    mockInsertText.mockReset()
    mockDispatch.mockReset()
    mockPosAtCoords.mockReset()
    mockPosAtCoords.mockReturnValue({ pos: 1 })
    mockSetSelection.mockReset()
    mockSetSelection.mockReturnValue('transaction')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('does not reset editor content when the parent echoes a local change', () => {
    mockGetDocHTML.mockReturnValue('<p>Hello world</p>')
    const handleChange = vi.fn()

    const { rerender } = render(
      <RichTextEditor
        ariaLabel="Document body editor"
        onChange={handleChange}
        value=""
      />,
    )

    mockSetContent.mockClear()

    act(() => {
      capturedDocChange?.()
    })

    expect(handleChange).toHaveBeenCalledTimes(1)
    const emittedMarkdown = handleChange.mock.calls[0]?.[0]

    rerender(
      <RichTextEditor
        ariaLabel="Document body editor"
        onChange={handleChange}
        value={emittedMarkdown}
      />,
    )

    expect(mockSetContent).not.toHaveBeenCalled()
  })

  it('resets editor content when inline reference rendering changes externally', () => {
    const handleChange = vi.fn()
    const inlineReferences = [
      {
        token: '[[note-2]]',
        raw: 'note-2',
        targetId: 'note-2',
        targetType: 'note',
        targetGraph: 'execution',
        targetTitle: 'Follow-up',
        targetPath: 'data/content/execution/follow-up.md',
        targetBreadcrumb: 'execution > Follow-up',
      },
    ]

    const { rerender } = render(
      <RichTextEditor
        ariaLabel="Document body editor"
        onChange={handleChange}
        value={'See [[note-2]]'}
      />,
    )

    mockSetContent.mockClear()

    rerender(
      <RichTextEditor
        ariaLabel="Document body editor"
        inlineReferences={inlineReferences}
        onChange={handleChange}
        value={'See [[note-2]]'}
      />,
    )

    expect(mockSetContent).toHaveBeenCalledTimes(1)
  })

  it('preserves the current selection when external content sync updates the editor', () => {
    const handleChange = vi.fn()

    const { rerender } = render(
      <RichTextEditor
        ariaLabel="Document body editor"
        onChange={handleChange}
        value="Original"
      />,
    )

    mockSetSelection.mockClear()
    mockDispatch.mockClear()

    if (latestMockEditorState === null) {
      throw new Error('missing mocked editor state')
    }

    latestMockEditorState.selection = { anchor: 5, head: 5 }
    latestMockEditorState.doc = { content: { size: 12 } }

    rerender(
      <RichTextEditor
        ariaLabel="Document body editor"
        onChange={handleChange}
        value="Updated"
      />,
    )

    expect(mockSetContent).toHaveBeenCalled()
    expect(mockSetSelection).toHaveBeenCalledWith('selection')
    expect(mockDispatch).toHaveBeenCalledWith('transaction')
  })

  it('resets editor content when inline reference details change on the same array instance', () => {
    const handleChange = vi.fn()
    const inlineReferences: Array<{
      token: string
      raw: string
      targetId: string
      targetType: 'note'
      targetGraph: string
      targetTitle: string
      targetPath: string
      targetBreadcrumb: string
    }> = []

    const { rerender } = render(
      <RichTextEditor
        ariaLabel="Document body editor"
        inlineReferences={inlineReferences}
        onChange={handleChange}
        value={'See [[note-2]]'}
      />,
    )

    mockSetContent.mockClear()

    inlineReferences.push({
      token: '[[note-2]]',
      raw: 'note-2',
      targetId: 'note-2',
      targetType: 'note',
      targetGraph: 'execution',
      targetTitle: 'Follow-up',
      targetPath: 'data/content/execution/follow-up.md',
      targetBreadcrumb: 'execution > Follow-up',
    })

    rerender(
      <RichTextEditor
        ariaLabel="Document body editor"
        inlineReferences={inlineReferences}
        onChange={handleChange}
        value={'See [[note-2]]'}
      />,
    )

    expect(mockSetContent).toHaveBeenCalledTimes(1)
  })

  it('exports markdown from canonical document HTML even when live editor DOM includes decorations', () => {
    const nestedListHTML = '<ul><li><p>Parent</p><ul><li><p>Child</p></li></ul></li></ul>'
    mockGetDocHTML.mockReturnValue(nestedListHTML)
    mockEditorViewDOMHTML = '<ul><li><p>Parent</p></li></ul><div class="prosekit-widget">widget decoration</div>'

    const handle = { current: null as null | { getMarkdown: () => string } }
    render(
      <RichTextEditor
        ref={handle}
        ariaLabel="Document body editor"
        onChange={vi.fn()}
        value=""
      />,
    )

    const markdown = handle.current?.getMarkdown() ?? ''
    const expected = editorHTMLToMarkdown(nestedListHTML)

    expect(markdown).toBe(expected)
    expect(markdown).toContain('Child')
  })

  it('re-establishes a selection on first pointer down after external content sync', () => {
    const { rerender } = render(
      <RichTextEditor
        ariaLabel="Document body editor"
        onChange={vi.fn()}
        value="Original"
      />,
    )

    rerender(
      <RichTextEditor
        ariaLabel="Document body editor"
        onChange={vi.fn()}
        value="Updated"
      />,
    )

    fireEvent.pointerDown(screen.getByLabelText('Document body editor'), {
      button: 0,
      clientX: 24,
      clientY: 24,
    })

    expect(mockSetSelection).toHaveBeenCalled()
    expect(mockDispatch).toHaveBeenCalledWith('transaction')
  })

  it('falls back to a valid selection when pointer coordinates cannot be resolved', () => {
    mockPosAtCoords.mockReturnValue(null)

    render(
      <RichTextEditor
        ariaLabel="Document body editor"
        onChange={vi.fn()}
        value=""
      />,
    )

    fireEvent.pointerDown(screen.getByLabelText('Document body editor'), {
      button: 0,
      clientX: 4,
      clientY: 4,
    })

    expect(mockSetSelection).toHaveBeenCalled()
    expect(mockDispatch).toHaveBeenCalledWith('transaction')
  })

})