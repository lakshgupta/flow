import { MarkerType, Position, BaseEdge, getSmoothStepPath } from "@xyflow/react";
import type { Edge, EdgeProps, Node } from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";
import type { CSSProperties } from "react";
import { createContext } from "react";

import { fileNameFromPath } from "./docUtils";
import { graphDirectoryColorHex, resolveGraphDirectoryColor } from "./graphColors";
import type {
  GraphCanvasEdgePayload,
  GraphCanvasFlowNodeData,
  GraphCanvasFlowNodeInput,
  GraphCanvasLayerGuidance,
  GraphCanvasNodePayload,
  GraphCanvasPosition,
  GraphCanvasResponse,
  GraphCanvasResponseWire,
} from "../types";

export type GraphCanvasFlowEdgeData = {
  context: string;
  sourceId: string;
  targetId: string;
  kind: string;
};

export type GraphCanvasEdgeVisualState = {
  isReferenceEdge: boolean;
  hasSelection: boolean;
  isConnected: boolean;
  isSelected: boolean;
  isGlowVisible: boolean;
  stroke: string;
  strokeWidth: number;
  glowStrokeWidth: number;
  glowOpacity: number;
  opacity: number;
  strokeDasharray?: string;
  markerId: "graph-canvas-arrow" | "graph-canvas-arrow-dim" | null;
};

export type EdgeEditHandler = (sourceId: string, targetId: string, context: string) => void;
export const EdgeEditContext = createContext<EdgeEditHandler>(() => {});

/**
 * ContextEdge renders a smoothstep edge.
 * - Hover: shows a tooltip with the context annotation.
 * - Selected: shows a clickable HTML label via EdgeLabelRenderer to edit context.
 */
export function ContextEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
  selected,
}: EdgeProps<Edge<GraphCanvasFlowEdgeData>>) {
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{ ...style, cursor: "pointer" }}
      markerEnd={markerEnd}
      interactionWidth={32}
    />
  );
}

export function graphCanvasTypeLabel(value: string): string {
  return value === "command" ? "Cmd" : value.charAt(0).toUpperCase() + value.slice(1);
}

export function graphCanvasTypeClassName(value: string): string {
  if (value === "task" || value === "command") {
    return value;
  }
  return "note";
}

function graphCanvasNodeShape(value?: string): string {
  return value === "circle" ? "circle" : "card";
}

function graphCanvasNodeDimensions(shape?: string): { width: number; height: number } {
  if (graphCanvasNodeShape(shape) === "circle") {
    return { width: 132, height: 132 };
  }

  return { width: CANVAS_NODE_W, height: CANVAS_NODE_H };
}

export function renderGraphCanvasNodeLabel(data: GraphCanvasFlowNodeInput): React.ReactNode {
  const graphColor = graphDirectoryColorHex(data.graphColor);
  return (
    <article
      className={[
        "graph-canvas-node",
        `graph-canvas-node-${graphCanvasTypeClassName(data.type)}`,
        graphColor ? "graph-canvas-node-tinted" : "",
        data.shape === "circle" ? "graph-canvas-node-circle" : "",
        data.isCanvasSelected ? "graph-canvas-node-selected" : "",
        data.isPanelDocument ? "graph-canvas-node-panel" : "",
      ]
        .filter((value) => value !== "")
        .join(" ")}
      style={graphColor ? { "--graph-node-color": graphColor } as CSSProperties : undefined}
    >
      {data.shape === "circle" ? (
        <>
          <span className="graph-canvas-node-badge">{graphCanvasTypeLabel(data.type)}</span>
          <strong className="graph-canvas-node-title">{data.title}</strong>
          <span className="graph-canvas-node-graph">{data.graph}</span>
        </>
      ) : (
        <>
          <div className="graph-canvas-node-topline">
            <span className="graph-canvas-node-badge">{graphCanvasTypeLabel(data.type)}</span>
            <span className="graph-canvas-node-graph">{data.graph}</span>
          </div>
          <strong className="graph-canvas-node-title">{data.title}</strong>
          {data.description !== "" ? <p className="graph-canvas-node-description">{data.description}</p> : null}
        </>
      )}
    </article>
  );
}

