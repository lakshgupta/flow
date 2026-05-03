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
import { editorHTMLToMarkdown, markdownToHTML, parseFlowReferenceHref, parseFlowDateHref, parseFlowAssetHref } from '../../richText'
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
  onAssetOpenInThread?: (assetHref: string, assetName: string, kind: "pdf" | "text") => void
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
  { value, onChange, placeholder, ariaLabel, className, inlineReferences, referenceLookupGraph, onReferenceOpen, onDateOpen, onAssetOpenInThread, scrollToHeadingSlug, onScrollCompleted }: RichTextEditorProps,
  ref,
) {
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [selectedAssetForToolbar, setSelectedAssetForToolbar] = useState<{ href: string; name: string; left: number; top: number } | null>(null)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const selectedAssetAnchorRef = useRef<HTMLAnchorElement | null>(null)
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

  const positionAssetToolbar = useCallback((anchor: HTMLAnchorElement, href: string, name: string) => {
    const container = editorContainerRef.current
    const containerBounds = container?.getBoundingClientRect()
    const anchorBounds = anchor.getBoundingClientRect()
    if (containerBounds !== undefined) {
      const containerScrollLeft = container?.scrollLeft ?? 0
      const containerScrollTop = container?.scrollTop ?? 0
      const approxToolbarWidth = 240
      const maxLeft = Math.max(8, containerBounds.width - approxToolbarWidth - 8)
      const desiredLeft = anchorBounds.right - containerBounds.left + containerScrollLeft + 8
      const desiredTop = anchorBounds.top - containerBounds.top + containerScrollTop - 2
      setSelectedAssetForToolbar({
        href,
        name,
        left: Math.max(8, Math.min(desiredLeft, maxLeft)),
        top: Math.max(8, desiredTop),
      })
      return
    }

    setSelectedAssetForToolbar({ href, name, left: 8, top: 8 })
  }, [])

  const handleEditorClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const rawTarget = event.target
    const target = rawTarget instanceof HTMLElement
      ? rawTarget
      : rawTarget instanceof Text
        ? rawTarget.parentElement
        : null
    if (target === null) {
      setSelectedAssetForToolbar(null)
      return
    }

    const anchor = target.closest('a')
    if (!(anchor instanceof HTMLAnchorElement)) {
      setSelectedAssetForToolbar(null)
      return
    }

    const href = anchor.getAttribute('href') ?? anchor.href

    const asset = parseFlowAssetHref(href)
    if (asset !== null) {
      event.preventDefault()
      if ((event.metaKey || event.ctrlKey) && asset.isThreadViewable && asset.threadKind !== null && onAssetOpenInThread !== undefined) {
        onAssetOpenInThread(asset.href, asset.name, asset.threadKind)
        selectedAssetAnchorRef.current = null
        setSelectedAssetForToolbar(null)
        return
      }

      selectedAssetAnchorRef.current = anchor
      positionAssetToolbar(anchor, asset.href, asset.name)
      return
    }

    const dateResult = parseFlowDateHref(href)
    if (dateResult !== null) {
      event.preventDefault()
      onDateOpen?.(dateResult.date)
      selectedAssetAnchorRef.current = null
      setSelectedAssetForToolbar(null)
      return
    }

    if (onReferenceOpen === undefined) {
      selectedAssetAnchorRef.current = null
      setSelectedAssetForToolbar(null)
      return
    }

    const reference = parseFlowReferenceHref(href)
    if (reference === null) {
      selectedAssetAnchorRef.current = null
      setSelectedAssetForToolbar(null)
      return
    }

    event.preventDefault()
    onReferenceOpen(reference.documentId, reference.graphPath)
    selectedAssetAnchorRef.current = null
    setSelectedAssetForToolbar(null)
  }, [onAssetOpenInThread, onDateOpen, onReferenceOpen, positionAssetToolbar])

  useEffect(() => {
    if (selectedAssetForToolbar === null) {
      return
    }

    const container = editorContainerRef.current
    const anchor = selectedAssetAnchorRef.current
    if (container === null || anchor === null) {
      return
    }

    const syncPosition = () => {
      if (!anchor.isConnected) {
        selectedAssetAnchorRef.current = null
        setSelectedAssetForToolbar(null)
        return
      }
      positionAssetToolbar(anchor, selectedAssetForToolbar.href, selectedAssetForToolbar.name)
    }

    const handleScroll = () => {
      syncPosition()
    }

    window.addEventListener('resize', handleScroll)
    container.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('resize', handleScroll)
      container.removeEventListener('scroll', handleScroll)
    }
  }, [positionAssetToolbar, selectedAssetForToolbar])

  useEffect(() => {
    if (selectedAssetForToolbar === null) {
      return
    }

    const anchor = selectedAssetAnchorRef.current
    if (anchor === null || !anchor.isConnected) {
      selectedAssetAnchorRef.current = null
      setSelectedAssetForToolbar(null)
      return
    }

    positionAssetToolbar(anchor, selectedAssetForToolbar.href, selectedAssetForToolbar.name)
  }, [positionAssetToolbar, renderedHTML, selectedAssetForToolbar])

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
        <div ref={editorContainerRef} className="relative w-full flex-1 box-border overflow-y-auto" onClickCapture={handleEditorClickCapture}>
          {selectedAssetForToolbar !== null ? (
            <div
              className="flow-editor-asset-toolbar"
              style={{ left: `${selectedAssetForToolbar.left}px`, top: `${selectedAssetForToolbar.top}px` }}
              onClick={(event) => event.stopPropagation()}
            >
              <span className="flow-editor-asset-toolbar-name" title={selectedAssetForToolbar.name}>{selectedAssetForToolbar.name}</span>
              <a
                className="flow-editor-asset-toolbar-download"
                href={selectedAssetForToolbar.href}
                download={selectedAssetForToolbar.name}
                onClick={(event) => event.stopPropagation()}
              >
                Download
              </a>
            </div>
          ) : null}
          <div
            ref={editor.mount}
            aria-label={ariaLabel}
            className="ProseMirror flow-editor-content box-border min-h-full py-4 outline-hidden outline-0"
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
