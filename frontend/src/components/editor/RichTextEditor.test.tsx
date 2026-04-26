import { act, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from './RichTextEditor'

const mockSetContent = vi.fn()
const mockGetDocHTML = vi.fn()
const mockFocus = vi.fn()
const mockInsertText = vi.fn()
let capturedDocChange: (() => void) | null = null

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
    createEditor: vi.fn(() => ({
      setContent: mockSetContent,
      getDocHTML: mockGetDocHTML,
      view: {
        dom: document.createElement('div'),
        focus: mockFocus,
      },
      commands: {
        insertText: mockInsertText,
      },
      mount: vi.fn(),
    })),
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
})