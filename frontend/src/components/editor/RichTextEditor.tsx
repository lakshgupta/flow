import 'prosekit/basic/style.css'
import 'prosekit/basic/typography.css'

import { createEditor } from 'prosekit/core'
import { ProseKit, useDocChange } from 'prosekit/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { editorHTMLToMarkdown, markdownToHTML } from '../../richText'
import { BlockHandle } from './ui/block-handle'
import { defineEditorExtension } from './define-editor-extension'
import { DropIndicator } from './ui/drop-indicator'
import { InlineMenu } from './ui/inline-menu'
import { SlashMenu } from './ui/slash-menu'

export interface RichTextEditorProps {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
  scrollToHeadingSlug?: string | null
  onScrollCompleted?: () => void
}

/** Inner component: lives inside ProseKit provider so it can use ProseKit hooks. */
function DocChangeTracker({ onHtmlChange }: { onHtmlChange: () => void }) {
  useDocChange(onHtmlChange)
  return null
}

export function RichTextEditor({ value, onChange, placeholder, ariaLabel, className, scrollToHeadingSlug, onScrollCompleted }: RichTextEditorProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  // Track the last markdown value we emitted so we can skip re-syncing when
  // the parent echoes back the same value after an auto-save.
  const lastEmittedRef = useRef(value)
  // Set to true briefly while we programmatically set content so we can
  // suppress the resulting useDocChange callback.
  const isSettingRef = useRef(false)

  const extension = useMemo(() => defineEditorExtension(placeholder), [placeholder])

  const editor = useMemo(() => {
    const initialHTML = markdownToHTML(value)
    return createEditor({ extension, defaultContent: initialHTML || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only run once — external value updates handled via useEffect below

  // When the parent supplies a new markdown value (e.g. switching documents),
  // push it into the editor without triggering our onChange.
  useEffect(() => {
    if (value === lastEmittedRef.current) return
    lastEmittedRef.current = value
    isSettingRef.current = true
    editor.setContent(markdownToHTML(value) || '<p></p>')
  }, [value, editor])

  // Scroll to a heading by its slug when requested by the parent (e.g. TOC click).
  useEffect(() => {
    if (!scrollToHeadingSlug) return
    const dom = editor.view?.dom
    if (!dom) return
    const headings = dom.querySelectorAll('h1, h2, h3, h4, h5, h6')
    for (const heading of headings) {
      const slug = (heading.textContent ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      if (slug === scrollToHeadingSlug) {
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

  function handleDateRequest() {
    setDatePickerOpen(true)
  }

  function handleDateSelect(date: Date | undefined) {
    setDatePickerOpen(false)
    if (!date) {
      editor.view?.focus()
      return
    }
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    editor.view?.focus()
    editor.commands.insertText({ text: dateStr })
  }

  return (
    <ProseKit editor={editor}>
      <div className={className ?? 'box-border h-full w-full overflow-y-hidden overflow-x-hidden flex flex-col bg-background text-foreground'}>
        <div className="relative w-full flex-1 box-border overflow-y-auto">
          <div
            ref={editor.mount}
            aria-label={ariaLabel}
            className="ProseMirror box-border min-h-full px-[max(2rem,calc(50%-28rem))] py-6 outline-hidden outline-0"
          />
          <InlineMenu />
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
}
