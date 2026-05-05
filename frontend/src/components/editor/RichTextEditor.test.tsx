import { act, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from './RichTextEditor'
import { editorHTMLToMarkdown } from '../../richText'

const mockSetContent = vi.fn()
const mockGetDocHTML = vi.fn()
const mockFocus = vi.fn()
const mockInsertText = vi.fn()
let capturedDocChange: (() => void) | null = null
let mockEditorViewDOMHTML = ''

vi.mock('./ui/block-handle', () => ({
  BlockHandle: () => null,
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

      return {
        setContent: mockSetContent,
        getDocHTML: mockGetDocHTML,
        view: {
          dom,
          focus: mockFocus,
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
    mockSetContent.mockReset()
    mockGetDocHTML.mockReset()
    mockFocus.mockReset()
    mockInsertText.mockReset()
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
})