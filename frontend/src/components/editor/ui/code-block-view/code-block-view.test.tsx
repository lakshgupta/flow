import { createRef } from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const excalidrawMockState = vi.hoisted(() => ({
  latestOnChange: null as null | ((elements: unknown[], appState: unknown, files: unknown) => void),
}))

vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: ({ onChange }: { onChange: (elements: unknown[], appState: unknown, files: unknown) => void }) => {
    excalidrawMockState.latestOnChange = onChange

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
  parseExcalidrawSource: (source: string) => ({
    status: source.trim() === '' ? 'empty' : 'ready',
    height: 512,
    initialData: { elements: [], appState: { viewBackgroundColor: 'transparent' }, files: {} },
    normalizedSource: source === '' ? '{"type":"excalidraw"}' : source,
  }),
  serializeExcalidrawScene: (elements: Array<{ id: string }>) =>
    elements.length === 0 ? '{"type":"excalidraw"}' : '{"type":"excalidraw","elements":[{"id":"drawn-element"}]}',
  setExcalidrawSourceHeight: () => '{"type":"excalidraw","flow":{"height":552}}',
}))

import CodeBlockView from './code-block-view'

describe('CodeBlockView', () => {
  it('renders a Mermaid preview for mermaid code blocks', () => {
    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'mermaid' }, textContent: 'flowchart TD\nA-->B' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={null as never}
        getPos={vi.fn() as never}
      />,
    )

    expect(screen.getByLabelText('Code block language')).toHaveValue('mermaid')
    expect(screen.getByLabelText('Mermaid diagram source')).toHaveValue('flowchart TD\nA-->B')
    expect(screen.queryByText('Special section')).not.toBeInTheDocument()
    expect(screen.getByTestId('mermaid-editor-preview')).toHaveTextContent('flowchart TD')
  })

  it('does not render a Mermaid preview for non-mermaid code blocks', () => {
    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'typescript' }, textContent: 'const value = 1' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={null as never}
        getPos={vi.fn() as never}
      />,
    )

    expect(screen.queryByTestId('mermaid-editor-preview')).not.toBeInTheDocument()
  })

  it('renders an Excalidraw editor for excalidraw code blocks', () => {
    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'excalidraw' }, textContent: '{"type":"excalidraw"}' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={{ dispatch: vi.fn(), state: { schema: { text: vi.fn() }, tr: { replaceWith: vi.fn(), delete: vi.fn() } } } as never}
        getPos={vi.fn(() => 1) as never}
      />,
    )

    expect(screen.getByLabelText('Code block language')).toHaveValue('excalidraw')
    expect(screen.getByTestId('excalidraw-editor-preview')).toBeInTheDocument()
    expect(screen.getByLabelText('Resize Excalidraw diagram')).toBeInTheDocument()
    expect(screen.getByTestId('excalidraw-editor-preview').parentElement).toHaveStyle({ height: '512px' })
  })

  it('does not overwrite an existing Excalidraw scene during initial sync', () => {
    const dispatch = vi.fn()
    const transaction = {
      replaceWith: vi.fn(() => transaction),
      delete: vi.fn(() => transaction),
    }

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'excalidraw' }, textContent: '{"type":"excalidraw","elements":[{"id":"persisted-element"}]}' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={{ dispatch, state: { schema: { text: vi.fn(() => 'text-node') }, tr: transaction } } as never}
        getPos={vi.fn(() => 1) as never}
      />,
    )

    excalidrawMockState.latestOnChange?.([], { viewBackgroundColor: 'transparent' }, {})

    expect(transaction.replaceWith).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('persists the first non-empty Excalidraw scene change without outer-shell interaction capture', () => {
    const dispatch = vi.fn()
    const transaction = {
      replaceWith: vi.fn(() => transaction),
      delete: vi.fn(() => transaction),
    }

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'excalidraw' }, textContent: '{"type":"excalidraw"}' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={{ dispatch, state: { schema: { text: vi.fn((value) => value) }, tr: transaction } } as never}
        getPos={vi.fn(() => 1) as never}
      />,
    )

    excalidrawMockState.latestOnChange?.([{ id: 'drawn-element' }], { viewBackgroundColor: 'transparent' }, {})

    expect(transaction.replaceWith).toHaveBeenCalledWith(2, expect.any(Number), '{"type":"excalidraw","elements":[{"id":"drawn-element"}]}')
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('persists Excalidraw scene changes after interaction', async () => {
    const user = userEvent.setup()
    const dispatch = vi.fn()
    const transaction = {
      replaceWith: vi.fn(() => transaction),
      delete: vi.fn(() => transaction),
    }

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'excalidraw' }, textContent: '{"type":"excalidraw"}' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={{ dispatch, state: { schema: { text: vi.fn(() => 'text-node') }, tr: transaction } } as never}
        getPos={vi.fn(() => 1) as never}
      />,
    )

    await user.click(screen.getByTestId('excalidraw-editor-preview'))

    expect(transaction.replaceWith).toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalled()
  })

  it('persists a resized Excalidraw editor height', () => {
    const dispatch = vi.fn()
    const transaction = {
      replaceWith: vi.fn(() => transaction),
      delete: vi.fn(() => transaction),
    }

    render(
      <CodeBlockView
        contentRef={createRef<HTMLPreElement>()}
        node={{ attrs: { language: 'excalidraw' }, textContent: '{"type":"excalidraw"}' } as never}
        selected={false}
        setAttrs={vi.fn()}
        view={{ dispatch, state: { schema: { text: vi.fn(() => 'text-node') }, tr: transaction } } as never}
        getPos={vi.fn(() => 1) as never}
      />,
    )

    const handle = screen.getByLabelText('Resize Excalidraw diagram')
    fireEvent.pointerDown(handle, { clientY: 100 })
    fireEvent.pointerMove(window, { clientY: 140 })
    fireEvent.pointerUp(window, { clientY: 140 })

    expect(transaction.replaceWith).toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalled()
  })
})