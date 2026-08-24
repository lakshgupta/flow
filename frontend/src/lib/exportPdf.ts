import { markdownToHTML } from "../richText";
import { requestJSON } from "./api";
import { renderPrintDiagrams } from "./print-diagrams";
import type { DocumentResponse } from "../types";

/**
 * Sanitize a document or graph title for use as a filename:
 * strips characters illegal on Windows/macOS, trims whitespace, falls back
 * to a generic name, and caps at 120 chars.
 */
export function sanitizeFilename(title: string): string {
  const trimmed = title.trim();
  if (trimmed === "") {
    return "Flow-export";
  }
  const cleaned = trimmed.replace(/[/\\:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned === "") {
    return "Flow-export";
  }
  return cleaned.slice(0, 120);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type PrintNode = {
  id: string;
  title: string;
  type: string;
  status?: string;
  body: string;
  run?: string;
};

export function buildPrintHtml(nodes: PrintNode[], filenameTitle: string): string {
  const title = escapeHtml(filenameTitle);
  const style = `
    @page { margin: 1.8cm 1.6cm; size: A4; }
    @media print { .no-print { display: none; } }
    :root { --border: #e8e8e8; --muted:#f6f6f6; --foreground:#111827; --primary:#7c8cf8; --muted-foreground:#6b7280; --card:#ffffff; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif; color: var(--foreground); background: #fff; line-height: 1.6; }
    .export-cover { padding: 2.5rem 0 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
    .export-cover h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em; }
    .export-cover .subtitle { margin-top: 0.35rem; color: var(--muted-foreground); font-size: 13px; }
    .export-node { break-inside: avoid; page-break-inside: avoid; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
    .export-node:last-child { border-bottom: none; }
    .export-node-title { margin: 0 0 0.6rem; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
    .export-badges { display: flex; gap: 6px; margin-bottom: 0.6rem; }
    .export-badge { font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); background: #eef2ff; color: #4338ca; }
    .export-badge-status { background: var(--muted); color: var(--muted-foreground); }
    .export-body { font-size: 14px; line-height: 1.7; overflow-wrap: break-word; }
    .export-body p { margin: 0 0 0.8em; }
    .export-body h1,.export-body h2,.export-body h3 { margin: 1.1em 0 0.4em; line-height: 1.3; }
    .export-body h1{font-size:1.35em} .export-body h2{font-size:1.2em; border-bottom:1px solid var(--border); padding-bottom:0.15em} .export-body h3{font-size:1.05em}
    .export-body ul,.export-body ol{ margin: 0.3em 0 0.8em; padding-left: 1.4rem; }
    .export-body li::marker{ color: #7c8cf8; }
    .export-body a{ color: var(--primary); }
    .export-body code{ font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.88em; background: #f3f4f6; padding: 0.15em 0.35em; border-radius: 6px; }
    .export-body pre{ background: var(--muted); border: 1px solid var(--border); border-radius: 8px; padding: 0.9em 1em; overflow-x: auto; }
    .export-body pre code{ background: none; padding: 0; }
    .export-body blockquote{ border-left: 3px solid #c7d2fe; background: #eef2ff55; margin: 0.8em 0; padding: 0.5em 1em; border-radius: 0 8px 8px 0; color: #4b5563; }
    .export-body table{ width: 100%; border-collapse: collapse; margin: 0.8em 0; font-size: 0.92em; }
    .export-body th,.export-body td{ border:1px solid var(--border); padding:0.4em 0.6em; text-align:left; }
    .export-body th{ background: var(--muted); font-weight:600; }
    .export-run{ font-family: ui-monospace, monospace; background: var(--muted); border: 1px solid var(--border); border-radius: 8px; padding: 0.9em 1em; white-space: pre-wrap; word-break: break-all; }
    .print-diagram { break-inside: avoid; page-break-inside: avoid; margin: 1em 0; text-align: center; }
    .print-diagram svg { max-width: 100%; height: auto; }
    .print-diagram-mermaid svg { display: block; margin: 0 auto; }
    .print-diagram-caption { font-size: 11px; color: var(--muted-foreground); margin-top: 0.4em; }
  `;

  const nodesHtml = nodes
    .map((node) => {
      const badgeType = escapeHtml(node.type);
      const statusBadge =
        node.status != null && node.status !== ""
          ? `<span class="export-badge export-badge-status">${escapeHtml(node.status)}</span>`
          : "";
      const bodyHtml =
        node.type === "command" && node.run != null && node.run !== ""
          ? `<pre class="export-run">${escapeHtml(node.run)}</pre>`
          : markdownToHTML(node.body ?? "");

      return `<section class="export-node">
        <div class="export-badges"><span class="export-badge">${badgeType}</span>${statusBadge}</div>
        <h2 class="export-node-title">${escapeHtml(node.title)}</h2>
        <div class="export-body">${bodyHtml}</div>
      </section>`;
    })
    .join("\n");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${style}</style></head>
  <body>
    <div class="export-cover"><h1>${title}</h1><div class="subtitle">Flow export · ${nodes.length} node${nodes.length === 1 ? "" : "s"} · ${new Date().toLocaleDateString()}</div></div>
    ${nodesHtml}
  </body></html>`;
}

function buildPrintFilename(title: string, count: number): string {
  const base = sanitizeFilename(title);
  if (count <= 1) {
    return base + ".pdf";
  }
  return base + ".pdf";
}

export async function printNodesAsPdf(nodeIds: string[], preferredTitle?: string): Promise<void> {
  if (nodeIds.length === 0) {
    return;
  }

  const nodes: PrintNode[] = [];
  for (const id of nodeIds) {
    // eslint-disable-next-line no-await-in-loop -- sequential keeps error handling simple and N is small.
    const doc = await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(id)}`);
    nodes.push({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      status: doc.status,
      body: doc.body,
      run: (doc as { run?: string }).run,
    });
  }

  const filenameTitle =
    preferredTitle != null && preferredTitle.trim() !== ""
      ? preferredTitle.trim()
      : nodes.length === 1
        ? nodes[0].title
        : `Selection — ${nodes[0].title} + ${nodes.length - 1} more`;
  // Render mermaid/excalidraw fences into inline SVG diagrams at their
  // original positions before the browser prints the page.
  const html = await renderPrintDiagrams(buildPrintHtml(nodes, filenameTitle));

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:0;";
  document.body.appendChild(iframe);

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 1000);
  };

  const doc = iframe.contentDocument;
  if (doc == null) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Give the iframe a moment to finish rendering (fonts, diagram SVGs are
  // already inlined as HTML).
  await new Promise<void>((resolve) => window.setTimeout(resolve, 350));

  const win = iframe.contentWindow;
  if (win == null) {
    cleanup();
    return;
  }

  // Hint the filename via the iframe document title; the browser's Save dialog
  // will suggest it. Building the PDF itself is delegated to the browser's
  // print-to-PDF.
  try {
    doc.title = buildPrintFilename(filenameTitle, nodes.length).replace(/\.pdf$/i, "");
  } catch {
    // ignore
  }

  win.focus();
  win.print();
  cleanup();
}
