import { createRef } from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const textSelectionNearMock = vi.hoisted(() => vi.fn(() => 'selection'))

vi.mock('prosekit/pm/state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('prosekit/pm/state')>()

  return {
    ...actual,
    TextSelection: {
      ...actual.TextSelection,
      near: textSelectionNearMock,
    },
  }
})

const excalidrawMockState = vi.hoisted(() => ({
  latestOnChange: null as null | ((elements: unknown[], appState: unknown, files: unknown) => void),
  latestUpdateScene: vi.fn(),
}))

vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: ({
    excalidrawAPI,
    onChange,
  }: {
    excalidrawAPI?: (api: { updateScene: typeof excalidrawMockState.latestUpdateScene }) => void;
    onChange: (elements: unknown[], appState: unknown, files: unknown) => void;
  }) => {
    excalidrawMockState.latestOnChange = onChange
    excalidrawAPI?.({ updateScene: excalidrawMockState.latestUpdateScene })

    return (
      <button
        data-testid="excalidraw-editor-preview"
        onClick={() => onChange([{ id: 'drawn-element' }], { viewBackgroundColor: 'transparent' }, {})}
        type="button"
      >
        excalidraw
      </button>
    )
  },
}))

vi.mock('../../../MermaidDiagram', () => ({
  MermaidDiagram: ({ source }: { source: string }) => <div data-testid="mermaid-editor-preview">{source}</div>,
}))

vi.mock('../../../../lib/excalidraw', () => ({
  DEFAULT_EXCALIDRAW_HEIGHT: 384,
  clampExcalidrawHeight: (height: number) => height,
  parseExcalidrawSource: async (source: string) => ({
    status: source.trim() === '' ? 'empty' : 'ready',
    height: 512,
    initialData: { elements: [], appState: { viewBackgroundColor: 'transparent' }, files: {} },
    normalizedSource: source === '' ? '{"type":"excalidraw"}' : source,
  }),
  serializeExcalidrawScene: async (elements: Array<{ id: string }>) =>
    elements.length === 0 ? '{"type":"excalidraw"}' : '{"type":"excalidraw","elements":[{"id":"drawn-element"}]}',
  setExcalidrawSourceHeight: async () => '{"type":"excalidraw","flow":{"height":552}}',
}))

vi.mock('../../../LazyExcalidraw', () => {
  function MockLazyExcalidraw(props: Record<string, unknown>) {
    const { excalidrawAPI, onChange, ...rest } = props as {
      excalidrawAPI?: (api: { updateScene: typeof excalidrawMockState.latestUpdateScene }) => void;
      onChange?: (elements: unknown[], appState: unknown, files: unknown) => void;
    }
    excalidrawMockState.latestOnChange = onChange ?? null
    excalidrawAPI?.({ updateScene: excalidrawMockState.latestUpdateScene })
    return (
      <button
        data-testid="excalidraw-editor-preview"
        onClick={() => onChange?.([{ id: 'drawn-element' }], { viewBackgroundColor: 'transparent' }, {})}
        type="button"
      >
        excalidraw
      </button>
    )
  }
  return { LazyExcalidraw: MockLazyExcalidraw }
})

import CodeBlockView from './code-block-view'

function createViewMocks() {
  const dispatch = vi.fn()
  const focus = vi.fn()
  const transaction = {
    replaceWith: vi.fn(() => transaction),
    delete: vi.fn(() => transaction),
    setSelection: vi.fn(() => transaction),
    scrollIntoView: vi.fn(() => transaction),
    doc: {
      resolve: vi.fn(() => 'resolved-position'),
    },
  }

  return {
    dispatch,
    focus,
    transaction,
    view: {
      dispatch,
      focus,
      state: {
        schema: {
          text: vi.fn((value) => value),
          nodes: {
            paragraph: {
              createAndFill: vi.fn(() => ({ type: 'paragraph-node' })),
            },
          },
        },
        tr: transaction,
      },
    },
  }
}

