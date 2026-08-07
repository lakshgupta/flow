import { getSmoothStepPath } from "@xyflow/react";

import {
  edgeTypeFixLabel,
  graphCanvasEdgeViolationSeverity,
  graphCanvasEdgeViolations,
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
    edgeViolations,
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
    quickFixEdge,
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
            <marker id="graph-canvas-arrow-error" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 10 3.5 L 0 7 Z" fill="var(--destructive)" />
            </marker>
            <marker id="graph-canvas-arrow-warn" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 10 3.5 L 0 7 Z" fill="var(--warn)" />
            </marker>
            <filter id="graph-canvas-edge-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g transform={`translate(${rfViewport.x} ${rfViewport.y}) scale(${rfViewport.zoom})`}>
            {edges.map((edge) => {
              const sourceNode = graphCanvasNodes.find((node) => node.id === edge.source);
              const targetNode = graphCanvasNodes.find((node) => node.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const visual = graphCanvasEdgeVisualState(
                edge,
                selectedCanvasNodeId,
                selectedEdgeId,
                graphCanvasEdgeViolationSeverity(edge, edgeViolations),
              );
              const isEditableEdge = isEditableGraphCanvasEdge(edge);
              const ports = pickBestEdgePorts(sourceNode, targetNode);
              const [edgePath, labelX, labelY] = getSmoothStepPath({ ...ports, borderRadius: 8 });

              return (
                <g key={edge.id}>
                  {visual.isGlowVisible && (
                    <path
                      d={edgePath}
                      stroke={visual.stroke}
                      strokeWidth={visual.glowStrokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      opacity={visual.glowOpacity}
                      filter="url(#graph-canvas-edge-glow)"
                      pointerEvents="none"
                    />
                  )}
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
                      handleGraphCanvasEdgeClick({
                        edgeId: edge.id,
                        sourceId: edge.source,
                        targetId: edge.target,
                        context: edge.context ?? "",
                        relationships: edge.relationships ?? [],
                        x: labelX * rfViewport.zoom + rfViewport.x,
                        y: labelY * rfViewport.zoom + rfViewport.y,
                      });
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
      {edges.map((edge) => {
        const matchedViolations = graphCanvasEdgeViolations(edge, edgeViolations);
        if (matchedViolations.length === 0 || !isEditableGraphCanvasEdge(edge)) {
          return null;
        }

        const sourceNode = graphCanvasNodes.find((node) => node.id === edge.source);
        const targetNode = graphCanvasNodes.find((node) => node.id === edge.target);
        if (!sourceNode || !targetNode) {
          return null;
        }

        const primary = matchedViolations.find((violation) => violation.severity === "error") ?? matchedViolations[0];
        const ports = pickBestEdgePorts(sourceNode, targetNode);
        const [, labelX, labelY] = getSmoothStepPath({ ...ports, borderRadius: 8 });
        const fixLabel = edgeTypeFixLabel(primary);

        return (
          <button
            key={`quickfix:${edge.id}`}
            type="button"
            className={[
              "graph-canvas-quickfix",
              primary.severity === "error" ? "graph-canvas-quickfix-error" : "graph-canvas-quickfix-warn",
            ].join(" ")}
            style={{
              left: labelX * rfViewport.zoom + rfViewport.x,
              top: labelY * rfViewport.zoom + rfViewport.y,
            }}
            title={primary.message}
            aria-label={`Quick fix: ${primary.message}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              void quickFixEdge(
                {
                  sourceId: edge.source,
                  targetId: edge.target,
                  context: edge.context ?? "",
                  relationships: edge.relationships ?? [],
                },
                primary,
              );
            }}
          >
            {fixLabel === "" ? "Remove tag" : `→ ${fixLabel}`}
          </button>
        );
      })}
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
