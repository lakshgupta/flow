import { memo, useMemo, type CSSProperties, type MouseEvent as ReactMouseEvent, type RefObject, useCallback } from "react";
import { ChevronLeft, ChevronRight, FileText, Info, Maximize2, Minimize2, X } from "lucide-react";

import type { DocumentPropertiesPanelProps } from "./DocumentPropertiesPanel";
import { DocumentPropertiesPanel } from "./DocumentPropertiesPanel";
import { RenderedMarkdown } from "./RenderedMarkdown";
import { RichTextEditor, type RichTextEditorHandle } from "./editor/RichTextEditor";
import { TableOfContents, type TOCItem } from "./TableOfContents";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

import { formatDocumentType } from "../lib/docUtils";
import { graphDirectoryColorHex, resolveGraphDirectoryColor } from "../lib/graphColors";
import { parseFlowAssetHref, parseFlowDateHref, parseFlowReferenceHref } from "../richText";
import type { DocumentFormState, DocumentResponse, HomeFormState, HomeResponse } from "../types";

type CenterDocumentSidePanelMode = "hidden" | "toc" | "properties";

type ThreadPanelData = {
  documentId: string;
  graphPath: string;
  isActive: boolean;
  isTail: boolean;
};

type ThreadAssetEntry = {
  id: string;
  href: string;
  name: string;
  graphPath: string;
  kind: "pdf" | "text";
};

type ThreadPanelActions = {
  activateThreadDocument: (documentId: string, graphPath: string) => void;
  toggleThreadExpanded: () => void;
  togglePanelExpandMode: (documentId: string) => void;
  moveThreadFocus: (delta: number) => void;
  minimizeRightRail: () => void;
  closeDocumentThreadFrom: (index: number) => void;
  updateHomeFormField: (field: keyof HomeFormState, value: string) => void;
  openInlineReference: (sourceDocumentId: string, documentId: string, graphPath: string) => void;
  openDate: (date: string) => void;
  openThreadAsset: (sourceDocumentId: string, graphPath: string, assetHref: string, assetName: string, kind: "pdf" | "text") => void;
  clearEditorScrollTarget: () => void;
  updateFormField: (field: keyof DocumentFormState, value: string) => void;
  toggleCenterDocumentSidePanel: (mode: Exclude<CenterDocumentSidePanelMode, "hidden">) => void;
  handleCenterDocumentTOCResizeMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  navigateTOC: (headingSlug: string) => void;
  addOutgoingLink: (nodeId: string) => void;
  removeOutgoingLink: (nodeId: string) => void;
  updateLinkDetail: (nodeId: string, field: "linkType" | "context", value: string) => void;
  beginThreadPanelResize: (event: ReactMouseEvent<HTMLDivElement>, panelKey: string) => void;
  resetThreadPanelWidth: (panelKey: string) => void;
};

export type ThreadPanelStackProps = {
  panelError: string;
  mutationError: string;
  mutationSuccess: string;
  isMaximizedRightRail: boolean;
  isRightRailDocked: boolean;
  threadExpanded: boolean;
  panelExpandModes: Record<string, "thread" | "full">;
  threadPanels: ThreadPanelData[];
  threadDocumentsById: Record<string, DocumentResponse>;
  activeThreadPanelIndex: number;
  threadStackRef: RefObject<HTMLDivElement | null>;
  threadPanelWidths: Record<string, number>;
  graphDirectoryColorsByPath: Record<string, string>;
  threadAssetsById: Record<string, ThreadAssetEntry>;
  homeThreadDocumentId: string;
  homeFormState: HomeFormState;
  homeInlineReferences: HomeResponse["inlineReferences"];
  formState: DocumentFormState;
  selectedDocument: DocumentResponse | null;
  selectedDocumentId: string;
  selectedDocumentInlineReferences: DocumentResponse["inlineReferences"];
  isSelectedDocumentLoading: boolean;
  savingHome: boolean;
  savingDocument: boolean;
  centerDocumentLayoutRef: RefObject<HTMLDivElement | null>;
  centerDocumentEditorRef: RefObject<RichTextEditorHandle | null>;
  centerDocumentSidePanelMode: CenterDocumentSidePanelMode;
  showCenterDocumentSidePanel: boolean;
  centerDocumentSidePanelLabel: string;
  centerDocumentSidePanelTitle: string;
  centerDocumentSidePanelDescription: string;
  centerDocumentSidePanelResizerLabel: string;
  documentTOCRatio: number;
  tocItems: TOCItem[];
  selectedDocumentLinks: DocumentPropertiesPanelProps["linkStats"];
  editableOutgoingLinks: DocumentPropertiesPanelProps["editableOutgoingLinks"];
  availableLinkTargets: DocumentPropertiesPanelProps["availableLinkTargets"];
  editorScrollTarget: string | null;
  actions: ThreadPanelActions;
};

