import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const insertText = vi.fn()

vi.mock('prosekit/core', () => ({
  canUseRegexLookbehind: () => false,
}))

vi.mock('prosekit/react', () => ({
  useEditor: () => ({
    commands: { insertText },
  }),
}))

vi.mock('prosekit/react/autocomplete', async () => {
  const React = await import('react')

  return {
    AutocompletePopover: ({ children, onOpenChange, onQueryChange }: { children: React.ReactNode; onOpenChange?: (open: boolean) => void; onQueryChange?: (query: string) => void }) => {
      useEffect(() => {
        onOpenChange?.(true)
        onQueryChange?.('par')
      }, [onOpenChange, onQueryChange])

      return <div>{children}</div>
    },
    AutocompleteList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AutocompleteEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AutocompleteItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
      <button type="button" onClick={onSelect}>
        {children}
      </button>
    ),
  }
})

import ReferenceMenu from './reference-menu'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('ReferenceMenu', () => {
  afterEach(() => {
    insertText.mockReset()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads lookup results for [[ queries and inserts the canonical breadcrumb token', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes('/api/reference-targets?')) {
        return jsonResponse([
          {
            id: 'task-1',
            type: 'task',
            graph: 'execution',
            title: 'Parser',
            path: 'data/content/execution/parser.md',
            breadcrumb: 'execution > Parser',
          },
        ])
      }

      throw new Error(`Unhandled request: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<ReferenceMenu graphPath="execution" />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/reference-targets?q=par&limit=8&graph=execution'), expect.anything())
    })

    const option = await screen.findByRole('button', { name: /Parser execution > Parser/i })
    await user.click(option)

    expect(insertText).toHaveBeenCalledWith({ text: '[[execution > Parser]] ' })
  })

  it('loads breadcrumb lookup results without a graph filter when no graph scope is provided', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes('/api/reference-targets?')) {
        return jsonResponse([
          {
            id: 'note-1',
            type: 'note',
            graph: 'execution',
            title: 'Parser Overview',
            path: 'data/content/execution/overview.md',
            breadcrumb: 'execution > Parser Overview',
          },
        ])
      }

      throw new Error(`Unhandled request: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<ReferenceMenu />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/reference-targets?q=par&limit=8'), expect.anything())
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('&graph='), expect.anything())
    })

    expect(await screen.findByRole('button', { name: /Parser Overview execution > Parser Overview/i })).toBeInTheDocument()
  })
})