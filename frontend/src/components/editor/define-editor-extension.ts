import { defineBasicExtension } from 'prosekit/basic'
import { union } from 'prosekit/core'
import { defineBackgroundColor } from 'prosekit/extensions/background-color'
import { defineHorizontalRule } from 'prosekit/extensions/horizontal-rule'
import { defineImageUploadHandler, type ImageCanDropPredicate, type ImageCanPastePredicate } from 'prosekit/extensions/image'
import { defineMath } from 'prosekit/extensions/math'
import { definePlaceholder } from 'prosekit/extensions/placeholder'
import { defineTextColor } from 'prosekit/extensions/text-color'
import { render as renderKaTeX } from 'katex'

import { createFlowImageUploader } from '../../lib/imageUploader'
import { defineCodeBlockExitKeymap } from './code-block-exit-keymap'
import { defineEditorCodeBlockHighlight } from './define-editor-highlight'
import { defineHeadingExitKeymap } from './heading-exit-keymap'
import { defineTableExitKeymap } from './table-exit-keymap'
import { defineTableDeleteKeymap } from './table-delete-keymap'
import { defineDoubleClickWordSelection } from './double-click-word-selection'
import { defineImageIndentKeymap } from './image-indent-keymap'
import { defineSearchHighlight } from './search-highlight'
import { defineCodeBlockView } from './ui/code-block-view'
import { defineImageView } from './ui/image-view'
import { hasImageExtension } from './image-utils'

/** Accepts files whose MIME type starts with `image/` or that have a
 *  recognised image file extension. The extension fallback is essential for
 *  the Wails desktop app on Linux where `file.type` is often empty when
 *  dragging from a file manager (WebKitGTK). */
const canDropImage: ImageCanDropPredicate = ({ file }) =>
  file.type.startsWith('image/') || hasImageExtension(file.name)

const canPasteImage: ImageCanPastePredicate = ({ file }) =>
  file.type.startsWith('image/') || hasImageExtension(file.name)

const onImageUploadError = ({ file, error }: { file: File; error: unknown }) => {
  console.error('[flow] Image upload failed', { fileName: file.name, fileType: file.type, error })
}

export function defineEditorExtension(
  placeholder = 'Start writing…',
  getDocumentPath?: () => string | undefined,
) {
  return union(
    defineBasicExtension(),
    defineTextColor(),
    defineBackgroundColor(),
    definePlaceholder({ placeholder }),
    // Keep the Shiki highlighter mounted but skip custom diagram languages
    // (mermaid, excalidraw) — their source is rendered as labeled sections, and
    // shiki cannot resolve the `excalidraw` language. `nodeTypes` stays the
    // default `['codeBlock', 'mathBlock']`.
    defineEditorCodeBlockHighlight(),
    defineMath({
      renderMathBlock: (text, element) => renderKaTeX(text, element, { displayMode: true, throwOnError: false, output: 'mathml' }),
      renderMathInline: (text, element) => renderKaTeX(text, element, { displayMode: false, throwOnError: false, output: 'mathml' }),
    }),
    defineCodeBlockExitKeymap(),
    defineHeadingExitKeymap(),
    defineTableExitKeymap(),
    defineDoubleClickWordSelection(),
    defineImageIndentKeymap(),
    defineHorizontalRule(),
    defineSearchHighlight(),
    defineImageView(),
    defineCodeBlockView(),
    defineImageUploadHandler({
      uploader: createFlowImageUploader(getDocumentPath ?? (() => undefined)),
      canDrop: canDropImage,
      canPaste: canPasteImage,
      onError: onImageUploadError,
    }),
    // Registered last so it has the highest keymap priority: it must preempt
    // the tables plugin's Backspace/Delete handling (deleteCellSelection)
    // for whole-table selections.
    defineTableDeleteKeymap(),
  )
}

export type EditorExtension = ReturnType<typeof defineEditorExtension>
