import { renderMermaidDiagramSource } from "./mermaid";

/**
 * Renders diagram code blocks (mermaid, excalidraw) into print-ready inline
 * SVG for PDF export. Each rendered diagram replaces its source fence at the
 * exact position it occupied in the document.
 */

const MERMAID_START_DIRECTIVE =
  /^(?:C4(?:Context|Container|Component|Dynamic|Deployment)|graph|flowchart|erDiagram|gitGraph|gantt|info|pie|quadrantChart|xychart(?:-beta)?|requirement(?:Diagram)?|sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|journey|timeline|mindmap|kanban|sankey(?:-beta)?|packet(?:-beta)?|radar-beta|block(?:-beta)?|treeView-beta|architecture|ishikawa(?:-beta)?|venn-beta|treemap|wardley-beta)\b/i;

type ExcalidrawModule = typeof import("@excalidraw/excalidraw");

let excalidrawModulePromise: Promise<ExcalidrawModule> | null = null;

function loadExcalidraw(): Promise<ExcalidrawModule> {
  if (excalidrawModulePromise === null) {
    excalidrawModulePromise = import("@excalidraw/excalidraw");
  }
  return excalidrawModulePromise;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Strip a committed title line so mermaid receives pure source syntax. */
function stripMermaidTitleLine(text: string): string {
  const newlineIndex = text.indexOf("\n");
  if (newlineIndex === -1) return text;
  const firstLine = text.slice(0, newlineIndex).trim();
  if (firstLine === "" || MERMAID_START_DIRECTIVE.test(firstLine)) {
    return text;
  }
  return text.slice(newlineIndex + 1);
}

async function renderMermaidBlock(source: string, index: number): Promise<string | null> {
  try {
    const trimmed = stripMermaidTitleLine(source).trim();
    if (trimmed === "") return null;
    const { svg } = await renderMermaidDiagramSource(trimmed, `flow-print-mermaid-${index}`);
    return `<div class="print-diagram print-diagram-mermaid"><div class="flow-mermaid-diagram flow-mermaid-diagram-ready">${svg}</div></div>`;
  } catch {
    // Rendering failed — keep the fenced source in the PDF rather than nothing.
    return null;
  }
}

async function renderExcalidrawBlock(sceneText: string): Promise<string | null> {
  try {
    const data = JSON.parse(sceneText) as Record<string, unknown>;
    if (!Array.isArray(data.elements) || data.elements.length === 0) return null;
    const mod = await loadExcalidraw();
    const appState =
      typeof data.appState === "object" && data.appState !== null
        ? (data.appState as Record<string, unknown>)
        : {};
    const svg = await mod.exportToSvg({
      elements: data.elements as never,
      appState: {
        ...appState,
        exportBackground: true,
        viewBackgroundColor: "#ffffff",
      } as never,
      files: typeof data.files === "object" && data.files !== null ? (data.files as never) : {},
    });
    const title = typeof data.flowTitle === "string" ? data.flowTitle.trim() : "";
    const caption = title !== "" ? `<figcaption class="print-diagram-caption">${escapeHtml(title)}</figcaption>` : "";
    return `<figure class="print-diagram print-diagram-excalidraw">${svg.outerHTML}${caption}</figure>`;
  } catch {
    return null;
  }
}

/**
 * Replace every mermaid/excalidraw code fence in the HTML with its rendered
 * diagram, preserving document order. Blocks that fail to render are left as
 * fenced source. Returns the transformed HTML.
 */
export async function renderPrintDiagrams(html: string): Promise<string> {
  if (!html.includes("language-mermaid") && !html.includes("language-excalidraw")) {
    return html;
  }

  if (typeof DOMParser === "undefined") return html;

  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");

  const replacements: Array<{ node: Element; html: string }> = [];

  const mermaidBlocks = Array.from(doc.querySelectorAll("pre > code.language-mermaid"));
  await Promise.all(
    mermaidBlocks.map(async (code, index) => {
      const pre = code.parentElement;
      if (pre === null) return;
      const rendered = await renderMermaidBlock(code.textContent ?? "", index);
      if (rendered !== null) {
        replacements.push({ node: pre, html: rendered });
      }
    }),
  );

  const excalidrawBlocks = Array.from(doc.querySelectorAll("pre > code.language-excalidraw"));
  await Promise.all(
    excalidrawBlocks.map(async (code) => {
      const pre = code.parentElement;
      if (pre === null) return;
      const rendered = await renderExcalidrawBlock(code.textContent ?? "");
      if (rendered !== null) {
        replacements.push({ node: pre, html: rendered });
      }
    }),
  );

  for (const { node, html: replacement } of replacements) {
    node.outerHTML = replacement;
  }

  return doc.body.innerHTML;
}
