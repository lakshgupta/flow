import { CalendarDays, Home, Search, Settings, ShieldAlert } from "lucide-react";
import { memo } from "react";

import { SettingsDialog, type SettingsDialogProps } from "./SettingsDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

import type { RightRailControlsActions } from "../hooks/useRightRailControlsActions";

export type RightRailControlsProps = {
  searchActive: boolean;
  calendarActive: boolean;
  /** The edge-violations panel toggle; only shown on graph surfaces. */
  showViolationsButton?: boolean;
  violationsActive?: boolean;
  showHomeButton: boolean;
  settingsDialog: SettingsDialogProps;
  actions: RightRailControlsActions;
};

function RightRailControlsComponent({
  searchActive,
  calendarActive,
  showViolationsButton = false,
  violationsActive = false,
  showHomeButton,
  settingsDialog,
  actions,
}: RightRailControlsProps) {
  return (
    <>
      {showHomeButton && (
        <Tooltip>
          <TooltipTrigger asChild>
              <button
                type="button"
                className="right-rail-icon-btn"
                aria-label="Navigate to Home"
                onClick={actions.navigateHome}
              >
                <Home size={17} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Home</TooltipContent>
        </Tooltip>
      )}
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
      {showViolationsButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={`right-rail-icon-btn${violationsActive ? " right-rail-icon-btn-active" : ""}`}
              aria-label="Edge violations"
              onClick={actions.toggleViolations}
            >
              <ShieldAlert size={17} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Edge violations</TooltipContent>
        </Tooltip>
      )}
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