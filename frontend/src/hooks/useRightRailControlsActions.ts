import { useCallback, useMemo, useRef } from "react";

export type RightRailControlsActions = {
  openSettings: () => void;
  toggleSearch: () => void;
  toggleCalendar: () => void;
  openDocument: () => void;
};

type UseRightRailControlsActionsArgs = {
  setSettingsDialogOpen: (open: boolean) => void;
  toggleRightPanel: (tab: "calendar" | "search" | "document") => void;
  handleSelectedNodeDocumentButtonClick: () => void;
};

export function useRightRailControlsActions({
  setSettingsDialogOpen,
  toggleRightPanel,
  handleSelectedNodeDocumentButtonClick,
}: UseRightRailControlsActionsArgs): RightRailControlsActions {
  const actionRefs = useRef({
    setSettingsDialogOpen,
    toggleRightPanel,
    handleSelectedNodeDocumentButtonClick,
  });

  actionRefs.current = {
    setSettingsDialogOpen,
    toggleRightPanel,
    handleSelectedNodeDocumentButtonClick,
  };

  const openSettings = useCallback(() => {
    actionRefs.current.setSettingsDialogOpen(true);
  }, []);

  const toggleSearch = useCallback(() => {
    actionRefs.current.toggleRightPanel("search");
  }, []);

  const toggleCalendar = useCallback(() => {
    actionRefs.current.toggleRightPanel("calendar");
  }, []);

  const openDocument = useCallback(() => {
    actionRefs.current.handleSelectedNodeDocumentButtonClick();
  }, []);

  return useMemo(() => ({
    openSettings,
    toggleSearch,
    toggleCalendar,
    openDocument,
  }), [openDocument, openSettings, toggleCalendar, toggleSearch]);
}