/** Open an external URL in the system browser.
 *  In Wails desktop mode, `window.runtime.BrowserOpenURL` opens the URL in the
 *  user's default browser. In browser mode, a temporary <a> click is used. */
function openExternalLink(href: string) {
  const runtime = typeof window !== "undefined"
    ? (window as Record<string, unknown>).runtime as Record<string, ((url: string) => void) | undefined> | undefined
    : undefined;
  if (typeof runtime?.BrowserOpenURL === "function") {
    runtime.BrowserOpenURL(href);
    return;
  }
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function handleReadonlyPanelClick(
  event: ReactMouseEvent<HTMLDivElement>,
  sourceDocumentId: string,
  graphPath: string,
  actions: ThreadPanelActions,
): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const anchor = target.closest("a");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return;
  }

  const href = anchor.getAttribute("href") ?? anchor.href;

  // Cmd/Ctrl+Click on a regular URL opens it in the browser
  if ((event.metaKey || event.ctrlKey) && href && !href.startsWith("#") && !href.startsWith("/api/files")) {
    event.preventDefault();
    openExternalLink(href);
    return;
  }

  const dateResult = parseFlowDateHref(href);
  if (dateResult !== null) {
    event.preventDefault();
    actions.openDate(dateResult.date);
    return;
  }

  const reference = parseFlowReferenceHref(href);
  if (reference === null) {
    const asset = parseFlowAssetHref(href);
    if (asset !== null && (event.metaKey || event.ctrlKey) && asset.isThreadViewable && asset.threadKind !== null) {
      event.preventDefault();
      actions.openThreadAsset(sourceDocumentId, graphPath, asset.href, asset.name, asset.threadKind);
    }
    return;
  }

  event.preventDefault();
  actions.openInlineReference(sourceDocumentId, reference.documentId, reference.graphPath);
}

// ── Shared sub-components ──────────────────────────────────────────────

const PanelLoadingSkeleton = memo(function PanelLoadingSkeleton() {
  return (
    <div className="thread-panel-skeleton-container" data-testid="thread-panel-skeleton">
      <div className="thread-panel-skeleton-header">
        <Skeleton className="thread-panel-skeleton-badge" />
        <Skeleton className="thread-panel-skeleton-title" />
      </div>
      <div className="thread-panel-skeleton-body">
        <Skeleton className="thread-panel-skeleton-line thread-panel-skeleton-line-full" />
        <Skeleton className="thread-panel-skeleton-line thread-panel-skeleton-line-full" />
        <Skeleton className="thread-panel-skeleton-line thread-panel-skeleton-line-partial" />
      </div>
    </div>
  );
});

const ThreadAssetShell = memo(function ThreadAssetShell({
  title,
  description,
  asset,
}: {
  title: string;
  description: string;
  asset: ThreadAssetEntry;
}) {
  return (
    <div className="thread-panel-shell thread-panel-shell-readonly thread-panel-shell-asset">
      <div className="thread-panel-title-block">
        <h2 className="thread-panel-title">{title}</h2>
        {description.trim() !== "" ? <p className="thread-panel-description">{description}</p> : null}
      </div>
      <div className="thread-panel-asset-body">
        <iframe
          src={asset.kind === "pdf" ? `${asset.href}#page=1&view=FitH` : asset.href}
          title={asset.name}
          className="thread-panel-asset-frame"
        />
      </div>
    </div>
  );
});

// ── Active panel content variants ──────────────────────────────────────

