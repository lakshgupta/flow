import { useEffect, useMemo, useRef } from "react";

import { renderExcalidrawDiagramSource } from "../lib/excalidraw";
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
  const renderPrefixRef = useRef(`flow-rendered-diagram-${Math.random().toString(36).slice(2)}`);
  const html = useMemo(() => markdownToHTML(value, inlineReferences), [inlineReferences, value]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const cleanups: Array<() => void> = [];
    const listItems = Array.from(container.querySelectorAll("li"));
    for (const listItem of listItems) {
      if (!(listItem instanceof HTMLLIElement)) {
        continue;
      }

      const nestedList = listItem.querySelector(":scope > ul, :scope > ol");
      if (!(nestedList instanceof HTMLElement)) {
        continue;
      }

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "flow-nested-list-toggle";

      let expanded = true;
      const syncState = () => {
        nestedList.hidden = !expanded;
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
        toggle.setAttribute("aria-label", expanded ? "Collapse nested list" : "Expand nested list");
        toggle.textContent = expanded ? "▾" : "▸";
      };

      const handleToggle = () => {
        expanded = !expanded;
        syncState();
      };

      syncState();
      toggle.addEventListener("click", handleToggle);
      listItem.insertBefore(toggle, listItem.firstChild);
      cleanups.push(() => {
        toggle.removeEventListener("click", handleToggle);
        toggle.remove();
      });
    }

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [html]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const diagramBlocks = [
      {
        language: "mermaid",
        render: (source: string, index: number) => renderMermaidDiagramSource(source, `${renderPrefixRef.current}-mermaid-${index}`).then((result) => result.svg),
        rootClassName: "flow-mermaid-diagram",
        inlineClassName: "flow-mermaid-diagram-inline",
        loadingClassName: "flow-mermaid-diagram-loading",
        errorClassName: "flow-mermaid-diagram-error",
        messageClassName: "flow-mermaid-diagram-message",
        detailClassName: "flow-mermaid-diagram-detail",
        loadingMessage: "Rendering diagram...",
        errorMessage: "Unable to render Mermaid diagram.",
        datasetKey: "mermaidRendered",
      },
      {
        language: "excalidraw",
        render: (source: string) => renderExcalidrawDiagramSource(source),
        rootClassName: "flow-excalidraw-diagram",
        inlineClassName: "flow-excalidraw-diagram-inline",
        loadingClassName: "flow-excalidraw-diagram-loading",
        errorClassName: "flow-excalidraw-diagram-error",
        messageClassName: "flow-excalidraw-diagram-message",
        detailClassName: "flow-excalidraw-diagram-detail",
        loadingMessage: "Rendering diagram...",
        errorMessage: "Unable to render Excalidraw diagram.",
        datasetKey: "excalidrawRendered",
      },
    ] as const;
    const matchedBlocks = diagramBlocks.flatMap((diagram) => {
      return Array.from(container.querySelectorAll("pre > code")).flatMap((code) => {
        if (!(code instanceof HTMLElement) || new RegExp(`(^|\\s)language-${diagram.language}(\\s|$)`).test(code.className) === false) {
          return [];
        }

        return [{ code, diagram }] as const;
      });
    });
    if (matchedBlocks.length === 0) {
      return;
    }

    let cancelled = false;
    const previews: HTMLDivElement[] = [];
    const renderedBlocks: Array<{ pre: HTMLElement; datasetKey: string }> = [];

    void (async () => {
      for (const [index, { code, diagram }] of matchedBlocks.entries()) {
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
        preview.className = `${diagram.rootClassName} ${diagram.inlineClassName} ${diagram.loadingClassName}`;
        preview.innerHTML = `<p class="${diagram.messageClassName}">${diagram.loadingMessage}</p>`;
        pre.after(preview);
        previews.push(preview);

        try {
          const rendered = await diagram.render(source, index);
          if (cancelled) {
            return;
          }

          preview.className = `${diagram.rootClassName} ${diagram.inlineClassName}`;
          preview.innerHTML = rendered;
          pre.dataset[diagram.datasetKey] = "true";
          renderedBlocks.push({ pre, datasetKey: diagram.datasetKey });
        } catch (error) {
          if (cancelled) {
            return;
          }

          preview.className = `${diagram.rootClassName} ${diagram.inlineClassName} ${diagram.errorClassName}`;
          preview.innerHTML = [
            `<p class="${diagram.messageClassName}">${diagram.errorMessage}</p>`,
            `<p class="${diagram.detailClassName}">${escapeHTML(toErrorMessage(error))}</p>`,
          ].join("");
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const preview of previews) {
        preview.remove();
      }
      for (const rendered of renderedBlocks) {
        delete rendered.pre.dataset[rendered.datasetKey];
      }
    };
  }, [html]);

  return <div ref={containerRef} className={className} aria-label={ariaLabel} dangerouslySetInnerHTML={{ __html: html }} />;
}