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

  it('preserves multiple consecutive empty paragraphs', () => {
    const markdown = editorHTMLToMarkdown('<p>alpha</p><p><br></p><p><br></p><p>beta</p>')
    const html = markdownToHTML(markdown)

    expect((markdown.match(/<p><br><\/p>/g) ?? []).length).toBe(2)
    expect((html.match(/<p><br><\/p>/g) ?? []).length).toBe(2)
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

  it('serializes strikethrough markup with double tildes for markdown round-trips', () => {
    const markdown = editorHTMLToMarkdown('<p><s>retire me</s></p>')

    expect(markdown).toBe('~~retire me~~\n')
    expect(markdownToHTML(markdown)).toContain('<s>retire me</s>')
  })

  it('renders escaped inline reference tokens as links when resolved', () => {
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

  it('preserves nested unordered lists across editor round-trips', () => {
    const sourceHTML = '<ul><li>Parent<ul><li>Child</li></ul></li></ul>'

    const markdown = editorHTMLToMarkdown(sourceHTML)
    const html = markdownToHTML(markdown)

    expect(markdown).toContain('Parent')
    expect(markdown).toContain('Child')
    expect((html.match(/<ul>/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('preserves ordered list nesting under unordered lists', () => {
    const sourceHTML = '<ul><li>Parent<ol><li>Step one</li><li>Step two</li></ol></li></ul>'

    const markdown = editorHTMLToMarkdown(sourceHTML)
    const html = markdownToHTML(markdown)

    expect(markdown).toContain('Step one')
    expect(markdown).toContain('Step two')
    expect(html).toContain('<ol>')
  })

  it('preserves ProseMirror-style nested lists with paragraph-wrapped items', () => {
    const sourceHTML = '<ul><li><p>Parent</p><ul><li><p>Child</p></li></ul></li></ul>'

    const markdown = editorHTMLToMarkdown(sourceHTML)
    const html = markdownToHTML(markdown)

    expect(markdown).toContain('Parent')
    expect(markdown).toContain('Child')
    expect((html.match(/<ul>/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('keeps nested list depth stable across repeated round-trips', () => {
    const baseline = [
      '- Parent',
      '  - Child',
      '    - Grandchild',
      '- Sibling',
      '',
    ].join('\n')
    let markdown = editorHTMLToMarkdown(markdownToHTML(baseline))

    for (let i = 0; i < 9; i += 1) {
      const html = markdownToHTML(markdown)
      const nextMarkdown = editorHTMLToMarkdown(html)
      expect(nextMarkdown).toBe(markdown)
      markdown = nextMarkdown
    }

    expect(markdown).toContain('    - Child')
    expect(markdown).toContain('        - Grandchild')
  })

  it('does not normalize list-like lines inside fenced code blocks', () => {
    const sourceHTML = '<pre><code class="language-markdown">-   keep\n  -   spacing\n</code></pre>'

    const markdown = editorHTMLToMarkdown(sourceHTML)

    expect(markdown).toContain('-   keep')
    expect(markdown).toContain('  -   spacing')
  })
})