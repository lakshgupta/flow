import { createRef } from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../MermaidDiagram', () => ({
  MermaidDiagram: ({ source }: { source: string }) => <div data-testid="mermaid-editor-preview">{source}</div>,
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
})