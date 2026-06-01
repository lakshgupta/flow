import { memo, type RefObject } from "react";

import type { DocumentFormState, GraphTreeResponse, SearchResult, SurfaceState } from "../types";
import type { RightRailSearchPanelProps, RightRailCalendarPanelProps } from "./RightRailPanels";
import { RightRailSearchPanel, RightRailCalendarPanel } from "./RightRailPanels";
import { DocumentEditorPane } from "./DocumentEditorPane";
import { RichTextEditor } from "./editor/RichTextEditor";

type RightSidebarPanelProps = {
  rightRailCollapsed: boolean;
  rightRailMaximized: boolean;
  rightPanelTab: string;
  isResizingRight: boolean;
  handleRightSidebarMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  // Home surface
  graphTree: GraphTreeResponse | null;
  homeDocumentEditorRef: RefObject<{ getMarkdown: () => string } | null>;
  homeFormState: { title: string; body: string };
  homeInlineReferences: GraphTreeResponse["home"]["inlineReferences"];
  homeSurfaceActions: {
    updateHomeFormField: (field: string, value: string) => void;
    openInlineReference: (documentId: string, graphPath: string) => void;
    openDate: (date: string) => void;
    openThreadAsset: (href: string) => void;
  };
  // Document editor
  hasRightRailDocument: boolean;
  renderCenterDocumentShell: (isMaximizedRightRail: boolean) => React.ReactNode;
  selectedDocument: DocumentFormState | null;
  formState: DocumentFormState;
  panelError: string;
  mutationError: string;
  mutationSuccess: string;
  savingDocument: boolean;
  deletingDocument: boolean;
  selectedDocumentGraphColor: string | undefined;
  selectedDocumentTintStyle: React.CSSProperties | undefined;
  documentTOCRatio: number;
  tocItems: Array<{ id: string; title: string; level: number; slug: string }>;
  selectedDocumentLinks: { outgoing: Array<{ id: string; title: string }>; incoming: Array<{ id: string; title: string }> };
  rightRailDocumentLayoutRef: RefObject<HTMLDivElement | null>;
  rightRailDocumentEditorRef: RefObject<{ getMarkdown: () => string } | null>;
  editorScrollTarget: string | null;
  rightRailDocumentActions: Record<string, unknown>;
  // Search
  searchQuery: string;
  searchTagQuery: string;
  searchTitleQuery: string;
  searchDescriptionQuery: string;
  searchContentQuery: string;
  searchError: string;
  hasDeferredSearchFilter: boolean;
  searchResults: SearchResult[];
  setSearchQuery: (value: string) => void;
  setSearchTagQuery: (value: string) => void;
  setSearchTitleQuery: (value: string) => void;
  setSearchDescriptionQuery: (value: string) => void;
  setSearchContentQuery: (value: string) => void;
  handleRightRailSearchResultNavigate: (result: SearchResult) => void;
  // Calendar
  calendarDocumentsForDisplay: RightRailCalendarPanelProps["documents"];
  calendarFocusDate: string;
  setCalendarFocusDate: (value: string) => void;
  handleRightRailCalendarDocumentOpen: (document: RightRailCalendarPanelProps["documents"][0]) => void;
  calendarError: string;
};

