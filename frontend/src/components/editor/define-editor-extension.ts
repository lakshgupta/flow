import { defineBasicExtension } from 'prosekit/basic'
import { union } from 'prosekit/core'
import { defineCodeBlockShiki } from 'prosekit/extensions/code-block'
import { defineHorizontalRule } from 'prosekit/extensions/horizontal-rule'
import { definePlaceholder } from 'prosekit/extensions/placeholder'

import { defineCodeBlockView } from './ui/code-block-view'

export function defineEditorExtension(placeholder = 'Start writing…') {
  return union(
    defineBasicExtension(),
    definePlaceholder({ placeholder }),
    defineCodeBlockShiki(),
    defineHorizontalRule(),
    defineCodeBlockView(),
  )
}

export type EditorExtension = ReturnType<typeof defineEditorExtension>
