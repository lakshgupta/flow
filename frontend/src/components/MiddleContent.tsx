import { memo, type RefObject } from "react";
import type { ReactFlowInstance } from "reactflow";

import type { GraphCanvasFlowNodeData, GraphCanvasResponse, GraphTreeResponse, SurfaceState } from "../types";
import type { GraphCanvasOverlayController } from "./graphCanvasOverlayController";
import { GraphCanvasSurface } from "./GraphCanvasSurface";
import { GraphEmptyState } from "./GraphEmptyState";
import { HomeSurface } from "./HomeSurface";
import type { ThreadPanelStackProps } from "./ThreadPanels";

type MiddleContentProps = {
  activeSurface: SurfaceState;
  isThreadStackOpen: boolean;
  renderCenterDocumentShell: (isMaximizedRightRail: boolean) => React.ReactNode;
  // Home surface props
  homeMutationError: string;
  homeTOCVisible: boolean;
  showFreshStartGuide: boolean;
  homeDocumentLayoutRef: RefObject<HTMLDivElement | null>;
  homeDocumentEditorRef: RefObject<{ getMarkdown: () => string } | null>;
  documentTOCRatio: number;
  homeInlineReferences: GraphTreeResponse["home"]["inlineReferences"];
  editorScrollTarget: string | null;
  homeFormState: { title: string; body: string };
  tocItems: Array<{ id: string; title: string; level: number; slug: string }>;
  homeSurfaceActions: ReturnType<typeof import("../hooks/useHomeSurfaceActions").useHomeSurfaceActions>;
  // Graph canvas props
  graphCanvasShellRef: RefObject<HTMLDivElement | null>;
  selectedGraphPath: string;
  graphCanvasDragActive: boolean;
  connectingFrom: string | null;
  graphCanvasData: GraphCanvasResponse;
  graphCanvasNodes: Array<{ id: string; data: GraphCanvasFlowNodeData }>;
  graphCanvasEdges: Array<{ id: string; source: string; target: string; data: Record<string, unknown> }>;
  edgeTypes: Record<string, unknown>;
  graphCanvasNodeSearchTerm: string;
  graphCanvasNodeSearchHasMatches: boolean;
  graphCanvasNodeSearchSelectedIndex: number;
  graphCanvasNodeSearchMatchCount: number;
  normalizedGraphCanvasNodeSearchTerm: string;
  graphCanvasResettingLayout: boolean;
  graphCanvasLayoutMode: "user" | "horizontal";
  overlayController: GraphCanvasOverlayController;
  handleEdgeDoubleClickAction: (sourceId: string, targetId: string) => void;
  graphCanvasSurfaceActions: ReturnType<typeof import("../hooks/useGraphCanvasSurfaceActions").useGraphCanvasSurfaceActions>;
  // Graph canvas state
  graphCanvasError: string;
  graphCanvasLoading: boolean;
  graphCreateError: string;
  graphCreatePendingType: string;
  graphEmptyStateActions: {
    selectGraph: (graphPath: string) => void;
    createGraph: (name: string) => void;
    dismissGraphCreateError: () => void;
    setGraphCreatePendingType: (type: string) => void;
  };
};

function MiddleContentComponent({
  activeSurface,
  isThreadStackOpen,
  renderCenterDocumentShell,
  homeMutationError,
  homeTOCVisible,
  showFreshStartGuide,
  homeDocumentLayoutRef,
  homeDocumentEditorRef,
  documentTOCRatio,
  homeInlineReferences,
  editorScrollTarget,
  homeFormState,
  tocItems,
  homeSurfaceActions,
  graphCanvasShellRef,
  selectedGraphPath,
  graphCanvasDragActive,
  connectingFrom,
  graphCanvasData,
  graphCanvasNodes,
  graphCanvasEdges,
  edgeTypes,
  graphCanvasNodeSearchTerm,
  graphCanvasNodeSearchHasMatches,
  graphCanvasNodeSearchSelectedIndex,
  graphCanvasNodeSearchMatchCount,
  normalizedGraphCanvasNodeSearchTerm,
  graphCanvasResettingLayout,
  graphCanvasLayoutMode,
  overlayController,
  handleEdgeDoubleClickAction,
  graphCanvasSurfaceActions,
  graphCanvasError,
  graphCanvasLoading,
  graphCreateError,
  graphCreatePendingType,
  graphEmptyStateActions,
}: MiddleContentProps) {
  if (isThreadStackOpen) {
    return <>{renderCenterDocumentShell(false)}</>;
  }

  if (activeSurface.kind === "home") {
    return (
      <HomeSurface
        homeMutationError={homeMutationError}
        homeTOCVisible={homeTOCVisible}
        showFreshStartGuide={showFreshStartGuide}
        homeDocumentLayoutRef={homeDocumentLayoutRef}
        homeDocumentEditorRef={homeDocumentEditorRef}
        documentTOCRatio={documentTOCRatio}
        homeInlineReferences={homeInlineReferences}
        editorScrollTarget={editorScrollTarget}
        homeFormState={homeFormState}
        tocItems={tocItems}
        actions={homeSurfaceActions}
      />
    );
  }

  return (
    <div className="graph-canvas-outer">
      {graphCanvasError !== "" ? (
        <div className="detail-empty shell-inner-card">
          <p>Graph canvas data could not be loaded for this graph.</p>
        </div>
      ) : graphCanvasLoading ? (
        <div className="skeleton-card">
          <div className="skeleton-graph-canvas">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-line skeleton-line-md" />
            <div className="skeleton-node" />
            <div className="skeleton-line skeleton-line-sm" />
            <div className="skeleton-node" />
            <div className="skeleton-line skeleton-line-md" />
            <div className="skeleton-node" />
          </div>
        </div>
      ) : graphCanvasData !== null && graphCanvasData.nodes.length === 0 ? (
        <GraphEmptyState
          selectedGraphPath={selectedGraphPath}
          graphCanvasDragActive={graphCanvasDragActive}
          graphCreateError={graphCreateError}
          graphCreatePendingType={graphCreatePendingType}
          actions={graphEmptyStateActions}
        />
      ) : graphCanvasData === null ? (
        <div className="detail-empty shell-inner-card">
          <p>Graph canvas data is not available yet.</p>
        </div>
      ) : (
        <GraphCanvasSurface
          graphCanvasShellRef={graphCanvasShellRef}
          selectedGraphPath={selectedGraphPath}
          graphCanvasDragActive={graphCanvasDragActive}
          connectingFrom={connectingFrom}
          graphCanvasData={graphCanvasData}
          graphCanvasNodes={graphCanvasNodes}
          graphCanvasEdges={graphCanvasEdges}
          edgeTypes={edgeTypes}
          graphCanvasNodeSearchTerm={graphCanvasNodeSearchTerm}
          graphCanvasNodeSearchHasMatches={graphCanvasNodeSearchHasMatches}
          graphCanvasNodeSearchSelectedIndex={graphCanvasNodeSearchSelectedIndex}
          graphCanvasNodeSearchMatchCount={graphCanvasNodeSearchMatchCount}
          normalizedGraphCanvasNodeSearchTerm={normalizedGraphCanvasNodeSearchTerm}
          graphCanvasResettingLayout={graphCanvasResettingLayout}
          graphCanvasLayoutMode={graphCanvasLayoutMode}
          overlayController={overlayController}
          edgeDoubleClickAction={handleEdgeDoubleClickAction}
          actions={graphCanvasSurfaceActions}
        />
      )}
    </div>
  );
}

export const MiddleContent = memo(MiddleContentComponent);
