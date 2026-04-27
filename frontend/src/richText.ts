import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

import { slugifyValue } from "./lib/docUtils";
import type { InlineReference } from "./types";

const INLINE_REFERENCE_PATTERN = /\[\[([^\[\]\n]+)\]\]/g;
const ESCAPED_INLINE_REFERENCE_PATTERN = /\\\[\\\[([^\[\]\n]+)\\\]\\\]/g;
const FLOW_REFERENCE_HASH_PREFIX = "#flow-reference?";
const FLOW_DATE_HASH_PREFIX = "#flow-date?";
const ISO_DATE_PATTERN = /\b(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/g;
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
turndown.addRule("flowDateLink", {
  filter(node) {
    if (!(node instanceof Element) || node.tagName !== "A") {
      return false;
    }
    return parseFlowDateHref(node.getAttribute("href") ?? "") !== null;
  },
  replacement(_content, node) {
    if (!(node instanceof Element)) {
      return "";
    }
    return parseFlowDateHref(node.getAttribute("href") ?? "")?.date ?? "";
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
  const normalizedValue = normalizeInlineReferenceTokens(value);
  if (normalizedValue.trim() === "") {
    return "<p></p>";
  }

  const html = markdown.render(renderResolvedInlineReferences(normalizedValue, inlineReferences));
  return linkifyDates(html);
}

export function editorHTMLToMarkdown(value: string): string {
  const normalized = normalizeInlineReferenceTokens(turndown.turndown(value)).trim();
  if (normalized === "") {
    return "";
  }

  return `${normalized}\n`;
}

export function parseFlowDateHref(href: string): { date: string } | null {
  const markerIndex = href.indexOf(FLOW_DATE_HASH_PREFIX);
  if (markerIndex < 0) {
    return null;
  }

  const query = href.slice(markerIndex + FLOW_DATE_HASH_PREFIX.length);
  const params = new URLSearchParams(query);
  const date = (params.get("date") ?? "").trim();
  if (!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(date)) {
    return null;
  }

  return { date };
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

function normalizeInlineReferenceTokens(value: string): string {
  return value.replace(ESCAPED_INLINE_REFERENCE_PATTERN, '[[$1]]');
}

/** Wraps ISO date strings in rendered HTML (outside of existing anchors) as flow-date links. */
function linkifyDates(html: string): string {
  // Parse the HTML, walk text nodes outside <a> tags, and wrap dates.
  if (typeof document === "undefined") {
    // SSR / test environments without DOM — apply a simple regex pass instead.
    return html.replace(ISO_DATE_PATTERN, (date) => {
      const params = new URLSearchParams({ date });
      return `<a href="${FLOW_DATE_HASH_PREFIX}${params.toString()}" class="flow-date-link">${date}</a>`;
    });
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  const root = template.content;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip text inside existing anchors.
      let parent = node.parentElement;
      while (parent !== null) {
        if (parent.tagName === "A") return NodeFilter.FILTER_REJECT;
        parent = parent.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current !== null) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? "";
    if (!ISO_DATE_PATTERN.test(text)) {
      ISO_DATE_PATTERN.lastIndex = 0;
      continue;
    }
    ISO_DATE_PATTERN.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    ISO_DATE_PATTERN.lastIndex = 0;
    while ((match = ISO_DATE_PATTERN.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      const anchor = document.createElement("a");
      const params = new URLSearchParams({ date: match[1] });
      anchor.setAttribute("href", `${FLOW_DATE_HASH_PREFIX}${params.toString()}`);
      anchor.className = "flow-date-link";
      anchor.textContent = match[1];
      fragment.appendChild(anchor);
      lastIndex = match.index + match[0].length;
    }
    ISO_DATE_PATTERN.lastIndex = 0;
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  const div = document.createElement("div");
  div.appendChild(root);
  return div.innerHTML;
}

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
