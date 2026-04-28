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

  it('collapses repeated BR-only paragraphs to a stable empty paragraph', () => {
    const markdown = editorHTMLToMarkdown('<table><tbody><tr><td><p><br><br><br class="ProseMirror-trailingBreak"></p></td></tr></tbody></table>')

    expect(markdown).not.toContain('<br><br>')
    expect(markdown).toContain('<p><br></p>')
  })

  it('preserves inline reference tokens when converting editor HTML to markdown', () => {
    const markdown = editorHTMLToMarkdown('<p>[[graph2 > Task1]] test</p>')

    expect(markdown).toBe('[[graph2 > Task1]] test\n')
  })

  it('renders legacy escaped inline reference tokens as links when resolved', () => {
    const html = markdownToHTML('\\[\\[graph2 > Task1\\]\\] test', [
      {
        token: '[[graph2 > Task1]]',
        raw: 'graph2 > Task1',
        targetId: 'graph2/task1',
        targetType: 'task',
        targetGraph: 'graph2',
        targetTitle: 'Task1',
        targetPath: 'data/content/graph2/task1.md',
        targetBreadcrumb: 'graph2 > Task1',
      },
    ])

    expect(html).toContain('href="#flow-reference?')
    expect(html).toContain('>Task1</a>')
  })
})