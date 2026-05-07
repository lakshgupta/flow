import type { Editor } from 'prosekit/core'
import type { LinkAttrs } from 'prosekit/extensions/link'
import type { EditorState } from 'prosekit/pm/state'
import { useEditor, useEditorDerivedValue } from 'prosekit/react'
import { InlinePopover } from 'prosekit/react/inline-popover'
import { useState } from 'react'

import { GRAPH_DIRECTORY_COLOR_OPTIONS } from '../../../../lib/graphColors'
import type { EditorExtension } from '../../define-editor-extension'
import Button from '../button/button'

const DEFAULT_TEXT_COLOR = GRAPH_DIRECTORY_COLOR_OPTIONS[0]?.hex ?? '#f4c7cf'
const DEFAULT_BACKGROUND_COLOR = GRAPH_DIRECTORY_COLOR_OPTIONS.find((option) => option.id === 'amber')?.hex ?? DEFAULT_TEXT_COLOR

type ColorMarkState = {
  isActive: boolean
  color?: string
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (value === undefined || value.trim() === '') {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return normalized
  }

  const rgbMatch = normalized.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbMatch) {
    const [red, green, blue] = rgbMatch.slice(1, 4).map((component) => Number(component))
    return `#${[red, green, blue].map((component) => component.toString(16).padStart(2, '0')).join('')}`
  }

  return fallback
}

function getMarkState(state: EditorState, markName: string): ColorMarkState {
  const { $from } = state.selection
  const marks = $from.marksAcross($from) ?? $from.marks()
  const mark = marks.find((candidate) => candidate.type.name === markName)
  if (!mark) {
    return { isActive: false }
  }

  return {
    isActive: true,
    color: typeof mark.attrs.color === 'string' ? mark.attrs.color : undefined,
  }
}

function getInlineMenuItems(editor: Editor<EditorExtension>) {
  const textColor = getMarkState(editor.state, 'textColor')
  const backgroundColor = getMarkState(editor.state, 'backgroundColor')

  return {
    bold: editor.commands.toggleBold
      ? {
        isActive: editor.marks.bold.isActive(),
        canExec: editor.commands.toggleBold.canExec(),
        command: () => editor.commands.toggleBold(),
      }
      : undefined,
    italic: editor.commands.toggleItalic
      ? {
        isActive: editor.marks.italic.isActive(),
        canExec: editor.commands.toggleItalic.canExec(),
        command: () => editor.commands.toggleItalic(),
      }
      : undefined,
    underline: editor.commands.toggleUnderline
      ? {
        isActive: editor.marks.underline.isActive(),
        canExec: editor.commands.toggleUnderline.canExec(),
        command: () => editor.commands.toggleUnderline(),
      }
      : undefined,
    strike: editor.commands.toggleStrike
      ? {
        isActive: editor.marks.strike.isActive(),
        canExec: editor.commands.toggleStrike.canExec(),
        command: () => editor.commands.toggleStrike(),
      }
      : undefined,
    code: editor.commands.toggleCode
      ? {
        isActive: editor.marks.code.isActive(),
        canExec: editor.commands.toggleCode.canExec(),
        command: () => editor.commands.toggleCode(),
      }
      : undefined,
    link: editor.commands.addLink
      ? {
        isActive: editor.marks.link.isActive(),
        canExec: editor.commands.addLink.canExec({ href: '' }),
        command: () => editor.commands.expandLink(),
        currentLink: getCurrentLink(editor.state) || '',
      }
      : undefined,
    textColor: editor.commands.addTextColor
      ? {
        isActive: textColor.isActive,
        canExec: editor.commands.addTextColor.canExec({ color: DEFAULT_TEXT_COLOR }),
        color: normalizeHexColor(textColor.color, DEFAULT_TEXT_COLOR),
        command: (color: string) => editor.commands.addTextColor({ color }),
        clear: editor.commands.removeTextColor
          ? () => editor.commands.removeTextColor()
          : undefined,
      }
      : undefined,
    backgroundColor: editor.commands.addBackgroundColor
      ? {
        isActive: backgroundColor.isActive,
        canExec: editor.commands.addBackgroundColor.canExec({ color: DEFAULT_BACKGROUND_COLOR }),
        color: normalizeHexColor(backgroundColor.color, DEFAULT_BACKGROUND_COLOR),
        command: (color: string) => editor.commands.addBackgroundColor({ color }),
        clear: editor.commands.removeBackgroundColor
          ? () => editor.commands.removeBackgroundColor()
          : undefined,
      }
      : undefined,
  }
}

function getCurrentLink(state: EditorState): string | undefined {
  const { $from } = state.selection
  const marks = $from.marksAcross($from)
  if (!marks) {
    return
  }
  for (const mark of marks) {
    if (mark.type.name === 'link') {
      return (mark.attrs as LinkAttrs).href
    }
  }
}

