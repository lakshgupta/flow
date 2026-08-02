import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { RichTextEditor, type RichTextEditorHandle } from './RichTextEditor'

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => null,
}))

vi.mock('react-day-picker', () => ({
  DayPicker: () => null,
}))

vi.mock('react-day-picker/style.css', () => ({}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => children,
  DialogContent: ({ children }: { children: React.ReactNode }) => children,
  DialogTitle: ({ children }: { children: React.ReactNode }) => children,
}))

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

describe('RichTextEditor markdown shortcuts', () => {
  it('renders an atx heading as a heading element while typing', async () => {
    const user = userEvent.setup()

    render(
      <RichTextEditor
        ariaLabel="Document body editor"
        onChange={vi.fn()}
        value=""
      />,
    )

    const editor = screen.getByLabelText('Document body editor')
    await user.click(editor)
    await user.type(editor, '# Heading')

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Heading' })).toBeInTheDocument()
    })
  })

  it('returns to normal text after pressing Enter at the end of a heading', async () => {
    const user = userEvent.setup()

    render(
      <RichTextEditor
        ariaLabel="Document body editor"
        onChange={vi.fn()}
        value=""
      />,
    )

    const editor = screen.getByLabelText('Document body editor')
    await user.click(editor)
    await user.type(editor, '# Heading')
    await user.keyboard('{Enter}')
    await user.type(editor, 'Normal text')

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Heading' })).toBeInTheDocument()
      expect(editor.querySelector('p')).toHaveTextContent('Normal text')
      expect(editor.querySelectorAll('h1')).toHaveLength(1)
    })
  })

  it('renders markdown strikethrough without leaving literal tildes behind', async () => {
    const user = userEvent.setup()

    render(
      <RichTextEditor
        ariaLabel="Document body editor"
        onChange={vi.fn()}
        value=""
      />,
    )

    const editor = screen.getByLabelText('Document body editor')
    await user.click(editor)
    await user.type(editor, '~~retire me~~')

    await waitFor(() => {
      const strike = editor.querySelector('s, strike, del')
      expect(strike?.textContent).toBe('retire me')
      expect(editor.textContent).not.toContain('~~')
    })
  })

  it('moves the caret out of a trailing code block with ArrowDown', async () => {
    const user = userEvent.setup()

    render(
      <RichTextEditor
        ariaLabel="Document body editor"
        onChange={vi.fn()}
        value=""
      />,
    )

    const editor = screen.getByLabelText('Document body editor')
    await user.click(editor)
    await user.type(editor, '```js')
    await user.keyboard('{Enter}')
    await user.type(editor, 'const value = 1')
    await user.keyboard('{ArrowDown}')
    await user.type(editor, 'after block')

    await waitFor(() => {
      const codeContent = editor.querySelector('pre')
      expect(codeContent).not.toBeNull()
      expect(codeContent?.textContent).toContain('const value = 1')
      expect(editor.querySelector('p')).toHaveTextContent('after block')
    })
  })

  const MERMAID_DOC = '```mermaid\nflowchart TD\n  A --> B\n```'

  it('creates a new line after a trailing mermaid diagram with Enter', async () => {
    const user = userEvent.setup()
    const ref = createRef<RichTextEditorHandle>()

    render(
      <RichTextEditor
        ref={ref}
        ariaLabel="Document body editor"
        onChange={vi.fn()}
        value={'Intro\n\n' + MERMAID_DOC}
      />,
    )

    const editor = screen.getByLabelText('Document body editor')
    await waitFor(() => {
      expect(editor.querySelector('[data-diagram-section="true"]')).not.toBeNull()
      expect(editor.querySelector('.flow-diagram-block-source')?.classList.contains('hidden')).toBe(true)
    })

    // Clicking in jsdom places the DOM caret either at the doc start (focus
    // restore) or at the doc end (pointerdown fallback), depending on rAF
    // timing. Both are valid bug scenarios, so assert the invariant that
    // holds either way: Enter must never insert a newline inside the diagram
    // source, and must always create a visible paragraph outside it.
    await user.click(editor)
    await waitFor(() => {
      expect(editor).toHaveFocus()
    })
    await user.click(editor)
    await user.click(editor)
    await user.keyboard('{Enter}')

    await waitFor(() => {
      const md = ref.current?.getMarkdown() ?? ''
      expect(md).not.toContain('A --> B\n\n')
      expect(md).toContain('flowchart TD\n  A --> B')
      expect(md).toContain('<p><br></p>')
    })
  })

  it('moves a leading mermaid diagram to the next line with Enter', async () => {
    const user = userEvent.setup()
    const ref = createRef<RichTextEditorHandle>()

    render(<RichTextEditor ref={ref} ariaLabel="Document body editor" onChange={vi.fn()} value={MERMAID_DOC} />)

    const editor = screen.getByLabelText('Document body editor')
    await waitFor(() => {
      expect(editor.querySelector('[data-diagram-section="true"]')).not.toBeNull()
    })

    await user.click(editor)
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(editor.firstElementChild?.tagName).toBe('P')
      expect(ref.current?.getMarkdown()).toContain('<p><br></p>\n\n```mermaid')
    })
  })

  it('steps down into a trailing collapsed mermaid diagram and writes after it with Right and Enter', async () => {
    const user = userEvent.setup()
    const ref = createRef<RichTextEditorHandle>()

    render(<RichTextEditor ref={ref} ariaLabel="Document body editor" onChange={vi.fn()} value="" />)
    const editor = screen.getByLabelText('Document body editor')

    // Build the document by typing so the caret ends up at a known position:
    // at the end of the diagram source, which is rendered with its editor open
    // because it starts empty.
    await user.click(editor)
    await user.type(editor, 'Intro')
    await user.keyboard('{Enter}')
    await user.type(editor, '```mermaid')
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(editor.querySelector('[data-diagram-section="true"]')).not.toBeNull()
    })
    await user.type(editor, 'flowchart TD')
    await user.keyboard('{Enter}')
    await user.type(editor, '  A --> B')

    // Collapse the source editor without moving the caret. A real click would
    // also run the editor's pointerdown fallback and relocate the caret to the
    // end of the document, so dispatch a bare click event instead.
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Mermaid source editor' }))
    await waitFor(() => {
      expect(editor.querySelector('.flow-diagram-block-source')?.classList.contains('hidden')).toBe(true)
    })

    editor.focus()
    // Left (from the right edge) puts the caret at the left edge of the
    // diagram; a second Left walks out to the paragraph above; Down steps back
    // onto the left edge; Right crosses to the right edge; Enter then writes a
    // new line after the diagram.
    await user.keyboard('{ArrowLeft}')
    await user.keyboard('{ArrowLeft}')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowRight}')
    await user.keyboard('{Enter}')

    const md = ref.current?.getMarkdown() ?? ''
    // The diagram source is untouched — Enter never added a newline inside it.
    expect(md).toContain('flowchart TD\n  A --> B')
    expect(md).not.toContain('flowchart TD\n\n')
    expect(md).not.toContain('A --> B\n\n')
    // A new line was created after the diagram so the user can keep writing.
    expect(md.lastIndexOf('```mermaid') < md.lastIndexOf('<p><br></p>')).toBe(true)
  })

  it('steps up from below a collapsed mermaid diagram and moves it up a line with Left and Backspace', async () => {
    const user = userEvent.setup()
    const ref = createRef<RichTextEditorHandle>()

    render(<RichTextEditor ref={ref} ariaLabel="Document body editor" onChange={vi.fn()} value="" />)
    const editor = screen.getByLabelText('Document body editor')

    await user.click(editor)
    await user.type(editor, 'Intro')
    await user.keyboard('{Enter}')
    await user.type(editor, '```mermaid')
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(editor.querySelector('[data-diagram-section="true"]')).not.toBeNull()
    })
    await user.type(editor, 'flowchart TD')
    await user.keyboard('{Enter}')
    await user.type(editor, '  A --> B')

    // Move out of the diagram with ArrowDown and write a paragraph below it.
    await user.keyboard('{ArrowDown}')
    await user.type(editor, 'After')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Mermaid source editor' }))
    await waitFor(() => {
      expect(editor.querySelector('.flow-diagram-block-source')?.classList.contains('hidden')).toBe(true)
    })

    editor.focus()
    // Up lands on the right edge of the diagram, Left on the left edge, and
    // Backspace removes the line above, moving the whole section up.
    await user.keyboard('{ArrowUp}')
    await user.keyboard('{ArrowLeft}')
    await user.keyboard('{Backspace}')
    await user.keyboard('{Backspace}')

    const md = ref.current?.getMarkdown() ?? ''
    // The two Backspace presses removed the empty line and then the non-empty
    // 'Intro' paragraph above the diagram — the section moved to the top.
    expect(md).not.toContain('Intro')
    expect(md.trimStart().startsWith('```mermaid')).toBe(true)
    expect(md).toContain('flowchart TD\n  A --> B')
    expect(md).toContain('After')
  })

  it('keeps editing the source when the source editor is open', async () => {
    const user = userEvent.setup()
    const ref = createRef<RichTextEditorHandle>()

    render(<RichTextEditor ref={ref} ariaLabel="Document body editor" onChange={vi.fn()} value={MERMAID_DOC} />)

    const editor = screen.getByLabelText('Document body editor')
    await waitFor(() => {
      expect(editor.querySelector('[data-diagram-section="true"]')).not.toBeNull()
    })

    await user.click(screen.getByRole('button', { name: 'Toggle Mermaid source editor' }))
    await waitFor(() => {
      expect(editor.querySelector('.flow-diagram-block-source')?.classList.contains('hidden')).toBe(false)
    })
    await user.click(editor)
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(ref.current?.getMarkdown()).toContain('```mermaid\n\nflowchart TD')
    })
  })
})