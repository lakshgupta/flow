import { getSmoothStepPath } from "@xyflow/react";

import {
  graphCanvasEdgeVisualState,
  isEditableGraphCanvasEdge,
  pickBestEdgePorts,
} from "../lib/graphCanvasUtils";
import type { GraphCanvasOverlayController } from "./graphCanvasOverlayController";

export interface GraphCanvasOverlayEdgesProps {
  controller: GraphCanvasOverlayController;
}

export function GraphCanvasOverlayEdges({
  controller,
}: GraphCanvasOverlayEdgesProps) {
  const {
    edges,
    graphCanvasNodes,
    rfViewport,
    selectedCanvasNodeId,
    selectedEdgeId,
    hoveredEdgeTooltip,
  } = controller.state;
  const {
    clearEdgeClickTimer,
    selectEdge,
    handleGraphCanvasEdgeClick,
    handleGraphCanvasEdgeHover,
    clearHoveredEdgeTooltip,
    handleGraphCanvasEdgeDoubleClick,
    handleDeleteEdge,
  } = controller.actions;

  return (
    <>
      {edges.length > 0 && (
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <defs>
            <marker id="graph-canvas-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 10 3.5 L 0 7 Z" fill="var(--graph-edge)" />
            </marker>
            <marker id="graph-canvas-arrow-dim" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 10 3.5 L 0 7 Z" fill="var(--graph-edge-dim)" />
            </marker>
          </defs>
          <g transform={`translate(${rfViewport.x} ${rfViewport.y}) scale(${rfViewport.zoom})`}>
            {edges.map((edge) => {
              const sourceNode = graphCanvasNodes.find((node) => node.id === edge.source);
              const targetNode = graphCanvasNodes.find((node) => node.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const visual = graphCanvasEdgeVisualState(edge, selectedCanvasNodeId, selectedEdgeId);
              const isEditableEdge = isEditableGraphCanvasEdge(edge);
              const ports = pickBestEdgePorts(sourceNode, targetNode);
              const [edgePath, labelX, labelY] = getSmoothStepPath({ ...ports, borderRadius: 8 });

              return (
                <g key={edge.id}>
                  <path
                    d={edgePath}
                    stroke="transparent"
                    strokeWidth={20}
                    strokeOpacity={0}
                    fill="none"
                    pointerEvents="stroke"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!isEditableEdge) {
                        clearEdgeClickTimer();
                        selectEdge(edge.id);
                        return;
                      }
                      handleGraphCanvasEdgeClick(edge.id, edge.source);
                    }}
                    onMouseEnter={() => {
                      handleGraphCanvasEdgeHover(
                        edge.id,
                        edge.context ?? "",
                        labelX * rfViewport.zoom + rfViewport.x,
                        labelY * rfViewport.zoom + rfViewport.y,
                      );
                    }}
                    onMouseLeave={() => {
                      clearHoveredEdgeTooltip(edge.id);
                    }}
                    onDoubleClick={(event) => {
                      if (!isEditableEdge) {
                        return;
                      }
                      event.stopPropagation();
                      handleGraphCanvasEdgeDoubleClick(edge.source, edge.target, edge.context ?? "", edge.id);
                    }}
                    onContextMenu={(event) => {
                      if (!isEditableEdge) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      void handleDeleteEdge(edge.source, edge.target);
                    }}
                  />
                  <path
                    d={edgePath}
                    stroke={visual.stroke}
                    strokeWidth={visual.strokeWidth}
                    fill="none"
                    opacity={visual.opacity}
                    markerEnd={visual.markerId === null ? undefined : `url(#${visual.markerId})`}
                    strokeDasharray={visual.strokeDasharray}
                    pointerEvents="none"
                  >
                    {edge.context ? <title>{edge.context}</title> : null}
                  </path>
                </g>
              );
            })}
          </g>
        </svg>
      )}
      {hoveredEdgeTooltip !== null && (
        <div
          className="graph-edge-hover-tooltip"
          style={{
            left: hoveredEdgeTooltip.x,
            top: hoveredEdgeTooltip.y,
            transform: "translate(-50%, calc(-100% - 10px))",
          }}
        >
          {hoveredEdgeTooltip.context}
        </div>
      )}
    </>
  );
}