function isActivePaletteColor(selectedColor: string, candidateColor: string): boolean {
  return selectedColor.trim().toLowerCase() === candidateColor.trim().toLowerCase()
}

function ColorPaletteList(props: {
  menuLabel: string
  selectedColor: string
  onSelect: (color: string) => void
  clearLabel: string
  onClear: () => void
}) {
  return (
    <>
      <div className="flex flex-col gap-1 text-gray-900 dark:text-gray-50" role="list" aria-label={props.menuLabel}>
        {GRAPH_DIRECTORY_COLOR_OPTIONS.map((option) => {
          const selected = isActivePaletteColor(props.selectedColor, option.hex)
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => props.onSelect(option.hex)}
              onMouseDown={(event) => event.preventDefault()}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-gray-900 dark:text-gray-50 transition-colors ${selected
                ? 'border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-900'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900/80'}`}
              aria-label={`${props.menuLabel} ${option.label}`}
            >
              <span className="graph-color-swatch" style={{ backgroundColor: option.hex }} aria-hidden="true" />
              <span className="flex-1 text-left">{option.label}</span>
              {selected ? <div className="i-lucide-check size-4 block shrink-0" aria-hidden="true"></div> : null}
            </button>
          )
        })}
      </div>
      <button
        onClick={props.onClear}
        onMouseDown={(event) => event.preventDefault()}
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium text-gray-900 dark:text-gray-50 ring-offset-white dark:ring-offset-gray-950 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-gray-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 h-9 px-3"
      >
        {props.clearLabel}
      </button>
    </>
  )
}

