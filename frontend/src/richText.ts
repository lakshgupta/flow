import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const markdown = new MarkdownIt({
  breaks: true,
  html: true,
  linkify: true,
}).use(markdownItAnchor, {
  permalink: false, // don't add permalink symbols
  slugify: (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
});

const turndown = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  headingStyle: "atx",
});

turndown.use(gfm);
turndown.addRule("mark", {
  filter: "mark",
  replacement(content) {
    return `<mark>${content}</mark>`;
  },
});

export function markdownToHTML(value: string): string {
  if (value.trim() === "") {
    return "<p></p>";
  }

  return markdown.render(value);
}

export function editorHTMLToMarkdown(value: string): string {
  const normalized = turndown.turndown(value).trim();
  if (normalized === "") {
    return "";
  }

  return `${normalized}\n`;
}
