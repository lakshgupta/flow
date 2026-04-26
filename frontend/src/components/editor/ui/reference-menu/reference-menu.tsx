import type { BasicExtension } from 'prosekit/basic'
import { canUseRegexLookbehind } from 'prosekit/core'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { useEditor } from 'prosekit/react'
import { AutocompleteEmpty, AutocompleteItem, AutocompleteList, AutocompletePopover } from 'prosekit/react/autocomplete'

import { loadReferenceTargets } from '../../../../lib/api'
import type { ReferenceTargetResponse } from '../../../../types'

const regex = canUseRegexLookbehind() ? /(?<!\[)\[\[([^\[\]\n]*)$/u : /\[\[([^\[\]\n]*)$/u

export default function ReferenceMenu({ graphPath }: { graphPath?: string }) {
  const editor = useEditor<BasicExtension>()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ReferenceTargetResponse[]>([])
  const requestSequenceRef = useRef(0)

  useEffect(() => {
    if (!open) {
      setResults([])
      setLoading(false)
      return
    }

    if (deferredQuery === '') {
      setResults([])
      setLoading(false)
      return
    }

    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId
    let cancelled = false

    async function loadTargets(): Promise<void> {
      try {
        setLoading(true)
        const nextResults = await loadReferenceTargets(deferredQuery, graphPath)
        if (!cancelled && requestSequenceRef.current === requestId) {
          setResults(nextResults)
        }
      } catch {
        if (!cancelled && requestSequenceRef.current === requestId) {
          setResults([])
        }
      } finally {
        if (!cancelled && requestSequenceRef.current === requestId) {
          setLoading(false)
        }
      }
    }

    void loadTargets()

    return () => {
      cancelled = true
    }
  }, [deferredQuery, graphPath, open])

  const handleReferenceInsert = (target: ReferenceTargetResponse) => {
    editor.commands.insertText({ text: `[[${target.breadcrumb}]] ` })
  }

  return (
    <AutocompletePopover
      regex={regex}
      className="relative block max-h-100 min-w-72 select-none overflow-auto whitespace-nowrap p-1 z-10 box-border rounded-lg border border-border bg-popover text-popover-foreground shadow-lg [&:not([data-state])]:hidden"
      onOpenChange={setOpen}
      onQueryChange={setQuery}
    >
      <AutocompleteList>
        <AutocompleteEmpty className="relative flex items-center justify-between min-w-32 scroll-my-1 rounded-sm px-3 py-1.5 box-border cursor-default select-none whitespace-nowrap outline-hidden text-muted-foreground">
          <span>{loading ? 'Loading references...' : deferredQuery === '' ? 'Type to search references' : 'No references found'}</span>
        </AutocompleteEmpty>

        {results.map((target) => (
          <AutocompleteItem
            key={target.id}
            value={`${target.title} ${target.breadcrumb} ${target.id}`}
            className="relative flex min-w-40 flex-col scroll-my-1 rounded-sm px-3 py-1.5 box-border cursor-default select-none outline-hidden data-focused:bg-accent data-focused:text-accent-foreground"
            onSelect={() => handleReferenceInsert(target)}
          >
            <span>{target.title}</span>
            <span className="text-xs text-muted-foreground data-focused:text-accent-foreground/80">{target.breadcrumb}</span>
          </AutocompleteItem>
        ))}
      </AutocompleteList>
    </AutocompletePopover>
  )
}