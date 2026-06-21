import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from './RichTextEditor'

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
})