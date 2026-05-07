import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const setParagraph = vi.fn()
const setHeading = vi.fn()
const wrapInList = vi.fn()
const setBlockquote = vi.fn()
const insertTable = vi.fn()
const insertHorizontalRule = vi.fn()
const setCodeBlock = vi.fn()
const insertCodeBlock = vi.fn()
const insertText = vi.fn()

vi.mock('prosekit/core', () => ({
  canUseRegexLookbehind: () => false,
}))

vi.mock('prosekit/react', () => ({
  useEditor: () => ({
    commands: {
      setParagraph,
      setHeading,
      wrapInList,
      setBlockquote,
      insertTable,
      insertHorizontalRule,
      setCodeBlock,
      insertCodeBlock,
      insertText,
    },
  }),
}))

vi.mock('prosekit/react/autocomplete', async () => {
  const React = await import('react')

  return {
    AutocompletePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AutocompleteList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AutocompleteItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
      <button type="button" onClick={onSelect}>
        {children}
      </button>
    ),
    AutocompleteEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }
})

import SlashMenu from './slash-menu'

describe('SlashMenu', () => {
  it('inserts a Mermaid code block without starter content', async () => {
    const user = userEvent.setup()

    render(<SlashMenu />)

    await user.click(screen.getByRole('button', { name: /Mermaid Diagram/i }))

    expect(insertCodeBlock).toHaveBeenCalledWith({ language: 'mermaid' })
    expect(insertText).not.toHaveBeenCalled()
  })
})