import { memo, useMemo, type RefObject } from "react";
import type { Edge, EdgeTypes, Node } from "@xyflow/react";

import type { GraphCanvasFlowNodeData, GraphCanvasResponse, GraphCreateType, GraphTreeResponse, HomeFormState, SurfaceState } from "../types";
import type { GraphCanvasFlowEdgeData } from "../lib/graphCanvasUtils";
import type { GraphCanvasOverlayController } from "./graphCanvasOverlayController";
import type { GraphCanvasSurfaceActions } from "./GraphCanvasSurface";
import { GraphCanvasSurface } from "./GraphCanvasSurface";
import { GraphEmptyState } from "./GraphEmptyState";
import { HomeSurface } from "./HomeSurface";
import { usePresentationMode } from "../hooks/usePresentationMode";
import { PresentationOverlay } from "./PresentationOverlay";


type MiddleContentProps = {
  activeSurface: SurfaceState;
  isThreadStackOpen: boolean;
  renderCenterDocumentShell: (isMaximizedRightRail: boolean) => React.ReactNode;
  // Home surface props
  homeMutationError: string;
  showFreshStartGuide: boolean;
  homeDocumentEditorRef: RefObject<{ getMarkdown: () => string } | null>;
  homeInlineReferences: GraphTreeResponse["home"]["inlineReferences"];
  editorScrollTarget: string | null;
  homeFormState: HomeFormState;
  homeSurfaceActions: ReturnType<typeof import("../hooks/useHomeSurfaceActions").useHomeSurfaceActions>;
  searchQuery?: string;
  searchIndex?: number;
  // Graph canvas props
  graphCanvasShellRef: RefObject<HTMLDivElement | null>;
  selectedGraphPath: string;
  graphCanvasDragActive: boolean;
  connectingFrom: string | null;
  graphCanvasData: GraphCanvasResponse | null;
  graphCanvasNodes: Node<GraphCanvasFlowNodeData>[];
  graphCanvasEdges: Edge<GraphCanvasFlowEdgeData>[];
  edgeTypes: EdgeTypes;
  graphCanvasNodeSearchTerm: string;
  graphCanvasNodeSearchHasMatches: boolean;
  graphCanvasNodeSearchSelectedIndex: number;
  graphCanvasNodeSearchMatchCount: number;
  normalizedGraphCanvasNodeSearchTerm: string;
  graphCanvasResettingLayout: boolean;
  graphCanvasLayoutMode: "user" | "horizontal";
  overlayController: GraphCanvasOverlayController;
  handleEdgeDoubleClickAction: (sourceId: string, targetId: string, context: string) => void;
  graphCanvasSurfaceActions: GraphCanvasSurfaceActions;
  // Graph canvas state
  graphCanvasError: string;
  graphCanvasLoading: boolean;
  graphCreateError: string;
  graphCreatePendingType: GraphCreateType | "";
  graphEmptyStateActions: {
    setDragActive: (active: boolean) => void;
    handleFilesDrop: (files: FileList | File[]) => void;
    handleFilesDropFromURIs: (dataTransfer: DataTransfer, graphPath: string) => void;
    createGraphDocument: (type: GraphCreateType) => void;
  };
  shiftSelectedNodes: string[];
};

function MiddleContentComponent({
  activeSurface,
  isThreadStackOpen,
  renderCenterDocumentShell,
  homeMutationError,
  showFreshStartGuide,
  homeDocumentEditorRef,
  homeInlineReferences,
  editorScrollTarget,
  homeFormState,
  homeSurfaceActions,
  searchQuery = "",
  searchIndex = 0,
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
  shiftSelectedNodes,
}: MiddleContentProps) {
  const isGraphSurface = activeSurface.kind === "graph";

  const selectedPresentationNodeId = useMemo(() => {
    const selected = graphCanvasNodes.find((node) => node.data.isCanvasSelected);
    return typeof selected?.id === "string" ? selected.id : null;
  }, [graphCanvasNodes]);

  const presentation = usePresentationMode({
    data: graphCanvasData,
    startNodeId: selectedPresentationNodeId,
    entryEnabled: isGraphSurface && !isThreadStackOpen,
    onOpenDocument: (nodeId) => graphCanvasSurfaceActions.handleNodeDoubleClick(nodeId),
    onExit: (lastNodeId) => graphCanvasSurfaceActions.handleNodeClick(lastNodeId),
  });

  if (isThreadStackOpen) {
    return <>{renderCenterDocumentShell(false)}</>;
  }

  const isHome = activeSurface.kind === "home";

  return (
    <>
      <div style={isHome ? { flex: "1 1 auto", display: "flex", minHeight: 0 } : { display: "none" }}>
        <HomeSurface
          homeMutationError={homeMutationError}
          showFreshStartGuide={showFreshStartGuide}
          homeDocumentEditorRef={homeDocumentEditorRef}
          homeInlineReferences={homeInlineReferences}
          editorScrollTarget={editorScrollTarget}
          homeFormState={homeFormState}
          actions={homeSurfaceActions}
          searchQuery={searchQuery}
          searchIndex={searchIndex}
        />
      </div>
      {!isHome && (
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
                <div className="skeleton-node" />
                <div className="skeleton-line skeleton-line-md" />
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
              presentationEnter={presentation.enter}
              shiftSelectedNodes={shiftSelectedNodes}
            />
          )}
        </div>
      )}
      <PresentationOverlay
        state={presentation.state}
        nodesById={presentation.nodesById}
        bodies={presentation.bodies}
        onClose={presentation.exit}
        onBack={() => presentation.run({ type: "goBack" })}
        onFollow={() => presentation.run({ type: "followHighlighted" })}
        onRotate={(direction) => presentation.run({ type: "rotateHighlight", direction })}
        onOpen={(nodeId) => graphCanvasSurfaceActions.handleNodeDoubleClick(nodeId)}
      />
    </>
  );
}

export const MiddleContent = memo(MiddleContentComponent);
