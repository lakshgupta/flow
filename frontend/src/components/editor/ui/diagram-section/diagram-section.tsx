import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNodeViewProps } from "prosekit/react";
import { IconChevronDown, IconChevronUp, IconTrash } from "@tabler/icons-react";

import { MermaidDiagram } from "../../../MermaidDiagram";
import { LazyExcalidraw } from "../../../LazyExcalidraw";
import { joinClassNames } from "../../../ui/utils";

type SectionLanguage = "mermaid" | "excalidraw";

function isSectionLanguage(language: string | null | undefined): language is SectionLanguage {
  return language === "mermaid" || language === "excalidraw";
}

const SECTION_LABELS: Record<SectionLanguage, { title: string; placeholder: string; toggle: string; sourceLabel: string }> = {
  mermaid: {
    title: "Mermaid Diagram",
    placeholder: "Untitled Mermaid diagram",
    toggle: "Toggle Mermaid source editor",
    sourceLabel: "Mermaid source",
  },
  excalidraw: {
    title: "Excalidraw Diagram",
    placeholder: "Untitled Excalidraw diagram",
    toggle: "Toggle Excalidraw source editor",
    sourceLabel: "Excalidraw source",
  },
};

function splitTitleAndSource(text: string): { title: string; source: string } {
  const newlineIndex = text.indexOf("\n");
  if (newlineIndex === -1) {
    return { title: "", source: text };
  }
  return {
    title: text.slice(0, newlineIndex).trim(),
    source: text.slice(newlineIndex + 1).replace(/^\n+/, ""),
  };
}

function joinTitleAndSource(title: string, source: string): string {
  const trimmedTitle = title.trim();
  const trimmedSource = source.replace(/^\n+/, "").replace(/\n+$/, "");
  if (trimmedTitle === "" && trimmedSource === "") return "";
  if (trimmedTitle === "") return trimmedSource;
  if (trimmedSource === "") return trimmedTitle;
  return `${trimmedTitle}\n${trimmedSource}`;
}

/**
 * NodeView that wraps a Mermaid or Excalidraw code block as a labeled,
 * deletable, keyboard-navigable section.
 *
 * - Title bar: editable title input on the left, source-edit toggle + delete
 *   (trash) button on the right.
 * - Body: the rendered diagram (Mermaid SVG or Excalidraw canvas).
 * - Source editor: collapsible <pre> below the body that holds the code block
 *   contentRef so the user can edit the Mermaid/Excalidraw source directly.
 * - Keyboard: Alt+ArrowUp/Down swaps the section with its previous/next sibling.
 */
