import { defineBasicExtension } from 'prosekit/basic'
import { union } from 'prosekit/core'
import { defineBackgroundColor } from 'prosekit/extensions/background-color'
import { defineCodeBlockShiki } from 'prosekit/extensions/code-block'
import { defineHorizontalRule } from 'prosekit/extensions/horizontal-rule'
import { definePlaceholder } from 'prosekit/extensions/placeholder'
import { defineTextColor } from 'prosekit/extensions/text-color'

import { defineCodeBlockExitKeymap } from './code-block-exit-keymap'
import { defineHeadingExitKeymap } from './heading-exit-keymap'
import { defineCodeBlockView } from './ui/code-block-view'
import { defineImageView } from './ui/image-view'

export function defineEditorExtension(placeholder = 'Start writing…') {
  return union(
    defineBasicExtension(),
    defineTextColor(),
    defineBackgroundColor(),
    definePlaceholder({ placeholder }),
    // Keep the Shiki extension mounted but avoid parsing custom diagram languages
    // (for example `excalidraw`) as regular code blocks.
    defineCodeBlockShiki({ nodeTypes: ['mathBlock'] }),
    defineCodeBlockExitKeymap(),
    defineHeadingExitKeymap(),
    defineHorizontalRule(),
    defineImageView(),
    defineCodeBlockView(),
  )
}

export type EditorExtension = ReturnType<typeof defineEditorExtension>
