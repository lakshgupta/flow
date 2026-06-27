import type { BasicExtension } from 'prosekit/basic'
import type { Uploader } from 'prosekit/extensions/file'
import { useEditor } from 'prosekit/react'
import { AutocompleteList, AutocompletePopover } from 'prosekit/react/autocomplete'
import { useCallback, useRef } from 'react'

import SlashMenuEmpty from './slash-menu-empty'
import SlashMenuItem from './slash-menu-item'

const regex = /\/(\S.*)?$/u

export default function SlashMenu({ onDateRequest, uploader }: { onDateRequest?: () => void; uploader?: Uploader<string> }) {
  const editor = useEditor<BasicExtension>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && uploader) {
      editor.commands.uploadImage({ file, uploader })
    }
    event.target.value = ''
  }, [editor, uploader])

  return (
    <>
    <AutocompletePopover regex={regex} className="relative block max-h-100 min-w-60 select-none overflow-auto whitespace-nowrap p-1 z-10 box-border rounded-lg border border-border bg-popover text-popover-foreground shadow-lg [&:not([data-state])]:hidden">
      <AutocompleteList>
        <SlashMenuItem
          label="Text"
          onSelect={() => editor.commands.setParagraph()}
        />

        <SlashMenuItem
          label="Heading 1"
          kbd="#"
          onSelect={() => editor.commands.setHeading({ level: 1 })}
        />

        <SlashMenuItem
          label="Heading 2"
          kbd="##"
          onSelect={() => editor.commands.setHeading({ level: 2 })}
        />

        <SlashMenuItem
          label="Heading 3"
          kbd="###"
          onSelect={() => editor.commands.setHeading({ level: 3 })}
        />

        <SlashMenuItem
          label="Bullet list"
          kbd="-"
          onSelect={() => editor.commands.wrapInList({ kind: 'bullet' })}
        />

        <SlashMenuItem
          label="Ordered list"
          kbd="1."
          onSelect={() => editor.commands.wrapInList({ kind: 'ordered' })}
        />

        <SlashMenuItem
          label="Task list"
          kbd="[]"
          onSelect={() => editor.commands.wrapInList({ kind: 'task' })}
        />

        <SlashMenuItem
          label="Toggle list"
          kbd=">>"
          onSelect={() => editor.commands.wrapInList({ kind: 'toggle' })}
        />

        <SlashMenuItem
          label="Quote"
          kbd=">"
          onSelect={() => editor.commands.setBlockquote()}
        />

        <SlashMenuItem
          label="Table"
          onSelect={() => editor.commands.insertTable({ row: 3, col: 3 })}
        />

        <SlashMenuItem
          label="Divider"
          kbd="---"
          onSelect={() => editor.commands.insertHorizontalRule()}
        />

        <SlashMenuItem
          label="Code"
          kbd="/code"
          onSelect={() => editor.commands.insertCodeBlock({ language: '' })}
        />

        <SlashMenuItem
          label="Mermaid Diagram"
          kbd="/mermaid"
          onSelect={() => editor.commands.insertCodeBlock({ language: 'mermaid' })}
        />

        {onDateRequest && (
          <SlashMenuItem
            label="Date"
            kbd="📅"
            onSelect={() => onDateRequest()}
          />
        )}

        {uploader && (
          <SlashMenuItem
            label="Image"
            kbd="📷"
            onSelect={handleImageUpload}
          />
        )}

        <SlashMenuEmpty />
      </AutocompleteList>
    </AutocompletePopover>
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleFileChange}
    />
    </>
  )
}