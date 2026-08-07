import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import {
  CANVAS_NODE_H,
  CANVAS_NODE_W,
  applyEdgeTypeFixTags,
  applyEdgeTypeFixTagsAll,
  buildGraphCanvasFlowEdges,
  buildGraphCanvasFlowNodes,
  edgeTypeFixLabel,
  graphCanvasEdgeViolationSeverity,
  graphCanvasEdgeViolations,
  graphCanvasEdgeVisualState,
  intersectingGraphCanvasNodeIds,
} from "./graphCanvasUtils";
import type { EdgeTypeViolation, GraphCanvasEdgePayload, GraphCanvasFlowNodeData, GraphCanvasResponse } from "../types";

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

describe("graphCanvasEdgeViolationSeverity", () => {
  const edge = { source: "task-a", target: "task-b", relationships: ["depends-on"] };

  it("returns null when there are no violations", () => {
    expect(graphCanvasEdgeViolationSeverity(edge, null)).toBeNull();
    expect(graphCanvasEdgeViolationSeverity(edge, undefined)).toBeNull();
    expect(graphCanvasEdgeViolationSeverity(edge, [])).toBeNull();
  });

  it("matches an error violation by source/target/relationship", () => {
    const violations: EdgeTypeViolation[] = [{
      path: "a.md",
      graph: "demo",
      fromID: "task-a",
      fromType: "task",
      toID: "task-b",
      toType: "note",
      relationship: "depends-on",
      severity: "error",
      message: "tasks cannot depend on notes",
    }];

    expect(graphCanvasEdgeViolationSeverity(edge, violations)).toBe("error");
  });

  it("returns warning severity for warning violations", () => {
    const violations: EdgeTypeViolation[] = [{
      path: "a.md",
      graph: "demo",
      fromID: "task-a",
      fromType: "task",
      toID: "task-b",
      toType: "note",
      relationship: "depends-on",
      severity: "warning",
      message: "depends-on to a note is unusual",
    }];

    expect(graphCanvasEdgeViolationSeverity(edge, violations)).toBe("warning");
  });

  it("prefers error over warning when both match the same edge", () => {
    const bothRelationshipsEdge = { source: "task-a", target: "task-b", relationships: ["depends-on", "maps-to"] };
    const violations: EdgeTypeViolation[] = [
      {
        path: "a.md",
        graph: "demo",
        fromID: "task-a",
        fromType: "task",
        toID: "task-b",
        toType: "note",
        relationship: "maps-to",
        severity: "warning",
        message: "w",
      },
      {
        path: "a.md",
        graph: "demo",
        fromID: "task-a",
        fromType: "task",
        toID: "task-b",
        toType: "note",
        relationship: "depends-on",
        severity: "error",
        message: "e",
      },
    ];

    expect(graphCanvasEdgeViolationSeverity(bothRelationshipsEdge, violations)).toBe("error");
  });

  it("normalizes relationship separators (underscores vs dashes)", () => {
    const violations: EdgeTypeViolation[] = [{
      path: "a.md",
      graph: "demo",
      fromID: "task-a",
      fromType: "task",
      toID: "task-b",
      toType: "note",
      relationship: "depends_on",
      severity: "error",
      message: "e",
    }];

    expect(graphCanvasEdgeViolationSeverity(edge, violations)).toBe("error");
  });

  it("ignores violations that reference other edges", () => {
    const violations: EdgeTypeViolation[] = [{
      path: "a.md",
      graph: "demo",
      fromID: "task-x",
      fromType: "task",
      toID: "task-y",
      toType: "note",
      relationship: "depends-on",
      severity: "error",
      message: "other edge",
    }];

    expect(graphCanvasEdgeViolationSeverity(edge, violations)).toBeNull();
  });
});

