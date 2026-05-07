import { useCallback, useMemo, useRef, type MouseEvent as ReactMouseEvent } from "react";

import type { ThreadPanelStackProps } from "../components/ThreadPanels";
import type { DocumentFormState, HomeFormState } from "../types";

type ThreadDensityMode = "comfortable" | "dense" | "ultra";

type UseThreadPanelActionsArgs = {
  activateThreadDocument: (documentId: string, graphPath: string) => Promise<void> | void;
  setThreadDensityMode: (mode: ThreadDensityMode) => void;
  toggleThreadExpanded: () => void;
  moveThreadFocus: (delta: number) => void;
  toggleRightRailMaximized: () => void;
  closeDocumentThreadFrom: (index: number) => Promise<void> | void;
  updateHomeFormField: (field: keyof HomeFormState, value: string) => void;
  handleInlineReferenceOpen: (
    sourceDocumentId: string,
    documentId: string,
    graphPath: string,
    openMode: "center" | "right-rail",
  ) => Promise<void> | void;
  handleDateOpen: (date: string) => void;
  openAssetInThreadFromSource: (
    sourceDocumentId: string,
    graphPath: string,
    assetHref: string,
    assetName: string,
    kind: "pdf" | "text",
  ) => Promise<void> | void;
  setEditorScrollTarget: (target: string | null) => void;
  updateFormField: (field: keyof DocumentFormState, value: string) => void;
  toggleCenterDocumentSidePanel: (mode: "toc" | "properties") => void;
  handleDocumentTOCResizeMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  handleTOCNavigate: (headingSlug: string) => void;
  addOutgoingLink: (nodeId: string) => void;
  removeOutgoingLink: (nodeId: string) => void;
  updateEditableLinkDetail: (nodeId: string, field: "linkType" | "context", value: string) => void;
  beginThreadPanelResize: (event: ReactMouseEvent<HTMLDivElement>, panelElement: HTMLElement | null, panelKey: string) => void;
};

