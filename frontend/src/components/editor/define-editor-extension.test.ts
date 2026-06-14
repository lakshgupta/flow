import { describe, expect, it, vi } from 'vitest'

const {
  defineBasicExtension,
  union,
  definePlugin,
  defineBackgroundColor,
  defineCodeBlockShiki,
  defineHorizontalRule,
  defineMath,
  definePlaceholder,
  defineTextColor,
  defineCodeBlockExitKeymap,
  defineHeadingExitKeymap,
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
  defineHorizontalRule: vi.fn(() => 'horizontal-rule-extension'),
  defineMath: vi.fn(() => 'math-extension'),
  definePlaceholder: vi.fn(({ placeholder }: { placeholder: string }) => `placeholder:${placeholder}`),
  defineTextColor: vi.fn(() => 'text-color-extension'),
  defineCodeBlockExitKeymap: vi.fn(() => 'code-block-exit-keymap-extension'),
  defineHeadingExitKeymap: vi.fn(() => 'heading-exit-keymap-extension'),
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
    expect(defineCodeBlockShiki).toHaveBeenCalledWith()
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
      'image-indent-keymap-extension',
      'horizontal-rule-extension',
      'image-view-extension',
      'code-block-view-extension',
      'image-upload-handler-extension',
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
      'image-indent-keymap-extension',
      'horizontal-rule-extension',
      'image-view-extension',
      'code-block-view-extension',
      'image-upload-handler-extension',
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