describe("graphCanvasEdgeViolations / edgeTypeFixLabel / applyEdgeTypeFixTags", () => {
  const edge = { source: "task-a", target: "task-b", relationships: ["depends-on", "maps-to"] };

  function violation(relationship: string, severity: EdgeTypeViolation["severity"], fixTags?: string[]): EdgeTypeViolation {
    return {
      path: "a.md",
      graph: "demo",
      fromID: "task-a",
      fromType: "task",
      toID: "task-b",
      toType: "note",
      relationship,
      severity,
      message: `${relationship} message`,
      ...(fixTags ? { fixTags } : {}),
    };
  }

  it("returns all matching violations for an edge", () => {
    const violations = [
      violation("depends-on", "warning", ["relates-to"]),
      violation("maps-to", "error", ["relates-to"]),
      violation("depends-on", "warning", ["relates-to"]),
    ];
    const other = { ...violation("depends-on", "warning", ["relates-to"]), fromID: "other" };

    expect(graphCanvasEdgeViolations(edge, violations)).toHaveLength(3);
    expect(graphCanvasEdgeViolations(edge, [other])).toHaveLength(0);
    expect(graphCanvasEdgeViolations(edge, null)).toHaveLength(0);
    expect(graphCanvasEdgeViolations(edge, [])).toHaveLength(0);
  });

  it("normalizes separators when matching relationship tags", () => {
    const violations = [violation("depends_on", "error", ["relates-to"])];
    const result = graphCanvasEdgeViolations(edge, violations);
    expect(result).toHaveLength(1);
    expect(result[0].relationship).toBe("depends_on");
  });

  it("edgeTypeFixLabel joins fix tags and returns empty string for removal", () => {
    expect(edgeTypeFixLabel(violation("depends-on", "warning", ["relates-to"]))).toBe("relates-to");
    expect(edgeTypeFixLabel(violation("maps-to", "warning", ["relates-to", "documents"]))).toBe("relates-to / documents");
    expect(edgeTypeFixLabel(violation("maps-to", "warning"))).toBe("");
  });

  it("applyEdgeTypeFixTags replaces the offending tag with the fix tags", () => {
    const next = applyEdgeTypeFixTags(["depends-on", "blocks"], violation("depends-on", "warning", ["relates-to"]));
    expect(next).toEqual(["blocks", "relates-to"]);
  });

  it("applyEdgeTypeFixTags removes the tag when there are no fix tags", () => {
    const next = applyEdgeTypeFixTags(["depends-on", "blocks"], violation("depends-on", "warning"));
    expect(next).toEqual(["blocks"]);
  });

  it("applyEdgeTypeFixTags is separator-insensitive and dedupes existing fix tags", () => {
    const next = applyEdgeTypeFixTags(["depends_on", "relates-to"], violation("depends-on", "warning", ["relates-to"]));
    expect(next).toEqual(["relates-to"]);
  });

  it("applyEdgeTypeFixTagsAll applies multiple violations to the same edge in order", () => {
    const violations = [
      violation("depends-on", "warning", ["relates-to"]),
      violation("maps-to", "error", ["relates-to"]),
    ];
    const next = applyEdgeTypeFixTagsAll(["depends-on", "maps-to", "blocks"], violations);
    expect(next).toEqual(["blocks", "relates-to"]);
  });

  it("applyEdgeTypeFixTagsAll is a no-op for an empty violation list", () => {
    expect(applyEdgeTypeFixTagsAll(["depends-on"], [])).toEqual(["depends-on"]);
  });

  it("applyEdgeTypeFixTagsAll handles remove-style fixes (no fix tags)", () => {
    const next = applyEdgeTypeFixTagsAll(["depends-on", "maps-to"], [violation("depends-on", "error")]);
    expect(next).toEqual(["maps-to"]);
  });
});

describe("graphCanvasEdgeVisualState / buildGraphCanvasFlowEdges", () => {
  const edge: GraphCanvasEdgePayload = {
    id: "edge-1",
    source: "task-a",
    target: "task-b",
    kind: "link",
    relationships: ["depends-on"],
  };

  function violation(severity: EdgeTypeViolation["severity"]): EdgeTypeViolation {
    return {
      path: "a.md",
      graph: "demo",
      fromID: "task-a",
      fromType: "task",
      toID: "task-b",
      toType: "note",
      relationship: "depends-on",
      severity,
      message: severity === "error" ? "bad edge" : "odd edge",
    };
  }

  it("renders error violations with destructive stroke and dashed pattern", () => {
    const visual = graphCanvasEdgeVisualState(edge, "", "", "error");
    expect(visual.stroke).toBe("var(--destructive)");
    expect(visual.strokeDasharray).toBe("8 4");
    expect(visual.markerId).toBe("graph-canvas-arrow-error");

    const built = buildGraphCanvasFlowEdges(
      { selectedGraph: "demo", availableGraphs: [], layerGuidance: { magneticThresholdPx: 18, guides: [] }, nodes: [], edges: [edge], viewport: null },
      "",
      [violation("error")],
    );
    expect(built[0].style?.stroke).toBe("var(--destructive)");
    expect(built[0].style?.strokeDasharray).toBe("8 4");
  });

  it("renders warning violations with warn stroke and dashed pattern", () => {
    const visual = graphCanvasEdgeVisualState(edge, "", "", "warning");
    expect(visual.stroke).toBe("var(--warn)");
    expect(visual.strokeDasharray).toBe("8 4");
    expect(visual.markerId).toBe("graph-canvas-arrow-warn");
  });

  it("keeps normal styling when no violation matches", () => {
    const built = buildGraphCanvasFlowEdges(
      { selectedGraph: "demo", availableGraphs: [], layerGuidance: { magneticThresholdPx: 18, guides: [] }, nodes: [], edges: [edge], viewport: null },
      "",
      [],
    );
    expect(built[0].style?.stroke).toBe("var(--graph-edge)");
    expect(built[0].style?.strokeDasharray).toBeUndefined();
    expect(built[0].markerEnd).toEqual({
      type: "arrowclosed",
      width: 18,
      height: 18,
      color: "var(--graph-edge)",
    });
  });

  it("computes violation severity from the violations list in buildGraphCanvasFlowEdges", () => {
    const built = buildGraphCanvasFlowEdges(
      { selectedGraph: "demo", availableGraphs: [], layerGuidance: { magneticThresholdPx: 18, guides: [] }, nodes: [], edges: [edge], viewport: null },
      "",
      [violation("error")],
    );
    expect(built[0].style?.stroke).toBe("var(--destructive)");
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
