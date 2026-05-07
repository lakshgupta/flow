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
const EMPTY_PARAGRAPH_TEXT_PATTERN = /^[\s\u00A0\u200B\u2060\uFEFF]*$/;

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
    return node instanceof Element && isSemanticallyEmptyParagraph(node);
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
turndown.addRule("strikethrough", {
  filter(node) {
    return node instanceof Element && ["S", "STRIKE", "DEL"].includes(node.tagName);
  },
  replacement(content) {
    return content === "" ? "" : `~~${content}~~`;
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
  const normalizedHTML = normalizeEmptyParagraphMarkup(value);
  const normalized = normalizeMarkdownListSpacing(normalizeInlineReferenceTokens(turndown.turndown(normalizedHTML))).trim();
  if (normalized === "") {
    return "";
  }

  return `${normalized}\n`;
}

function normalizeEmptyParagraphMarkup(value: string): string {
  if (typeof document !== "undefined") {
    const template = document.createElement("template");
    template.innerHTML = value;

    template.content.querySelectorAll("p").forEach((paragraph) => {
      if (isSemanticallyEmptyParagraph(paragraph)) {
        paragraph.innerHTML = "<br>";
      }
    });

    return template.innerHTML;
  }

  // ProseMirror may emit BR-only paragraphs with multiple <br> nodes; collapse
  // them to a stable representation to avoid growth across save/reload cycles.
  return value.replace(/<p>(?:\s*<br(?:\s[^>]*)?>\s*)+<\/p>/gi, EMPTY_PARAGRAPH_MARKUP);
}

function isSemanticallyEmptyParagraph(node: Element): boolean {
  if (node.tagName !== "P") {
    return false;
  }

  if (!isSemanticallyEmptyText(node.textContent)) {
    return false;
  }

  return Array.from(node.childNodes).every((child) => isSemanticallyEmptyChild(child));
}

function isSemanticallyEmptyChild(node: ChildNode): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    return isSemanticallyEmptyText(node.textContent);
  }

  if (!(node instanceof Element)) {
    return false;
  }

  if (node instanceof HTMLBRElement) {
    return true;
  }

  return isSemanticallyEmptyText(node.textContent) && Array.from(node.childNodes).every((child) => isSemanticallyEmptyChild(child));
}

function isSemanticallyEmptyText(value: string | null | undefined): boolean {
  return EMPTY_PARAGRAPH_TEXT_PATTERN.test(value ?? "");
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

export function parseFlowAssetHref(href: string): {
  href: string;
  path: string;
  name: string;
  isPDF: boolean;
  threadKind: "pdf" | "text" | null;
  isThreadViewable: boolean;
} | null {
  let parsed: URL
  try {
    parsed = new URL(href, "http://flow.local")
  } catch {
    return null
  }

  if (parsed.pathname !== "/api/files") {
    return null
  }

  const pathValue = (parsed.searchParams.get("path") ?? "").trim()
  if (pathValue === "") {
    return null
  }

  let decodedPath = pathValue
  try {
    decodedPath = decodeURIComponent(pathValue)
  } catch {
    // Keep original query value when URL decoding fails.
  }

  const segments = decodedPath.split("/")
  const name = segments.length > 0 ? (segments[segments.length - 1] || "attachment") : "attachment"
  const normalizedHref = `${parsed.pathname}${parsed.search}`
  const lowerName = name.toLowerCase()
  const isPDF = lowerName.endsWith(".pdf")
  const textThreadExtensions = new Set([
    ".txt", ".md", ".markdown", ".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".go", ".java", ".rb",
    ".rs", ".c", ".cc", ".cpp", ".h", ".hpp", ".cs", ".php", ".swift", ".kt", ".kts",
    ".sh", ".bash", ".zsh", ".fish", ".ps1", ".css", ".scss", ".less", ".html", ".xml",
    ".sql", ".csv", ".tsv", ".log",
  ])
  const extensionMatch = lowerName.match(/(\.[a-z0-9]+)$/)
  const hasTextExtension = extensionMatch !== null && textThreadExtensions.has(extensionMatch[1])
  const threadKind: "pdf" | "text" | null = isPDF ? "pdf" : hasTextExtension ? "text" : null

  return {
    href: normalizedHref,
    path: decodedPath,
    name,
    isPDF,
    threadKind,
    isThreadViewable: threadKind !== null,
  }
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

function normalizeMarkdownListSpacing(value: string): string {
  const lines = value.split("\n");
  const normalizedLines: string[] = [];
  let openFence: "```" | "~~~" | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1].startsWith("`") ? "```" : "~~~";
      if (openFence === null) {
        openFence = marker;
      } else if (openFence === marker) {
        openFence = null;
      }
      normalizedLines.push(line);
      continue;
    }

    if (openFence !== null) {
      normalizedLines.push(line);
      continue;
    }

    // Keep list indentation intact, but collapse excessive spacing after the marker
    // so repeated round-trips do not keep changing list line formatting.
    normalizedLines.push(line.replace(/^(\s*(?:>\s*)*)([-*+]|\d+[.)])\s{2,}(?=\S)/, "$1$2 "));
  }

  return normalizedLines.join("\n");
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