export default function InlineMenu() {
  const editor = useEditor<EditorExtension>()
  const items = useEditorDerivedValue(getInlineMenuItems)

  const [linkMenuOpen, setLinkMenuOpen] = useState(false)
  const [textColorMenuOpen, setTextColorMenuOpen] = useState(false)
  const [backgroundColorMenuOpen, setBackgroundColorMenuOpen] = useState(false)
  const toggleLinkMenuOpen = () => setLinkMenuOpen((open) => !open)
  const toggleTextColorMenuOpen = () => setTextColorMenuOpen((open) => !open)
  const toggleBackgroundColorMenuOpen = () => setBackgroundColorMenuOpen((open) => !open)

  const handleLinkUpdate = (href?: string) => {
    if (href) {
      editor.commands.addLink({ href })
    } else {
      editor.commands.removeLink()
    }

    setLinkMenuOpen(false)
    editor.focus()
  }

  const applyTextColor = (color: string) => {
    items.textColor?.command(color)
    setTextColorMenuOpen(false)
    editor.focus()
  }

  const clearTextColor = () => {
    items.textColor?.clear?.()
    setTextColorMenuOpen(false)
    editor.focus()
  }

  const applyBackgroundColor = (color: string) => {
    items.backgroundColor?.command(color)
    setBackgroundColorMenuOpen(false)
    editor.focus()
  }

  const clearBackgroundColor = () => {
    items.backgroundColor?.clear?.()
    setBackgroundColorMenuOpen(false)
    editor.focus()
  }

  return (
    <>
      <InlinePopover
        data-testid="inline-menu-main"
        className="z-10 box-border border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-lg [&:not([data-state])]:hidden relative flex min-w-32 space-x-1 overflow-auto whitespace-nowrap rounded-md p-1"
        onOpenChange={(open) => {
          if (!open) {
            setLinkMenuOpen(false)
            setTextColorMenuOpen(false)
            setBackgroundColorMenuOpen(false)
          }
        }}
      >
        {items.bold && (
          <Button
            pressed={items.bold.isActive}
            disabled={!items.bold.canExec}
            onClick={items.bold.command}
            tooltip="Bold"
          >
            <div className="i-lucide-bold size-5 block"></div>
          </Button>
        )}
        {items.italic && (
          <Button
            pressed={items.italic.isActive}
            disabled={!items.italic.canExec}
            onClick={items.italic.command}
            tooltip="Italic"
          >
            <div className="i-lucide-italic size-5 block"></div>
          </Button>
        )}
        {items.underline && (
          <Button
            pressed={items.underline.isActive}
            disabled={!items.underline.canExec}
            onClick={items.underline.command}
            tooltip="Underline"
          >
            <div className="i-lucide-underline size-5 block"></div>
          </Button>
        )}
        {items.strike && (
          <Button
            pressed={items.strike.isActive}
            disabled={!items.strike.canExec}
            onClick={items.strike.command}
            tooltip="Strikethrough"
          >
            <div className="i-lucide-strikethrough size-5 block"></div>
          </Button>
        )}
        {items.code && (
          <Button
            pressed={items.code.isActive}
            disabled={!items.code.canExec}
            onClick={items.code.command}
            tooltip="Code"
          >
            <div className="i-lucide-code size-5 block"></div>
          </Button>
        )}
        {items.link && items.link.canExec && (
          <Button
            pressed={items.link.isActive}
            onClick={() => {
              items.link?.command?.()
              toggleLinkMenuOpen()
            }}
            tooltip="Link"
          >
            <div className="i-lucide-link size-5 block"></div>
          </Button>
        )}
        {items.textColor && items.textColor.canExec && (
          <Button
            pressed={items.textColor.isActive}
            onClick={() => {
              setLinkMenuOpen(false)
              setBackgroundColorMenuOpen(false)
              toggleTextColorMenuOpen()
            }}
            tooltip="Text color"
          >
            <span className="relative flex h-5 w-5 items-center justify-center text-sm font-semibold text-gray-900 dark:text-gray-50">
              <span aria-hidden="true">A</span>
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-0 h-1 w-full rounded-full border border-black/8 dark:border-white/10"
                style={{ backgroundColor: items.textColor.color }}
              />
            </span>
          </Button>
        )}
        {items.backgroundColor && items.backgroundColor.canExec && (
          <Button
            pressed={items.backgroundColor.isActive}
            onClick={() => {
              setLinkMenuOpen(false)
              setTextColorMenuOpen(false)
              toggleBackgroundColorMenuOpen()
            }}
            tooltip="Background color"
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-sm border border-gray-300 bg-white text-[11px] font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-50"
              style={{ boxShadow: `inset 0 -0.65rem 0 ${items.backgroundColor.color}` }}
            >
              A
              <span className="sr-only">Background color</span>
            </span>
          </Button>
        )}
      </InlinePopover>

      {items.link && (
        <InlinePopover
          placement="bottom"
          defaultOpen={false}
          open={linkMenuOpen}
          onOpenChange={setLinkMenuOpen}
          data-testid="inline-menu-link"
          className="z-10 box-border border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-lg [&:not([data-state])]:hidden relative flex flex-col w-xs rounded-lg p-4 gap-y-2 items-stretch"
        >
          {linkMenuOpen && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const target = event.target as HTMLFormElement | null
                const href = target?.querySelector('input')?.value?.trim()
                handleLinkUpdate(href)
              }}
            >
              <input
                placeholder="Paste the link..."
                defaultValue={items.link.currentLink}
                className="flex h-9 rounded-md w-full bg-white dark:bg-gray-950 px-3 py-2 text-sm placeholder:text-gray-500 dark:placeholder:text-gray-500 transition border box-border border-gray-200 dark:border-gray-800 border-solid ring-0 ring-transparent focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-gray-300 focus-visible:ring-offset-0 outline-hidden focus-visible:outline-hidden file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50"
              />
            </form>
          )}
          {items.link.isActive && (
            <button
              onClick={() => handleLinkUpdate()}
              onMouseDown={(event) => event.preventDefault()}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white dark:ring-offset-gray-950 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-gray-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-0 bg-gray-900 dark:bg-gray-50 text-gray-50 dark:text-gray-900 hover:bg-gray-900/90 dark:hover:bg-gray-50/90 h-9 px-3"
            >
              Remove link
            </button>
          )}
        </InlinePopover>
      )}

      {items.textColor && (
        <InlinePopover
          placement="bottom"
          defaultOpen={false}
          open={textColorMenuOpen}
          onOpenChange={setTextColorMenuOpen}
          data-testid="inline-menu-text-color"
          className="z-10 box-border border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-lg [&:not([data-state])]:hidden relative flex flex-col w-44 rounded-lg p-4 gap-y-3 items-stretch"
        >
          {textColorMenuOpen && (
            <ColorPaletteList
              menuLabel="Text color"
              selectedColor={items.textColor.color}
              onSelect={applyTextColor}
              clearLabel="Clear text color"
              onClear={clearTextColor}
            />
          )}
        </InlinePopover>
      )}

      {items.backgroundColor && (
        <InlinePopover
          placement="bottom"
          defaultOpen={false}
          open={backgroundColorMenuOpen}
          onOpenChange={setBackgroundColorMenuOpen}
          data-testid="inline-menu-background-color"
          className="z-10 box-border border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-lg [&:not([data-state])]:hidden relative flex flex-col w-48 rounded-lg p-4 gap-y-3 items-stretch"
        >
          {backgroundColorMenuOpen && (
            <ColorPaletteList
              menuLabel="Background color"
              selectedColor={items.backgroundColor.color}
              onSelect={applyBackgroundColor}
              clearLabel="Clear background color"
              onClear={clearBackgroundColor}
            />
          )}
        </InlinePopover>
      )}
    </>
  )
}
