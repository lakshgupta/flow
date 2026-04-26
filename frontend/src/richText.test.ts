import { describe, expect, it } from 'vitest'

import { editorHTMLToMarkdown, markdownToHTML } from './richText'

describe('richText conversion', () => {
  it('preserves an empty paragraph between blocks', () => {
    const markdown = editorHTMLToMarkdown('<p>alpha</p><p><br></p><p>beta</p>')

    expect(markdown).toContain('<p><br></p>')
    expect(markdownToHTML(markdown)).toContain('<p><br></p>')
  })

  it('preserves a trailing empty paragraph', () => {
    const markdown = editorHTMLToMarkdown('<p>alpha</p><p><br></p>')

    expect(markdown).toContain('<p><br></p>')
    expect(markdownToHTML(markdown)).toContain('<p><br></p>')
  })
})