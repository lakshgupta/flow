import { CalendarDays, FileText, Search, Settings } from "lucide-react";
import { memo } from "react";

import { SettingsDialog, type SettingsDialogProps } from "./SettingsDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

import type { RightRailControlsActions } from "../hooks/useRightRailControlsActions";

export type RightRailControlsProps = {
  searchActive: boolean;
  calendarActive: boolean;
  showDocumentButton: boolean;
  documentActive: boolean;
  settingsDialog: SettingsDialogProps;
  actions: RightRailControlsActions;
};

function RightRailControlsComponent({
  searchActive,
  calendarActive,
  showDocumentButton,
  documentActive,
  settingsDialog,
  actions,
}: RightRailControlsProps) {
  return (
    <div className="right-sidebar-icons">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="right-rail-icon-btn"
            aria-label="Settings"
            onClick={actions.openSettings}
          >
            <Settings size={18} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Settings</TooltipContent>
      </Tooltip>
      <SettingsDialog {...settingsDialog} />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`right-rail-icon-btn${searchActive ? " right-rail-icon-btn-active" : ""}`}
            aria-label="Search"
            onClick={actions.toggleSearch}
          >
            <Search size={18} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Search</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`right-rail-icon-btn${calendarActive ? " right-rail-icon-btn-active" : ""}`}
            aria-label="Calendar"
            onClick={actions.toggleCalendar}
          >
            <CalendarDays size={18} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Calendar</TooltipContent>
      </Tooltip>
      <Tooltip>
        {showDocumentButton ? (
          <TooltipTrigger asChild>
            <button
              type="button"
              className={`right-rail-icon-btn${documentActive ? " right-rail-icon-btn-active" : ""}`}
              aria-label="Document"
              onClick={actions.openDocument}
            >
              <FileText size={18} />
            </button>
          </TooltipTrigger>
        ) : null}
        {showDocumentButton ? <TooltipContent side="left">Document</TooltipContent> : null}
      </Tooltip>
    </div>
  );
}

export const RightRailControls = memo(RightRailControlsComponent);