import 'prosekit/basic/style.css'
import 'prosekit/basic/typography.css'

import { createEditor } from 'prosekit/core'
import { TextSelection } from 'prosekit/pm/state'
import { ProseKit, useDocChange } from 'prosekit/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'

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
import { getWailsUpload, getWailsUploadFromPath, createFlowImageUploader } from '../../lib/imageUploader'
import { hasImageExtension } from './image-utils'
import { BlockHandle } from './ui/block-handle'
import { defineEditorExtension } from './define-editor-extension'
import { DropDiagBanner } from './ui/drop-diag-banner'
import type { DropDiagEntry } from './ui/drop-diag-banner'
import { DropIndicator } from './ui/drop-indicator'
import { InlineMenu } from './ui/inline-menu'
import ReferenceMenu from './ui/reference-menu/reference-menu'
import { SlashMenu } from './ui/slash-menu'

/** Open an external URL in the system browser.
 *  In Wails desktop mode, `window.runtime.BrowserOpenURL` opens the URL in the
 *  user's default browser. In browser mode, a temporary <a> click is used. */
function openExternalLink(href: string) {
  const runtime = typeof window !== 'undefined'
    ? (window as Record<string, unknown>).runtime as Record<string, ((url: string) => void) | undefined> | undefined
    : undefined
  if (typeof runtime?.BrowserOpenURL === 'function') {
    runtime.BrowserOpenURL(href)
    return
  }
  const a = document.createElement('a')
  a.href = href
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/** Extract file paths/URIs from a text/html string. Some Linux file
 *  managers (e.g. Nautilus) provide the drop data as HTML. */
function extractPathsFromHTML(html: string): string[] {
  const paths: string[] = []
  // file:// URIs embedded in href attributes or plain text
  const uriMatches = html.matchAll(/file:\/\/[^\s"'<>]+/g)
  for (const m of uriMatches) {
    paths.push(m[0])
  }
  // Absolute paths that look like images (no scheme prefix)
  if (paths.length === 0) {
    const pathMatches = html.matchAll(/(?:href|src)=["']?(\/[^\s"'>]+)["']?/g)
    for (const m of pathMatches) {
      const p = m[1]
      if (hasImageExtension(p)) {
        paths.push('file://' + p)
      }
    }
  }
  // Bare absolute paths on separate lines
  if (paths.length === 0) {
    const lines = html.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
    for (const line of lines) {
      if (line.startsWith('/') && hasImageExtension(line)) {
        paths.push('file://' + line)
      }
    }
  }
  return paths
}

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
  /** The canonical relative path of the document being edited (e.g. data/content/design/note.md).
   *  When set, uploaded images are saved alongside the document. */
  documentPath?: string
}

export interface RichTextEditorHandle {
  getMarkdown: () => string
}

function clampSelectionPosition(position: number | undefined, docSize: number): number {
  if (typeof position !== 'number' || Number.isFinite(position) === false) {
    return 1
  }

  return Math.min(Math.max(1, Math.round(position)), Math.max(docSize, 1))
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

/** Inner component: lives inside ProseKit provider so it can use ProseKit hooks. */
function DocChangeTracker({ onHtmlChange }: { onHtmlChange: () => void }) {
  useDocChange(onHtmlChange)
  return null
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { value, onChange, placeholder, ariaLabel, className, inlineReferences, referenceLookupGraph, onReferenceOpen, onDateOpen, onAssetOpenInThread, scrollToHeadingSlug, onScrollCompleted, documentPath }: RichTextEditorProps,
  ref,
) {
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [selectedAssetForToolbar, setSelectedAssetForToolbar] = useState<{ href: string; name: string; left: number; top: number } | null>(null)
  const [dropDiags, setDropDiags] = useState<DropDiagEntry[]>([])
  const dropDiagIdRef = useRef(0)
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

  // Keep a stable getter so image uploads always have the latest documentPath.
  const documentPathRef = useRef(documentPath)
  documentPathRef.current = documentPath
  const getDocumentPath = useCallback(() => documentPathRef.current, [])

  const extension = useMemo(() => defineEditorExtension(placeholder, getDocumentPath), [getDocumentPath, placeholder])

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
    const currentSelection = editor.view?.state.selection
    isSettingRef.current = true
    editor.setContent(renderedHTML || '<p></p>')

    const nextView = editor.view
    if (currentSelection !== undefined && nextView !== null && nextView !== undefined) {
      const docSize = nextView.state.doc.content.size
      const anchor = clampSelectionPosition(currentSelection.anchor, docSize)
      const head = clampSelectionPosition(currentSelection.head, docSize)
      nextView.dispatch(nextView.state.tr.setSelection(TextSelection.create(nextView.state.doc, anchor, head)))
    }
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

    // Cmd/Ctrl+Click on a regular URL opens it in the browser
    if ((event.metaKey || event.ctrlKey) && href && !href.startsWith('#') && !href.startsWith('/api/files')) {
      event.preventDefault()
      event.stopPropagation()
      openExternalLink(href)
      selectedAssetAnchorRef.current = null
      setSelectedAssetForToolbar(null)
      return
    }

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

  const handleEditorPointerDownCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (typeof event.button === 'number' && event.button > 0) {
      return
    }

    const view = editor.view
    if (view === null || view === undefined) {
      return
    }

    const rawTarget = event.target
    const target = rawTarget instanceof HTMLElement
      ? rawTarget
      : rawTarget instanceof Text
        ? rawTarget.parentElement
        : null
    if (target?.closest('a') instanceof HTMLAnchorElement) {
      return
    }
    if (target?.closest('[data-flow-editor-interactive="true"]') instanceof HTMLElement) {
      return
    }

    const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
    const fallbackPos = typeof view.state.doc.content?.size === 'number'
      ? view.state.doc.content.size
      : 0
    const selectionPos = coords?.pos ?? fallbackPos
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, selectionPos)))

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => view.focus())
      return
    }

    view.focus()
  }, [editor])

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

  // Intercept file drops in the Wails desktop app. On Linux, WebKitGTK either
  // does not populate dataTransfer.files (placing file URIs in text/uri-list or
  // text/plain instead) or creates unreadable File objects. The capturing-phase
  // listener fires before ProseKit's handleDrop, so we can handle the upload
  // ourselves and stop propagation to prevent ProseKit from inserting the
  // filename as plain text.
  useEffect(() => {
    const container = editorContainerRef.current
    if (!container) return

    const uriUpload = getWailsUploadFromPath()
    const isWails = !!(uriUpload || getWailsUpload())

    const handleDragOverCapture = (event: DragEvent) => {
      if (!isWails) return
      // Allow dropping on the editor in Wails mode so the drop event actually
      // fires (some WebKitGTK builds skip the drop when dragover isn't
      // prevented on the inner element).
      event.preventDefault()
      event.dataTransfer && (event.dataTransfer.dropEffect = 'copy')
    }

    const handleDragEnterCapture = (event: DragEvent) => {
      if (!isWails) return
      event.preventDefault()
    }

    const showDiag = (parts: string[]) => {
      const id = ++dropDiagIdRef.current
      setDropDiags((prev) => [...prev, { id, message: parts.join(' | '), timestamp: new Date() }])
    }

    const handleDropCapture = (event: DragEvent) => {

      // Collect everything the browser gives us so we can diagnose without
      // needing a dev console (Wails on Linux often has no accessible inspector).
      const types = event.dataTransfer ? Array.from(event.dataTransfer.types) : []
      const uriList = event.dataTransfer?.getData('text/uri-list') ?? ''
      const plainText = event.dataTransfer?.getData('text/plain') ?? ''
      const htmlText = event.dataTransfer?.getData('text/html') ?? ''
      const files = event.dataTransfer?.files
      const filesCount = files?.length ?? 0

      // Build a visible diagnostic string (shown in a temporary UI banner).
      const diagParts: string[] = []
      diagParts.push(`types=[${types.join(', ')}]`)
      diagParts.push(`uriList=${uriList ? '"' + uriList.slice(0, 200) + '"' : 'null'}`)
      diagParts.push(`plain=${plainText ? '"' + plainText.slice(0, 200) + '"' : 'null'}`)
      diagParts.push(`html=${htmlText ? '"' + htmlText.slice(0, 200) + '"' : 'null'}`)
      diagParts.push(`files=${filesCount}`)
      diagParts.push(`wails=${isWails}`)

      if (!isWails) {
        diagParts.push('action=non-Wails-skip')
        showDiag(diagParts)
        return
      }

      // --- Extract file:// URIs from data transfer formats ---
      // This is the Linux/WebKitGTK path where file managers provide URIs
      // instead of readable File objects.
      let fileURIs: string[] = []

      // 1. text/uri-list — the canonical GNOME/KDE format.
      if (uriList.trim()) {
        const uris = uriList
          .split('\n')
          .map((u) => u.trim())
          .filter((u) => u.startsWith('file://'))
        fileURIs.push(...uris)
      }

      // 2. raw paths from text/plain
      if (!fileURIs.length && plainText.trim()) {
        const lines = plainText
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
        for (const line of lines) {
          if (line.startsWith('/') && hasImageExtension(line)) {
            fileURIs.push('file://' + line)
          }
        }
      }

      // 3. extract paths from text/html
      if (!fileURIs.length && htmlText.trim()) {
        fileURIs.push(...extractPathsFromHTML(htmlText))
      }

      // --- If we have file URIs, handle uploads via Wails binding ---
      // On Linux, file managers provide file:// URIs instead of readable
      // File objects, so ProseKit cannot handle them. We upload files
      // ourselves and insert them as images or links.
      if (fileURIs.length > 0 && uriUpload) {
        const imageURIs = fileURIs.filter((uri) => {
          try {
            return hasImageExtension(decodeURIComponent(uri))
          } catch {
            return false
          }
        })
        const nonImageURIs = fileURIs.filter((uri) => {
          try {
            return !hasImageExtension(decodeURIComponent(uri))
          } catch {
            return true
          }
        })

        // Handle image URIs — insert as image nodes.
        if (imageURIs.length > 0) {
          event.preventDefault()
          event.stopPropagation()

          const view = editor.view
          if (!view) {
            diagParts.push('action=editor-view-null')
            showDiag(diagParts)
            return
          }

          const pos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })
          if (!pos) {
            diagParts.push('action=posAtCoords-null')
            showDiag(diagParts)
            return
          }
          const insertPos = pos.pos
          const docPath = documentPathRef.current

          diagParts.push(`action=upload-uri ${imageURIs.length} image(s)`)
          showDiag(diagParts)

          void (async () => {
            for (const uri of imageURIs) {
              try {
                const url = await uriUpload(uri, docPath ?? '')
                const node = view.state.schema.nodes.image?.create({ src: url })
                if (!node) continue
                view.dispatch(view.state.tr.insert(insertPos, node))
                showDiag([...diagParts, `url=${url}`])
              } catch (error) {
                // eslint-disable-next-line no-console
                console.error('[flow] Linux image drop failed', { uri, error })
                showDiag([...diagParts, `upload-error=${String(error)}`])
              }
            }
          })()
          return
        }

        // Handle non-image URIs (PDFs, etc.) — upload and insert as links.
        if (nonImageURIs.length > 0) {
          event.preventDefault()
          event.stopPropagation()

          const view = editor.view
          if (!view) {
            diagParts.push('action=editor-view-null')
            showDiag(diagParts)
            return
          }

          const pos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })
          if (!pos) {
            diagParts.push('action=posAtCoords-null')
            showDiag(diagParts)
            return
          }
          const insertPos = pos.pos
          const docPath = documentPathRef.current

          diagParts.push(`action=upload-uri-link ${nonImageURIs.length} file(s)`)
          showDiag(diagParts)

          void (async () => {
            for (const uri of nonImageURIs) {
              try {
                const url = await uriUpload(uri, docPath ?? '')
                // Extract filename from the URI for display.
                const decoded = decodeURIComponent(uri)
                const fileName = decoded.split('/').pop() ?? decoded
                // Insert a paragraph with a link to the uploaded file.
                const linkMark = view.state.schema.marks.link?.create({ href: url })
                const textNode = view.state.schema.text(fileName, linkMark ? [linkMark] : undefined)
                const paragraph = view.state.schema.nodes.paragraph?.create(null, textNode)
                if (!paragraph) continue
                view.dispatch(view.state.tr.insert(insertPos, paragraph))
                showDiag([...diagParts, `url=${url}`])
              } catch (error) {
                // eslint-disable-next-line no-console
                console.error('[flow] Linux file drop failed', { uri, error })
                showDiag([...diagParts, `upload-error=${String(error)}`])
              }
            }
          })()
          return
        }

        // No image or non-image URIs found — let ProseKit handle naturally.
        return
      }

      // --- No file URIs: let ProseKit handle naturally ---
      // This covers: browser drops with readable File objects, macOS drops,
      // paste events, and non-image file drops. ProseKit's canDropImage
      // predicate will filter for images; other files pass through normally.
    }

    container.addEventListener('dragover', handleDragOverCapture, { capture: true })
    container.addEventListener('dragenter', handleDragEnterCapture, { capture: true })
    container.addEventListener('drop', handleDropCapture, { capture: true })
    return () => {
      container.removeEventListener('dragover', handleDragOverCapture, { capture: true })
      container.removeEventListener('dragenter', handleDragEnterCapture, { capture: true })
      container.removeEventListener('drop', handleDropCapture, { capture: true })
    }
  }, [editor])

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
    getMarkdown: () => editorHTMLToMarkdown(editor.getDocHTML()),
  }), [editor])

  return (
    <ProseKit editor={editor}>
      <div className={className ?? 'box-border h-full w-full overflow-y-hidden overflow-x-hidden flex flex-col bg-background text-foreground'}>
        <DropDiagBanner
          messages={dropDiags}
          onClose={(id) => setDropDiags((prev) => prev.filter((d) => d.id !== id))}
          onCloseAll={() => setDropDiags([])}
        />
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
            onPointerDownCapture={handleEditorPointerDownCapture}
          />
          <InlineMenu />
          <ReferenceMenu graphPath={referenceLookupGraph} />
          <SlashMenu onDateRequest={handleDateRequest} uploader={createFlowImageUploader(getDocumentPath)} />
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
