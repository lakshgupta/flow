import { Check, Loader2 } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { SidebarTrigger } from "./ui/sidebar";
import { Separator } from "./ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./ui/breadcrumb";
import { RightRailControls, type RightRailControlsProps } from "./RightRailControls";
import { GraphValidationIndicator } from "./GraphValidationIndicator";
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
  /** Bumped after graph mutations to keep the validation badge fresh. */
  graphValidationReloadToken?: number;
  /** Opens the right-rail violations sidebar from the validation badge. */
  onOpenViolations?: () => void;
  /** Show the edge-violations toggle in the rail controls (graph surfaces only). */
  showViolationsButton?: boolean;
  violationsActive?: boolean;
  /** True while a document autosave is in flight. */
  savingDocument?: boolean;
  /** True while the home-surface autosave is in flight. */
  savingHome?: boolean;
  /** Epoch ms of the last successful autosave — flashes a brief "Saved" confirmation. */
  lastSaveAt?: number;
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
  graphValidationReloadToken = 0,
  onOpenViolations,
  showViolationsButton = false,
  violationsActive = false,
  savingDocument = false,
  savingHome = false,
  lastSaveAt = 0,
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

  // Subtle autosave status chip: "Saving…" while a save is in flight, then a
  // brief fading "Saved" confirmation whenever lastSaveAt advances.
  // Keep SAVED_FLASH_MS in sync with the saveStatusSavedInOut duration in styles.css.
  const SAVED_FLASH_MS = 2000;
  const [showSaved, setShowSaved] = useState<boolean>(false);
  const lastSaveAtRef = useRef(lastSaveAt);
  const savedFlashTimerRef = useRef<number | null>(null);
  const isSaving = savingDocument || savingHome;

  useEffect(() => {
    if (lastSaveAt === 0 || lastSaveAt === lastSaveAtRef.current) {
      return;
    }
    lastSaveAtRef.current = lastSaveAt;
    setShowSaved(true);

    // React runs the previous effect's cleanup first, so the old timer is
    // already cleared here — just arm the new one.
    savedFlashTimerRef.current = window.setTimeout(() => {
      savedFlashTimerRef.current = null;
      setShowSaved(false);
    }, SAVED_FLASH_MS);

    return () => {
      if (savedFlashTimerRef.current !== null) {
        window.clearTimeout(savedFlashTimerRef.current);
        savedFlashTimerRef.current = null;
      }
    };
  }, [lastSaveAt]);

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
        {activeSurface.kind === "graph" && (
          <GraphValidationIndicator graphPath={activeSurface.graphPath} reloadToken={graphValidationReloadToken} onOpen={onOpenViolations} />
        )}
        {(isSaving || showSaved) && (
          <div
            className={`save-status-indicator${!isSaving && showSaved ? " save-status-saved" : ""}`}
            role="status"
            aria-live="polite"
            aria-label={isSaving ? "Saving changes" : "All changes saved"}
          >
            {isSaving ? (
              <>
                <Loader2 className="save-status-icon save-status-spinner" size={13} aria-hidden="true" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <Check className="save-status-icon" size={13} aria-hidden="true" />
                <span>Saved</span>
              </>
            )}
          </div>
        )}
        <RightRailControls
          searchActive={rightPanelTab === "search" && !rightRailCollapsed}
          calendarActive={rightPanelTab === "calendar" && !rightRailCollapsed}
          showViolationsButton={showViolationsButton}
          violationsActive={violationsActive}
          showHomeButton={activeSurface.kind === "graph"}
          settingsDialog={settingsDialogProps}
          actions={rightRailControlsActions}
        />
      </div>
    </header>
  );
}

export const WorkspaceHeader = memo(WorkspaceHeaderComponent);
