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

export type EdgeToolbarState = {
  edgeId: string;
  sourceId: string;
  targetId: string;
  x: number;
  y: number;
  context: string;
  relationships: string[];
};

export type GraphCanvasOverlayState = {
  edges: GraphCanvasEdgePayload[];
  graphCanvasNodes: Node<GraphCanvasFlowNodeData>[];
  rfViewport: { x: number; y: number; zoom: number };
  intersectingNodeIds: string[];
  intersectingSourceNodeId: string | null;
  selectedCanvasNodeId: string;
  selectedEdgeId: string;
  hoveredEdgeTooltip: HoveredEdgeTooltip | null;
  edgeToolbar: EdgeToolbarState | null;
  relationshipTagCatalog: string[];
  shiftSelectedNodes: string[];
  connectingTarget: string | null;
  canvasContextMenu: { x: number; y: number } | null;
  /** Context menu opened on a specific canvas node (e.g. via right-click), used to pick node color. */
  nodeContextMenu: { x: number; y: number; nodeId: string } | null;
  connectingFrom: string | null;
  connectingPointerPos: { x: number; y: number } | null;
  connectingStartPos: { x: number; y: number } | null;
};

export type GraphCanvasOverlayActions = {
  clearEdgeClickTimer: () => void;
  selectEdge: (edgeId: string) => void;
  handleGraphCanvasEdgeClick: (edge: {
    edgeId: string;
    sourceId: string;
    targetId: string;
    context: string;
    relationships: string[];
    x: number;
    y: number;
  }) => void;
  handleGraphCanvasEdgeHover: (edgeId: string, context: string, x: number, y: number) => void;
  clearHoveredEdgeTooltip: (edgeId: string) => void;
  handleGraphCanvasEdgeDoubleClick: (sourceId: string, targetId: string, context: string, edgeId: string) => void;
  setEdgeToolbarState: (state: EdgeToolbarState | null) => void;
  persistEdgeToolbar: (state: EdgeToolbarState) => Promise<void>;
  handleDeleteEdge: (sourceId: string, targetId: string) => Promise<void>;
  onNodeClick: (event: MouseEvent<HTMLDivElement>, nodeId: string) => void;
  onNodeDoubleClick: (event: MouseEvent<HTMLDivElement>, nodeId: string) => void;
  onNodePointerDown: (event: PointerEvent<HTMLDivElement>, nodeId: string) => void;
  onHandlePointerDown: (event: PointerEvent<HTMLDivElement>, nodeId: string) => void;
  onNodeDescriptionSave: (nodeId: string, description: string) => void;
  onNodeResizePreview: (nodeId: string, width: number, height: number) => void;
  onNodeResizeCommit: (nodeId: string, width: number, height: number) => void;
  onBringNodeToFront: (nodeId: string) => void;
  onSendNodeToBack: (nodeId: string) => void;
  onMerge: () => void;
  closeCanvasContextMenu: () => void;
  /** Opens the per-node color picker context menu at screen coordinates for the given node. */
  openNodeContextMenu: (x: number, y: number, nodeId: string) => void;
  closeNodeContextMenu: () => void;
  /** Sets or clears the per-node color override; null or empty string clears the override. */
  setNodeColor: (nodeId: string, colorId: string | null) => void;
  createGraphDocument: (type: GraphCreateType) => void;
};

export type GraphCanvasOverlayController = {
  state: GraphCanvasOverlayState;
  actions: GraphCanvasOverlayActions;
};