const ActiveHomePanel = memo(function ActiveHomePanel({
  homeFormState,
  homeInlineReferences,
  homeThreadDocumentId,
  editorScrollTarget,
  actions,
}: {
  homeFormState: HomeFormState;
  homeInlineReferences: HomeResponse["inlineReferences"];
  homeThreadDocumentId: string;
  editorScrollTarget: string | null;
  actions: ThreadPanelActions;
}) {
  return (
    <div className="thread-panel-shell thread-panel-shell-home">
      <div className="thread-panel-title-block">
        <input
          className="center-document-toolbar-title"
          placeholder="Home title"
          value={homeFormState.title}
          onChange={(event) => actions.updateHomeFormField("title", event.target.value)}
          aria-label="Home title"
        />
      </div>
      <div className="center-document-main home-document home-thread-main">
        <div className="home-document-body center-document-body home-thread-body">
          <RichTextEditor
            ariaLabel="Home body editor"
            className="home-editor"
            inlineReferences={homeInlineReferences}
            onChange={(value) => actions.updateHomeFormField("body", value)}
            onReferenceOpen={(documentId, graphPath) => actions.openInlineReference(homeThreadDocumentId, documentId, graphPath)}
            onDateOpen={actions.openDate}
            onAssetOpenInThread={(assetHref, assetName, kind) => {
              actions.openThreadAsset(homeThreadDocumentId, "", assetHref, assetName, kind);
            }}
            onScrollCompleted={actions.clearEditorScrollTarget}
            placeholder="Start writing…"
            scrollToHeadingSlug={editorScrollTarget}
            value={homeFormState.body}
          />
        </div>
      </div>
    </div>
  );
});

const ActiveDocumentPanel = memo(function ActiveDocumentPanel({
  panel,
  formState,
  selectedDocument,
  selectedDocumentInlineReferences,
  editorScrollTarget,
  centerDocumentLayoutRef,
  centerDocumentEditorRef,
  centerDocumentSidePanelMode,
  showCenterDocumentSidePanel,
  centerDocumentSidePanelLabel,
  centerDocumentSidePanelTitle,
  centerDocumentSidePanelDescription,
  centerDocumentSidePanelResizerLabel,
  documentTOCRatio,
  tocItems,
  selectedDocumentLinks,
  editableOutgoingLinks,
  availableLinkTargets,
  actions,
}: {
  panel: ThreadPanelData;
  formState: DocumentFormState;
  selectedDocument: DocumentResponse | null;
  selectedDocumentInlineReferences: DocumentResponse["inlineReferences"];
  editorScrollTarget: string | null;
  centerDocumentLayoutRef: RefObject<HTMLDivElement | null>;
  centerDocumentEditorRef: RefObject<RichTextEditorHandle | null>;
  centerDocumentSidePanelMode: CenterDocumentSidePanelMode;
  showCenterDocumentSidePanel: boolean;
  centerDocumentSidePanelLabel: string;
  centerDocumentSidePanelTitle: string;
  centerDocumentSidePanelDescription: string;
  centerDocumentSidePanelResizerLabel: string;
  documentTOCRatio: number;
  tocItems: TOCItem[];
  selectedDocumentLinks: DocumentPropertiesPanelProps["linkStats"];
  editableOutgoingLinks: DocumentPropertiesPanelProps["editableOutgoingLinks"];
  availableLinkTargets: DocumentPropertiesPanelProps["availableLinkTargets"];
  actions: ThreadPanelActions;
}) {
  return (
    <div className="thread-panel-shell">
      <div className="thread-panel-title-block">
        <input
          className="center-document-toolbar-title"
          placeholder="Document title"
          value={formState.title}
          onChange={(event) => actions.updateFormField("title", event.target.value)}
          aria-label="Document title"
        />
      </div>

      <div
        ref={centerDocumentLayoutRef}
        className="center-document-layout"
        aria-label="Document content layout"
        data-side-panel={centerDocumentSidePanelMode}
        style={{ "--document-toc-ratio": documentTOCRatio.toString() } as CSSProperties}
      >
        <div className="center-document-main home-document">
          <div className="home-document-body center-document-body">
            <RichTextEditor
              ariaLabel="Document body editor"
              inlineReferences={selectedDocumentInlineReferences}
              onChange={(value) => actions.updateFormField("body", value)}
              onReferenceOpen={(documentId, graphPath) => actions.openInlineReference(panel.documentId, documentId, graphPath)}
              onDateOpen={actions.openDate}
              onAssetOpenInThread={(assetHref, assetName, kind) => {
                actions.openThreadAsset(panel.documentId, panel.graphPath, assetHref, assetName, kind);
              }}
              ref={centerDocumentEditorRef}
              onScrollCompleted={actions.clearEditorScrollTarget}
              placeholder="Type / for headings, lists, quotes, links, and highlights"
              scrollToHeadingSlug={editorScrollTarget}
              value={formState.body}
            />
          </div>
        </div>

        {showCenterDocumentSidePanel && selectedDocument !== null ? (
          <>
            <div
              className="center-document-toc-resizer"
              onMouseDown={actions.handleCenterDocumentTOCResizeMouseDown}
              role="separator"
              aria-label={centerDocumentSidePanelResizerLabel}
              aria-orientation="vertical"
            />

            <aside className="center-document-side-panel" aria-label={centerDocumentSidePanelLabel}>
              <div className="center-document-toc-header center-document-side-panel-header">
                <h4>{centerDocumentSidePanelTitle}</h4>
                <p>{centerDocumentSidePanelDescription}</p>
              </div>

              {centerDocumentSidePanelMode === "toc" ? (
                <TableOfContents items={tocItems} onNavigate={actions.navigateTOC} />
              ) : (
                <DocumentPropertiesPanel
                  selectedDocument={selectedDocument}
                  formState={formState}
                  linkStats={selectedDocumentLinks}
                  editableOutgoingLinks={editableOutgoingLinks}
                  availableLinkTargets={availableLinkTargets}
                  onAddOutgoingLink={actions.addOutgoingLink}
                  onRemoveOutgoingLink={actions.removeOutgoingLink}
                  onUpdateLinkDetail={actions.updateLinkDetail}
                  updateFormField={actions.updateFormField}
                />
              )}
            </aside>
          </>
        ) : null}
      </div>
    </div>
  );
});

