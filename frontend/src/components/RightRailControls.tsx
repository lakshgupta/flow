import { CalendarDays, Search, Settings } from "lucide-react";
import { memo } from "react";

import { SettingsDialog, type SettingsDialogProps } from "./SettingsDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

import type { RightRailControlsActions } from "../hooks/useRightRailControlsActions";

export type RightRailControlsProps = {
  searchActive: boolean;
  calendarActive: boolean;
  settingsDialog: SettingsDialogProps;
  actions: RightRailControlsActions;
};

function RightRailControlsComponent({
  searchActive,
  calendarActive,
  settingsDialog,
  actions,
}: RightRailControlsProps) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`right-rail-icon-btn${searchActive ? " right-rail-icon-btn-active" : ""}`}
            aria-label="Search"
            onClick={actions.toggleSearch}
          >
            <Search size={17} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Search</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`right-rail-icon-btn${calendarActive ? " right-rail-icon-btn-active" : ""}`}
            aria-label="Calendar"
            onClick={actions.toggleCalendar}
          >
            <CalendarDays size={17} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Calendar</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="right-rail-icon-btn"
            aria-label="Settings"
            onClick={actions.openSettings}
          >
            <Settings size={17} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Settings</TooltipContent>
      </Tooltip>
      <SettingsDialog {...settingsDialog} />
    </>
  );
}

export const RightRailControls = memo(RightRailControlsComponent);