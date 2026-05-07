import { useEffect, useMemo, useRef } from "react";

import { renderMermaidDiagramSource } from "../lib/mermaid";
import { toErrorMessage } from "../lib/utils";
import { markdownToHTML } from "../richText";
import type { InlineReference } from "../types";

type RenderedMarkdownProps = {
  value: string;
  inlineReferences?: InlineReference[];
  className?: string;
  ariaLabel?: string;
};

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function RenderedMarkdown({ value, inlineReferences, className, ariaLabel }: RenderedMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderPrefixRef = useRef(`flow-rendered-mermaid-${Math.random().toString(36).slice(2)}`);
  const html = useMemo(() => markdownToHTML(value, inlineReferences), [inlineReferences, value]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const mermaidBlocks = Array.from(container.querySelectorAll("pre > code")).filter((code) => {
      return code instanceof HTMLElement && /(^|\s)language-mermaid(\s|$)/.test(code.className);
    });
    if (mermaidBlocks.length === 0) {
      return;
    }

    let cancelled = false;
    const previews: HTMLDivElement[] = [];
    const renderedBlocks: HTMLElement[] = [];

    void (async () => {
      for (const [index, code] of mermaidBlocks.entries()) {
        if (!(code instanceof HTMLElement)) {
          continue;
        }
        const pre = code.parentElement;
        if (!(pre instanceof HTMLElement)) {
          continue;
        }

        const source = code.textContent ?? "";
        if (source.trim() === "") {
          continue;
        }

        const preview = document.createElement("div");
        preview.className = "flow-mermaid-diagram flow-mermaid-diagram-inline flow-mermaid-diagram-loading";
        preview.innerHTML = '<p class="flow-mermaid-diagram-message">Rendering diagram...</p>';
        pre.after(preview);
        previews.push(preview);

        try {
          const rendered = await renderMermaidDiagramSource(source, `${renderPrefixRef.current}-${index}`);
          if (cancelled) {
            return;
          }

          preview.className = "flow-mermaid-diagram flow-mermaid-diagram-inline";
          preview.innerHTML = rendered.svg;
          rendered.bindFunctions?.(preview);
          pre.dataset.mermaidRendered = "true";
          renderedBlocks.push(pre);
        } catch (error) {
          if (cancelled) {
            return;
          }

          preview.className = "flow-mermaid-diagram flow-mermaid-diagram-inline flow-mermaid-diagram-error";
          preview.innerHTML = [
            '<p class="flow-mermaid-diagram-message">Unable to render Mermaid diagram.</p>',
            `<p class="flow-mermaid-diagram-detail">${escapeHTML(toErrorMessage(error))}</p>`,
          ].join("");
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const preview of previews) {
        preview.remove();
      }
      for (const pre of renderedBlocks) {
        delete pre.dataset.mermaidRendered;
      }
    };
  }, [html]);

  return <div ref={containerRef} className={className} aria-label={ariaLabel} dangerouslySetInnerHTML={{ __html: html }} />;
}