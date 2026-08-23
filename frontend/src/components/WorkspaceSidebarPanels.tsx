import { ArrowLeft, GalleryVerticalEnd, Rows3 } from "lucide-react";
import { memo } from "react";

import { GraphTree } from "./GraphTree";
import { TableOfContents, type TOCItem } from "./TableOfContents";
import { Button } from "./ui/button";
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

export type SidebarView = "content" | "toc";

type GraphTreePanelProps = {
  graphTree: GraphTreeResponse | null;
  activeSurface: SurfaceState;
  selectedDocumentId: string;
  actions: SidebarNavigationActions;
  onReorderGraph?: (sourceGraphPath: string, targetGraphPath: string) => void;
  onReorderFile?: (graphPath: string, sourceFileId: string, targetFileId: string) => void;
  sidebarView?: SidebarView;
  tocTitle?: string;
  tocItems?: TOCItem[];
  onBackToContent?: () => void;
  onNavigateTOC?: (headingSlug: string) => void;
  showTOCButton?: boolean;
  onShowTOC?: () => void;
};

function SidebarTOCPanel({
  title,
  items,
  onBack,
  onNavigate,
}: {
  title: string;
  items: TOCItem[];
  onBack: () => void;
  onNavigate: (headingSlug: string) => void;
}) {
  return (
    <aside className="sidebar-toc-view" aria-label="Sidebar table of contents" data-testid="sidebar-toc-view">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="sidebar-toc-back"
        aria-label="Back to content tree"
        onClick={onBack}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        <span>Back to content tree</span>
      </Button>
      <div className="sidebar-toc-header">
        <p className="sidebar-toc-eyebrow">Table of Contents</p>
        <h3 className="sidebar-toc-title">{title}</h3>
      </div>
      <div className="sidebar-toc-content">
        <TableOfContents items={items} onNavigate={onNavigate} />
      </div>
    </aside>
  );
}

function GraphTreePanelComponent({
  graphTree,
  activeSurface,
  selectedDocumentId,
  actions,
  onReorderGraph,
  onReorderFile,
  sidebarView = "content",
  tocTitle = "Current document",
  tocItems = [],
  onBackToContent = () => {},
  onNavigateTOC = () => {},
  showTOCButton = false,
  onShowTOC = () => {},
}: GraphTreePanelProps) {
  const handleSelectHome = () => {
    if (activeSurface.kind === "home") {
      onShowTOC();
      return;
    }

    actions.selectHome();
  };

  const handleOpenDocument = (documentId: string, graphPath: string) => {
    if (selectedDocumentId === documentId) {
      onShowTOC();
      return;
    }

    actions.openDocument(documentId, graphPath);
  };

  const graphTreeContent = (
    <GraphTree
      graphTree={graphTree}
      activeSurface={activeSurface}
      selectedDocumentId={selectedDocumentId}
      onSelectHome={handleSelectHome}
      onSelectGraph={actions.selectGraph}
      onOpenGraphViolations={actions.openGraphViolations}
      onOpenDocument={handleOpenDocument}
      onCreateGraph={actions.createGraph}
      onCreateNode={actions.createNode}
      onRenameGraph={actions.renameGraph}
      onRenameNode={actions.renameNode}
      onMoveNode={actions.moveNode}
      onMoveGraph={actions.moveGraph}
      onReorderGraph={onReorderGraph ?? (() => {})}
      onReorderFile={onReorderFile ?? (() => {})}
      onDeleteNode={actions.deleteNode}
      onDeleteGraph={actions.deleteGraph}
      onDownloadGraph={actions.downloadGraph}
      onSetGraphColor={actions.setGraphColor}
      onSetGraphCanvasDisabled={actions.setGraphCanvasDisabled}
      onSetNodeColor={actions.setNodeColor}
      onRebuildIndex={actions.rebuildIndex}
    />
  );

  return (
    <>
      {sidebarView === "content" && showTOCButton ? (
        <div className="sidebar-content-actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="sidebar-show-toc"
            aria-label="Show table of contents"
            onClick={onShowTOC}
          >
            <Rows3 size={14} aria-hidden="true" />
            <span>Show table of contents</span>
          </Button>
        </div>
      ) : null}
      <div hidden={sidebarView === "toc"} aria-hidden={sidebarView === "toc"}>
        {graphTreeContent}
      </div>
      {sidebarView === "toc" ? (
        <SidebarTOCPanel
          title={tocTitle}
          items={tocItems}
          onBack={onBackToContent}
          onNavigate={onNavigateTOC}
        />
      ) : null}
    </>
  );
}

export const WorkspaceSelectorPanel = memo(WorkspaceSelectorPanelComponent);
export const GraphTreePanel = memo(GraphTreePanelComponent);