describe('CodeBlockView', () => {
  beforeEach(() => {
    excalidrawMockState.latestOnChange = null
    excalidrawMockState.latestUpdateScene.mockClear()
    textSelectionNearMock.mockClear()
  })

  it('renders a Mermaid preview for mermaid code blocks', () => {
    const { view } = createViewMocks()

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'mermaid' }, nodeSize: 24, textContent: 'flowchart TD\nA-->B' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={view as never}
        getPos={vi.fn() as never}
      />,
    )

    expect(screen.queryByLabelText('Code block language')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Mermaid diagram source')).toHaveValue('flowchart TD\nA-->B')
    expect(screen.queryByText('Special section')).not.toBeInTheDocument()
    expect(screen.getByTestId('mermaid-editor-preview')).toHaveTextContent('flowchart TD')
    expect(screen.getByLabelText('Resize Mermaid diagram')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Mermaid diagram' })).toBeInTheDocument()
  })

  it('does not render a Mermaid preview for non-mermaid code blocks', () => {
    const { view } = createViewMocks()

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'typescript' }, nodeSize: 18, textContent: 'const value = 1' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={view as never}
        getPos={vi.fn() as never}
      />,
    )

    expect(screen.queryByTestId('mermaid-editor-preview')).not.toBeInTheDocument()
  })

  it('inserts a paragraph above a plain code block', () => {
    const { dispatch, focus, transaction, view } = createViewMocks()

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'typescript' }, nodeSize: 18, textContent: 'const value = 1' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={view as never}
        getPos={vi.fn(() => 3) as never}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Write above code block' }))

    expect(transaction.replaceWith).toHaveBeenCalledWith(3, 3, { type: 'paragraph-node' })
    expect(transaction.doc.resolve).toHaveBeenCalledWith(4)
    expect(textSelectionNearMock).toHaveBeenCalledWith('resolved-position', 1)
    expect(transaction.setSelection).toHaveBeenCalledWith('selection')
    expect(transaction.scrollIntoView).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('renders an Excalidraw editor for excalidraw code blocks', async () => {
    const { dispatch, focus, transaction, view } = createViewMocks()

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'excalidraw' }, nodeSize: 28, textContent: '{"type":"excalidraw"}' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={view as never}
        getPos={vi.fn(() => 1) as never}
      />,
    )

    expect(screen.queryByLabelText('Code block language')).not.toBeInTheDocument()
    expect(screen.getByTestId('excalidraw-editor-preview')).toBeInTheDocument()
    expect(screen.getByLabelText('Resize Excalidraw diagram')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Excalidraw diagram' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('excalidraw-editor-preview').parentElement).toHaveStyle({ height: '512px' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete Excalidraw diagram' }))

    expect(transaction.delete).toHaveBeenCalledWith(1, 29)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('does not overwrite an existing Excalidraw scene during initial sync', () => {
    const { dispatch, transaction, view } = createViewMocks()

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'excalidraw' }, nodeSize: 68, textContent: '{"type":"excalidraw","elements":[{"id":"persisted-element"}]}' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={view as never}
        getPos={vi.fn(() => 1) as never}
      />,
    )

    excalidrawMockState.latestOnChange?.([], { viewBackgroundColor: 'transparent' }, {})

    expect(transaction.replaceWith).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('persists the first non-empty Excalidraw scene change without outer-shell interaction capture', async () => {
    const { dispatch, transaction, view } = createViewMocks()

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'excalidraw' }, nodeSize: 28, textContent: '{"type":"excalidraw"}' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={view as never}
        getPos={vi.fn(() => 1) as never}
      />,
    )

    excalidrawMockState.latestOnChange?.([{ id: 'drawn-element' }], { viewBackgroundColor: 'transparent' }, {})

    await waitFor(() => {
      expect(transaction.replaceWith).toHaveBeenCalledWith(2, expect.any(Number), '{"type":"excalidraw","elements":[{"id":"drawn-element"}]}')
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('persists Excalidraw scene changes after interaction', async () => {
    const user = userEvent.setup()
    const { dispatch, transaction, view } = createViewMocks()

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'excalidraw' }, nodeSize: 28, textContent: '{"type":"excalidraw"}' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={view as never}
        getPos={vi.fn(() => 1) as never}
      />,
    )

    await user.click(screen.getByTestId('excalidraw-editor-preview'))

    expect(transaction.replaceWith).toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalled()
  })

  it('does not push the same Excalidraw scene back into the canvas after a local edit rerenders', async () => {
    const user = userEvent.setup()
    const { dispatch, transaction, view } = createViewMocks()

    const rendered = render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'excalidraw' }, nodeSize: 28, textContent: '{"type":"excalidraw"}' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={view as never}
        getPos={vi.fn(() => 1) as never}
      />,
    )

    await waitFor(() => {
      expect(excalidrawMockState.latestUpdateScene).toHaveBeenCalledTimes(1)
    })

    await user.click(screen.getByTestId('excalidraw-editor-preview'))

    await waitFor(() => {
      expect(transaction.replaceWith).toHaveBeenCalled()
    })
    expect(dispatch).toHaveBeenCalled()

    rendered.rerender(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'excalidraw' }, nodeSize: 64, textContent: '{"type":"excalidraw","elements":[{"id":"drawn-element"}]}' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={view as never}
        getPos={vi.fn(() => 1) as never}
      />,
    )

    expect(excalidrawMockState.latestUpdateScene).toHaveBeenCalledTimes(1)
  })

  it('persists a resized Excalidraw editor height', async () => {
    const { dispatch, transaction, view } = createViewMocks()

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'excalidraw' }, nodeSize: 28, textContent: '{"type":"excalidraw"}' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={view as never}
        getPos={vi.fn(() => 1) as never}
      />,
    )

    const handle = screen.getByLabelText('Resize Excalidraw diagram')
    fireEvent.pointerDown(handle, { clientY: 100 })
    fireEvent.pointerMove(window, { clientY: 140 })
    fireEvent.pointerUp(window, { clientY: 140 })

    await waitFor(() => {
      expect(transaction.replaceWith).toHaveBeenCalled()
    })
    expect(dispatch).toHaveBeenCalled()
  })

  it('deletes a Mermaid code block from the document', () => {
    const { dispatch, focus, transaction, view } = createViewMocks()

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'mermaid' }, nodeSize: 20, textContent: 'flowchart TD\nA-->B' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={view as never}
        getPos={vi.fn(() => 4) as never}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete Mermaid diagram' }))

    expect(transaction.delete).toHaveBeenCalledWith(4, 24)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('inserts a paragraph above a Mermaid diagram block', () => {
    const { dispatch, focus, transaction, view } = createViewMocks()

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'mermaid' }, nodeSize: 20, textContent: 'flowchart TD\nA-->B' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={view as never}
        getPos={vi.fn(() => 6) as never}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Write above code block' }))

    expect(transaction.replaceWith).toHaveBeenCalledWith(6, 6, { type: 'paragraph-node' })
    expect(transaction.doc.resolve).toHaveBeenCalledWith(7)
    expect(textSelectionNearMock).toHaveBeenCalledWith('resolved-position', 1)
    expect(transaction.setSelection).toHaveBeenCalledWith('selection')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledTimes(1)
  })
})