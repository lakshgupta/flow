import { describe, expect, it, vi } from 'vitest'

const {
  defineBasicExtension,
  union,
  definePlugin,
  defineBackgroundColor,
  defineCodeBlockShiki,
  defineCodeBlockHighlight,
  defineHorizontalRule,
  defineMath,
  definePlaceholder,
  defineTextColor,
  defineCodeBlockExitKeymap,
  defineHeadingExitKeymap,
  defineTableExitKeymap,
  defineTableDeleteKeymap,
  defineDoubleClickWordSelection,
  defineImageIndentKeymap,
  defineCodeBlockView,
  defineImageView,
  defineImageUploadHandler,
  createFlowImageUploader,
} = vi.hoisted(() => ({
  defineBasicExtension: vi.fn(() => 'basic-extension'),
  union: vi.fn((...extensions: unknown[]) => extensions),
  definePlugin: vi.fn(() => 'plugin-extension'),
  defineBackgroundColor: vi.fn(() => 'background-color-extension'),
  defineCodeBlockShiki: vi.fn(() => 'code-block-shiki-extension'),
  defineCodeBlockHighlight: vi.fn(() => 'code-block-shiki-extension'),
  defineHorizontalRule: vi.fn(() => 'horizontal-rule-extension'),
  defineMath: vi.fn(() => 'math-extension'),
  definePlaceholder: vi.fn(({ placeholder }: { placeholder: string }) => `placeholder:${placeholder}`),
  defineTextColor: vi.fn(() => 'text-color-extension'),
  defineCodeBlockExitKeymap: vi.fn(() => 'code-block-exit-keymap-extension'),
  defineHeadingExitKeymap: vi.fn(() => 'heading-exit-keymap-extension'),
  defineTableExitKeymap: vi.fn(() => 'table-exit-keymap-extension'),
  defineTableDeleteKeymap: vi.fn(() => 'table-delete-keymap-extension'),
  defineDoubleClickWordSelection: vi.fn(() => 'double-click-word-selection-extension'),
  defineImageIndentKeymap: vi.fn(() => 'image-indent-keymap-extension'),
  defineCodeBlockView: vi.fn(() => 'code-block-view-extension'),
  defineImageView: vi.fn(() => 'image-view-extension'),
  defineImageUploadHandler: vi.fn(() => 'image-upload-handler-extension'),
  createFlowImageUploader: vi.fn(() => 'mock-uploader'),
}))

vi.mock('prosekit/basic', () => ({
  defineBasicExtension,
}))

vi.mock('prosekit/core', () => ({
  union,
  definePlugin,
}))

vi.mock('prosekit/extensions/background-color', () => ({
  defineBackgroundColor,
}))

vi.mock('prosekit/extensions/code-block', () => ({
  defineCodeBlockShiki,
  defineCodeBlockHighlight,
}))

vi.mock('prosekit/extensions/horizontal-rule', () => ({
  defineHorizontalRule,
}))

vi.mock('prosekit/extensions/image', () => ({
  defineImageUploadHandler,
}))

vi.mock('prosekit/extensions/math', () => ({
  defineMath,
}))

vi.mock('prosekit/extensions/placeholder', () => ({
  definePlaceholder,
}))

vi.mock('prosekit/extensions/text-color', () => ({
  defineTextColor,
}))

vi.mock('./code-block-exit-keymap', () => ({
  defineCodeBlockExitKeymap,
}))

vi.mock('./heading-exit-keymap', () => ({
  defineHeadingExitKeymap,
}))

vi.mock('./table-exit-keymap', () => ({
  defineTableExitKeymap,
}))

vi.mock('./table-delete-keymap', () => ({
  defineTableDeleteKeymap,
}))

vi.mock('./double-click-word-selection', () => ({
  defineDoubleClickWordSelection,
}))

vi.mock('./image-indent-keymap', () => ({
  defineImageIndentKeymap,
}))

vi.mock('./ui/code-block-view', () => ({
  defineCodeBlockView,
}))

vi.mock('./ui/image-view', () => ({
  defineImageView,
}))

vi.mock('../../lib/imageUploader', () => ({
  createFlowImageUploader,
}))

vi.mock('katex', () => ({
  render: vi.fn(),
}))

import { defineEditorExtension } from './define-editor-extension'

describe('defineEditorExtension', () => {
  it('registers the custom image node view and upload handler in the production editor extension', () => {
    const extension = defineEditorExtension('Image ready')

    expect(defineImageView).toHaveBeenCalledTimes(1)
    // The highlight extension skips diagram languages, so it is built by
    // defineEditorCodeBlockHighlight (which wraps defineCodeBlockHighlight)
    // instead of prosekit's defineCodeBlockShiki.
    expect(defineCodeBlockHighlight).toHaveBeenCalledTimes(1)
    expect(defineCodeBlockShiki).not.toHaveBeenCalled()
    expect(defineMath).toHaveBeenCalledTimes(1)
    expect(union).toHaveBeenCalledWith(
      'basic-extension',
      'text-color-extension',
      'background-color-extension',
      'placeholder:Image ready',
      'code-block-shiki-extension',
      'math-extension',
      'code-block-exit-keymap-extension',
      'heading-exit-keymap-extension',
      'table-exit-keymap-extension',
      'double-click-word-selection-extension',
      'image-indent-keymap-extension',
      'horizontal-rule-extension',
      'image-view-extension',
      'code-block-view-extension',
      'image-upload-handler-extension',
      'table-delete-keymap-extension',
    )
    expect(extension).toEqual([
      'basic-extension',
      'text-color-extension',
      'background-color-extension',
      'placeholder:Image ready',
      'code-block-shiki-extension',
      'math-extension',
      'code-block-exit-keymap-extension',
      'heading-exit-keymap-extension',
      'table-exit-keymap-extension',
      'double-click-word-selection-extension',
      'image-indent-keymap-extension',
      'horizontal-rule-extension',
      'image-view-extension',
      'code-block-view-extension',
      'image-upload-handler-extension',
      'table-delete-keymap-extension',
    ])

    expect(createFlowImageUploader).toHaveBeenCalledTimes(1)
    expect(defineImageUploadHandler).toHaveBeenCalledWith({
      uploader: 'mock-uploader',
      canDrop: expect.any(Function),
      canPaste: expect.any(Function),
      onError: expect.any(Function),
    })
  })
})