import { memo, useMemo, type CSSProperties, type MouseEvent as ReactMouseEvent, type RefObject, useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Info, Maximize2, Minimize2, X } from "lucide-react";

import type { DocumentPropertiesPanelProps } from "./DocumentPropertiesPanel";
import { DocumentPropertiesPanel } from "./DocumentPropertiesPanel";
import { RenderedMarkdown } from "./RenderedMarkdown";
import { RichTextEditor, type RichTextEditorHandle } from "./editor/RichTextEditor";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

import { createDocumentFormState, formatDocumentType, isBodyLeadingHeadingDuplicated } from "../lib/docUtils";
import { graphDirectoryColorHex, resolveGraphDirectoryColor } from "../lib/graphColors";
import { TASK_STATUS_OPTIONS } from "../lib/graphCanvasUtils";
import { parseFlowAssetHref, parseFlowDateHref, parseFlowReferenceHref } from "../richText";
import type { DocumentFormState, DocumentResponse, HomeFormState, HomeResponse } from "../types";

type CenterDocumentSidePanelMode = "hidden" | "properties";

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
  /** Per-thread-panel field edit: keeps every open panel's draft independent. */
  updateThreadFormField: (documentId: string, field: keyof DocumentFormState, value: string) => void;
  /** Persist one thread panel's document from its own form state. */
  saveThreadDocument: (documentId: string) => void;
  /** Track whether a panel has a debounced save in flight (unload flush). */
  setThreadPanelSavePending: (documentId: string, pending: boolean) => void;
  toggleCenterDocumentSidePanel: (mode: "properties") => void;  addOutgoingLink: (nodeId: string) => void;
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
  homeDocumentEditorRef: RefObject<RichTextEditorHandle | null>;
  homeFormState: HomeFormState;
  homeInlineReferences: HomeResponse["inlineReferences"];
  formState: DocumentFormState;
  selectedDocument: DocumentResponse | null;
  selectedDocumentId: string;
  selectedDocumentInlineReferences: DocumentResponse["inlineReferences"];
  isSelectedDocumentLoading: boolean;
  savingHome: boolean;
  savingDocument: boolean;
  centerDocumentEditorRef: RefObject<RichTextEditorHandle | null>;
  centerDocumentSidePanelMode: CenterDocumentSidePanelMode;
  showCenterDocumentSidePanel: boolean;
  centerDocumentSidePanelLabel: string;
  centerDocumentSidePanelTitle: string;
  centerDocumentSidePanelDescription: string;
  selectedDocumentLinks: DocumentPropertiesPanelProps["linkStats"];
  editableOutgoingLinks: DocumentPropertiesPanelProps["editableOutgoingLinks"];
  availableLinkTargets: DocumentPropertiesPanelProps["availableLinkTargets"];
  editorScrollTarget: string | null;
  actions: ThreadPanelActions;
  searchQuery?: string;
  searchIndex?: number;
  threadFormStates: Record<string, DocumentFormState>;
};

/** Open an external URL in the system browser.
 *  In Wails desktop mode, `window.runtime.BrowserOpenURL` opens the URL in the
 *  user's default browser. In browser mode, a temporary <a> click is used. */
