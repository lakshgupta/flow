import { memo } from "react";
import { SidebarTrigger } from "./ui/sidebar";
import { Separator } from "./ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./ui/breadcrumb";
import { RightRailControls, type RightRailControlsProps } from "./RightRailControls";
import type { SurfaceState } from "../types";

export type WorkspaceHeaderProps = {
  workspaceSurfaceTitle: string | null;
  workspaceSurfaceSection: string;
  rightPanelTab: string;
  rightRailCollapsed: boolean;
  activeSurface: SurfaceState;
  settingsDialogProps: RightRailControlsProps["settingsDialog"];
  rightRailControlsActions: RightRailControlsProps["actions"];
};

function WorkspaceHeaderComponent({
  workspaceSurfaceTitle,
  workspaceSurfaceSection,
  rightPanelTab,
  rightRailCollapsed,
  activeSurface,
  settingsDialogProps,
  rightRailControlsActions,
}: WorkspaceHeaderProps) {
  return (
    <header className="workspace-shell-header">
      <div className="workspace-shell-header-leading">
        <SidebarTrigger />
        <Separator className="workspace-shell-header-separator" orientation="vertical" />
        <Breadcrumb className="workspace-shell-breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>Workspace</BreadcrumbItem>
            <BreadcrumbSeparator />
            {workspaceSurfaceTitle === null ? (
              <BreadcrumbItem>
                <BreadcrumbPage>{workspaceSurfaceSection}</BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              <>
                <BreadcrumbItem>{workspaceSurfaceSection}</BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{workspaceSurfaceTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="workspace-shell-header-trailing">
        <RightRailControls
          searchActive={rightPanelTab === "search" && !rightRailCollapsed}
          calendarActive={rightPanelTab === "calendar" && !rightRailCollapsed}
          showHomeButton={activeSurface.kind === "graph"}
          settingsDialog={settingsDialogProps}
          actions={rightRailControlsActions}
        />
      </div>
    </header>
  );
}

export const WorkspaceHeader = memo(WorkspaceHeaderComponent);
