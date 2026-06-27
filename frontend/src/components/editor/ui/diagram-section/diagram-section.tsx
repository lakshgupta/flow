import { useCallback, useMemo, useState } from "react";
import type { ReactNodeViewProps } from "prosekit/react";
import { IconChevronDown, IconChevronUp, IconTrash } from "@tabler/icons-react";

import { MermaidDiagram } from "../../../MermaidDiagram";
import { joinClassNames } from "../../../ui/utils";

type SectionLanguage = "mermaid";

function isSectionLanguage(language: string | null | undefined): language is SectionLanguage {
  return language === "mermaid";
}

const SECTION_LABELS: Record<SectionLanguage, { title: string; placeholder: string; toggle: string; sourceLabel: string }> = {
  mermaid: {
    title: "Mermaid Diagram",
    placeholder: "Untitled Mermaid diagram",
    toggle: "Toggle Mermaid source editor",
    sourceLabel: "Mermaid source",
  },
};

/**
 * NodeView that wraps a Mermaid code block as a labeled, deletable,
 * keyboard-navigable section.
 *
 * The title is stored as the first line of the code block text for persistence.
 * It is extracted ONCE on mount — subsequent source editor changes never
 * overwrite the title. Only the title input field can update it.
 *
 * - Title bar: editable title input on the left, source-edit toggle + delete
 *   (trash) button on the right.
 * - Body: the rendered diagram (Mermaid SVG).
 * - Source editor: collapsible <pre> below the body that holds the code block
 *   contentRef so the user can edit the Mermaid source directly.
 * - Keyboard: Alt+ArrowUp/Down swaps the section with its previous/next sibling.
 */
export default function DiagramSection(props: ReactNodeViewProps) {
  const { node, contentRef, view, getPos } = props;
  const language = (node.attrs as { language?: string }).language ?? "";
  const fullText = node.textContent;

  const isSection = isSectionLanguage(language);
  const labels = isSection ? SECTION_LABELS[language] : null;

  // Extract title ONCE on mount from persisted code block text.
  // After mount, title is only updated when the user commits via the title input.
  const [committedTitle, setCommittedTitle] = useState<string>(() => {
    const newlineIndex = fullText.indexOf("\n");
    return newlineIndex === -1 ? "" : fullText.slice(0, newlineIndex).trim();
  });
  const [draftTitle, setDraftTitle] = useState<string>(committedTitle);

  // Source is the full text minus the committed title line
  const source = useMemo(() => {
    if (!committedTitle) return fullText;
    const prefix = committedTitle + "\n";
    return fullText.startsWith(prefix) ? fullText.slice(prefix.length) : fullText;
  }, [fullText, committedTitle]);

  // Auto-open source editor when a new diagram block is inserted (empty source)
  const [sourceOpen, setSourceOpen] = useState<boolean>(source.trim() === "");

  const commitTitle = useCallback(
    (nextTitle: string) => {
      if (!isSectionLanguage(language)) return;
      const trimmed = nextTitle.trim();
      if (trimmed === committedTitle) return;
      const next = trimmed ? `${trimmed}\n${source}` : source;
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
      setCommittedTitle(trimmed);
    },
    [language, committedTitle, source, getPos, view, node],
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
        setDraftTitle(committedTitle);
        (event.currentTarget as HTMLInputElement).blur();
      }
    },
    [commitTitle, draftTitle, committedTitle],
  );

  const handleDelete = useCallback(() => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos === null) return;
    const tr = view.state.tr.delete(pos, pos + node.nodeSize);
    view.dispatch(tr);
    view.focus();
  }, [getPos, view, node]);

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
          {language === "mermaid" && (
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
          )}
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
          <MermaidDiagram source={source} />
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
