import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

import { slugifyValue } from "./lib/docUtils";
import type { InlineReference } from "./types";

const INLINE_REFERENCE_PATTERN = /\[\[([^\[\]\n]+)\]\]/g;
const FLOW_REFERENCE_HASH_PREFIX = "#flow-reference?";
const EMPTY_PARAGRAPH_MARKUP = "<p><br></p>";

const markdown = new MarkdownIt({
  breaks: true,
  html: true,
  linkify: true,
}).use(markdownItAnchor, {
  permalink: false, // don't add permalink symbols
  slugify: slugifyValue,
});

const turndown = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  headingStyle: "atx",
});

turndown.use(gfm);
turndown.addRule("emptyParagraph", {
  filter(node) {
    if (!(node instanceof Element) || node.tagName !== "P") {
      return false;
    }

    if (node.textContent?.trim() !== "") {
      return false;
    }

    return Array.from(node.childNodes).every((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        return child.textContent?.trim() === "";
      }

      return child instanceof HTMLBRElement;
    });
  },
  replacement() {
    return `\n\n${EMPTY_PARAGRAPH_MARKUP}\n\n`;
  },
});
turndown.addRule("flowInlineReference", {
  filter(node) {
    if (!(node instanceof Element) || node.tagName !== "A") {
      return false;
    }

    return parseFlowReferenceHref(node.getAttribute("href") ?? "") !== null;
  },
  replacement(_content, node) {
    if (!(node instanceof Element)) {
      return "";
    }

    return parseFlowReferenceHref(node.getAttribute("href") ?? "")?.token ?? "";
  },
});
turndown.addRule("mark", {
  filter: "mark",
  replacement(content) {
    return `<mark>${content}</mark>`;
  },
});

export function markdownToHTML(value: string, inlineReferences?: InlineReference[]): string {
  if (value.trim() === "") {
    return "<p></p>";
  }

  return markdown.render(renderResolvedInlineReferences(value, inlineReferences));
}

export function editorHTMLToMarkdown(value: string): string {
  const normalized = turndown.turndown(value).trim();
  if (normalized === "") {
    return "";
  }

  return `${normalized}\n`;
}

export function parseFlowReferenceHref(href: string): { documentId: string; graphPath: string; token: string } | null {
  const markerIndex = href.indexOf(FLOW_REFERENCE_HASH_PREFIX);
  if (markerIndex < 0) {
    return null;
  }

  const query = href.slice(markerIndex + FLOW_REFERENCE_HASH_PREFIX.length);
  const params = new URLSearchParams(query);
  const documentId = (params.get("target") ?? "").trim();
  const token = params.get("token") ?? "";
  if (documentId === "" || token === "") {
    return null;
  }

  return {
    documentId,
    graphPath: (params.get("graph") ?? "").trim(),
    token,
  };
}

function renderResolvedInlineReferences(value: string, inlineReferences?: InlineReference[]): string {
  if ((inlineReferences?.length ?? 0) === 0) {
    return value;
  }

  const referencesByToken = new Map((inlineReferences ?? []).map((reference) => [reference.token, reference]));
  return value.replace(INLINE_REFERENCE_PATTERN, (match) => {
    const reference = referencesByToken.get(match);
    if (!reference) {
      return match;
    }

    return `<a href="${escapeHTML(buildFlowReferenceHref(reference))}">${escapeHTML(reference.targetTitle)}</a>`;
  });
}

function buildFlowReferenceHref(reference: InlineReference): string {
  const params = new URLSearchParams();
  params.set("target", reference.targetId);
  if (reference.targetGraph.trim() !== "") {
    params.set("graph", reference.targetGraph);
  }
  params.set("token", reference.token);
  return `${FLOW_REFERENCE_HASH_PREFIX}${params.toString()}`;
}

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
