import type { Node } from "@xyflow/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GraphCanvasOverlayEdges } from "./GraphCanvasOverlayEdges";
import type {
  GraphCanvasOverlayActions,
  GraphCanvasOverlayController,
} from "./graphCanvasOverlayController";
import type {
  EdgeTypeViolation,
  GraphCanvasEdgePayload,
  GraphCanvasFlowNodeData,
} from "../types";

function makeNode(id: string, x: number, y: number): Node<GraphCanvasFlowNodeData> {
  return {
    id,
    position: { x, y },
    width: 288,
    height: 130,
    data: {
      label: null,
      id,
      type: "task",
      shape: "card",
      title: id,
      description: "",
      graph: "demo",
      featureSlug: "demo",
      fileName: `${id}.md`,
      positionPersisted: false,
      isCanvasSelected: false,
      isPanelDocument: false,
    },
  } as Node<GraphCanvasFlowNodeData>;
}

function makeActions(): GraphCanvasOverlayActions {
  const noop = vi.fn();
  return {
    clearEdgeClickTimer: noop,
    selectEdge: noop,
    handleGraphCanvasEdgeClick: noop,
    handleGraphCanvasEdgeHover: noop,
    clearHoveredEdgeTooltip: noop,
    handleGraphCanvasEdgeDoubleClick: noop,
    setEdgeToolbarState: noop,
    persistEdgeToolbar: vi.fn().mockResolvedValue(undefined),
    quickFixEdge: vi.fn().mockResolvedValue(undefined),
    fixAllEdgeViolations: vi.fn().mockResolvedValue(undefined),
    handleDeleteEdge: noop,
    onNodeClick: noop,
    onNodeDoubleClick: noop,
    onNodePointerDown: noop,
    onHandlePointerDown: noop,
    onNodeDescriptionSave: noop,
    onNodeResizePreview: noop,
    onNodeResizeCommit: noop,
    onBringNodeToFront: noop,
    onSendNodeToBack: noop,
    onMerge: noop,
    closeCanvasContextMenu: noop,
    openNodeContextMenu: noop,
    closeNodeContextMenu: noop,
    setNodeColor: noop,
    deleteNode: noop,
    createGraphDocument: noop,
  };
}

const baseEdge: GraphCanvasEdgePayload = {
  id: "link:task-a:note-a",
  source: "task-a",
  target: "note-a",
  kind: "link",
  context: "",
  relationships: ["depends-on"],
};

const warningViolation: EdgeTypeViolation = {
  path: "data/content/demo/task-a.md",
  graph: "demo",
  fromID: "task-a",
  fromType: "task",
  toID: "note-a",
  toType: "note",
  relationship: "depends-on",
  severity: "warning",
  message: "depends-on targets a note; use relates-to for contextual notes",
  fixTags: ["relates-to"],
};

function makeController(overrides?: {
  edges?: GraphCanvasEdgePayload[];
  violations?: EdgeTypeViolation[];
  quickFixEdge?: GraphCanvasOverlayActions["quickFixEdge"];
}): GraphCanvasOverlayController {
  const actions = makeActions();
  return {
    state: {
      edges: overrides?.edges ?? [baseEdge],
      edgeViolations: overrides?.violations ?? [warningViolation],
      graphCanvasNodes: [makeNode("task-a", 0, 0), makeNode("note-a", 400, 0)],
      rfViewport: { x: 0, y: 0, zoom: 1 },
      intersectingNodeIds: [],
      intersectingSourceNodeId: null,
      selectedCanvasNodeId: "",
      selectedEdgeId: "",
      hoveredEdgeTooltip: null,
      edgeToolbar: null,
      relationshipTagCatalog: [],
      shiftSelectedNodes: [],
      connectingTarget: null,
      canvasContextMenu: null,
      nodeContextMenu: null,
      connectingFrom: null,
      connectingPointerPos: null,
      connectingStartPos: null,
    },
    actions: overrides?.quickFixEdge
      ? { ...actions, quickFixEdge: overrides.quickFixEdge }
      : actions,
  };
}

describe("GraphCanvasOverlayEdges quick-fix pill", () => {
  it("renders a fix pill for a violating edge with the suggested tag", () => {
    const controller = makeController();
    render(<GraphCanvasOverlayEdges controller={controller} />);

    const pill = screen.getByRole("button", { name: /quick fix: depends-on targets a note/i });
    expect(pill).toHaveTextContent("→ relates-to");
    expect(pill.className).toContain("graph-canvas-quickfix-warn");
  });

  it("renders the error variant for error violations", () => {
    const controller = makeController({
      violations: [{ ...warningViolation, severity: "error", message: "bad edge" }],
    });
    render(<GraphCanvasOverlayEdges controller={controller} />);

    const pill = screen.getByRole("button", { name: /quick fix: bad edge/i });
    expect(pill.className).toContain("graph-canvas-quickfix-error");
  });

  it("applies the fix with the offending tag replaced when clicked", () => {
    const quickFixEdge = vi.fn().mockResolvedValue(undefined);
    const controller = makeController({ quickFixEdge });
    render(<GraphCanvasOverlayEdges controller={controller} />);

    fireEvent.click(screen.getByRole("button", { name: /quick fix/i }));

    expect(quickFixEdge).toHaveBeenCalledTimes(1);
    expect(quickFixEdge).toHaveBeenCalledWith(
      {
        sourceId: "task-a",
        targetId: "note-a",
        context: "",
        relationships: ["depends-on"],
      },
      warningViolation,
    );
  });

  it("renders no pill when the edge has no violations", () => {
    const controller = makeController({ violations: [] });
    render(<GraphCanvasOverlayEdges controller={controller} />);

    expect(screen.queryByRole("button", { name: /quick fix/i })).toBeNull();
  });

  it("renders no pill for reference edges", () => {
    const referenceEdge: GraphCanvasEdgePayload = {
      id: "ref:task-a:note-a",
      source: "task-a",
      target: "note-a",
      kind: "reference",
    };
    const controller = makeController({ edges: [referenceEdge] });
    render(<GraphCanvasOverlayEdges controller={controller} />);

    expect(screen.queryByRole("button", { name: /quick fix/i })).toBeNull();
  });
});
