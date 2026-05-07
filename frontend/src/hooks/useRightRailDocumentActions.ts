import {
  useCallback,
  useMemo,
  useRef,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type { DocumentEditorPaneProps } from "../components/DocumentEditorPane";
import type { DocumentFormState, DocumentResponse } from "../types";

type UseRightRailDocumentActionsArgs = {
  toggleRightRailMaximized: () => void;
  openDeleteDialogForSelectedDocument: () => void;
  handleCloseContextPanel: () => Promise<void> | void;
  updateFormField: (field: keyof DocumentFormState, value: string) => void;
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
  handleGraphCanvasFilesDrop: (files: FileList | File[]) => Promise<void> | void;
  handleInspectDocument: (documentId: string, graphPath: string) => void;
  handleRightRailDocumentTOCResizeMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  handleTOCNavigate: (headingSlug: string) => void;
  selectedDocumentRef: MutableRefObject<DocumentResponse | null>;
};

export function useRightRailDocumentActions({
  toggleRightRailMaximized,
  openDeleteDialogForSelectedDocument,
  handleCloseContextPanel,
  updateFormField,
  handleInlineReferenceOpen,
  handleDateOpen,
  openAssetInThreadFromSource,
  setEditorScrollTarget,
  handleGraphCanvasFilesDrop,
  handleInspectDocument,
  handleRightRailDocumentTOCResizeMouseDown,
  handleTOCNavigate,
  selectedDocumentRef,
}: UseRightRailDocumentActionsArgs): DocumentEditorPaneProps["actions"] {
  const actionRefs = useRef({
    toggleRightRailMaximized,
    openDeleteDialogForSelectedDocument,
    handleCloseContextPanel,
    updateFormField,
    handleInlineReferenceOpen,
    handleDateOpen,
    openAssetInThreadFromSource,
    setEditorScrollTarget,
    handleGraphCanvasFilesDrop,
    handleInspectDocument,
    handleRightRailDocumentTOCResizeMouseDown,
    handleTOCNavigate,
  });

  actionRefs.current = {
    toggleRightRailMaximized,
    openDeleteDialogForSelectedDocument,
    handleCloseContextPanel,
    updateFormField,
    handleInlineReferenceOpen,
    handleDateOpen,
    openAssetInThreadFromSource,
    setEditorScrollTarget,
    handleGraphCanvasFilesDrop,
    handleInspectDocument,
    handleRightRailDocumentTOCResizeMouseDown,
    handleTOCNavigate,
  };

  const handleRightRailDocumentToggleMaximize = useCallback(() => {
    actionRefs.current.toggleRightRailMaximized();
  }, []);

  const handleRightRailDocumentOpenDeleteDialog = useCallback(() => {
    actionRefs.current.openDeleteDialogForSelectedDocument();
  }, []);

  const handleRightRailDocumentClose = useCallback(() => {
    void actionRefs.current.handleCloseContextPanel();
  }, []);

  const handleRightRailDocumentFormFieldChange = useCallback((field: keyof DocumentFormState, value: string) => {
    actionRefs.current.updateFormField(field, value);
  }, []);

  const handleRightRailDocumentInlineReferenceOpen = useCallback((documentId: string, graphPath: string) => {
    const currentDocument = selectedDocumentRef.current;
    if (currentDocument === null) {
      return;
    }
    void actionRefs.current.handleInlineReferenceOpen(currentDocument.id, documentId, graphPath, "right-rail");
  }, [selectedDocumentRef]);

  const handleRightRailDocumentDateOpen = useCallback((date: string) => {
    actionRefs.current.handleDateOpen(date);
  }, []);

  const handleRightRailDocumentAssetOpen = useCallback((assetHref: string, assetName: string, kind: "pdf" | "text") => {
    const currentDocument = selectedDocumentRef.current;
    if (currentDocument === null) {
      return;
    }
    void actionRefs.current.openAssetInThreadFromSource(currentDocument.id, currentDocument.graph, assetHref, assetName, kind);
  }, [selectedDocumentRef]);

  const handleRightRailDocumentClearEditorScrollTarget = useCallback(() => {
    actionRefs.current.setEditorScrollTarget(null);
  }, []);

  const handleRightRailDocumentFilesDrop = useCallback((files: FileList | File[]) => {
    void actionRefs.current.handleGraphCanvasFilesDrop(files);
  }, []);

  const handleRightRailDocumentInspect = useCallback((documentId: string, graphPath: string) => {
    actionRefs.current.handleInspectDocument(documentId, graphPath);
  }, []);

  const handleRightRailDocumentResizeTOC = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    actionRefs.current.handleRightRailDocumentTOCResizeMouseDown(event);
  }, []);

  const handleRightRailDocumentTOCNavigate = useCallback((headingSlug: string) => {
    actionRefs.current.handleTOCNavigate(headingSlug);
  }, []);

  return useMemo(() => ({
    toggleMaximize: handleRightRailDocumentToggleMaximize,
    openDeleteDialog: handleRightRailDocumentOpenDeleteDialog,
    closeDocument: handleRightRailDocumentClose,
    updateFormField: handleRightRailDocumentFormFieldChange,
    openInlineReference: handleRightRailDocumentInlineReferenceOpen,
    openDate: handleRightRailDocumentDateOpen,
    openThreadAsset: handleRightRailDocumentAssetOpen,
    clearEditorScrollTarget: handleRightRailDocumentClearEditorScrollTarget,
    handleFilesDrop: handleRightRailDocumentFilesDrop,
    inspectDocument: handleRightRailDocumentInspect,
    resizeTOC: handleRightRailDocumentResizeTOC,
    navigateTOC: handleRightRailDocumentTOCNavigate,
  }), [
    handleRightRailDocumentAssetOpen,
    handleRightRailDocumentClearEditorScrollTarget,
    handleRightRailDocumentClose,
    handleRightRailDocumentDateOpen,
    handleRightRailDocumentFilesDrop,
    handleRightRailDocumentFormFieldChange,
    handleRightRailDocumentInlineReferenceOpen,
    handleRightRailDocumentInspect,
    handleRightRailDocumentOpenDeleteDialog,
    handleRightRailDocumentResizeTOC,
    handleRightRailDocumentTOCNavigate,
    handleRightRailDocumentToggleMaximize,
  ]);
}