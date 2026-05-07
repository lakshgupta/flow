import { memo, type CSSProperties, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { ChevronLeft, ChevronRight, FileText, Info, Maximize2, Minimize2, Rows3, X } from "lucide-react";

import type { DocumentPropertiesPanelProps } from "./DocumentPropertiesPanel";
import { DocumentPropertiesPanel } from "./DocumentPropertiesPanel";
import { RenderedMarkdown } from "./RenderedMarkdown";
import { RichTextEditor, type RichTextEditorHandle } from "./editor/RichTextEditor";
import { TableOfContents, type TOCItem } from "./TableOfContents";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

import { formatDocumentType } from "../lib/docUtils";
import { graphDirectoryColorHex, resolveGraphDirectoryColor } from "../lib/graphColors";
import { parseFlowAssetHref, parseFlowDateHref, parseFlowReferenceHref } from "../richText";
import type { DocumentFormState, DocumentResponse, HomeFormState, HomeResponse } from "../types";

type ThreadDensityMode = "comfortable" | "dense" | "ultra";
type CenterDocumentSidePanelMode = "hidden" | "toc" | "properties";

type ThreadPanelData = {
  documentId: string;
  graphPath: string;
  document: DocumentResponse | null;
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
  setThreadDensityMode: (mode: ThreadDensityMode) => void;
  toggleThreadExpanded: () => void;
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
};

export type ThreadPanelStackProps = {
  panelError: string;
  mutationError: string;
  mutationSuccess: string;
  isMaximizedRightRail: boolean;
  threadExpanded: boolean;
  threadDensityMode: ThreadDensityMode;
  nextThreadDensityLabel: string;
  nextThreadDensityMode: ThreadDensityMode;
  threadPanels: ThreadPanelData[];
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

function ThreadAssetShell({
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

function ThreadPanelStackComponent({
  panelError,
  mutationError,
  mutationSuccess,
  isMaximizedRightRail,
  threadExpanded,
  threadDensityMode,
  nextThreadDensityLabel,
  nextThreadDensityMode,
  threadPanels,
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
    <div className="center-document-shell" data-thread-expanded={threadExpanded ? "true" : "false"}>
      {panelError !== "" ? <p className="status-line status-line-error">{panelError}</p> : null}
      {mutationError !== "" ? <p className="status-line status-line-error">{mutationError}</p> : null}
      {mutationSuccess !== "" ? <p className="status-line status-line-success">{mutationSuccess}</p> : null}

      {threadPanels.length === 0 ? (
        <div className="detail-empty">
          <p>Loading document content.</p>
        </div>
      ) : (
        <div
          ref={threadStackRef}
          className="thread-stack"
          data-density={threadDensityMode}
          data-multi-thread={threadPanels.length > 1 ? "true" : "false"}
          aria-label="Document thread"
        >
          {threadPanels.map((panel, index) => {
            const panelIsHome = panel.documentId === homeThreadDocumentId;
            const panelDocument = panel.document;
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
            const panelCustomWidth = threadPanelWidths[panelKey];
            const panelGraphColor = panelIsHome
              ? undefined
              : graphDirectoryColorHex(resolveGraphDirectoryColor(panel.graphPath, graphDirectoryColorsByPath));
            const threadPanelStyle = {
              ...(panelCustomWidth !== undefined ? { "--thread-panel-width": `${panelCustomWidth}px` } : {}),
              ...(panelGraphColor !== undefined ? { "--thread-graph-color": panelGraphColor } : {}),
            } as CSSProperties;

            return (
              <section
                key={panelKey}
                className={`thread-panel ${panel.isActive ? "thread-panel-active" : "thread-panel-readonly"} ${panelGraphColor ? "thread-panel-tinted" : ""}`}
                aria-label={panel.isActive ? `Active thread document ${panelTitle}` : `Thread document ${panelTitle}`}
                data-active={panel.isActive ? "true" : "false"}
                data-thread-panel-key={panelKey}
                style={threadPanelStyle}
                onClick={(event) => {
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
                }}
              >
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
                  <div className="thread-panel-header-actions">
                    {panel.isActive ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Switch to ${nextThreadDensityLabel} thread density`}
                          title={`Switch to ${nextThreadDensityLabel} thread density`}
                          onClick={() => actions.setThreadDensityMode(nextThreadDensityMode)}
                        >
                          <Rows3 size={16} />
                        </Button>
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Close thread from ${panelTitle || panel.documentId}`}
                      title="Close thread"
                      onClick={() => actions.closeDocumentThreadFrom(index)}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </div>

                {panel.isActive && panelDocumentIsLoading ? (
                  <div className="detail-empty thread-panel-loading">
                    <p>Loading document content.</p>
                  </div>
                ) : panel.isActive && panelIsHome ? (
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
                ) : panel.isActive ? (
                  panelAsset !== null ? (
                    <ThreadAssetShell title={panelTitle} description={panelDescription} asset={panelAsset} />
                  ) : (
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
                  )
                ) : panelIsHome ? (
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
                ) : panelAsset !== null ? (
                  <ThreadAssetShell title={panelTitle} description={panelDescription} asset={panelAsset} />
                ) : panelDocument === null ? (
                  <div className="detail-empty thread-panel-loading">
                    <p>Loading document content.</p>
                  </div>
                ) : (
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
                )}

                <div
                  className="thread-panel-resize-handle"
                  role="separator"
                  aria-label="Resize thread panel"
                  aria-orientation="vertical"
                  onMouseDown={(event) => actions.beginThreadPanelResize(event, panelKey)}
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const ThreadPanelStack = memo(ThreadPanelStackComponent);