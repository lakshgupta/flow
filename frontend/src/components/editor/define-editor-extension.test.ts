import { describe, expect, it, vi } from 'vitest'

const {
  defineBasicExtension,
  union,
  defineBackgroundColor,
  defineCodeBlockShiki,
  defineHorizontalRule,
  definePlaceholder,
  defineTextColor,
  defineCodeBlockExitKeymap,
  defineHeadingExitKeymap,
  defineCodeBlockView,
  defineImageView,
} = vi.hoisted(() => ({
  defineBasicExtension: vi.fn(() => 'basic-extension'),
  union: vi.fn((...extensions: unknown[]) => extensions),
  defineBackgroundColor: vi.fn(() => 'background-color-extension'),
  defineCodeBlockShiki: vi.fn(() => 'code-block-shiki-extension'),
  defineHorizontalRule: vi.fn(() => 'horizontal-rule-extension'),
  definePlaceholder: vi.fn(({ placeholder }: { placeholder: string }) => `placeholder:${placeholder}`),
  defineTextColor: vi.fn(() => 'text-color-extension'),
  defineCodeBlockExitKeymap: vi.fn(() => 'code-block-exit-keymap-extension'),
  defineHeadingExitKeymap: vi.fn(() => 'heading-exit-keymap-extension'),
  defineCodeBlockView: vi.fn(() => 'code-block-view-extension'),
  defineImageView: vi.fn(() => 'image-view-extension'),
}))

vi.mock('prosekit/basic', () => ({
  defineBasicExtension,
}))

vi.mock('prosekit/core', () => ({
  union,
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

vi.mock('./ui/code-block-view', () => ({
  defineCodeBlockView,
}))

vi.mock('./ui/image-view', () => ({
  defineImageView,
}))

import { defineEditorExtension } from './define-editor-extension'

describe('defineEditorExtension', () => {
  it('registers the custom image node view in the production editor extension', () => {
    const extension = defineEditorExtension('Image ready')

    expect(defineImageView).toHaveBeenCalledTimes(1)
    expect(defineCodeBlockShiki).toHaveBeenCalledWith({ nodeTypes: ['mathBlock'] })
    expect(union).toHaveBeenCalledWith(
      'basic-extension',
      'text-color-extension',
      'background-color-extension',
      'placeholder:Image ready',
      'code-block-shiki-extension',
      'code-block-exit-keymap-extension',
      'heading-exit-keymap-extension',
      'horizontal-rule-extension',
      'image-view-extension',
      'code-block-view-extension',
    )
    expect(extension).toEqual([
      'basic-extension',
      'text-color-extension',
      'background-color-extension',
      'placeholder:Image ready',
      'code-block-shiki-extension',
      'code-block-exit-keymap-extension',
      'heading-exit-keymap-extension',
      'horizontal-rule-extension',
      'image-view-extension',
      'code-block-view-extension',
    ])
  })
})