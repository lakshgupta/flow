import { memo, type RefObject } from "react";

import { RichTextEditor, type RichTextEditorHandle } from "./editor/RichTextEditor";

import type { HomeFormState, HomeResponse } from "../types";

export type HomeSurfaceActions = {
  updateHomeFormField: (field: keyof HomeFormState, value: string) => void;
  openInlineReference: (documentId: string, graphPath: string) => void;
  openDate: (date: string) => void;
  openThreadAsset: (assetHref: string, assetName: string, kind: "pdf" | "text") => void;
  clearEditorScrollTarget: () => void;
};

export type HomeSurfaceProps = {
  homeMutationError: string;
  showFreshStartGuide: boolean;
  homeDocumentEditorRef: RefObject<RichTextEditorHandle | null>;
  homeInlineReferences: HomeResponse["inlineReferences"];
  editorScrollTarget: string | null;
  homeFormState: HomeFormState;
  actions: HomeSurfaceActions;
};

function HomeSurfaceComponent({
  homeMutationError,
  showFreshStartGuide,
  homeDocumentEditorRef,
  homeInlineReferences,
  editorScrollTarget,
  homeFormState,
  actions,
}: HomeSurfaceProps) {
  return (
    <div className="home-surface">
      {homeMutationError !== "" && <p className="status-line status-line-error home-status-message">{homeMutationError}</p>}
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
      <div className="home-document-layout center-document-layout" aria-label="Home content layout" data-side-panel="hidden">
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
      </div>
    </div>
  );
}

export const HomeSurface = memo(HomeSurfaceComponent);
