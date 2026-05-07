import { FileText } from "lucide-react";
import { memo, type CSSProperties, type RefObject } from "react";

import { RichTextEditor, type RichTextEditorHandle } from "./editor/RichTextEditor";
import { TableOfContents, type TOCItem } from "./TableOfContents";
import { Button } from "./ui/button";

import type { HomeFormState, HomeResponse } from "../types";

type HomeSurfaceActions = {
  toggleTOC: () => void;
  updateHomeFormField: (field: keyof HomeFormState, value: string) => void;
  openInlineReference: (documentId: string, graphPath: string) => void;
  openDate: (date: string) => void;
  openThreadAsset: (assetHref: string, assetName: string, kind: "pdf" | "text") => void;
  clearEditorScrollTarget: () => void;
  resizeTOC: (event: React.MouseEvent<HTMLDivElement>) => void;
  navigateTOC: (headingSlug: string) => void;
};

export type HomeSurfaceProps = {
  homeMutationError: string;
  homeTOCVisible: boolean;
  showFreshStartGuide: boolean;
  homeDocumentLayoutRef: RefObject<HTMLDivElement | null>;
  homeDocumentEditorRef: RefObject<RichTextEditorHandle | null>;
  documentTOCRatio: number;
  homeInlineReferences: HomeResponse["inlineReferences"];
  editorScrollTarget: string | null;
  homeFormState: HomeFormState;
  tocItems: TOCItem[];
  actions: HomeSurfaceActions;
};

function HomeSurfaceComponent({
  homeMutationError,
  homeTOCVisible,
  showFreshStartGuide,
  homeDocumentLayoutRef,
  homeDocumentEditorRef,
  documentTOCRatio,
  homeInlineReferences,
  editorScrollTarget,
  homeFormState,
  tocItems,
  actions,
}: HomeSurfaceProps) {
  return (
    <div className="home-surface">
      {homeMutationError !== "" && <p className="status-line status-line-error home-status-message">{homeMutationError}</p>}
      <div className="home-surface-toolbar">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="center-document-toolbar-toggle"
          data-active={homeTOCVisible ? "true" : "false"}
          aria-label={homeTOCVisible ? "Hide table of contents" : "Show table of contents"}
          aria-pressed={homeTOCVisible}
          title={homeTOCVisible ? "Hide table of contents" : "Show table of contents"}
          onClick={actions.toggleTOC}
        >
          <FileText size={16} />
        </Button>
      </div>
      {showFreshStartGuide && (
        <section className="fresh-start-panel shell-inner-card" aria-label="Fresh workspace guide">
          <div className="fresh-start-copy">
            <p className="section-kicker">Fresh Workspace</p>
            <h3>Start with Home or create your first graph.</h3>
            <p>
              The app is loaded. This workspace is just pristine: Home only contains its default heading, and there are no graph documents yet.
            </p>
            <ul className="fresh-start-list">
              <li>Use the add button in the Content section to create your first graph or directory.</li>
              <li>Write project context directly in Home below.</li>
              <li>Once a graph has files, it will appear in the left tree with its documents underneath.</li>
            </ul>
          </div>
        </section>
      )}
      <div
        ref={homeDocumentLayoutRef}
        className="home-document-layout center-document-layout"
        aria-label="Home content layout"
        data-side-panel={homeTOCVisible ? "toc" : "hidden"}
        style={{ "--document-toc-ratio": documentTOCRatio.toString() } as CSSProperties}
      >
        <div className="center-document-main">
          <RichTextEditor
            ariaLabel="Home body editor"
            className="home-editor"
            inlineReferences={homeInlineReferences}
            ref={homeDocumentEditorRef}
            onChange={(value) => actions.updateHomeFormField("body", value)}
            onReferenceOpen={actions.openInlineReference}
            onDateOpen={actions.openDate}
            onAssetOpenInThread={actions.openThreadAsset}
            onScrollCompleted={actions.clearEditorScrollTarget}
            placeholder="Start writing…"
            scrollToHeadingSlug={editorScrollTarget}
            value={homeFormState.body}
          />
        </div>

        {homeTOCVisible ? (
          <>
            <div
              className="center-document-toc-resizer"
              onMouseDown={actions.resizeTOC}
              role="separator"
              aria-label="Resize table of contents"
              aria-orientation="vertical"
            />

            <aside className="center-document-toc" aria-label="Document table of contents">
              <div className="center-document-toc-header">
                <h4>Table of Contents</h4>
              </div>
              <TableOfContents items={tocItems} onNavigate={actions.navigateTOC} />
            </aside>
          </>
        ) : null}
      </div>
    </div>
  );
}

export const HomeSurface = memo(HomeSurfaceComponent);