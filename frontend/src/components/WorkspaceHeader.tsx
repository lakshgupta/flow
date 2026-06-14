import { memo, useMemo } from "react";
import { SidebarTrigger } from "./ui/sidebar";
import { Separator } from "./ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./ui/breadcrumb";
import { RightRailControls, type RightRailControlsProps } from "./RightRailControls";
import type { GraphTreeResponse, SurfaceState } from "../types";

export type WorkspaceHeaderProps = {
  workspaceSurfaceSection: string;
  selectedGraphPath: string;
  graphTree: GraphTreeResponse | null;
  onNavigateGraph: (graphPath: string) => void;
  rightPanelTab: string;
  rightRailCollapsed: boolean;
  activeSurface: SurfaceState;
  settingsDialogProps: RightRailControlsProps["settingsDialog"];
  rightRailControlsActions: RightRailControlsProps["actions"];
};

function graphPathSegments(graphPath: string): string[] {
  if (graphPath === "") {
    return [];
  }
  return graphPath.split("/");
}

function WorkspaceHeaderComponent({
  workspaceSurfaceSection,
  selectedGraphPath,
  graphTree,
  onNavigateGraph,
  rightPanelTab,
  rightRailCollapsed,
  activeSurface,
  settingsDialogProps,
  rightRailControlsActions,
}: WorkspaceHeaderProps) {
  const pathSegments = graphPathSegments(selectedGraphPath);

  const displayNames = useMemo(() => {
    if (pathSegments.length === 0) {
      return [];
    }
    const names: string[] = [];
    let builtPath = "";
    for (let i = 0; i < pathSegments.length; i++) {
      builtPath = i === 0 ? pathSegments[i] : `${builtPath}/${pathSegments[i]}`;
      const graphNode = graphTree?.graphs.find((g) => g.graphPath === builtPath);
      names.push(graphNode?.displayName ?? pathSegments[i]);
    }
    return names;
  }, [pathSegments, graphTree?.graphs]);

  return (
    <header className="workspace-shell-header">
      <div className="workspace-shell-header-leading">
        <SidebarTrigger />
        <Separator className="workspace-shell-header-separator" orientation="vertical" />
        <Breadcrumb className="workspace-shell-breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>Workspace</BreadcrumbItem>
            <BreadcrumbSeparator />
            {pathSegments.length === 0 ? (
              <BreadcrumbItem>
                <BreadcrumbPage>{workspaceSurfaceSection}</BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              pathSegments.map((segment, index) => {
                const isLast = index === pathSegments.length - 1;
                const builtPath = pathSegments.slice(0, index + 1).join("/");
                return (
                  <span key={builtPath} style={{ display: "contents" }}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage>{displayNames[index]}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink onClick={() => onNavigateGraph(builtPath)}>
                          {displayNames[index]}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </span>
                );
              })
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