function RightSidebarPanelComponent({
  rightRailCollapsed,
  rightRailMaximized,
  rightPanelTab,
  isResizingRight,
  handleRightSidebarMouseDown,
  graphTree,
  homeDocumentEditorRef,
  homeFormState,
  homeInlineReferences,
  homeSurfaceActions,
  hasRightRailDocument,
  renderCenterDocumentShell,
  selectedDocument,
  formState,
  panelError,
  mutationError,
  mutationSuccess,
  savingDocument,
  deletingDocument,
  selectedDocumentGraphColor,
  selectedDocumentTintStyle,
  documentTOCRatio,
  tocItems,
  selectedDocumentLinks,
  rightRailDocumentLayoutRef,
  rightRailDocumentEditorRef,
  editorScrollTarget,
  rightRailDocumentActions,
  searchQuery,
  searchTagQuery,
  searchTitleQuery,
  searchDescriptionQuery,
  searchContentQuery,
  searchError,
  hasDeferredSearchFilter,
  searchResults,
  setSearchQuery,
  setSearchTagQuery,
  setSearchTitleQuery,
  setSearchDescriptionQuery,
  setSearchContentQuery,
  handleRightRailSearchResultNavigate,
  calendarDocumentsForDisplay,
  calendarFocusDate,
  setCalendarFocusDate,
  handleRightRailCalendarDocumentOpen,
  calendarError,
}: RightSidebarPanelProps) {
  return (
    <aside
      className="app-right-sidebar"
      aria-label="Right pane"
      data-open={rightRailCollapsed ? "false" : "true"}
      data-focus={!rightRailCollapsed && rightRailMaximized ? "true" : "false"}
      style={!rightRailCollapsed && !rightRailMaximized ? { width: "var(--right-sidebar-width)", ...(isResizingRight ? { transition: "none" } : {}) } : undefined}
    >
      {!rightRailCollapsed && !rightRailMaximized && (
        <div className="right-sidebar-resize-handle" onMouseDown={handleRightSidebarMouseDown} />
      )}
      <div className="right-sidebar-panel">
        {!rightRailCollapsed && (rightPanelTab === "home" ? (
          <div className="home-surface">
            <div className="home-document-layout center-document-layout" data-side-panel="hidden" aria-label="Home content layout">
              <div className="center-document-main">
                <RichTextEditor
                  ariaLabel="Home body editor"
                  className="home-editor"
                  inlineReferences={homeInlineReferences}
                  ref={homeDocumentEditorRef}
                  onChange={(value) => homeSurfaceActions.updateHomeFormField("body", value)}
                  onReferenceOpen={homeSurfaceActions.openInlineReference}
                  onDateOpen={homeSurfaceActions.openDate}
                  onAssetOpenInThread={homeSurfaceActions.openThreadAsset}
                  placeholder="Start writing…"
                  value={homeFormState.body}
                />
              </div>
            </div>
          </div>
        ) : rightPanelTab === "document" && hasRightRailDocument ? (
          rightRailMaximized ? (
            renderCenterDocumentShell(true)
          ) : (
            <DocumentEditorPane
              selectedDocument={selectedDocument}
              formState={formState}
              panelError={panelError}
              mutationError={mutationError}
              mutationSuccess={mutationSuccess}
              savingDocument={savingDocument}
              deletingDocument={deletingDocument}
              isMaximized={rightRailMaximized}
              tintColor={selectedDocumentGraphColor}
              tintStyle={selectedDocumentTintStyle}
              documentTOCRatio={documentTOCRatio}
              tocItems={tocItems}
              outgoingLinks={selectedDocumentLinks.outgoing}
              incomingLinks={selectedDocumentLinks.incoming}
              rightRailDocumentLayoutRef={rightRailDocumentLayoutRef}
              rightRailDocumentEditorRef={rightRailDocumentEditorRef}
              editorScrollTarget={editorScrollTarget}
              actions={rightRailDocumentActions}
            />
          )
        ) : rightPanelTab === "search" ? (
          <RightRailSearchPanel
            searchQuery={searchQuery}
            searchTagQuery={searchTagQuery}
            searchTitleQuery={searchTitleQuery}
            searchDescriptionQuery={searchDescriptionQuery}
            searchContentQuery={searchContentQuery}
            searchError={searchError}
            hasDeferredSearchFilter={hasDeferredSearchFilter}
            searchResults={searchResults}
            setSearchQuery={setSearchQuery}
            setSearchTagQuery={setSearchTagQuery}
            setSearchTitleQuery={setSearchTitleQuery}
            setSearchDescriptionQuery={setSearchDescriptionQuery}
            setSearchContentQuery={setSearchContentQuery}
            onResultNavigate={handleRightRailSearchResultNavigate}
          />
        ) : rightPanelTab === "calendar" ? (
          <RightRailCalendarPanel
            documents={calendarDocumentsForDisplay}
            selectedDate={calendarFocusDate}
            onDateChange={setCalendarFocusDate}
            onDocumentOpen={handleRightRailCalendarDocumentOpen}
            error={calendarError}
          />
        ) : null)}
      </div>
    </aside>
  );
}

export const RightSidebarPanel = memo(RightSidebarPanelComponent);
