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
  const graphCanvasData: GraphCanvasResponse = {
    selectedGraph: "project/feature/auth/login",
    availableGraphs: ["project", "project/feature", "project/feature/auth", "project/feature/auth/login"],
    layerGuidance: {
      magneticThresholdPx: 24,
      guides: [],
    },
    nodes: [
      {
        id: "note-1",
        type: "note",
        graph: "project/feature/auth/login",
        title: "Deeply nested note",
        description: "",
        path: "project/feature/auth/login/note-1.md",
        featureSlug: "login",
        position: { x: 120, y: 140 },
        positionPersisted: true,
      },
    ],
    edges: [],
    viewport: null,
  };

  it("uses the node's own graph directory color when set", () => {
    const nodes = buildGraphCanvasFlowNodes(
      graphCanvasData,
      {},
      "",
      "",
      {
        project: "rose",
        "project/feature": "amber",
        "project/feature/auth": "lemon",
        "project/feature/auth/login": "mint",
      },
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.graphColor).toBe("mint");
  });

  it("falls back to the closest colored parent directory when the leaf has no color", () => {
    const nodes = buildGraphCanvasFlowNodes(
      graphCanvasData,
      {},
      "",
      "",
      {
        project: "rose",
        "project/feature": "amber",
        "project/feature/auth": "lemon",
      },
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.graphColor).toBe("lemon");
  });

  it("skips uncolored intermediate directories and finds the closest colored ancestor", () => {
    const nodes = buildGraphCanvasFlowNodes(
      graphCanvasData,
      {},
      "",
      "",
      {
        project: "rose",
        "project/feature": "amber",
      },
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.graphColor).toBe("amber");
  });
});
