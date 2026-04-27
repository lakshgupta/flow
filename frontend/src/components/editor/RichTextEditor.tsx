import 'prosekit/basic/style.css'
import 'prosekit/basic/typography.css'

import { createEditor } from 'prosekit/core'
import { ProseKit, useDocChange } from 'prosekit/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { editorHTMLToMarkdown, markdownToHTML, parseFlowReferenceHref, parseFlowDateHref } from '../../richText'
import { headingIdFromText } from '../../lib/docUtils'
import { toISODateString } from '../../lib/dateEntries'
import type { InlineReference } from '../../types'
import { BlockHandle } from './ui/block-handle'
import { defineEditorExtension } from './define-editor-extension'
import { DropIndicator } from './ui/drop-indicator'
import { InlineMenu } from './ui/inline-menu'
import ReferenceMenu from './ui/reference-menu/reference-menu'
import { SlashMenu } from './ui/slash-menu'

export interface RichTextEditorProps {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
  inlineReferences?: InlineReference[]
  referenceLookupGraph?: string
  onReferenceOpen?: (documentId: string, graphPath: string) => void
  onDateOpen?: (date: string) => void
  scrollToHeadingSlug?: string | null
  onScrollCompleted?: () => void
}

export interface RichTextEditorHandle {
  getMarkdown: () => string
}

function createInlineReferenceRenderKey(inlineReferences?: InlineReference[]): string {
  if ((inlineReferences?.length ?? 0) === 0) {
    return ''
  }

  return inlineReferences
    .map((reference) => [
      reference.token,
      reference.targetId,
      reference.targetGraph,
      reference.targetTitle,
      reference.targetPath,
      reference.targetBreadcrumb,
    ].join('\u0001'))
    .join('\u0002')
}

function serializeLiveEditorHTML(root: HTMLElement | null, fallbackHTML: string): string {
  if (root === null) {
    return fallbackHTML
  }

  const clone = root.cloneNode(true)
  if (!(clone instanceof HTMLElement)) {
    return fallbackHTML
  }

  for (const placeholder of clone.querySelectorAll('[data-placeholder]')) {
    placeholder.removeAttribute('data-placeholder')
    placeholder.classList.remove('prosekit-placeholder')
  }

  for (const breakElement of clone.querySelectorAll('br.ProseMirror-trailingBreak')) {
    breakElement.classList.remove('ProseMirror-trailingBreak')
  }

  return clone.innerHTML
}