export function buildGraphCanvasFlowNodes(
  graphCanvasData: GraphCanvasResponse | null,
  graphCanvasPositions: Record<string, GraphCanvasPosition>,
  selectedCanvasNodeId: string,
  selectedDocumentId: string,
  graphDirectoryColorsByPath: Record<string, string>,
): Node<GraphCanvasFlowNodeData>[] {
  if (graphCanvasData === null) {
    return [];
  }

  return graphCanvasData.nodes.map((item) => {
    const shape = graphCanvasNodeShape(item.shape);
    const dimensions = graphCanvasNodeDimensions(shape);
    const graphColor = resolveGraphDirectoryColor(item.graph, graphDirectoryColorsByPath);
    const data: GraphCanvasFlowNodeData = {
      label: renderGraphCanvasNodeLabel({
        id: item.id,
        type: item.type,
        shape,
        title: item.title,
        description: item.description,
        graph: item.graph,
        graphColor,
        featureSlug: item.featureSlug,
        fileName: fileNameFromPath(item.path),
        positionPersisted: item.positionPersisted,
        isCanvasSelected: item.id === selectedCanvasNodeId,
        isPanelDocument: item.id === selectedDocumentId,
      }),
      id: item.id,
      type: item.type,
      shape,
      title: item.title,
      description: item.description,
      graph: item.graph,
      graphColor,
      featureSlug: item.featureSlug,
      fileName: fileNameFromPath(item.path),
      positionPersisted: item.positionPersisted,
      isCanvasSelected: item.id === selectedCanvasNodeId,
      isPanelDocument: item.id === selectedDocumentId,
    };

    return {
      ...dimensions,
      id: item.id,
      position: graphCanvasPositions[item.id] ?? item.position,
      data,
      className: "graph-canvas-ghost-node",
      width: dimensions.width,
      height: dimensions.height,
      style: {
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        padding: 0,
        border: "none",
        borderRadius: 0,
        background: "transparent",
        boxShadow: "none",
        opacity: 0,
        pointerEvents: "none",
      },
      draggable: false,
      connectable: false,
      selectable: false,
    };
  });
}

export function isEditableGraphCanvasEdge(edge: Pick<GraphCanvasEdgePayload, "kind">): boolean {
  return edge.kind === "link";
}

export function graphCanvasEdgeVisualState(
  edge: GraphCanvasEdgePayload,
  selectedCanvasNodeId: string,
  selectedEdgeId = "",
): GraphCanvasEdgeVisualState {
  const isReferenceEdge = !isEditableGraphCanvasEdge(edge);
  const hasSelection = selectedCanvasNodeId !== "";
  const isConnected = selectedCanvasNodeId !== "" &&
    (edge.source === selectedCanvasNodeId || edge.target === selectedCanvasNodeId);
  const isSelected = selectedEdgeId !== "" && edge.id === selectedEdgeId;
  const stroke = isReferenceEdge
    ? hasSelection
      ? isConnected
        ? "var(--graph-reference-edge)"
        : "var(--graph-reference-edge-dim)"
      : "var(--graph-reference-edge)"
    : hasSelection
      ? isConnected
        ? "var(--graph-edge)"
        : "var(--graph-edge-dim)"
      : "var(--graph-edge)";

  return {
    isReferenceEdge,
    hasSelection,
    isConnected,
    isSelected,
    isGlowVisible: hasSelection && isConnected,
    stroke,
    strokeWidth: isSelected ? 3.5 : hasSelection ? (isConnected ? 2.7 : 1.7) : 2.1,
    glowStrokeWidth: isSelected ? 11 : hasSelection ? (isConnected ? 9 : 0) : 0,
    glowOpacity: isSelected ? 0.45 : hasSelection ? (isConnected ? 0.36 : 0) : 0,
    opacity: hasSelection ? (isConnected ? 1 : 0.56) : 0.92,
    strokeDasharray: isReferenceEdge ? "6 4" : undefined,
    markerId: isReferenceEdge ? null : (isConnected || !hasSelection) ? "graph-canvas-arrow" : "graph-canvas-arrow-dim",
  };
}

export function buildGraphCanvasFlowEdges(
  graphCanvasData: GraphCanvasResponse | null,
  selectedCanvasNodeId: string,
): Edge<GraphCanvasFlowEdgeData>[] {
  if (graphCanvasData === null) {
    return [];
  }

  return graphCanvasData.edges.map((edge: GraphCanvasEdgePayload) => {
    const visual = graphCanvasEdgeVisualState(edge, selectedCanvasNodeId);
    const isLinkEdge = isEditableGraphCanvasEdge(edge);

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: isLinkEdge ? "contextEdge" : "smoothstep",
      selectable: isLinkEdge,
      animated: false,
      data: isLinkEdge
        ? { context: edge.context ?? "", sourceId: edge.source, targetId: edge.target, kind: edge.kind }
        : undefined,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: visual.stroke,
      },
      style: {
        stroke: visual.stroke,
        strokeWidth: visual.strokeWidth,
        opacity: visual.opacity,
        strokeDasharray: visual.strokeDasharray,
      },
    };
  });
}

