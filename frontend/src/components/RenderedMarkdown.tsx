import { useEffect, useMemo, useRef } from "react";

import { markdownToHTML } from "../richText";
import type { InlineReference } from "../types";

type RenderedMarkdownProps = {
  value: string;
  inlineReferences?: InlineReference[];
  className?: string;
  ariaLabel?: string;
};

export function RenderedMarkdown({ value, inlineReferences, className, ariaLabel }: RenderedMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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

  return <div ref={containerRef} className={className} aria-label={ariaLabel} dangerouslySetInnerHTML={{ __html: html }} />;
}