/** Inner component: lives inside ProseKit provider so it can use ProseKit hooks. */
function DocChangeTracker({ onHtmlChange }: { onHtmlChange: () => void }) {
  useDocChange(onHtmlChange)
  return null
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { value, onChange, placeholder, ariaLabel, className, inlineReferences, referenceLookupGraph, onReferenceOpen, onDateOpen, scrollToHeadingSlug, onScrollCompleted }: RichTextEditorProps,
  ref,
) {
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  // Track the last markdown value we emitted so we can skip re-syncing when
  // the parent echoes back the same value after an auto-save.
  const lastEmittedRef = useRef(value)
  const inlineReferenceRenderKey = createInlineReferenceRenderKey(inlineReferences)
  const lastSyncedInlineReferencesKeyRef = useRef(inlineReferenceRenderKey)
  const renderedHTML = useMemo(() => markdownToHTML(value, inlineReferences), [inlineReferenceRenderKey, inlineReferences, value])
  const lastRenderedHTMLRef = useRef(renderedHTML)
  // Set to true briefly while we programmatically set content so we can
  // suppress the resulting useDocChange callback.
  const isSettingRef = useRef(false)

  const extension = useMemo(() => defineEditorExtension(placeholder), [placeholder])

  const editor = useMemo(() => {
    const initialHTML = renderedHTML
    return createEditor({ extension, defaultContent: initialHTML || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only run once — external value updates handled via useEffect below

  // When the parent supplies a new markdown value (e.g. switching documents),
  // push it into the editor without triggering our onChange.
  useEffect(() => {
    if (renderedHTML === lastRenderedHTMLRef.current) return

    if (value === lastEmittedRef.current && inlineReferenceRenderKey === lastSyncedInlineReferencesKeyRef.current) {
      lastRenderedHTMLRef.current = renderedHTML
      return
    }

    lastRenderedHTMLRef.current = renderedHTML
    lastSyncedInlineReferencesKeyRef.current = inlineReferenceRenderKey
    lastEmittedRef.current = value
    isSettingRef.current = true
    editor.setContent(renderedHTML || '<p></p>')
  }, [editor, inlineReferenceRenderKey, renderedHTML, value])

  // Scroll to a heading by its slug when requested by the parent (e.g. TOC click).
  useEffect(() => {
    if (!scrollToHeadingSlug) return
    const dom = editor.view?.dom
    if (!dom) return
    const headings = dom.querySelectorAll('h1, h2, h3, h4, h5, h6')
    for (const heading of headings) {
      const slug = headingIdFromText(heading.textContent ?? '')
      if (slug === scrollToHeadingSlug) {
        editor.view?.focus()
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
        onScrollCompleted?.()
        break
      }
    }
  }, [scrollToHeadingSlug, editor, onScrollCompleted])

  const handleDocChange = useCallback(() => {
    if (isSettingRef.current) {
      isSettingRef.current = false
      return
    }
    const html = editor.getDocHTML()
    const markdown = editorHTMLToMarkdown(html)
    lastEmittedRef.current = markdown
    onChange(markdown)
  }, [editor, onChange])

  const handleEditorClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    const anchor = target.closest('a')
    if (!(anchor instanceof HTMLAnchorElement)) {
      return
    }

    const href = anchor.getAttribute('href') ?? anchor.href

    const dateResult = parseFlowDateHref(href)
    if (dateResult !== null) {
      event.preventDefault()
      onDateOpen?.(dateResult.date)
      return
    }

    if (onReferenceOpen === undefined) {
      return
    }

    const reference = parseFlowReferenceHref(href)
    if (reference === null) {
      return
    }

    event.preventDefault()
    onReferenceOpen(reference.documentId, reference.graphPath)
  }, [onReferenceOpen, onDateOpen])

  function handleDateRequest() {
    setDatePickerOpen(true)
  }

  function handleDateSelect(date: Date | undefined) {
    setDatePickerOpen(false)
    if (!date) {
      editor.view?.focus()
      return
    }
    editor.view?.focus()
    editor.commands.insertText({ text: toISODateString(date) })
  }

  useImperativeHandle(ref, () => ({
    getMarkdown: () => editorHTMLToMarkdown(serializeLiveEditorHTML(editor.view?.dom as HTMLElement | null, editor.getDocHTML())),
  }), [editor])

  return (
    <ProseKit editor={editor}>
      <div className={className ?? 'box-border h-full w-full overflow-y-hidden overflow-x-hidden flex flex-col bg-background text-foreground'}>
        <div className="relative w-full flex-1 box-border overflow-y-auto" onClickCapture={handleEditorClickCapture}>
          <div
            ref={editor.mount}
            aria-label={ariaLabel}
            className="ProseMirror box-border min-h-full px-[max(2rem,calc(50%-28rem))] py-6 outline-hidden outline-0"
          />
          <InlineMenu />
          <ReferenceMenu graphPath={referenceLookupGraph} />
          <SlashMenu onDateRequest={handleDateRequest} />
          <BlockHandle />
          <DropIndicator />
          <DocChangeTracker onHtmlChange={handleDocChange} />
        </div>
      </div>
      <Dialog open={datePickerOpen} onOpenChange={(open) => { if (!open) handleDateSelect(undefined) }}>
        <DialogContent className="w-auto p-0 overflow-hidden">
          <DialogTitle className="sr-only">Pick a date</DialogTitle>
          <Calendar
            mode="single"
            onSelect={handleDateSelect}
          />
        </DialogContent>
      </Dialog>
    </ProseKit>
  )
})