// ── Readonly panel content variants ────────────────────────────────────

const ReadonlyHomePanel = memo(function ReadonlyHomePanel({
  panelTitle,
  panelDescription,
  homeFormState,
  homeInlineReferences,
  homeThreadDocumentId,
  actions,
}: {
  panelTitle: string;
  panelDescription: string;
  homeFormState: HomeFormState;
  homeInlineReferences: HomeResponse["inlineReferences"];
  homeThreadDocumentId: string;
  actions: ThreadPanelActions;
}) {
  return (
    <div className="thread-panel-shell thread-panel-shell-readonly">
      <div className="thread-panel-title-block">
        <h2 className="thread-panel-title">{panelTitle}</h2>
        {panelDescription.trim() !== "" ? <p className="thread-panel-description">{panelDescription}</p> : null}
      </div>
      <div
        className="thread-panel-readonly-body thread-panel-readonly-body-home"
        onClickCapture={(event) => handleReadonlyPanelClick(event, homeThreadDocumentId, "", actions)}
      >
        <RenderedMarkdown
          className="ProseMirror thread-panel-rendered-markdown"
          aria-label="Thread panel content for Home"
          value={homeFormState.body}
          inlineReferences={homeInlineReferences}
        />
      </div>
    </div>
  );
});

const ReadonlyDocumentPanel = memo(function ReadonlyDocumentPanel({
  panelTitle,
  panelDescription,
  panelDocument,
  panel,
  actions,
}: {
  panelTitle: string;
  panelDescription: string;
  panelDocument: DocumentResponse;
  panel: ThreadPanelData;
  actions: ThreadPanelActions;
}) {
  return (
    <div className="thread-panel-shell thread-panel-shell-readonly">
      <div className="thread-panel-title-block">
        <h2 className="thread-panel-title">{panelTitle}</h2>
        {panelDescription.trim() !== "" ? <p className="thread-panel-description">{panelDescription}</p> : null}
      </div>
      <div
        className="thread-panel-readonly-body"
        onClickCapture={(event) => handleReadonlyPanelClick(event, panel.documentId, panel.graphPath, actions)}
      >
        <RenderedMarkdown
          className="ProseMirror thread-panel-rendered-markdown"
          aria-label={`Thread panel content for ${panelTitle}`}
          value={panelDocument.body}
          inlineReferences={panelDocument.inlineReferences}
        />
      </div>
    </div>
  );
});

// ── Panel header ───────────────────────────────────────────────────────

