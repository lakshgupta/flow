import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { CANVAS_NODE_H, CANVAS_NODE_W, buildGraphCanvasFlowNodes, intersectingGraphCanvasNodeIds } from "./graphCanvasUtils";
import type { GraphCanvasFlowNodeData, GraphCanvasResponse } from "../types";

function makeNode(id: string, x: number, y: number): Node<GraphCanvasFlowNodeData> {
  return {
    id,
    position: { x, y },
    width: CANVAS_NODE_W,
    height: CANVAS_NODE_H,
    data: {
      label: null,
      id,
      type: "note",
      shape: "card",
      title: id,
      description: "",
      graph: "execution",
      featureSlug: "execution",
      fileName: `${id}.md`,
      positionPersisted: false,
      isCanvasSelected: false,
      isPanelDocument: false,
    },
  } as Node<GraphCanvasFlowNodeData>;
}

describe("intersectingGraphCanvasNodeIds", () => {
  it("returns intersecting node ids for the dragged node position", () => {
    const nodes = [
      makeNode("note-1", 140, 120),
      makeNode("note-2", 480, 220),
      makeNode("note-3", 900, 220),
    ];

    expect(intersectingGraphCanvasNodeIds(nodes, "note-1", { x: 490, y: 230 })).toEqual(["note-2"]);
  });

  it("ignores the dragged node itself and non-overlapping nodes", () => {
    const nodes = [
      makeNode("note-1", 140, 120),
      makeNode("note-2", 480, 220),
    ];

    expect(intersectingGraphCanvasNodeIds(nodes, "note-1", { x: 140, y: 120 })).toEqual([]);
    expect(intersectingGraphCanvasNodeIds(nodes, "missing", { x: 490, y: 230 })).toEqual([]);
  });
});

describe("buildGraphCanvasFlowNodes", () => {
  it("uses the closest parent graph directory color for nested graph nodes", () => {
    const graphCanvasData: GraphCanvasResponse = {
      selectedGraph: "graph1/graph11",
      availableGraphs: ["graph1", "graph1/graph11"],
      layerGuidance: {
        magneticThresholdPx: 24,
        guides: [],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "graph1/graph11",
          title: "Nested note",
          description: "",
          path: "graph1/graph11/note-1.md",
          featureSlug: "graph11",
          position: { x: 120, y: 140 },
          positionPersisted: true,
        },
      ],
      edges: [],
      viewport: null,
    };

    const nodes = buildGraphCanvasFlowNodes(
      graphCanvasData,
      {},
      "",
      "",
      {
        graph1: "rose",
        "graph1/graph11": "lemon",
      },
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.graphColor).toBe("rose");
  });
});