export function selectedGraphCanvasNode(
  graphCanvasData: GraphCanvasResponse | null,
  selectedCanvasNodeId: string,
): GraphCanvasNodePayload | null {
  if (graphCanvasData === null || selectedCanvasNodeId === "") {
    return null;
  }
  return graphCanvasData.nodes.find((node) => node.id === selectedCanvasNodeId) ?? null;
}

export function countConnectedGraphCanvasEdges(
  graphCanvasData: GraphCanvasResponse | null,
  selectedCanvasNodeId: string,
): number {
  if (graphCanvasData === null || selectedCanvasNodeId === "") {
    return 0;
  }
  return graphCanvasData.edges.filter(
    (edge) => edge.source === selectedCanvasNodeId || edge.target === selectedCanvasNodeId,
  ).length;
}

export function graphCanvasPositionMap(
  graphCanvasData: GraphCanvasResponse | null,
): Record<string, GraphCanvasPosition> {
  if (graphCanvasData === null) {
    return {};
  }
  return Object.fromEntries(graphCanvasData.nodes.map((node) => [node.id, node.position]));
}

const elk = new ELK();

export async function applyElkHorizontalLayout(
  nodes: GraphCanvasNodePayload[],
  edges: GraphCanvasEdgePayload[],
): Promise<Record<string, GraphCanvasPosition>> {
  if (nodes.length === 0) {
    return {};
  }

  const layout = await elk.layout({
    id: "graph-canvas",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": "96",
      "elk.layered.spacing.nodeNodeBetweenLayers": "180",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    },
    children: nodes.map((node) => {
      const dimensions = graphCanvasNodeDimensions(node.shape);
      return {
        id: node.id,
        width: dimensions.width,
        height: dimensions.height,
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  });

  const positioned = layout.children ?? [];
  return Object.fromEntries(
    positioned
      .filter((node): node is { id: string; x: number; y: number } =>
        typeof node.id === "string" && typeof node.x === "number" && typeof node.y === "number",
      )
      .map((node) => [node.id, { x: Math.round(node.x), y: Math.round(node.y) }]),
  );
}

// NODE_W / NODE_H are the exact rendered dimensions of a canvas node card set in buildGraphCanvasFlowNodes.
export const CANVAS_NODE_W = 288;
export const CANVAS_NODE_H = 130;
// NODE_W used by the force-layout collision radius (slightly wider for padding).
const NODE_W = 290;
const NODE_H = CANVAS_NODE_H;
const COLLIDE_R = Math.sqrt(NODE_W * NODE_W + NODE_H * NODE_H) / 2 + 28;

type PortSpec = { x: number; y: number; position: Position };

function getNodePortsForShape(pos: GraphCanvasPosition, shape?: string): PortSpec[] {
  const dimensions = graphCanvasNodeDimensions(shape);
  return [
    { x: pos.x + dimensions.width / 2, y: pos.y, position: Position.Top },
    { x: pos.x + dimensions.width, y: pos.y + dimensions.height / 2, position: Position.Right },
    { x: pos.x + dimensions.width / 2, y: pos.y + dimensions.height, position: Position.Bottom },
    { x: pos.x, y: pos.y + dimensions.height / 2, position: Position.Left },
  ];
}

/**
 * pickBestEdgePorts returns the source and target port that minimise the
 * straight-line distance between the two nodes, so that edges automatically
 * re-route to the closest pair of connection points as nodes are dragged.
 */
export function pickBestEdgePorts(
  sourceNode: Node<GraphCanvasFlowNodeData>,
  targetNode: Node<GraphCanvasFlowNodeData>,
): { sourceX: number; sourceY: number; sourcePosition: Position; targetX: number; targetY: number; targetPosition: Position } {
  const sourcePorts = getNodePortsForShape(graphCanvasOverlayPosition(sourceNode), sourceNode.data.shape);
  const targetPorts = getNodePortsForShape(graphCanvasOverlayPosition(targetNode), targetNode.data.shape);

  let bestDistSq = Infinity;
  let bestSrc = sourcePorts[2]; // default: bottom
  let bestTgt = targetPorts[0]; // default: top

  for (const s of sourcePorts) {
    for (const t of targetPorts) {
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestSrc = s;
        bestTgt = t;
      }
    }
  }

  return {
    sourceX: bestSrc.x,
    sourceY: bestSrc.y,
    sourcePosition: bestSrc.position,
    targetX: bestTgt.x,
    targetY: bestTgt.y,
    targetPosition: bestTgt.position,
  };
}

/**
 * applyForceLayout runs a simple spring-embedder force simulation to produce
 * a force-directed layout.  Nodes with `positionPersisted === true` are treated
 * as pinned (their position does not change).  Returns a position map keyed by
 * node id.
 */
export function applyForceLayout(
  nodes: GraphCanvasNodePayload[],
  edges: GraphCanvasEdgePayload[],
): Record<string, GraphCanvasPosition> {
  if (nodes.length === 0) return {};

  // Simulation parameters
  const REPEL = 120_000;
  const SPRING_LEN = 420;
  const SPRING_K = 0.05;
  const GRAVITY = 0.015;
  const DAMPING = 0.72;
  const STEPS = 320;
  const CX = 680;
  const CY = 440;

  type SN = { id: string; x: number; y: number; vx: number; vy: number; pinned: boolean };

  const sn: SN[] = nodes.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    vx: (Math.random() - 0.5) * 4,
    vy: (Math.random() - 0.5) * 4,
    pinned: n.positionPersisted,
  }));

  const idx = new Map(sn.map((n, i) => [n.id, i]));

  for (let step = 0; step < STEPS; step++) {
    const alpha = Math.max(0.01, 1 - step / (STEPS * 0.85));

    // Repulsion between every pair of nodes
    for (let i = 0; i < sn.length; i++) {
      for (let j = i + 1; j < sn.length; j++) {
        const a = sn[i], b = sn[j];
        const dx = b.x - a.x || 0.1;
        const dy = b.y - a.y || 0.1;
        const d2 = dx * dx + dy * dy;
        const d = Math.sqrt(d2);
        const f = (REPEL / d2) * alpha;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
        if (!b.pinned) { b.vx += fx; b.vy += fy; }
      }
    }

    // Spring attraction along edges
    for (const e of edges) {
      const si = idx.get(e.source);
      const ti = idx.get(e.target);
      if (si === undefined || ti === undefined) continue;
      const a = sn[si], b = sn[ti];
      const dx = b.x - a.x || 0.1;
      const dy = b.y - a.y || 0.1;
      const d = Math.sqrt(dx * dx + dy * dy);
      const f = ((d - SPRING_LEN) * SPRING_K) * alpha;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      if (!a.pinned) { a.vx += fx; a.vy += fy; }
      if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
    }

    // Weak gravity toward canvas centre
    for (const n of sn) {
      if (n.pinned) continue;
      n.vx += (CX - n.x) * GRAVITY * alpha;
      n.vy += (CY - n.y) * GRAVITY * alpha;
    }

    // Overlap separation (collision)
    for (let i = 0; i < sn.length; i++) {
      for (let j = i + 1; j < sn.length; j++) {
        const a = sn[i], b = sn[j];
        const dx = b.x - a.x || 0.1;
        const dy = b.y - a.y || 0.1;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < COLLIDE_R * 2) {
          const push = (COLLIDE_R * 2 - d) / 2 + 1;
          const px = (dx / d) * push;
          const py = (dy / d) * push;
          if (!a.pinned) { a.x -= px; a.y -= py; }
          if (!b.pinned) { b.x += px; b.y += py; }
        }
      }
    }

    // Integrate
    for (const n of sn) {
      if (n.pinned) continue;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  return Object.fromEntries(sn.map((n) => [n.id, { x: Math.round(n.x), y: Math.round(n.y) }]));
}