function openExternalLink(href: string) {
  const runtime = typeof window !== "undefined"
    ? (window as unknown as Record<string, unknown>).runtime as Record<string, ((url: string) => void) | undefined> | undefined
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
  homeDocumentEditorRef,
  homeFormState,
  homeInlineReferences,
  homeThreadDocumentId,
  editorScrollTarget,
  actions,
  searchQuery = "",
  searchIndex = 0,
}: {
  homeDocumentEditorRef: RefObject<RichTextEditorHandle | null>;
  homeFormState: HomeFormState;
  homeInlineReferences: HomeResponse["inlineReferences"];
  homeThreadDocumentId: string;
  editorScrollTarget: string | null;
  actions: ThreadPanelActions;
  searchQuery?: string;
  searchIndex?: number;
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
            searchQuery={searchQuery}
            searchIndex={searchIndex}
            inlineReferences={homeInlineReferences}
            ref={homeDocumentEditorRef}
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

const AUTO_SAVE_DEBOUNCE_MS = 400;
// Continuous-typing guard: bound the unsaved window during non-stop edits.
const AUTO_SAVE_MAX_GAP_MS = 4000;

/**
 * Editable document panel for one open thread entry. Every expanded panel owns
 * an independent ProseMirror editor and autosave timer, so multiple threads can
 * sit side by side and be edited without activating them, and switching focus
 * never remounts (or waits on) another panel's editor.
 */
const EditableThreadDocumentPanel = memo(function EditableThreadDocumentPanel({
  panel,
  panelDocument,
  formState,
  editorScrollTarget,
  centerDocumentSidePanelMode,
  centerDocumentSidePanelLabel,
  centerDocumentSidePanelTitle,
  centerDocumentSidePanelDescription,
  selectedDocumentLinks,
  editableOutgoingLinks,
  availableLinkTargets,
  actions,
  searchQuery = "",
  searchIndex = 0,
  isExpanded = false,
}: {
  panel: ThreadPanelData;
  panelDocument: DocumentResponse;
  formState: DocumentFormState;
  editorScrollTarget: string | null;
  centerDocumentSidePanelMode: CenterDocumentSidePanelMode;
  showCenterDocumentSidePanel: boolean;
  centerDocumentSidePanelLabel: string;
  centerDocumentSidePanelTitle: string;
  centerDocumentSidePanelDescription: string;
  selectedDocumentLinks: DocumentPropertiesPanelProps["linkStats"];
  editableOutgoingLinks: DocumentPropertiesPanelProps["editableOutgoingLinks"];
  availableLinkTargets: DocumentPropertiesPanelProps["availableLinkTargets"];
  actions: ThreadPanelActions;
  searchQuery?: string;
  searchIndex?: number;
  isExpanded?: boolean;
}) {
  const editorRef = useRef<RichTextEditorHandle | null>(null);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const lastSaveAtRef = useRef(Date.now());
  // Latest values for the unmount flush without re-creating callbacks.
  const stateRef = useRef(formState);
  stateRef.current = formState;

  const markSaved = useCallback(() => {
    lastSaveAtRef.current = Date.now();
    actions.setThreadPanelSavePending(panel.documentId, false);
  }, [actions, panel.documentId]);

  const flushSave = useCallback(() => {
    if (saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
      actions.saveThreadDocument(panel.documentId);
      markSaved();
    }
  }, [actions, panel.documentId, markSaved]);

  const scheduleSave = useCallback(() => {
    // First edit after a long idle gap saves immediately (bounds the unsaved
    // window during continuous typing); otherwise debounce.
    const now = Date.now();
    if (now - lastSaveAtRef.current >= AUTO_SAVE_MAX_GAP_MS) {
      lastSaveAtRef.current = now;
      actions.setThreadPanelSavePending(panel.documentId, false);
      actions.saveThreadDocument(panel.documentId);
      return;
    }

    actions.setThreadPanelSavePending(panel.documentId, true);
    if (saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = undefined;
      actions.saveThreadDocument(panel.documentId);
      markSaved();
    }, AUTO_SAVE_DEBOUNCE_MS);
  }, [actions, panel.documentId, markSaved]);

  // Persist pending edits when the panel closes.
  useEffect(() => flushSave, [flushSave]);

  const handleFieldChange = useCallback((field: keyof DocumentFormState, value: string) => {
    actions.updateThreadFormField(panel.documentId, field, value);
    scheduleSave();
  }, [actions, panel.documentId, scheduleSave]);

  const showCenterDocumentSidePanel = centerDocumentSidePanelMode !== "hidden";
  const isDeduped = isExpanded && isBodyLeadingHeadingDuplicated(formState.body, formState.title);

  return (
    <div className="thread-panel-shell">
      {!isDeduped && (
        <div className="thread-panel-title-block">
          <input
            className="center-document-toolbar-title"
            placeholder="Document title"
            value={formState.title}
            onChange={(event) => handleFieldChange("title", event.target.value)}
            aria-label="Document title"
          />
        </div>
      )}

      <div
        className="center-document-layout"
        aria-label="Document content layout"
        data-side-panel={centerDocumentSidePanelMode}
      >
        <div className="center-document-main home-document">
          <div className="home-document-body center-document-body">
            <RichTextEditor
              ariaLabel="Document body editor"
              inlineReferences={panelDocument.inlineReferences}
              onChange={(value) => handleFieldChange("body", value)}
              onReferenceOpen={(documentId, graphPath) => actions.openInlineReference(panel.documentId, documentId, graphPath)}
              onDateOpen={actions.openDate}
              onAssetOpenInThread={(assetHref, assetName, kind) => {
                actions.openThreadAsset(panel.documentId, panel.graphPath, assetHref, assetName, kind);
              }}
              ref={editorRef}
              onScrollCompleted={actions.clearEditorScrollTarget}
              placeholder="Type / for headings, lists, quotes, links, and highlights"
              scrollToHeadingSlug={editorScrollTarget}
              value={formState.body}
              searchQuery={searchQuery}
              searchIndex={searchIndex}
            />
          </div>
        </div>

        {showCenterDocumentSidePanel && panel.isActive ? (
          <aside className="center-document-side-panel" aria-label={centerDocumentSidePanelLabel}>
            <div className="center-document-side-panel-header">
              <h4>{centerDocumentSidePanelTitle}</h4>
              <p>{centerDocumentSidePanelDescription}</p>
            </div>
            <DocumentPropertiesPanel
              selectedDocument={panelDocument}
              formState={formState}
              linkStats={selectedDocumentLinks}
              editableOutgoingLinks={editableOutgoingLinks}
              availableLinkTargets={availableLinkTargets}
              onAddOutgoingLink={actions.addOutgoingLink}
              onRemoveOutgoingLink={actions.removeOutgoingLink}
              onUpdateLinkDetail={actions.updateLinkDetail}
              updateFormField={(field, value) => handleFieldChange(field, value)}
            />
          </aside>
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

// ── Panel header ───────────────────────────────────────────────────────

const ThreadPanelHeader = memo(function ThreadPanelHeader({
  panel,
  panelIsHome,
  panelAsset,
  panelDocument,
  panelTitle,
  formState,
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
  formState: DocumentFormState;
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
          <>
            <Badge variant="outline" className="center-document-type-badge">{formatDocumentType(panelDocument.type)}</Badge>
            {panel.isActive && panelDocument.type === "task" ? (
              <select
                className="center-document-status-select"
                value={formState.status}
                onChange={(event) => actions.updateFormField("status", event.target.value)}
                aria-label="Task status"
              >
                <option value="">No status</option>
                {TASK_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
                {formState.status.trim() !== "" && !TASK_STATUS_OPTIONS.includes(formState.status as (typeof TASK_STATUS_OPTIONS)[number]) ? (
                  <option value={formState.status}>{formState.status}</option>
                ) : null}
              </select>
            ) : null}
          </>
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
                {savingDocument && <span className="home-save-success">Saving…</span>}                {panelAsset === null && (
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
  homeDocumentEditorRef: RefObject<RichTextEditorHandle | null>;
  homeFormState: HomeFormState;
  homeInlineReferences: HomeResponse["inlineReferences"];
  formState: DocumentFormState;
  selectedDocument: DocumentResponse | null;
  selectedDocumentInlineReferences: DocumentResponse["inlineReferences"];
  editorScrollTarget: string | null;
  savingHome: boolean;
  savingDocument: boolean;
  centerDocumentEditorRef: RefObject<RichTextEditorHandle | null>;
  centerDocumentSidePanelMode: CenterDocumentSidePanelMode;
  showCenterDocumentSidePanel: boolean;
  centerDocumentSidePanelLabel: string;
  centerDocumentSidePanelTitle: string;
  centerDocumentSidePanelDescription: string;
  selectedDocumentLinks: DocumentPropertiesPanelProps["linkStats"];
  editableOutgoingLinks: DocumentPropertiesPanelProps["editableOutgoingLinks"];
  availableLinkTargets: DocumentPropertiesPanelProps["availableLinkTargets"];
  panelAsset: ThreadAssetEntry | null;
  panelDocument: DocumentResponse | null;
  panelIsHome: boolean;
  actions: ThreadPanelActions;
  searchQuery?: string;
  searchIndex?: number;
  panelFormState: DocumentFormState | undefined;
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
  homeDocumentEditorRef,
  homeFormState,
  homeInlineReferences,
  formState,
  selectedDocument,
  selectedDocumentInlineReferences,
  editorScrollTarget,
  savingHome,
  savingDocument,
  centerDocumentEditorRef,
  centerDocumentSidePanelMode,
  showCenterDocumentSidePanel,
  centerDocumentSidePanelLabel,
  centerDocumentSidePanelTitle,
  centerDocumentSidePanelDescription,
  selectedDocumentLinks,
  editableOutgoingLinks,
  availableLinkTargets,
  panelAsset,
  panelDocument,
  panelIsHome,
  actions,
  searchQuery = "",
  searchIndex = -1,
  panelFormState,
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
        formState={formState}
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
          homeDocumentEditorRef={homeDocumentEditorRef}
          homeFormState={homeFormState}
          homeInlineReferences={homeInlineReferences}
          homeThreadDocumentId={homeThreadDocumentId}
          editorScrollTarget={editorScrollTarget}
          actions={actions}
          searchQuery={searchQuery}
          searchIndex={searchIndex}
        />
      ) : panel.isActive && panelAsset !== null ? (
        <ThreadAssetShell title={panelTitle} description={panelDescription} asset={panelAsset} />
      ) : !panel.isActive && panelIsHome ? (
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
      ) : panelDocument === null || panelFormState === undefined ? (
        <PanelLoadingSkeleton />
      ) : (
        <EditableThreadDocumentPanel
          panel={panel}
          panelDocument={panelDocument}
          formState={panelFormState}
          editorScrollTarget={panel.isActive ? editorScrollTarget : null}
          isExpanded={panelExpandMode === "full" || (panel.isActive && threadExpanded)}
          centerDocumentSidePanelMode={centerDocumentSidePanelMode}
          showCenterDocumentSidePanel={panel.isActive && showCenterDocumentSidePanel && selectedDocument?.id === panel.documentId}
          centerDocumentSidePanelLabel={centerDocumentSidePanelLabel}
          centerDocumentSidePanelTitle={centerDocumentSidePanelTitle}
          centerDocumentSidePanelDescription={centerDocumentSidePanelDescription}
          selectedDocumentLinks={selectedDocumentLinks}
          editableOutgoingLinks={editableOutgoingLinks}
          availableLinkTargets={availableLinkTargets}
          actions={actions}
          searchQuery={searchQuery}
          searchIndex={searchIndex}
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

/** Per-panel draft state, seeded from the loaded document on first edit. */
function panelFormStateFor(
  panel: ThreadPanelData,
  panelDocument: DocumentResponse | null,
  threadFormStates: Record<string, DocumentFormState>,
): DocumentFormState | undefined {
  const existing = threadFormStates[panel.documentId];
  if (existing !== undefined) return existing;
  if (panelDocument === null) return undefined;
  return createDocumentFormState(panelDocument);
}

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
  homeDocumentEditorRef,
  homeFormState,
  homeInlineReferences,
  formState,
  selectedDocument,
  selectedDocumentId,
  selectedDocumentInlineReferences,
  isSelectedDocumentLoading,
  savingHome,
  savingDocument,
  centerDocumentEditorRef,
  centerDocumentSidePanelMode,
  showCenterDocumentSidePanel,
  centerDocumentSidePanelLabel,
  centerDocumentSidePanelTitle,
  centerDocumentSidePanelDescription,
  selectedDocumentLinks,
  editableOutgoingLinks,
  availableLinkTargets,
  editorScrollTarget,
  actions,
  searchQuery = "",
  searchIndex = -1,
  threadFormStates,
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
            // Per-panel draft state: each panel edits independently; the active
            // panel's live formState wins so the properties side panel and TOC
            // reflect keystrokes immediately.
            const panelFormState = panel.isActive && selectedDocument?.id === panel.documentId
              ? formState
              : panelFormStateFor(panel, panelDocument, threadFormStates);
            const panelTitle = panelIsHome
              ? homeFormState.title
              : panelAsset !== null
                ? panelAsset.name
                : (panelFormState?.title || panelDocument?.title || panel.documentId);
            const panelDescription = panelIsHome
              ? homeFormState.description
              : panelAsset !== null
                ? panelAsset.kind === "pdf" ? "PDF document" : "Text file"
                : panelFormState?.description || panelDocument?.description || "";
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
                homeDocumentEditorRef={homeDocumentEditorRef}
                homeFormState={homeFormState}
                homeInlineReferences={homeInlineReferences}
                formState={formState}
                selectedDocument={selectedDocument}
                selectedDocumentInlineReferences={selectedDocumentInlineReferences}
                editorScrollTarget={editorScrollTarget}
                savingHome={savingHome}
                savingDocument={savingDocument}
                centerDocumentEditorRef={centerDocumentEditorRef}
                centerDocumentSidePanelMode={centerDocumentSidePanelMode}
                showCenterDocumentSidePanel={showCenterDocumentSidePanel}
                centerDocumentSidePanelLabel={centerDocumentSidePanelLabel}
                centerDocumentSidePanelTitle={centerDocumentSidePanelTitle}
                centerDocumentSidePanelDescription={centerDocumentSidePanelDescription}
                selectedDocumentLinks={selectedDocumentLinks}
                editableOutgoingLinks={editableOutgoingLinks}
                availableLinkTargets={availableLinkTargets}
                panelAsset={panelAsset}
                panelDocument={panelDocument}
                panelIsHome={panelIsHome}
                actions={actions}
                searchQuery={panel.isActive ? searchQuery : ""}
                searchIndex={panel.isActive ? searchIndex : -1}
                panelFormState={panelFormState}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export const ThreadPanelStack = memo(ThreadPanelStackComponent);
