import { useCallback, useMemo } from "react";

import { useLatestRef } from "./useLatestRef";

export type RightRailControlsActions = {
  openSettings: () => void;
  toggleSearch: () => void;
  toggleCalendar: () => void;
  openDocument: () => void;
  navigateHome: () => void;
};

type UseRightRailControlsActionsArgs = {
  setSettingsDialogOpen: (open: boolean) => void;
  toggleRightPanel: (tab: "calendar" | "search" | "document") => void;
  handleSelectedNodeDocumentButtonClick: () => void;
  handleNavigateHome: () => void;
};

export function useRightRailControlsActions({
  setSettingsDialogOpen,
  toggleRightPanel,
  handleSelectedNodeDocumentButtonClick,
  handleNavigateHome,
}: UseRightRailControlsActionsArgs): RightRailControlsActions {
  const actionRefs = useLatestRef({
    setSettingsDialogOpen,
    toggleRightPanel,
    handleSelectedNodeDocumentButtonClick,
    handleNavigateHome,
  });

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

  const navigateHome = useCallback(() => {
    actionRefs.current.handleNavigateHome();
  }, []);

  return useMemo(() => ({
    openSettings,
    toggleSearch,
    toggleCalendar,
    openDocument,
    navigateHome,
  }), [navigateHome, openDocument, openSettings, toggleCalendar, toggleSearch]);
}