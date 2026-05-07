import { GalleryVerticalEnd } from "lucide-react";
import { memo } from "react";

import { GraphTree } from "./GraphTree";
import { Label } from "./ui/label";

import type { SidebarNavigationActions } from "../hooks/useSidebarNavigationActions";
import type { GraphTreeResponse, SurfaceState, WorkspaceResponse } from "../types";

type WorkspaceSelectorPanelProps = {
  workspace: WorkspaceResponse | null;
  switchingWorkspace: boolean;
  actions: SidebarNavigationActions;
};

function WorkspaceSelectorPanelComponent({ workspace, switchingWorkspace, actions }: WorkspaceSelectorPanelProps) {
  if (workspace === null || !workspace.workspaceSelectionEnabled) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 px-2 pb-2">
      <Label htmlFor="sidebar-workspace-select" className="flex items-center gap-2">
        <GalleryVerticalEnd size={14} />
        <span>Workspace</span>
      </Label>
      <select
        id="sidebar-workspace-select"
        className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
        value={workspace.workspacePath}
        onChange={(event) => {
          actions.selectWorkspace(event.target.value);
        }}
        disabled={switchingWorkspace}
      >
        {(workspace.workspaces ?? [{ scope: workspace.scope, workspacePath: workspace.workspacePath }]).map((item) => (
          <option key={`${item.scope}:${item.workspacePath}`} value={item.workspacePath}>
            {item.scope === "global" ? `* ${item.workspacePath}` : item.workspacePath}
          </option>
        ))}
      </select>
    </div>
  );
}

type GraphTreePanelProps = {
  graphTree: GraphTreeResponse | null;
  activeSurface: SurfaceState;
  selectedDocumentId: string;
  actions: SidebarNavigationActions;
};

function GraphTreePanelComponent({ graphTree, activeSurface, selectedDocumentId, actions }: GraphTreePanelProps) {
  return (
    <GraphTree
      graphTree={graphTree}
      activeSurface={activeSurface}
      selectedDocumentId={selectedDocumentId}
      onSelectHome={actions.selectHome}
      onSelectGraph={actions.selectGraph}
      onOpenDocument={actions.openDocument}
      onCreateGraph={actions.createGraph}
      onCreateNode={actions.createNode}
      onRenameGraph={actions.renameGraph}
      onRenameNode={actions.renameNode}
      onDeleteNode={actions.deleteNode}
      onDeleteGraph={actions.deleteGraph}
      onSetGraphColor={actions.setGraphColor}
    />
  );
}

export const WorkspaceSelectorPanel = memo(WorkspaceSelectorPanelComponent);
export const GraphTreePanel = memo(GraphTreePanelComponent);