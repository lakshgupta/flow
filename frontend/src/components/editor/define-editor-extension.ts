import { defineBasicExtension } from 'prosekit/basic'
import { union } from 'prosekit/core'
import { defineBackgroundColor } from 'prosekit/extensions/background-color'
import { defineCodeBlockShiki } from 'prosekit/extensions/code-block'
import { defineHorizontalRule } from 'prosekit/extensions/horizontal-rule'
import { defineImageUploadHandler, type ImageCanDropPredicate, type ImageCanPastePredicate } from 'prosekit/extensions/image'
import { defineMath } from 'prosekit/extensions/math'
import { definePlaceholder } from 'prosekit/extensions/placeholder'
import { defineTextColor } from 'prosekit/extensions/text-color'
import { render as renderKaTeX } from 'katex'

import { createFlowImageUploader } from '../../lib/imageUploader'
import { defineCodeBlockExitKeymap } from './code-block-exit-keymap'
import { defineHeadingExitKeymap } from './heading-exit-keymap'
import { defineImageIndentKeymap } from './image-indent-keymap'
import { defineCodeBlockView } from './ui/code-block-view'
import { defineDiagLogPlugin } from './diag-log-plugin'
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
    // Keep the Shiki extension mounted but avoid parsing custom diagram languages
    // (for example `excalidraw`) as regular code blocks.
    // `nodeTypes` here is the list of ProseMirror node types that receive
    // Shiki syntax highlighting decorations, not a list of languages. The
    // default is `['codeBlock', 'mathBlock']`, which is what we want.
    defineCodeBlockShiki(),
    defineMath({
      renderMathBlock: (text, element) => renderKaTeX(text, element, { displayMode: true, throwOnError: false, output: 'mathml' }),
      renderMathInline: (text, element) => renderKaTeX(text, element, { displayMode: false, throwOnError: false, output: 'mathml' }),
    }),
    defineCodeBlockExitKeymap(),
    defineHeadingExitKeymap(),
    defineImageIndentKeymap(),
    defineHorizontalRule(),
    defineImageView(),
    defineCodeBlockView(),
    defineImageUploadHandler({
      uploader: createFlowImageUploader(getDocumentPath ?? (() => undefined)),
      canDrop: canDropImage,
      canPaste: canPasteImage,
      onError: onImageUploadError,
    }),
  )
}

export type EditorExtension = ReturnType<typeof defineEditorExtension>
