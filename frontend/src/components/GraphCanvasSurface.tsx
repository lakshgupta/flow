import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import { ChevronLeft, ChevronRight, PaintbrushVertical, Play, Printer, Rows3, Search } from "lucide-react";
import { printNodesAsPdf } from "../lib/exportPdf";
import { memo, useEffect, type DragEvent as ReactDragEvent, type RefObject } from "react";

import { GraphCanvasOverlayEdges } from "./GraphCanvasOverlayEdges";
import { GraphCanvasOverlayInteraction } from "./GraphCanvasOverlayInteraction";
import { GraphCanvasOverlayNodes } from "./GraphCanvasOverlayNodes";
import type { GraphCanvasOverlayController } from "./graphCanvasOverlayController";
import { Input } from "./ui/input";

import { CANVAS_MAX_ZOOM, CANVAS_MIN_ZOOM } from "../lib/canvasZoom";
import { EdgeEditContext, type GraphCanvasFlowEdgeData } from "../lib/graphCanvasUtils";
import type { GraphCanvasFlowNodeData, GraphCanvasPosition, GraphCanvasResponse } from "../types";

export type GraphCanvasSurfaceActions = {
  setDragActive: (active: boolean) => void;
  handleFilesDrop: (files: FileList | File[]) => void;
  handleFilesDropFromURIs: (dataTransfer: DataTransfer, graphPath: string) => void;
  updateSearchTerm: (value: string) => void;
  searchNext: () => void;
  searchPrevious: () => void;
  toggleLayout: () => void;
  setFlowInstance: (instance: ReactFlowInstance<Node<GraphCanvasFlowNodeData>, Edge<GraphCanvasFlowEdgeData>>) => void;
  handleNodesChange: (changes: NodeChange<Node<GraphCanvasFlowNodeData>>[]) => void;
  handleNodeClick: (nodeId: string) => void;
  handleNodeDoubleClick: (nodeId: string) => void;
  handleNodeDrag: (nodeId: string, position: GraphCanvasPosition) => void;
  handleNodeDragStop: (nodeId: string, position: GraphCanvasPosition) => void;
  openCanvasContextMenu: (x: number, y: number) => void;
  clearCanvasSelection: () => void;
  persistViewport: () => void;
  deleteEdgeFromId: (edgeId: string) => void;
  zoomCanvasByWheel: (deltaY: number, deltaMode: number, clientX: number, clientY: number) => void;
};

export type GraphCanvasSurfaceProps = {
  graphCanvasShellRef: RefObject<HTMLDivElement | null>;
  selectedGraphPath: string;
  graphCanvasDragActive: boolean;
  connectingFrom: string | null;
  graphCanvasData: GraphCanvasResponse;
  graphCanvasNodes: Node<GraphCanvasFlowNodeData>[];
  graphCanvasEdges: Edge<GraphCanvasFlowEdgeData>[];
  edgeTypes: EdgeTypes;
  graphCanvasNodeSearchTerm: string;
  graphCanvasNodeSearchHasMatches: boolean;
  graphCanvasNodeSearchSelectedIndex: number;
  graphCanvasNodeSearchMatchCount: number;
  normalizedGraphCanvasNodeSearchTerm: string;
  graphCanvasResettingLayout: boolean;
  graphCanvasLayoutMode: "user" | "horizontal";
  overlayController: GraphCanvasOverlayController;
  edgeDoubleClickAction: (sourceId: string, targetId: string, context: string) => void;
  actions: GraphCanvasSurfaceActions;
  /** Enters presentation mode; rendered as a toolbar button when provided. */
  presentationEnter?: () => void;
  shiftSelectedNodes: string[];
};

function setDragState(event: ReactDragEvent<HTMLElement>, selectedGraphPath: string, setDragActive: (active: boolean) => void): void {
  event.preventDefault();
  if (selectedGraphPath !== "") {
    setDragActive(true);
  }
}

