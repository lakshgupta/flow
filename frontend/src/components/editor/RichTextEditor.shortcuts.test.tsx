import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from './RichTextEditor'

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
})