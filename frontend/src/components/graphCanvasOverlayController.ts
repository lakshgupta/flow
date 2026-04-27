import type { Node } from "@xyflow/react";
import type { MouseEvent, PointerEvent } from "react";

import type {
  GraphCanvasEdgePayload,
  GraphCanvasFlowNodeData,
  GraphCreateType,
} from "../types";

export type HoveredEdgeTooltip = {
  edgeId: string;
  context: string;
  x: number;
  y: number;
};

export type GraphCanvasOverlayState = {
  edges: GraphCanvasEdgePayload[];
  graphCanvasNodes: Node<GraphCanvasFlowNodeData>[];
  rfViewport: { x: number; y: number; zoom: number };
  selectedCanvasNodeId: string;
  selectedEdgeId: string;
  hoveredEdgeTooltip: HoveredEdgeTooltip | null;
  shiftSelectedNodes: string[];
  connectingTarget: string | null;
  canvasContextMenu: { x: number; y: number } | null;
  connectingFrom: string | null;
  connectingPointerPos: { x: number; y: number } | null;
  connectingStartPos: { x: number; y: number } | null;
};

export type GraphCanvasOverlayActions = {
  clearEdgeClickTimer: () => void;
  selectEdge: (edgeId: string) => void;
  handleGraphCanvasEdgeClick: (edgeId: string, sourceId: string) => void;
  handleGraphCanvasEdgeHover: (edgeId: string, context: string, x: number, y: number) => void;
  clearHoveredEdgeTooltip: (edgeId: string) => void;
  handleGraphCanvasEdgeDoubleClick: (sourceId: string, targetId: string, context: string, edgeId: string) => void;
  handleDeleteEdge: (sourceId: string, targetId: string) => Promise<void>;
  onNodeClick: (event: MouseEvent<HTMLDivElement>, nodeId: string) => void;
  onNodeDoubleClick: (event: MouseEvent<HTMLDivElement>, nodeId: string) => void;
  onNodePointerDown: (event: PointerEvent<HTMLDivElement>, nodeId: string) => void;
  onHandlePointerDown: (event: PointerEvent<HTMLDivElement>, nodeId: string) => void;
  onMerge: () => void;
  closeCanvasContextMenu: () => void;
  createGraphDocument: (type: GraphCreateType) => void;
};

export type GraphCanvasOverlayController = {
  state: GraphCanvasOverlayState;
  actions: GraphCanvasOverlayActions;
};