const ThreadPanelHeader = memo(function ThreadPanelHeader({
  panel,
  panelIsHome,
  panelAsset,
  panelDocument,
  panelTitle,
  index,
  threadPanels,
  threadExpanded,
  isMaximizedRightRail,
  activeThreadPanelIndex,
  savingHome,
  savingDocument,
  centerDocumentSidePanelMode,
  panelExpandMode,
  actions,
}: {
  panel: ThreadPanelData;
  panelIsHome: boolean;
  panelAsset: ThreadAssetEntry | null;
  panelDocument: DocumentResponse | null;
  panelTitle: string;
  index: number;
  threadPanels: ThreadPanelData[];
  threadExpanded: boolean;
  isMaximizedRightRail: boolean;
  activeThreadPanelIndex: number;
  savingHome: boolean;
  savingDocument: boolean;
  centerDocumentSidePanelMode: CenterDocumentSidePanelMode;
  panelExpandMode: "thread" | "full" | null;
  actions: ThreadPanelActions;
}) {
  const handleClose = useCallback(() => {
    actions.closeDocumentThreadFrom(index);
  }, [actions, index]);

  return (
    <div className="thread-panel-header">
      <div className="thread-panel-header-leading">
        {panelIsHome ? (
          <Badge variant="outline" className="center-document-type-badge">Home</Badge>
        ) : panelAsset !== null ? (
          <Badge variant="outline" className="center-document-type-badge">{panelAsset.kind === "pdf" ? "PDF" : "Text"}</Badge>
        ) : panelDocument !== null ? (
          <Badge variant="outline" className="center-document-type-badge">{formatDocumentType(panelDocument.type)}</Badge>
        ) : null}
      </div>
      <span className="thread-panel-header-title">{panelTitle || panel.documentId}</span>
      <div className="thread-panel-header-actions">
        {panel.isActive ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={threadExpanded ? "Restore thread width" : "Expand thread to full width"}
              title={threadExpanded ? "Restore thread width" : "Expand thread to full width"}
              onClick={actions.toggleThreadExpanded}
            >
              {threadExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Previous thread panel"
              title="Previous thread panel (Alt + Left)"
              disabled={activeThreadPanelIndex <= 0}
              onClick={() => actions.moveThreadFocus(-1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Next thread panel"
              title="Next thread panel (Alt + Right)"
              disabled={activeThreadPanelIndex < 0 || activeThreadPanelIndex >= threadPanels.length - 1}
              onClick={() => actions.moveThreadFocus(1)}
            >
              <ChevronRight size={16} />
            </Button>
            {panelIsHome ? <>{savingHome && <span className="home-save-success">Saving…</span>}</> : (
              <>
                {savingDocument && <span className="home-save-success">Saving…</span>}
                {panelAsset === null && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="center-document-toolbar-toggle"
                      data-active={centerDocumentSidePanelMode === "toc" ? "true" : "false"}
                      aria-label="Toggle table of contents"
                      aria-pressed={centerDocumentSidePanelMode === "toc"}
                      title="Toggle table of contents"
                      onClick={() => actions.toggleCenterDocumentSidePanel("toc")}
                    >
                      <FileText size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="center-document-toolbar-toggle"
                      data-active={centerDocumentSidePanelMode === "properties" ? "true" : "false"}
                      aria-label="Toggle document properties"
                      aria-pressed={centerDocumentSidePanelMode === "properties"}
                      title="Toggle document properties"
                      onClick={() => actions.toggleCenterDocumentSidePanel("properties")}
                    >
                      <Info size={16} />
                    </Button>
                  </>
                )}
              </>
            )}
            {isMaximizedRightRail && (
              <Button
                onClick={actions.minimizeRightRail}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Minimize right pane"
                title="Minimize right pane"
              >
                <Minimize2 size={16} />
              </Button>
            )}
          </>
        ) : null}
        {!panel.isActive && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={panelExpandMode === "full" ? "Collapse thread panel" : panelExpandMode === "thread" ? "Expand to full page view" : "Expand thread panel"}
            title={panelExpandMode === "full" ? "Collapse thread panel" : panelExpandMode === "thread" ? "Expand to full page view" : "Expand thread panel"}
            onClick={() => actions.togglePanelExpandMode(panel.documentId)}
          >
            {panelExpandMode === "full" ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Close thread from ${panelTitle || panel.documentId}`}
          title="Close thread"
          onClick={handleClose}
        >
          <X size={16} />
        </Button>
      </div>
    </div>
  );
});

// ── Per-panel section (memoized) ───────────────────────────────────────

type ThreadPanelSectionProps = {
  panel: ThreadPanelData;
  index: number;
  panelKey: string;
  panelTitle: string;
  panelDescription: string;
  panelDocumentIsLoading: boolean;
  panelGraphColor: string | undefined;
  panelCustomWidth: number | undefined;
  threadPanels: ThreadPanelData[];
  threadExpanded: boolean;
  panelExpandMode: "thread" | "full" | null;
  isMaximizedRightRail: boolean;
  activeThreadPanelIndex: number;
  homeThreadDocumentId: string;
  homeFormState: HomeFormState;
  homeInlineReferences: HomeResponse["inlineReferences"];
  formState: DocumentFormState;
  selectedDocument: DocumentResponse | null;
  selectedDocumentInlineReferences: DocumentResponse["inlineReferences"];
  editorScrollTarget: string | null;
  savingHome: boolean;
  savingDocument: boolean;
  centerDocumentLayoutRef: RefObject<HTMLDivElement | null>;
  centerDocumentEditorRef: RefObject<RichTextEditorHandle | null>;
  centerDocumentSidePanelMode: CenterDocumentSidePanelMode;
  showCenterDocumentSidePanel: boolean;
  centerDocumentSidePanelLabel: string;
  centerDocumentSidePanelTitle: string;
  centerDocumentSidePanelDescription: string;
  centerDocumentSidePanelResizerLabel: string;
  documentTOCRatio: number;
  tocItems: TOCItem[];
  selectedDocumentLinks: DocumentPropertiesPanelProps["linkStats"];
  editableOutgoingLinks: DocumentPropertiesPanelProps["editableOutgoingLinks"];
  availableLinkTargets: DocumentPropertiesPanelProps["availableLinkTargets"];
  panelAsset: ThreadAssetEntry | null;
  panelDocument: DocumentResponse | null;
  panelIsHome: boolean;
  actions: ThreadPanelActions;
};

const ThreadPanelSection = memo(function ThreadPanelSection({
  panel,
  index,
  panelKey,
  panelTitle,
  panelDescription,
  panelDocumentIsLoading,
  panelGraphColor,
  panelCustomWidth,
  threadPanels,
  threadExpanded,
  panelExpandMode,
  isMaximizedRightRail,
  activeThreadPanelIndex,
  homeThreadDocumentId,
  homeFormState,
  homeInlineReferences,
  formState,
  selectedDocument,
  selectedDocumentInlineReferences,
  editorScrollTarget,
  savingHome,
  savingDocument,
  centerDocumentLayoutRef,
  centerDocumentEditorRef,
  centerDocumentSidePanelMode,
  showCenterDocumentSidePanel,
  centerDocumentSidePanelLabel,
  centerDocumentSidePanelTitle,
  centerDocumentSidePanelDescription,
  centerDocumentSidePanelResizerLabel,
  documentTOCRatio,
  tocItems,
  selectedDocumentLinks,
  editableOutgoingLinks,
  availableLinkTargets,
  panelAsset,
  panelDocument,
  panelIsHome,
  actions,
}: ThreadPanelSectionProps) {
  const handleSectionClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (panel.isActive) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.closest("button") !== null || target.closest("a") !== null) {
        return;
      }
      actions.activateThreadDocument(panel.documentId, panel.graphPath);
    },
    [panel.isActive, panel.documentId, panel.graphPath, actions],
  );

  const handleResizeMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      actions.beginThreadPanelResize(event, panelKey);
    },
    [actions, panelKey],
  );

  const handleResizeDoubleClick = useCallback(() => {
    actions.resetThreadPanelWidth(panelKey);
  }, [actions, panelKey]);

  const threadPanelStyle = useMemo(() => ({
    ...(panelCustomWidth !== undefined ? { "--thread-panel-width": `${panelCustomWidth}px` } : {}),
    ...(panelGraphColor !== undefined ? { "--thread-graph-color": panelGraphColor } : {}),
  } as CSSProperties), [panelCustomWidth, panelGraphColor]);

  return (
    <section
      className={`thread-panel ${panel.isActive ? "thread-panel-active" : "thread-panel-readonly"} ${panelGraphColor ? "thread-panel-tinted" : ""}`}
      aria-label={panel.isActive ? `Active thread document ${panelTitle}` : `Thread document ${panelTitle}`}
      data-active={panel.isActive ? "true" : "false"}
      data-uncollapsed={panelExpandMode !== null ? "true" : undefined}
      data-expand-mode={panelExpandMode ?? undefined}
      data-thread-panel-key={panelKey}
      style={threadPanelStyle}
      onClick={handleSectionClick}
    >
      <ThreadPanelHeader
        panel={panel}
        panelIsHome={panelIsHome}
        panelAsset={panelAsset}
        panelDocument={panelDocument}
        panelTitle={panelTitle}
        index={index}
        threadPanels={threadPanels}
        threadExpanded={threadExpanded}
        isMaximizedRightRail={isMaximizedRightRail}
        activeThreadPanelIndex={activeThreadPanelIndex}
        savingHome={savingHome}
        savingDocument={savingDocument}
        centerDocumentSidePanelMode={centerDocumentSidePanelMode}
        panelExpandMode={panelExpandMode}
        actions={actions}
      />
      <div className="thread-panel-scroll">

      {panel.isActive && panelDocumentIsLoading ? (
        <PanelLoadingSkeleton />
      ) : panel.isActive && panelIsHome ? (
        <ActiveHomePanel
          homeFormState={homeFormState}
          homeInlineReferences={homeInlineReferences}
          homeThreadDocumentId={homeThreadDocumentId}
          editorScrollTarget={editorScrollTarget}
          actions={actions}
        />
      ) : panel.isActive ? (
        panelAsset !== null ? (
          <ThreadAssetShell title={panelTitle} description={panelDescription} asset={panelAsset} />
        ) : (
          <ActiveDocumentPanel
            panel={panel}
            formState={formState}
            selectedDocument={selectedDocument}
            selectedDocumentInlineReferences={selectedDocumentInlineReferences}
            editorScrollTarget={editorScrollTarget}
            centerDocumentLayoutRef={centerDocumentLayoutRef}
            centerDocumentEditorRef={centerDocumentEditorRef}
            centerDocumentSidePanelMode={centerDocumentSidePanelMode}
            showCenterDocumentSidePanel={showCenterDocumentSidePanel}
            centerDocumentSidePanelLabel={centerDocumentSidePanelLabel}
            centerDocumentSidePanelTitle={centerDocumentSidePanelTitle}
            centerDocumentSidePanelDescription={centerDocumentSidePanelDescription}
            centerDocumentSidePanelResizerLabel={centerDocumentSidePanelResizerLabel}
            documentTOCRatio={documentTOCRatio}
            tocItems={tocItems}
            selectedDocumentLinks={selectedDocumentLinks}
            editableOutgoingLinks={editableOutgoingLinks}
            availableLinkTargets={availableLinkTargets}
            actions={actions}
          />
        )
      ) : panelIsHome ? (
        <ReadonlyHomePanel
          panelTitle={panelTitle}
          panelDescription={panelDescription}
          homeFormState={homeFormState}
          homeInlineReferences={homeInlineReferences}
          homeThreadDocumentId={homeThreadDocumentId}
          actions={actions}
        />
      ) : panelAsset !== null ? (
        <ThreadAssetShell title={panelTitle} description={panelDescription} asset={panelAsset} />
      ) : panelDocument === null ? (
        <PanelLoadingSkeleton />
      ) : (
        <ReadonlyDocumentPanel
          panelTitle={panelTitle}
          panelDescription={panelDescription}
          panelDocument={panelDocument}
          panel={panel}
          actions={actions}
        />
      )}

      </div>

      <div
        className="thread-panel-resize-handle"
        role="separator"
        aria-label="Resize thread panel (double-click to reset)"
        aria-orientation="vertical"
        onMouseDown={handleResizeMouseDown}
        onDoubleClick={handleResizeDoubleClick}
      />
    </section>
  );
});

// ── Main stack component ───────────────────────────────────────────────

function ThreadPanelStackComponent({
  panelError,
  mutationError,
  mutationSuccess,
  isMaximizedRightRail,
  isRightRailDocked,
  threadExpanded,
  panelExpandModes,
  threadPanels,
  threadDocumentsById,
  activeThreadPanelIndex,
  threadStackRef,
  threadPanelWidths,
  graphDirectoryColorsByPath,
  threadAssetsById,
  homeThreadDocumentId,
  homeFormState,
  homeInlineReferences,
  formState,
  selectedDocument,
  selectedDocumentId,
  selectedDocumentInlineReferences,
  isSelectedDocumentLoading,
  savingHome,
  savingDocument,
  centerDocumentLayoutRef,
  centerDocumentEditorRef,
  centerDocumentSidePanelMode,
  showCenterDocumentSidePanel,
  centerDocumentSidePanelLabel,
  centerDocumentSidePanelTitle,
  centerDocumentSidePanelDescription,
  centerDocumentSidePanelResizerLabel,
  documentTOCRatio,
  tocItems,
  selectedDocumentLinks,
  editableOutgoingLinks,
  availableLinkTargets,
  editorScrollTarget,
  actions,
}: ThreadPanelStackProps) {
  return (
    <div
      className="center-document-shell"
      data-thread-expanded={threadExpanded ? "true" : "false"}
      data-right-rail-docked={isRightRailDocked ? "true" : "false"}
    >
      {panelError !== "" ? <p className="status-line status-line-error">{panelError}</p> : null}
      {mutationError !== "" ? <p className="status-line status-line-error">{mutationError}</p> : null}
      {mutationSuccess !== "" ? <p className="status-line status-line-success">{mutationSuccess}</p> : null}

      {threadPanels.length === 0 ? (
        <PanelLoadingSkeleton />
      ) : (
        <div
          ref={threadStackRef}
          className="thread-stack"
          data-multi-thread={threadPanels.length > 1 ? "true" : "false"}
          aria-label="Document thread"
        >
          {threadPanels.map((panel, index) => {
            const panelIsHome = panel.documentId === homeThreadDocumentId;
            const panelDocument = panel.isActive && selectedDocument?.id === panel.documentId
              ? selectedDocument
              : threadDocumentsById[panel.documentId] ?? null;
            const panelAsset = threadAssetsById[panel.documentId] ?? null;
            const panelTitle = panelIsHome
              ? homeFormState.title
              : panelAsset !== null
                ? panelAsset.name
                : panel.isActive ? formState.title : panelDocument?.title ?? panel.documentId;
            const panelDescription = panelIsHome
              ? homeFormState.description
              : panelAsset !== null
                ? panelAsset.kind === "pdf" ? "PDF document" : "Text file"
                : panel.isActive ? formState.description : panelDocument?.description ?? "";
            const panelDocumentIsLoading = !panelIsHome && panelAsset === null && panel.isActive && isSelectedDocumentLoading && selectedDocumentId === panel.documentId;

            const panelKey = `${panel.documentId}:${index}`;
            const panelWidthKey = panel.documentId;
            const panelCustomWidth = threadPanelWidths[panelWidthKey];
            const panelGraphColor = panelIsHome
              ? undefined
              : graphDirectoryColorHex(resolveGraphDirectoryColor(panel.graphPath, graphDirectoryColorsByPath));

            return (
              <ThreadPanelSection
                key={panelKey}
                panel={panel}
                index={index}
                panelKey={panelKey}
                panelTitle={panelTitle}
                panelDescription={panelDescription}
                panelDocumentIsLoading={panelDocumentIsLoading}
                panelGraphColor={panelGraphColor}
                panelCustomWidth={panelCustomWidth}
                panelExpandMode={!panel.isActive ? (panelExpandModes[panel.documentId] ?? null) : null}
                threadPanels={threadPanels}
                threadExpanded={threadExpanded}
                isMaximizedRightRail={isMaximizedRightRail}
                activeThreadPanelIndex={activeThreadPanelIndex}
                homeThreadDocumentId={homeThreadDocumentId}
                homeFormState={homeFormState}
                homeInlineReferences={homeInlineReferences}
                formState={formState}
                selectedDocument={selectedDocument}
                selectedDocumentInlineReferences={selectedDocumentInlineReferences}
                editorScrollTarget={editorScrollTarget}
                savingHome={savingHome}
                savingDocument={savingDocument}
                centerDocumentLayoutRef={centerDocumentLayoutRef}
                centerDocumentEditorRef={centerDocumentEditorRef}
                centerDocumentSidePanelMode={centerDocumentSidePanelMode}
                showCenterDocumentSidePanel={showCenterDocumentSidePanel}
                centerDocumentSidePanelLabel={centerDocumentSidePanelLabel}
                centerDocumentSidePanelTitle={centerDocumentSidePanelTitle}
                centerDocumentSidePanelDescription={centerDocumentSidePanelDescription}
                centerDocumentSidePanelResizerLabel={centerDocumentSidePanelResizerLabel}
                documentTOCRatio={documentTOCRatio}
                tocItems={tocItems}
                selectedDocumentLinks={selectedDocumentLinks}
                editableOutgoingLinks={editableOutgoingLinks}
                availableLinkTargets={availableLinkTargets}
                panelAsset={panelAsset}
                panelDocument={panelDocument}
                panelIsHome={panelIsHome}
                actions={actions}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export const ThreadPanelStack = memo(ThreadPanelStackComponent);