export default function DiagramSection(props: ReactNodeViewProps) {
  const { node, contentRef, view, getPos } = props;
  const language = (node.attrs as { language?: string }).language ?? "";
  const fullText = node.textContent;

  const isSection = isSectionLanguage(language);
  const labels = isSection ? SECTION_LABELS[language] : null;

  const { title, source } = useMemo(() => splitTitleAndSource(fullText), [fullText]);
  const [draftTitle, setDraftTitle] = useState<string>(title);
  // Auto-open source editor when a new diagram block is inserted (empty source)
  const [sourceOpen, setSourceOpen] = useState<boolean>(source.trim() === "");
  const lastSyncedTitleRef = useRef<string>(title);

  useEffect(() => {
    if (title !== lastSyncedTitleRef.current) {
      setDraftTitle(title);
      lastSyncedTitleRef.current = title;
    }
  }, [title]);

  const commitTitle = useCallback(
    (nextTitle: string) => {
      if (!isSectionLanguage(language)) return;
      if (nextTitle === title) return;
      const next = joinTitleAndSource(nextTitle, source);
      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos === null) return;
      const codeBlockType = view.state.schema.nodes.codeBlock;
      if (!codeBlockType) return;
      const newNode = codeBlockType.create(
        { language },
        view.state.schema.text(next),
      );
      const tr = view.state.tr.replaceWith(pos, pos + node.nodeSize, newNode);
      view.dispatch(tr);
    },
    [language, title, source, getPos, view, node],
  );

  const handleTitleBlur = useCallback(() => {
    commitTitle(draftTitle);
  }, [commitTitle, draftTitle]);

  const handleTitleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitTitle(draftTitle);
        (event.currentTarget as HTMLInputElement).blur();
      } else if (event.key === "Escape") {
        setDraftTitle(title);
        (event.currentTarget as HTMLInputElement).blur();
      }
    },
    [commitTitle, draftTitle, title],
  );

  const handleDelete = useCallback(() => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos === null) return;
    const tr = view.state.tr.delete(pos, pos + node.nodeSize);
    view.dispatch(tr);
    view.focus();
  }, [getPos, view, node]);

  /** Write Excalidraw canvas changes back to the code block, preserving the
   *  title line. Updates content in-place to avoid destroying the node view. */
  const handleExcalidrawSourceChange = useCallback(
    (nextSource: string) => {
      const next = joinTitleAndSource(title, nextSource)
      const pos = typeof getPos === "function" ? getPos() : null
      if (pos === null) return
      // Update text content in-place: replace content inside the code block
      // (pos+1 to pos+node.nodeSize-1) rather than replacing the entire node,
      // which would destroy the Excalidraw component.
      const contentStart = pos + 1
      const contentEnd = pos + node.nodeSize - 1
      const tr = view.state.tr
      tr.insertText(next, contentStart, contentEnd)
      view.dispatch(tr)
    },
    [title, getPos, view, node],
  )

  const handleSectionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!event.altKey) return;
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos === null) return;
      const direction = event.key === "ArrowUp" ? -1 : 1;
      const $pos = view.state.doc.resolve(pos);
      const parent = $pos.parent;
      const indexInParent = $pos.index($pos.depth);
      const siblingIndex = indexInParent + direction;
      if (siblingIndex < 0 || siblingIndex >= parent.childCount) return;
      const sectionNode = $pos.node();
      const tr = view.state.tr;
      if (direction === -1) {
        const insertPos = $pos.before(siblingIndex);
        tr.insert(insertPos, sectionNode);
      } else {
        const insertPos = $pos.after(siblingIndex);
        tr.insert(insertPos, sectionNode);
      }
      tr.delete(pos, pos + sectionNode.nodeSize);
      view.dispatch(tr);
    },
    [getPos, view],
  );

  if (!isSection || labels === null) {
    return (
      <pre
        ref={contentRef}
        data-language={language}
        data-diagram-section="false"
      />
    );
  }

  const ChevronIcon = sourceOpen ? IconChevronUp : IconChevronDown;

  return (
    <div
      className="flow-diagram-block"
      data-diagram-language={language}
      data-diagram-section="true"
      onKeyDownCapture={handleSectionKeyDown}
    >
      <div className="flow-diagram-block-header" contentEditable={false}>
        <div>
          <p className="flow-diagram-block-kicker">{labels.title}</p>
          <input
            aria-label={`${labels.title} title`}
            className="flow-diagram-block-title"
            onBlur={handleTitleBlur}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={handleTitleKeyDown}
            placeholder={labels.placeholder}
            type="text"
            value={draftTitle}
          />
        </div>
        <div className="flow-diagram-block-actions">
          <button
            aria-label={labels.toggle}
            aria-pressed={sourceOpen}
            className={joinClassNames(
              "flow-diagram-block-action",
              sourceOpen && "bg-muted text-foreground",
            )}
            onClick={() => setSourceOpen((current) => !current)}
            type="button"
          >
            <ChevronIcon size={14} stroke={1.75} />
            <span>Source</span>
          </button>
          <button
            aria-label={`Delete ${labels.title.toLowerCase()}`}
            className="flow-diagram-block-action flow-diagram-block-action-destructive"
            onClick={handleDelete}
            type="button"
          >
            <IconTrash size={14} stroke={1.75} />
          </button>
        </div>
      </div>
      <div className="flow-diagram-block-body" contentEditable={false}>
        <div className="flow-diagram-block-preview">
          {language === "mermaid" ? (
            <MermaidDiagram source={source} />
          ) : (
            <LazyExcalidraw source={source} onSourceChange={handleExcalidrawSourceChange} />
          )}
        </div>
      </div>
      <div className={sourceOpen ? 'flow-diagram-block-source' : 'flow-diagram-block-source hidden'}>
        <label className="flow-diagram-block-source-label" contentEditable={false}>
          {labels.sourceLabel}
        </label>
        <pre
          ref={contentRef}
          aria-label={labels.sourceLabel}
          className="flow-diagram-source"
          data-language={language}
        />
      </div>
    </div>
  );
}