export function applyGraphCanvasLayerGuidance(
  position: GraphCanvasPosition,
  layerGuidance: GraphCanvasLayerGuidance | null,
): GraphCanvasPosition {
  if (layerGuidance === null || layerGuidance.guides.length === 0) {
    return position;
  }

  let snappedX = position.x;
  let shortestDistance = Number.POSITIVE_INFINITY;
  for (const guide of layerGuidance.guides) {
    const distance = Math.abs(position.x - guide.x);
    if (distance <= layerGuidance.magneticThresholdPx && distance < shortestDistance) {
      shortestDistance = distance;
      snappedX = guide.x;
    }
  }

  return shortestDistance === Number.POSITIVE_INFINITY ? position : { x: snappedX, y: position.y };
}

export function normalizeGraphCanvasResponse(response: GraphCanvasResponseWire): GraphCanvasResponse {
  return {
    selectedGraph: response.selectedGraph ?? "",
    availableGraphs: response.availableGraphs ?? [],
    layerGuidance: {
      magneticThresholdPx: response.layerGuidance?.magneticThresholdPx ?? 18,
      guides: response.layerGuidance?.guides ?? [],
    },
    nodes: response.nodes ?? [],
    edges: response.edges ?? [],
    viewport: response.viewport ?? null,
  };
}

export function graphCanvasOverlayPosition(node: Node<GraphCanvasFlowNodeData>): GraphCanvasPosition {
  return { x: node.position.x, y: node.position.y };
}
