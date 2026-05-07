import {
  useCallback,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type { HomeSurfaceProps } from "../components/HomeSurface";
import type { HomeFormState } from "../types";

type UseHomeSurfaceActionsArgs = {
  setHomeTOCVisible: React.Dispatch<React.SetStateAction<boolean>>;
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
  handleHomeDocumentTOCResizeMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  handleTOCNavigate: (headingSlug: string) => void;
  homeThreadDocumentId: string;
};

export function useHomeSurfaceActions({
  setHomeTOCVisible,
  updateHomeFormField,
  handleInlineReferenceOpen,
  handleDateOpen,
  openAssetInThreadFromSource,
  setEditorScrollTarget,
  handleHomeDocumentTOCResizeMouseDown,
  handleTOCNavigate,
  homeThreadDocumentId,
}: UseHomeSurfaceActionsArgs): HomeSurfaceProps["actions"] {
  const actionRefs = useRef({
    updateHomeFormField,
    handleInlineReferenceOpen,
    handleDateOpen,
    openAssetInThreadFromSource,
    setEditorScrollTarget,
    handleHomeDocumentTOCResizeMouseDown,
    handleTOCNavigate,
  });

  actionRefs.current = {
    updateHomeFormField,
    handleInlineReferenceOpen,
    handleDateOpen,
    openAssetInThreadFromSource,
    setEditorScrollTarget,
    handleHomeDocumentTOCResizeMouseDown,
    handleTOCNavigate,
  };

  const handleHomeSurfaceToggleTOC = useCallback(() => {
    setHomeTOCVisible((current) => !current);
  }, [setHomeTOCVisible]);

  const handleHomeSurfaceFormFieldChange = useCallback((field: keyof HomeFormState, value: string) => {
    actionRefs.current.updateHomeFormField(field, value);
  }, []);

  const handleHomeSurfaceInlineReferenceOpen = useCallback((documentId: string, graphPath: string) => {
    void actionRefs.current.handleInlineReferenceOpen(homeThreadDocumentId, documentId, graphPath, "center");
  }, [homeThreadDocumentId]);

  const handleHomeSurfaceDateOpen = useCallback((date: string) => {
    actionRefs.current.handleDateOpen(date);
  }, []);

  const handleHomeSurfaceThreadAssetOpen = useCallback((assetHref: string, assetName: string, kind: "pdf" | "text") => {
    void actionRefs.current.openAssetInThreadFromSource(homeThreadDocumentId, "", assetHref, assetName, kind);
  }, [homeThreadDocumentId]);

  const handleHomeSurfaceClearEditorScrollTarget = useCallback(() => {
    actionRefs.current.setEditorScrollTarget(null);
  }, []);

  const handleHomeSurfaceResizeTOC = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    actionRefs.current.handleHomeDocumentTOCResizeMouseDown(event);
  }, []);

  const handleHomeSurfaceTOCNavigate = useCallback((headingSlug: string) => {
    actionRefs.current.handleTOCNavigate(headingSlug);
  }, []);

  return useMemo(() => ({
    toggleTOC: handleHomeSurfaceToggleTOC,
    updateHomeFormField: handleHomeSurfaceFormFieldChange,
    openInlineReference: handleHomeSurfaceInlineReferenceOpen,
    openDate: handleHomeSurfaceDateOpen,
    openThreadAsset: handleHomeSurfaceThreadAssetOpen,
    clearEditorScrollTarget: handleHomeSurfaceClearEditorScrollTarget,
    resizeTOC: handleHomeSurfaceResizeTOC,
    navigateTOC: handleHomeSurfaceTOCNavigate,
  }), [
    handleHomeSurfaceClearEditorScrollTarget,
    handleHomeSurfaceDateOpen,
    handleHomeSurfaceFormFieldChange,
    handleHomeSurfaceInlineReferenceOpen,
    handleHomeSurfaceResizeTOC,
    handleHomeSurfaceTOCNavigate,
    handleHomeSurfaceThreadAssetOpen,
    handleHomeSurfaceToggleTOC,
  ]);
}