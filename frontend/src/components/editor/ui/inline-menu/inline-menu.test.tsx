import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const toggleBold = Object.assign(vi.fn(), { canExec: vi.fn(() => true) })
const toggleItalic = Object.assign(vi.fn(), { canExec: vi.fn(() => true) })
const toggleUnderline = Object.assign(vi.fn(), { canExec: vi.fn(() => true) })
const toggleStrike = Object.assign(vi.fn(), { canExec: vi.fn(() => true) })
const toggleCode = Object.assign(vi.fn(), { canExec: vi.fn(() => true) })
const addLink = Object.assign(vi.fn(), { canExec: vi.fn(() => true) })
const expandLink = vi.fn()
const removeLink = vi.fn()
const addTextColor = Object.assign(vi.fn(), { canExec: vi.fn(() => true) })
const removeTextColor = vi.fn()
const addBackgroundColor = Object.assign(vi.fn(), { canExec: vi.fn(() => true) })
const removeBackgroundColor = vi.fn()
const focus = vi.fn()

const mockEditor = {
  focus,
  state: {
    selection: {
      $from: {
        marksAcross: () => [],
        marks: () => [],
      },
    },
  },
  marks: {
    bold: { isActive: () => false },
    italic: { isActive: () => false },
    underline: { isActive: () => false },
    strike: { isActive: () => false },
    code: { isActive: () => false },
    link: { isActive: () => false },
  },
  commands: {
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrike,
    toggleCode,
    addLink,
    expandLink,
    removeLink,
    addTextColor,
    removeTextColor,
    addBackgroundColor,
    removeBackgroundColor,
  },
}

vi.mock('prosekit/react', () => ({
  useEditor: () => mockEditor,
  useEditorDerivedValue: (factory: (editor: typeof mockEditor) => unknown) => factory(mockEditor),
}))

vi.mock('prosekit/react/inline-popover', () => ({
  InlinePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../button/button', () => ({
  default: ({ children, onClick, tooltip, disabled }: { children: React.ReactNode, onClick?: () => void, tooltip?: string, disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
      {tooltip ? <span>{tooltip}</span> : null}
    </button>
  ),
}))

import InlineMenu from './inline-menu'

describe('InlineMenu', () => {
  it('shows the shared pastel palette and applies selected swatches', async () => {
    const user = userEvent.setup()

    render(<InlineMenu />)

    await user.click(screen.getByRole('button', { name: /Text color/i }))
    await user.click(screen.getByRole('button', { name: 'Text color Rose' }))

    expect(addTextColor).toHaveBeenCalledWith({ color: '#f4c7cf' })

    await user.click(screen.getByRole('button', { name: /Background color/i }))
    await user.click(screen.getByRole('button', { name: 'Background color Mint' }))

    expect(addBackgroundColor).toHaveBeenCalledWith({ color: '#c8edd5' })
  })
})