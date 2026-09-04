import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from './RichTextEditor'

vi.mock('@/components/ui/calendar', () => ({ Calendar: () => null }))
vi.mock('react-day-picker', () => ({ DayPicker: () => null }))
vi.mock('react-day-picker/style.css', () => ({}))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => children,
  DialogContent: ({ children }: { children: React.ReactNode }) => children,
  DialogTitle: ({ children }: { children: React.ReactNode }) => children,
}))

const mockSetContent = vi.fn()
const mockFocus = vi.fn()
const mockDispatch = vi.fn()
const mockPosAtCoords = vi.fn<() => { pos: number } | null>(() => ({ pos: 1 }))
const mockSetSelection = vi.fn(() => 'transaction')
const { mockNear } = vi.hoisted(() => ({ mockNear: vi.fn(() => ({ from: 1 })) }))
let mockDocResolveParentIsTextblock = true

vi.mock('prosekit/pm/state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('prosekit/pm/state')>()
  return {
    ...actual,
    TextSelection: {
      ...actual.TextSelection,
      create: vi.fn(() => 'selection'),
      near: mockNear,
    },
  }
})

vi.mock('./ui/block-handle', () => ({ BlockHandle: () => null }))
vi.mock('./ui/table-handle', () => ({ TableHandle: () => null }))
vi.mock('./define-editor-extension', () => ({ defineEditorExtension: () => ({ mocked: true }) }))
vi.mock('./ui/drop-indicator', () => ({ DropIndicator: () => null }))
vi.mock('./ui/inline-menu', () => ({ InlineMenu: () => null }))
vi.mock('./ui/reference-menu/reference-menu', () => ({ default: () => null }))
vi.mock('./ui/slash-menu', () => ({ SlashMenu: () => null }))

vi.mock('prosekit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('prosekit/core')>()
  return {
    ...actual,
    createEditor: vi.fn(() => {
      const dom = document.createElement('div')
      return {
        setContent: mockSetContent,
        getDocHTML: vi.fn(() => '<p></p>'),
        view: {
          dom,
          dispatch: mockDispatch,
          focus: mockFocus,
          posAtCoords: mockPosAtCoords,
          state: {
            doc: {
              content: { size: 12 },
              resolve: vi.fn(() => ({
                parent: {
                  isTextblock: mockDocResolveParentIsTextblock,
                  type: { name: mockDocResolveParentIsTextblock ? 'paragraph' : 'codeBlock' },
                },
                depth: 1,
                index: vi.fn(() => 0),
              })),
            },
            selection: { anchor: 1, head: 1 },
            tr: { setSelection: mockSetSelection },
          },
        },
        commands: {},
        mount: vi.fn(),
      }
    }),
  }
})

vi.mock('prosekit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('prosekit/react')>()
  return {
    ...actual,
    ProseKit: ({ children }: { children: React.ReactNode }) => children,
    useDocChange: () => {},
  }
})

describe('RichTextEditor focus regression', () => {
  beforeEach(() => {
    mockSetContent.mockReset()
    mockFocus.mockReset()
    mockDispatch.mockReset()
    mockPosAtCoords.mockReset()
    mockPosAtCoords.mockReturnValue({ pos: 5 })
    mockSetSelection.mockReset()
    mockNear.mockReset()
    mockNear.mockReturnValue({ from: 1 })
    mockDocResolveParentIsTextblock = true
  })

  it('focuses synchronously on pointer down so slash/# keystrokes are not lost', () => {
    render(<RichTextEditor ariaLabel="Document body editor" onChange={vi.fn()} value="Initial" />)

    fireEvent.pointerDown(screen.getByLabelText('Document body editor'), {
      button: 0,
      clientX: 24,
      clientY: 24,
    })

    // Focus must be called synchronously, not solely deferred via
    // requestAnimationFrame, so that an immediate "/" or "# " keystroke after
    // the click lands in the editor. This is a regression guard for the
    // reported bug where slash/# required an extra Enter/new line to work.
    expect(mockFocus).toHaveBeenCalled()
  })

  it('places caret inside textblock on first click after opening a node', () => {
    const { rerender } = render(<RichTextEditor ariaLabel="Document body editor" onChange={vi.fn()} value="First doc" />)
    mockSetContent.mockClear()
    mockDispatch.mockClear()

    // Simulate opening a different node — value changes, editor does setContent
    rerender(<RichTextEditor ariaLabel="Document body editor" onChange={vi.fn()} value="Second doc with longer body" />)

    fireEvent.pointerDown(screen.getByLabelText('Document body editor'), {
      button: 0,
      clientX: 10,
      clientY: 10,
    })

    expect(mockDispatch).toHaveBeenCalled()
    expect(mockFocus).toHaveBeenCalled()
  })
})