function GraphCanvasSurfaceComponent({
  graphCanvasShellRef,
  selectedGraphPath,
  graphCanvasDragActive,
  connectingFrom,
  graphCanvasData,
  graphCanvasNodes,
  graphCanvasEdges,
  edgeTypes,
  graphCanvasNodeSearchTerm,
  graphCanvasNodeSearchHasMatches,
  graphCanvasNodeSearchSelectedIndex,
  graphCanvasNodeSearchMatchCount,
  normalizedGraphCanvasNodeSearchTerm,
  graphCanvasResettingLayout,
  graphCanvasLayoutMode,
  overlayController,
  edgeDoubleClickAction,
  actions,
  presentationEnter,
  shiftSelectedNodes,
}: GraphCanvasSurfaceProps) {
  // Trackpad pinch / Ctrl+wheel over the canvas must zoom the canvas only —
  // never the whole app. React Flow's own wheel handler only covers its pane,
  // but graph nodes are rendered in the overlay above it, so gestures over a
  // node would otherwise fall through to the webview's page zoom. Capture the
  // event at the shell (before React Flow) to always preventDefault the page
  // zoom, and zoom the canvas manually when the event is over the overlay.
  useEffect(() => {
    const shell = graphCanvasShellRef.current;
    if (!shell) {
      return;
    }

    const handleShellWheelCapture = (event: WheelEvent) => {
      // Only page-zoom gestures (touchpad pinch arrives as Ctrl+wheel).
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      const target = event.target instanceof Node ? event.target : null;
      if (target === null || !shell.contains(target)) {
        return;
      }
      // Stop the browser/webview from zooming the whole page. React Flow's
      // own handler still runs (preventDefault does not stop propagation)
      // and zooms the canvas for gestures over its pane.
      event.preventDefault();
      // If the gesture is over the React Flow pane, React Flow handles the
      // zoom. Over the overlay (nodes), zoom the canvas manually.
      const flowPane = shell.querySelector(".react-flow__pane");
      if (flowPane !== null && flowPane.contains(target)) {
        return;
      }
      actions.zoomCanvasByWheel(event.deltaY, event.deltaMode, event.clientX, event.clientY);
    };

    shell.addEventListener("wheel", handleShellWheelCapture, { capture: true, passive: false });
    return () => {
      shell.removeEventListener("wheel", handleShellWheelCapture, { capture: true });
    };
  }, [actions, graphCanvasShellRef]);

  return (
    <div
      ref={graphCanvasShellRef}
      className={`graph-canvas-shell${connectingFrom !== null ? " canvas-connecting-mode" : ""}${graphCanvasDragActive ? " graph-canvas-shell-dragover" : ""}`}
      onDragEnter={(event) => setDragState(event, selectedGraphPath, actions.setDragActive)}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        if (selectedGraphPath !== "") {
          actions.setDragActive(true);
        }
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        const related = event.relatedTarget;
        if (related instanceof HTMLElement && event.currentTarget.contains(related)) {
          return;
        }
        actions.setDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        actions.setDragActive(false);
        if (selectedGraphPath === "") {
          return;
        }
        // In Wails desktop mode, always use the URI-based path because the
        // HTTP multipart upload does not work through the Wails asset server.
        // This handles both images and PDFs on all platforms.
        actions.handleFilesDropFromURIs(event.dataTransfer, selectedGraphPath);
      }}
    >
      <div className="graph-canvas-toolbar">
        <div className="graph-canvas-node-search" role="search" aria-label="Graph canvas node search">
          <Search size={14} aria-hidden="true" />
          <Input
            type="search"
            value={graphCanvasNodeSearchTerm}
            onChange={(event) => actions.updateSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                actions.searchNext();
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                actions.searchPrevious();
                return;
              }

              if (event.key === "Enter") {
                event.preventDefault();
                if (event.shiftKey) {
                  actions.searchPrevious();
                  return;
                }
                actions.searchNext();
              }
            }}
            placeholder="Search nodes by title"
            aria-label="Search graph nodes"
            className="graph-canvas-node-search-input"
          />
          <span className="graph-canvas-node-search-count" aria-live="polite">
            {graphCanvasNodeSearchHasMatches
              ? `${Math.max(graphCanvasNodeSearchSelectedIndex + 1, 0)}/${graphCanvasNodeSearchMatchCount}`
              : normalizedGraphCanvasNodeSearchTerm === "" ? "" : "0"}
          </span>
          <button
            type="button"
            className="graph-canvas-node-search-nav"
            aria-label="Previous matching node"
            onClick={actions.searchPrevious}
            disabled={!graphCanvasNodeSearchHasMatches}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="graph-canvas-node-search-nav"
            aria-label="Next matching node"
            onClick={actions.searchNext}
            disabled={!graphCanvasNodeSearchHasMatches}
          >
            <ChevronRight size={14} />
          </button>
        </div>
        {presentationEnter !== undefined && (
          <button
            className="graph-canvas-layout-reset"
            type="button"
            onClick={presentationEnter}
            aria-label="Enter presentation mode"
            title="Enter presentation mode (p)"
          >
            <Play size={14} />
          </button>
        )}
        {shiftSelectedNodes.length > 0 && (
          <button
            className="graph-canvas-layout-reset"
            type="button"
            onClick={() => {
              void printNodesAsPdf(shiftSelectedNodes);
            }}
            aria-label={
              shiftSelectedNodes.length === 1
                ? "Export selected node as PDF"
                : `Export ${shiftSelectedNodes.length} selected nodes as PDF`
            }
            title={
              shiftSelectedNodes.length === 1
                ? "Export selected node as PDF"
                : `Export ${shiftSelectedNodes.length} selected nodes as PDF`
            }
          >
            <Printer size={14} />
          </button>
        )}
        <button
          className="graph-canvas-layout-reset"
          type="button"
          onClick={actions.toggleLayout}
          disabled={graphCanvasResettingLayout}
          aria-label={graphCanvasLayoutMode === "horizontal" ? "Switch to user-adjusted layout" : "Switch to horizontal layout"}
          aria-pressed={graphCanvasLayoutMode === "horizontal"}
          title={graphCanvasLayoutMode === "horizontal" ? "Switch to user-adjusted layout" : "Switch to horizontal layout"}
        >
          {graphCanvasLayoutMode === "horizontal" ? <PaintbrushVertical size={14} /> : <Rows3 size={14} />}
        </button>
      </div>
      <EdgeEditContext.Provider value={edgeDoubleClickAction}>
        <ReactFlow
          key={selectedGraphPath}
          onInit={actions.setFlowInstance}
          defaultViewport={graphCanvasData.viewport ?? { x: 0, y: 0, zoom: 1 }}
          minZoom={CANVAS_MIN_ZOOM}
          maxZoom={CANVAS_MAX_ZOOM}
          nodes={graphCanvasNodes}
          edges={graphCanvasEdges}
          onNodesChange={actions.handleNodesChange}
          onNodeClick={(_, node) => actions.handleNodeClick(node.id)}
          onNodeDoubleClick={(_, node) => actions.handleNodeDoubleClick(node.id)}
          onNodeDrag={(_, node) => actions.handleNodeDrag(node.id, node.position)}
          onNodeDragStop={(_, node) => actions.handleNodeDragStop(node.id, node.position)}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            const shell = graphCanvasShellRef.current;
            if (shell === null) {
              return;
            }
            const rect = shell.getBoundingClientRect();
            actions.openCanvasContextMenu(event.clientX - rect.left, event.clientY - rect.top);
          }}
          onPaneClick={actions.clearCanvasSelection}
          onMoveEnd={actions.persistViewport}
          nodesDraggable={false}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          edgeTypes={edgeTypes}
          onEdgeContextMenu={(event, edge) => {
            event.preventDefault();
            actions.deleteEdgeFromId(edge.id);
          }}
        >
          <Controls showInteractive={false} />
          <Background gap={32} color="var(--muted-foreground)" />
        </ReactFlow>
      </EdgeEditContext.Provider>
      <GraphCanvasOverlayInteraction controller={overlayController} />
      <div className="graph-canvas-overlay">
        <GraphCanvasOverlayEdges controller={overlayController} />
        <GraphCanvasOverlayNodes controller={overlayController} graphCanvasShellRef={graphCanvasShellRef} />
      </div>
    </div>
  );
}

export const GraphCanvasSurface = memo(GraphCanvasSurfaceComponent);