export function useThreadPanelActions({
  activateThreadDocument,
  setThreadDensityMode,
  toggleThreadExpanded,
  moveThreadFocus,
  toggleRightRailMaximized,
  closeDocumentThreadFrom,
  updateHomeFormField,
  handleInlineReferenceOpen,
  handleDateOpen,
  openAssetInThreadFromSource,
  setEditorScrollTarget,
  updateFormField,
  toggleCenterDocumentSidePanel,
  handleDocumentTOCResizeMouseDown,
  handleTOCNavigate,
  addOutgoingLink,
  removeOutgoingLink,
  updateEditableLinkDetail,
  beginThreadPanelResize,
}: UseThreadPanelActionsArgs): ThreadPanelStackProps["actions"] {
  const actionRefs = useRef<UseThreadPanelActionsArgs>({
    activateThreadDocument,
    setThreadDensityMode,
    toggleThreadExpanded,
    moveThreadFocus,
    toggleRightRailMaximized,
    closeDocumentThreadFrom,
    updateHomeFormField,
    handleInlineReferenceOpen,
    handleDateOpen,
    openAssetInThreadFromSource,
    setEditorScrollTarget,
    updateFormField,
    toggleCenterDocumentSidePanel,
    handleDocumentTOCResizeMouseDown,
    handleTOCNavigate,
    addOutgoingLink,
    removeOutgoingLink,
    updateEditableLinkDetail,
    beginThreadPanelResize,
  });

  actionRefs.current = {
    activateThreadDocument,
    setThreadDensityMode,
    toggleThreadExpanded,
    moveThreadFocus,
    toggleRightRailMaximized,
    closeDocumentThreadFrom,
    updateHomeFormField,
    handleInlineReferenceOpen,
    handleDateOpen,
    openAssetInThreadFromSource,
    setEditorScrollTarget,
    updateFormField,
    toggleCenterDocumentSidePanel,
    handleDocumentTOCResizeMouseDown,
    handleTOCNavigate,
    addOutgoingLink,
    removeOutgoingLink,
    updateEditableLinkDetail,
    beginThreadPanelResize,
  };

  const handleThreadPanelActivate = useCallback((documentId: string, graphPath: string) => {
    void actionRefs.current.activateThreadDocument(documentId, graphPath);
  }, []);

  const handleThreadDensityModeChange = useCallback((mode: ThreadDensityMode) => {
    actionRefs.current.setThreadDensityMode(mode);
  }, []);

  const handleThreadExpandedToggle = useCallback(() => {
    actionRefs.current.toggleThreadExpanded();
  }, []);

  const handleThreadFocusMove = useCallback((delta: number) => {
    actionRefs.current.moveThreadFocus(delta);
  }, []);

  const handleRightRailMinimize = useCallback(() => {
    actionRefs.current.toggleRightRailMaximized();
  }, []);

  const handleThreadCloseFrom = useCallback((index: number) => {
    void actionRefs.current.closeDocumentThreadFrom(index);
  }, []);

  const handleThreadHomeFormFieldChange = useCallback((field: keyof HomeFormState, value: string) => {
    actionRefs.current.updateHomeFormField(field, value);
  }, []);

  const handleThreadInlineReferenceOpen = useCallback((sourceDocumentId: string, documentId: string, graphPath: string) => {
    void actionRefs.current.handleInlineReferenceOpen(sourceDocumentId, documentId, graphPath, "center");
  }, []);

  const handleThreadDateOpen = useCallback((date: string) => {
    actionRefs.current.handleDateOpen(date);
  }, []);

  const handleThreadAssetOpen = useCallback((sourceDocumentId: string, graphPath: string, assetHref: string, assetName: string, kind: "pdf" | "text") => {
    void actionRefs.current.openAssetInThreadFromSource(sourceDocumentId, graphPath, assetHref, assetName, kind);
  }, []);

  const handleThreadClearEditorScrollTarget = useCallback(() => {
    actionRefs.current.setEditorScrollTarget(null);
  }, []);

  const handleThreadFormFieldChange = useCallback((field: keyof DocumentFormState, value: string) => {
    actionRefs.current.updateFormField(field, value);
  }, []);

  const handleThreadCenterDocumentSidePanelToggle = useCallback((mode: "toc" | "properties") => {
    actionRefs.current.toggleCenterDocumentSidePanel(mode);
  }, []);

  const handleThreadPanelTOCResizeMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    actionRefs.current.handleDocumentTOCResizeMouseDown(event);
  }, []);

  const handleThreadTOCNavigate = useCallback((headingSlug: string) => {
    actionRefs.current.handleTOCNavigate(headingSlug);
  }, []);

  const handleThreadAddOutgoingLink = useCallback((nodeId: string) => {
    actionRefs.current.addOutgoingLink(nodeId);
  }, []);

  const handleThreadRemoveOutgoingLink = useCallback((nodeId: string) => {
    actionRefs.current.removeOutgoingLink(nodeId);
  }, []);

  const handleThreadUpdateLinkDetail = useCallback((nodeId: string, field: "linkType" | "context", value: string) => {
    actionRefs.current.updateEditableLinkDetail(nodeId, field, value);
  }, []);

  const handleThreadPanelResizeMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>, panelKey: string) => {
    const panelElement = event.currentTarget.closest(".thread-panel");
    actionRefs.current.beginThreadPanelResize(event, panelElement instanceof HTMLElement ? panelElement : null, panelKey);
  }, []);

  return useMemo(() => ({
    activateThreadDocument: handleThreadPanelActivate,
    setThreadDensityMode: handleThreadDensityModeChange,
    toggleThreadExpanded: handleThreadExpandedToggle,
    moveThreadFocus: handleThreadFocusMove,
    minimizeRightRail: handleRightRailMinimize,
    closeDocumentThreadFrom: handleThreadCloseFrom,
    updateHomeFormField: handleThreadHomeFormFieldChange,
    openInlineReference: handleThreadInlineReferenceOpen,
    openDate: handleThreadDateOpen,
    openThreadAsset: handleThreadAssetOpen,
    clearEditorScrollTarget: handleThreadClearEditorScrollTarget,
    updateFormField: handleThreadFormFieldChange,
    toggleCenterDocumentSidePanel: handleThreadCenterDocumentSidePanelToggle,
    handleCenterDocumentTOCResizeMouseDown: handleThreadPanelTOCResizeMouseDown,
    navigateTOC: handleThreadTOCNavigate,
    addOutgoingLink: handleThreadAddOutgoingLink,
    removeOutgoingLink: handleThreadRemoveOutgoingLink,
    updateLinkDetail: handleThreadUpdateLinkDetail,
    beginThreadPanelResize: handleThreadPanelResizeMouseDown,
  }), [
    handleRightRailMinimize,
    handleThreadAddOutgoingLink,
    handleThreadAssetOpen,
    handleThreadCenterDocumentSidePanelToggle,
    handleThreadClearEditorScrollTarget,
    handleThreadCloseFrom,
    handleThreadDateOpen,
    handleThreadDensityModeChange,
    handleThreadExpandedToggle,
    handleThreadFocusMove,
    handleThreadFormFieldChange,
    handleThreadHomeFormFieldChange,
    handleThreadInlineReferenceOpen,
    handleThreadPanelActivate,
    handleThreadPanelResizeMouseDown,
    handleThreadPanelTOCResizeMouseDown,
    handleThreadRemoveOutgoingLink,
    handleThreadTOCNavigate,
    handleThreadUpdateLinkDetail,
  ]);
}