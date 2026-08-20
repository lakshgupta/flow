import type { Node } from "@xyflow/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GraphCanvasOverlayInteraction } from "./GraphCanvasOverlayInteraction";
import type {
  GraphCanvasOverlayActions,
  GraphCanvasOverlayController,
} from "./graphCanvasOverlayController";
import type { EdgeTypeViolation, GraphCanvasFlowNodeData } from "../types";

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
    onNodeStatusChange: noop,
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

function makeViolation(id: string): EdgeTypeViolation {
  return {
    path: `data/content/demo/${id}.md`,
    graph: "demo",
    fromID: "task-a",
    fromType: "task",
    toID: "note-a",
    toType: "note",
    relationship: "depends-on",
    severity: "warning",
    message: `${id} violation`,
    fixTags: ["relates-to"],
  };
}

function makeController(overrides?: {
  canvasContextMenu?: { x: number; y: number } | null;
  violations?: EdgeTypeViolation[];
  fixAllEdgeViolations?: GraphCanvasOverlayActions["fixAllEdgeViolations"];
}): GraphCanvasOverlayController {
  const actions = makeActions();
  return {
    state: {
      edges: [],
      edgeViolations: overrides?.violations ?? [makeViolation("one")],
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
      canvasContextMenu: overrides?.canvasContextMenu !== undefined ? overrides.canvasContextMenu : { x: 10, y: 20 },
      nodeContextMenu: null,
      connectingFrom: null,
      connectingPointerPos: null,
      connectingStartPos: null,
    },
    actions: overrides?.fixAllEdgeViolations
      ? { ...actions, fixAllEdgeViolations: overrides.fixAllEdgeViolations }
      : actions,
  };
}

describe("GraphCanvasOverlayInteraction fix-all context menu entry", () => {
  it("renders the Fix all violations entry with the violation count", () => {
    const controller = makeController({ violations: [makeViolation("one"), makeViolation("two")] });
    render(<GraphCanvasOverlayInteraction controller={controller} />);

    expect(screen.getByRole("button", { name: "Fix all violations (2)" })).toBeInTheDocument();
  });

  it("applies all fixes and closes the menu when clicked", () => {
    const closeCanvasContextMenu = vi.fn();
    const fixAllEdgeViolations = vi.fn().mockResolvedValue(undefined);
    const controller = makeController({ fixAllEdgeViolations });
    controller.actions.closeCanvasContextMenu = closeCanvasContextMenu;
    render(<GraphCanvasOverlayInteraction controller={controller} />);

    fireEvent.click(screen.getByRole("button", { name: "Fix all violations (1)" }));

    expect(fixAllEdgeViolations).toHaveBeenCalledTimes(1);
    expect(closeCanvasContextMenu).toHaveBeenCalledTimes(1);
  });

  it("hides the entry when there are no violations", () => {
    const controller = makeController({ violations: [] });
    render(<GraphCanvasOverlayInteraction controller={controller} />);

    expect(screen.queryByRole("button", { name: /fix all violations/i })).toBeNull();
  });

  it("renders nothing when the canvas context menu is closed", () => {
    const controller = makeController({ canvasContextMenu: null });
    render(<GraphCanvasOverlayInteraction controller={controller} />);

    expect(screen.queryByRole("button", { name: /fix all violations/i })).toBeNull();
  });
});
