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
import { ChevronLeft, ChevronRight, PaintbrushVertical, Rows3, Search } from "lucide-react";
import { memo, type DragEvent as ReactDragEvent, type RefObject } from "react";

import { GraphCanvasOverlayEdges } from "./GraphCanvasOverlayEdges";
import { GraphCanvasOverlayInteraction } from "./GraphCanvasOverlayInteraction";
import { GraphCanvasOverlayNodes } from "./GraphCanvasOverlayNodes";
import type { GraphCanvasOverlayController } from "./graphCanvasOverlayController";
import { Input } from "./ui/input";

import { EdgeEditContext, type GraphCanvasFlowEdgeData } from "../lib/graphCanvasUtils";
import type { GraphCanvasFlowNodeData, GraphCanvasPosition, GraphCanvasResponse } from "../types";

type GraphCanvasSurfaceActions = {
  setDragActive: (active: boolean) => void;
  handleFilesDrop: (files: FileList | File[]) => void;
  updateSearchTerm: (value: string) => void;
  searchNext: () => void;
  searchPrevious: () => void;
  toggleLayout: () => void;
  setFlowInstance: (instance: ReactFlowInstance<GraphCanvasFlowNodeData>) => void;
  handleNodesChange: (changes: NodeChange<Node<GraphCanvasFlowNodeData>>[]) => void;
  handleNodeClick: (nodeId: string) => void;
  handleNodeDoubleClick: (nodeId: string) => void;
  handleNodeDrag: (nodeId: string, position: GraphCanvasPosition) => void;
  handleNodeDragStop: (nodeId: string, position: GraphCanvasPosition) => void;
  openCanvasContextMenu: (x: number, y: number) => void;
  clearCanvasSelection: () => void;
  persistViewport: () => void;
  deleteEdgeFromId: (edgeId: string) => void;
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
}: GraphCanvasSurfaceProps) {
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
        const files = event.dataTransfer.files;
        if (!files || files.length === 0) {
          return;
        }
        actions.handleFilesDrop(files);
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
          minZoom={0.5}
          maxZoom={1.6}
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
        <GraphCanvasOverlayNodes controller={overlayController} />
      </div>
    </div>
  );
}

export const GraphCanvasSurface = memo(GraphCanvasSurfaceComponent);