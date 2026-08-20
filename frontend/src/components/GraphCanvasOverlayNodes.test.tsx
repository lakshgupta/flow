import type { Node } from "@xyflow/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GraphCanvasOverlayNodes } from "./GraphCanvasOverlayNodes";
import type {
  GraphCanvasOverlayActions,
  GraphCanvasOverlayController,
} from "./graphCanvasOverlayController";
import type { GraphCanvasFlowNodeData } from "../types";

function makeNode(id: string, type: string, overrides?: Partial<GraphCanvasFlowNodeData>): Node<GraphCanvasFlowNodeData> {
  return {
    id,
    position: { x: 0, y: 0 },
    width: 288,
    height: 130,
    data: {
      label: null,
      id,
      type,
      shape: "card",
      title: id,
      description: "",
      graph: "demo",
      featureSlug: "demo",
      fileName: `${id}.md`,
      positionPersisted: false,
      isCanvasSelected: false,
      isPanelDocument: false,
      ...overrides,
    },
  } as Node<GraphCanvasFlowNodeData>;
}

function makeController(node: Node<GraphCanvasFlowNodeData>, onStatusChange: ReturnType<typeof vi.fn>): GraphCanvasOverlayController {
  const noop = vi.fn();
  const actions: GraphCanvasOverlayActions = {
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
    onNodeStatusChange: onStatusChange,
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
  return {
    state: {
      edges: [],
      edgeViolations: [],
      graphCanvasNodes: [node],
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
    actions,
  };
}

describe("GraphCanvasOverlayNodes task status dropdown", () => {
  it("renders a status select on task nodes with the current status selected", () => {
    const controller = makeController(
      makeNode("task-a", "task", { status: "Running" }),
      vi.fn(),
    );
    render(<GraphCanvasOverlayNodes controller={controller} graphCanvasShellRef={{ current: null }} />);

    const select = screen.getByLabelText("Status for task-a");
    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect((select as HTMLSelectElement).value).toBe("Running");
  });

  it("does not render a status select on non-task nodes", () => {
    const controller = makeController(makeNode("note-a", "note"), vi.fn());
    render(<GraphCanvasOverlayNodes controller={controller} graphCanvasShellRef={{ current: null }} />);

    expect(screen.queryByLabelText("Status for note-a")).toBeNull();
  });

  it("fires onNodeStatusChange when a new status is picked", () => {
    const onStatusChange = vi.fn();
    const controller = makeController(makeNode("task-a", "task", { status: "Ready" }), onStatusChange);
    render(<GraphCanvasOverlayNodes controller={controller} graphCanvasShellRef={{ current: null }} />);

    const select = screen.getByLabelText("Status for task-a");
    fireEvent.change(select, { target: { value: "Done" } });
    expect(onStatusChange).toHaveBeenCalledWith("task-a", "Done");
  });

  it("lets the user clear the status back to none", () => {
    const onStatusChange = vi.fn();
    const controller = makeController(makeNode("task-a", "task", { status: "Done" }), onStatusChange);
    render(<GraphCanvasOverlayNodes controller={controller} graphCanvasShellRef={{ current: null }} />);

    const select = screen.getByLabelText("Status for task-a");
    fireEvent.change(select, { target: { value: "" } });
    expect(onStatusChange).toHaveBeenCalledWith("task-a", "");
  });
});
