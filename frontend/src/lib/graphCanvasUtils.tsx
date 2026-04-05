import { MarkerType } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";

import { fileNameFromPath } from "./docUtils";
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

export function graphCanvasTypeLabel(value: string): string {
  return value === "command" ? "Cmd" : value.charAt(0).toUpperCase() + value.slice(1);
}

export function graphCanvasTypeClassName(value: string): string {
  if (value === "task" || value === "command") {
    return value;
  }
  return "note";
}

export function renderGraphCanvasNodeLabel(data: GraphCanvasFlowNodeInput): React.ReactNode {
  return (
    <article
      className={[
        "graph-canvas-node",
        `graph-canvas-node-${graphCanvasTypeClassName(data.type)}`,
        data.isCanvasSelected ? "graph-canvas-node-selected" : "",
        data.isPanelDocument ? "graph-canvas-node-panel" : "",
      ]
        .filter((value) => value !== "")
        .join(" ")}
    >
      <div className="graph-canvas-node-topline">
        <span className="graph-canvas-node-badge">{graphCanvasTypeLabel(data.type)}</span>
        <span className="graph-canvas-node-file">{data.fileName}</span>
      </div>
      <strong className="graph-canvas-node-title">{data.title}</strong>
      <div className="graph-canvas-node-meta-row">
        <span>{data.graph}</span>
        <span>{data.positionPersisted ? "Saved" : "Seeded"}</span>
      </div>
      {data.description !== "" ? <p className="graph-canvas-node-description">{data.description}</p> : null}
    </article>
  );
}

export function buildGraphCanvasFlowNodes(
  graphCanvasData: GraphCanvasResponse | null,
  graphCanvasPositions: Record<string, GraphCanvasPosition>,
  selectedCanvasNodeId: string,
  selectedDocumentId: string,
): Node<GraphCanvasFlowNodeData>[] {
  if (graphCanvasData === null) {
    return [];
  }

  return graphCanvasData.nodes.map((item) => ({
    id: item.id,
    position: graphCanvasPositions[item.id] ?? item.position,
    data: {
      label: renderGraphCanvasNodeLabel({
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        graph: item.graph,
        featureSlug: item.featureSlug,
        fileName: fileNameFromPath(item.path),
        positionPersisted: item.positionPersisted,
        isCanvasSelected: item.id === selectedCanvasNodeId,
        isPanelDocument: item.id === selectedDocumentId,
      }),
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description,
      graph: item.graph,
      featureSlug: item.featureSlug,
      fileName: fileNameFromPath(item.path),
      positionPersisted: item.positionPersisted,
      isCanvasSelected: item.id === selectedCanvasNodeId,
      isPanelDocument: item.id === selectedDocumentId,
    },
    className: "graph-canvas-ghost-node",
    style: {
      width: "18rem",
      padding: 0,
      border: "none",
      borderRadius: 0,
      background: "transparent",
      boxShadow: "none",
      opacity: 0,
      pointerEvents: "none",
    },
    draggable: true,
    connectable: false,
    selectable: true,
  }));
}

export function buildGraphCanvasFlowEdges(
  graphCanvasData: GraphCanvasResponse | null,
  selectedCanvasNodeId: string,
): Edge[] {
  if (graphCanvasData === null) {
    return [];
  }

  const hasSelection = selectedCanvasNodeId !== "";
  return graphCanvasData.edges.map((edge: GraphCanvasEdgePayload) => {
    const isConnected =
      selectedCanvasNodeId !== "" &&
      (edge.source === selectedCanvasNodeId || edge.target === selectedCanvasNodeId);
    const isReference = edge.kind === "reference";

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      selectable: false,
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: hasSelection
          ? isConnected
            ? "#a7392b"
            : "rgba(82, 101, 97, 0.32)"
          : isReference
            ? "#7d5a3d"
            : "#244b47",
      },
      style: {
        stroke: hasSelection
          ? isConnected
            ? "#a7392b"
            : "rgba(82, 101, 97, 0.32)"
          : isReference
            ? "#7d5a3d"
            : "#244b47",
        strokeWidth: hasSelection ? (isConnected ? 2.6 : 1.25) : isReference ? 1.8 : 2.1,
        strokeDasharray: isReference ? "7 6" : undefined,
        opacity: hasSelection ? (isConnected ? 1 : 0.22) : 0.72,
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
  };
}

export function graphCanvasOverlayPosition(node: Node<GraphCanvasFlowNodeData>): GraphCanvasPosition {
  return { x: node.position.x, y: node.position.y };
}
