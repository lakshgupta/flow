import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from '../../RichTextEditor'

const renderedSources = vi.hoisted(() => [] as string[])

vi.mock('../../../MermaidDiagram', () => ({
  MermaidDiagram: ({ source }: { source: string }) => {
    renderedSources.push(source)
    return null
  },
}))

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

function renderEditor(value: string) {
  return render(
    <RichTextEditor
      ariaLabel="Document body editor"
      onChange={vi.fn()}
      value={value}
    />,
  )
}

async function waitForSection() {
  const editor = screen.getByLabelText('Document body editor')
  await waitFor(() => {
    expect(editor.querySelector('[data-diagram-section="true"]')).not.toBeNull()
  })
  return editor
}

describe('mermaid diagram section source and title', () => {
  it('renders the full source when the first line is diagram syntax', async () => {
    renderEditor('```mermaid\nflowchart TD\n  A --> B\n```')
    await waitForSection()

    expect(renderedSources.some((source) => source.trim() === 'flowchart TD\n  A --> B')).toBe(true)
    expect(renderedSources.some((source) => source.trim() === '  A --> B')).toBe(false)
    const title = screen.getByLabelText('Mermaid Diagram title') as HTMLInputElement
    expect(title.value).toBe('')
  })

  it('extracts an explicit title line and renders the remaining source', async () => {
    renderEditor('```mermaid\nMy Diagram\nflowchart TD\n  A --> B\n```')
    await waitForSection()

    expect(renderedSources.some((source) => source.trim() === 'flowchart TD\n  A --> B')).toBe(true)
    const title = screen.getByLabelText('Mermaid Diagram title') as HTMLInputElement
    expect(title.value).toBe('My Diagram')
  })

  it('renders the pasted source in full without a leading newline workaround', async () => {
    const user = userEvent.setup()
    renderEditor('')
    const editor = screen.getByLabelText('Document body editor')

    await user.click(editor)
    await user.type(editor, '```mermaid')
    await user.keyboard('{Enter}')
    await waitForSection()

    const pre = editor.querySelector('.flow-diagram-source')
    expect(pre).not.toBeNull()
    await user.click(pre as HTMLElement)
    await user.paste('flowchart TD\n  A --> B')

    await waitFor(() => {
      expect(renderedSources.at(-1)?.trim()).toBe('flowchart TD\n  A --> B')
    })
  })
})
