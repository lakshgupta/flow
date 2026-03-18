import { describe, expect, it } from "vitest";

import { editorHTMLToMarkdown, markdownToHTML } from "./richText";

describe("richText helpers", () => {
  it("renders markdown and inline mark tags to editor HTML", () => {
    const html = markdownToHTML("# Heading\n\nParagraph with <mark>highlight</mark>.");

    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("<mark>highlight</mark>");
  });

  it("serializes supported formatting back to markdown-compatible output", () => {
    const markdown = editorHTMLToMarkdown([
      "<h2>Section</h2>",
      "<p><strong>Bold</strong> <em>Italic</em> <a href=\"https://example.com\">Link</a> <mark>Hit</mark></p>",
      "<blockquote><p>Quoted</p></blockquote>",
      "<pre><code class=\"language-ts\">const value = 1;\n</code></pre>",
      "<ul data-type=\"taskList\"><li><input type=\"checkbox\" checked=\"checked\" />Done</li></ul>",
    ].join(""));

    expect(markdown).toContain("## Section");
    expect(markdown).toContain("**Bold**");
    expect(markdown).toContain("_Italic_");
    expect(markdown).toContain("[Link](https://example.com)");
    expect(markdown).toContain("<mark>Hit</mark>");
    expect(markdown).toContain("> Quoted");
    expect(markdown).toContain("const value = 1;");
    expect(markdown).toContain("[x] Done");
  });
});
