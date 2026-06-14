import {
  useCallback,
  useMemo,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Node, NodeChange, ReactFlowInstance } from "@xyflow/react";

import { getWailsCreateGraphFileNote } from "../lib/imageUploader";
import type { GraphCanvasSurfaceProps } from "../components/GraphCanvasSurface";
import type {
  EdgeToolbarState,
  GraphCanvasOverlayActions,
  HoveredEdgeTooltip,
} from "../components/graphCanvasOverlayController";
import type {
  GraphCanvasFlowNodeData,
  GraphCanvasPosition,
  GraphCreateType,
} from "../types";
import { useLatestRef } from "./useLatestRef";

type GraphCanvasEdgeClickPayload = {
  edgeId: string;
  sourceId: string;
  targetId: string;
  context: string;
  relationships: string[];
  x: number;
  y: number;
};

type UseGraphCanvasSurfaceActionsArgs = {
  clearEdgeClickTimer: () => void;
  updateIntersectingNodes: (nodeId: string, position: GraphCanvasPosition) => void;
  clearIntersectingNodes: () => void;
  handleGraphCanvasEdgeClick: (edge: GraphCanvasEdgeClickPayload) => void;
  handleGraphCanvasEdgeHover: (edgeId: string, context: string, x: number, y: number) => void;
  handleGraphCanvasEdgeDoubleClick: (sourceId: string, targetId: string, context: string, edgeId: string) => void;
  handlePersistEdgeToolbar: (state: EdgeToolbarState) => Promise<void>;
  handleDeleteEdge: (sourceId: string, targetId: string) => Promise<void>;
  handleGraphCanvasOverlayNodeClick: (event: ReactMouseEvent<HTMLDivElement>, nodeId: string) => void;
  handleGraphCanvasOverlayNodeDoubleClick: (event: ReactMouseEvent<HTMLDivElement>, nodeId: string) => void;
  handleGraphCanvasOverlayPointerDown: (event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => void;
  handleConnectionHandlePointerDown: (event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => void;
  handleGraphCanvasNodeDescriptionSave: (nodeId: string, description: string) => Promise<void> | void;
  previewGraphCanvasNodeLayout: (nodeId: string, layout: { width?: number; height?: number; zIndex?: number }) => void;
  persistGraphCanvasNodeLayout: (nodeId: string, layout: { width?: number; height?: number; zIndex?: number }) => Promise<void> | void;
  handleMergeDocuments: () => Promise<void> | void;
  handleCreateGraphDocument: (type: GraphCreateType) => Promise<void> | void;
  handleGraphCanvasFilesDrop: (files: FileList | File[]) => Promise<void> | void;
  handleRefreshGraphTree: () => Promise<void> | void;
  reloadCanvas: () => void;
  handleToggleGraphCanvasLayout: () => Promise<void> | void;
  handleGraphCanvasSearchNext: () => void;
  handleGraphCanvasSearchPrevious: () => void;
  handleGraphCanvasNodesChange: (changes: NodeChange<Node<GraphCanvasFlowNodeData>>[]) => void;
  handleOpenCanvasDocument: (nodeId: string) => void;
  updateGraphCanvasNodePosition: (nodeId: string, position: GraphCanvasPosition) => void;
  persistGraphCanvasPosition: (nodeId: string, position: GraphCanvasPosition) => Promise<void> | void;
  persistGraphCanvasViewport: (viewport: { x: number; y: number; zoom: number }) => Promise<void> | void;
  setHoveredEdgeTooltip: (value: HoveredEdgeTooltip | null | ((current: HoveredEdgeTooltip | null) => HoveredEdgeTooltip | null)) => void;
  setSelectedEdgeId: (edgeId: string) => void;
  setEdgeToolbar: (state: EdgeToolbarState | null) => void;
  setGraphCanvasDragActive: (active: boolean) => void;
  setGraphCanvasNodeSearchTerm: (value: string) => void;
  setGraphCanvasNodeSearchIndex: (value: number) => void;
  graphCanvasFlowRef: MutableRefObject<ReactFlowInstance<GraphCanvasFlowNodeData> | null>;
  setSelectedCanvasNodeId: (nodeId: string) => void;
  setCanvasContextMenu: (value: { x: number; y: number } | null) => void;
  setNodeContextMenu: (value: { x: number; y: number; nodeId: string } | null) => void;
  handleSetNodeColor: (nodeId: string, colorId: string | null) => Promise<void> | void;
  handleCanvasDeleteNode: (nodeId: string) => void;
  setShiftSelectedNodes: (nodeIds: string[]) => void;
  rfViewportRef: MutableRefObject<{ x: number; y: number; zoom: number }>;
};

export function useGraphCanvasSurfaceActions({
  clearEdgeClickTimer,
  updateIntersectingNodes,
  clearIntersectingNodes,
  handleGraphCanvasEdgeClick,
  handleGraphCanvasEdgeHover,
  handleGraphCanvasEdgeDoubleClick,
  handlePersistEdgeToolbar,
  handleDeleteEdge,
  handleGraphCanvasOverlayNodeClick,
  handleGraphCanvasOverlayNodeDoubleClick,
  handleGraphCanvasOverlayPointerDown,
  handleConnectionHandlePointerDown,
  handleGraphCanvasNodeDescriptionSave,
  previewGraphCanvasNodeLayout,
  persistGraphCanvasNodeLayout,
  handleMergeDocuments,
  handleCreateGraphDocument,
  handleGraphCanvasFilesDrop,
  handleRefreshGraphTree,
  reloadCanvas,
  handleToggleGraphCanvasLayout,
  handleGraphCanvasSearchNext,
  handleGraphCanvasSearchPrevious,
  handleGraphCanvasNodesChange,
  handleOpenCanvasDocument,
  updateGraphCanvasNodePosition,
  persistGraphCanvasPosition,
  persistGraphCanvasViewport,
  setHoveredEdgeTooltip,
  setSelectedEdgeId,
  setEdgeToolbar,
  setGraphCanvasDragActive,
  setGraphCanvasNodeSearchTerm,
  setGraphCanvasNodeSearchIndex,
  graphCanvasFlowRef,
  setSelectedCanvasNodeId,
  setCanvasContextMenu,
  setNodeContextMenu,
  handleSetNodeColor,
  handleCanvasDeleteNode,
  setShiftSelectedNodes,
  rfViewportRef,
}: UseGraphCanvasSurfaceActionsArgs): {
  graphCanvasOverlayActions: GraphCanvasOverlayActions;
  graphCanvasSurfaceActions: GraphCanvasSurfaceProps["actions"];
} {
  const actionRefs = useLatestRef({
    clearEdgeClickTimer,
    updateIntersectingNodes,
    clearIntersectingNodes,
    handleGraphCanvasEdgeClick,
    handleGraphCanvasEdgeHover,
    handleGraphCanvasEdgeDoubleClick,
    handlePersistEdgeToolbar,
    handleDeleteEdge,
    handleGraphCanvasOverlayNodeClick,
    handleGraphCanvasOverlayNodeDoubleClick,
    handleGraphCanvasOverlayPointerDown,
    handleConnectionHandlePointerDown,
    handleGraphCanvasNodeDescriptionSave,
    previewGraphCanvasNodeLayout,
    persistGraphCanvasNodeLayout,
    handleMergeDocuments,
    handleCreateGraphDocument,
    handleGraphCanvasFilesDrop,
    handleRefreshGraphTree,
    reloadCanvas,
    handleToggleGraphCanvasLayout,
    handleGraphCanvasSearchNext,
    handleGraphCanvasSearchPrevious,
    handleGraphCanvasNodesChange,
    handleOpenCanvasDocument,
    updateGraphCanvasNodePosition,
    persistGraphCanvasPosition,
    persistGraphCanvasViewport,
    handleSetNodeColor,
    handleCanvasDeleteNode,
  });

  const handleGraphCanvasClearHoveredTooltip = useCallback((edgeId: string) => {
    setHoveredEdgeTooltip((current) => current?.edgeId === edgeId ? null : current);
  }, [setHoveredEdgeTooltip]);

  const handleGraphCanvasPersistEdgeToolbar = useCallback((state: EdgeToolbarState) => {
    return actionRefs.current.handlePersistEdgeToolbar(state);
  }, []);

  const handleGraphCanvasEdgeClickBridge = useCallback((edge: GraphCanvasEdgeClickPayload) => {
    actionRefs.current.handleGraphCanvasEdgeClick(edge);
  }, []);

  const handleGraphCanvasEdgeHoverBridge = useCallback((edgeId: string, context: string, x: number, y: number) => {
    actionRefs.current.handleGraphCanvasEdgeHover(edgeId, context, x, y);
  }, []);

  const handleGraphCanvasEdgeDoubleClickBridge = useCallback((sourceId: string, targetId: string, context: string, edgeId: string) => {
    actionRefs.current.handleGraphCanvasEdgeDoubleClick(sourceId, targetId, context, edgeId);
  }, []);

  const handleGraphCanvasDeleteEdgeBridge = useCallback((sourceId: string, targetId: string) => {
    return actionRefs.current.handleDeleteEdge(sourceId, targetId);
  }, []);

  const handleGraphCanvasOverlayNodeClickBridge = useCallback((event: ReactMouseEvent<HTMLDivElement>, nodeId: string) => {
    actionRefs.current.handleGraphCanvasOverlayNodeClick(event, nodeId);
  }, []);

  const handleGraphCanvasOverlayNodeDoubleClickBridge = useCallback((event: ReactMouseEvent<HTMLDivElement>, nodeId: string) => {
    actionRefs.current.handleGraphCanvasOverlayNodeDoubleClick(event, nodeId);
  }, []);

  const handleGraphCanvasOverlayNodePointerDownBridge = useCallback((event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => {
    actionRefs.current.handleGraphCanvasOverlayPointerDown(event, nodeId);
  }, []);

  const handleGraphCanvasOverlayHandlePointerDownBridge = useCallback((event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => {
    actionRefs.current.handleConnectionHandlePointerDown(event, nodeId);
  }, []);

  const handleGraphCanvasNodeDescriptionSaveBridge = useCallback((nodeId: string, description: string) => {
    void actionRefs.current.handleGraphCanvasNodeDescriptionSave(nodeId, description);
  }, []);

  const handleGraphCanvasNodeResizePreviewBridge = useCallback((nodeId: string, width: number, height: number) => {
    actionRefs.current.previewGraphCanvasNodeLayout(nodeId, { width, height });
  }, []);

  const handleGraphCanvasNodeResizeCommitBridge = useCallback((nodeId: string, width: number, height: number) => {
    void actionRefs.current.persistGraphCanvasNodeLayout(nodeId, { width, height });
  }, []);

  const handleBringNodeToFrontBridge = useCallback((nodeId: string) => {
    void actionRefs.current.persistGraphCanvasNodeLayout(nodeId, { zIndex: Number.MAX_SAFE_INTEGER });
  }, []);

  const handleSendNodeToBackBridge = useCallback((nodeId: string) => {
    void actionRefs.current.persistGraphCanvasNodeLayout(nodeId, { zIndex: Number.MIN_SAFE_INTEGER });
  }, []);

  const handleGraphCanvasMergeDocumentsBridge = useCallback(() => {
    void actionRefs.current.handleMergeDocuments();
  }, []);

  const handleGraphCanvasCreateDocumentBridge = useCallback((type: GraphCreateType) => {
    void actionRefs.current.handleCreateGraphDocument(type);
  }, []);

  const handleGraphCanvasSetDragActive = useCallback((active: boolean) => {
    setGraphCanvasDragActive(active);
  }, [setGraphCanvasDragActive]);

  const handleGraphCanvasFilesDropBridge = useCallback((files: FileList | File[]) => {
    void actionRefs.current.handleGraphCanvasFilesDrop(files);
  }, []);

  const handleGraphCanvasFilesDropFromURIsBridge = useCallback((dataTransfer: DataTransfer, graphPath: string) => {
    // Try Wails binding first (desktop app).
    const createNote = getWailsCreateGraphFileNote();
    if (createNote) {
      // Extract URIs synchronously — dataTransfer data is cleared after the
      // event handler returns, so we cannot read it inside async callbacks.
      const fileURIs: string[] = [];
      const uriList = dataTransfer.getData("text/uri-list") ?? "";
      if (uriList.trim()) {
        fileURIs.push(...uriList.split("\n").map((u) => u.trim()).filter((u) => u.startsWith("file://")));
      }
      const plainText = dataTransfer.getData("text/plain") ?? "";
      if (!fileURIs.length && plainText.trim()) {
        const lines = plainText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
        for (const line of lines) {
          if (line.startsWith("/")) {
            fileURIs.push("file://" + line);
          }
        }
      }
      const htmlText = dataTransfer.getData("text/html") ?? "";
      if (!fileURIs.length && htmlText.trim()) {
        const uriMatches = htmlText.matchAll(/file:\/\/[^\s"'<>]+/g);
        for (const m of uriMatches) {
          fileURIs.push(m[0]);
        }
      }

      if (fileURIs.length > 0) {
        const uris = [...fileURIs];
        void (async () => {
          for (const uri of uris) {
            try {
              await createNote(uri, graphPath);
            } catch (error) {
              console.error("[flow] Failed to create graph file note from URI", { uri, error });
            }
          }
        void actionRefs.current.handleRefreshGraphTree();
        actionRefs.current.reloadCanvas();
        })();
        return;
      }
    }

    // Browser fallback: use dataTransfer.files with the HTTP upload path.
    const files = dataTransfer.files;
    if (files && files.length > 0) {
      void actionRefs.current.handleGraphCanvasFilesDrop(files);
    }
  }, []);

  const handleGraphCanvasSearchTermChange = useCallback((value: string) => {
    setGraphCanvasNodeSearchTerm(value);
    setGraphCanvasNodeSearchIndex(0);
  }, [setGraphCanvasNodeSearchIndex, setGraphCanvasNodeSearchTerm]);

  const handleGraphCanvasSearchNextBridge = useCallback(() => {
    actionRefs.current.handleGraphCanvasSearchNext();
  }, []);

  const handleGraphCanvasSearchPreviousBridge = useCallback(() => {
    actionRefs.current.handleGraphCanvasSearchPrevious();
  }, []);

  const handleGraphCanvasLayoutToggleBridge = useCallback(() => {
    void actionRefs.current.handleToggleGraphCanvasLayout();
  }, []);

  const handleGraphCanvasSetFlowInstance = useCallback((instance: ReactFlowInstance<GraphCanvasFlowNodeData>) => {
    graphCanvasFlowRef.current = instance;
  }, [graphCanvasFlowRef]);

  const handleGraphCanvasNodesChangeBridge = useCallback((changes: NodeChange<Node<GraphCanvasFlowNodeData>>[]) => {
    actionRefs.current.handleGraphCanvasNodesChange(changes);
  }, []);

  const handleGraphCanvasNodeClickSurface = useCallback((nodeId: string) => {
    actionRefs.current.clearEdgeClickTimer();
    actionRefs.current.clearIntersectingNodes();
    setSelectedCanvasNodeId(nodeId);
    setSelectedEdgeId("");
    setEdgeToolbar(null);
  }, [setEdgeToolbar, setSelectedCanvasNodeId, setSelectedEdgeId]);

  const handleGraphCanvasNodeDoubleClickSurface = useCallback((nodeId: string) => {
    actionRefs.current.handleOpenCanvasDocument(nodeId);
  }, []);

  const handleGraphCanvasNodeDragSurface = useCallback((nodeId: string, position: GraphCanvasPosition) => {
    actionRefs.current.updateGraphCanvasNodePosition(nodeId, position);
    actionRefs.current.updateIntersectingNodes(nodeId, position);
  }, []);

  const handleGraphCanvasNodeDragStopSurface = useCallback((nodeId: string, position: GraphCanvasPosition) => {
    actionRefs.current.updateGraphCanvasNodePosition(nodeId, position);
    actionRefs.current.updateIntersectingNodes(nodeId, position);
    void actionRefs.current.persistGraphCanvasPosition(nodeId, position);
  }, []);

  const handleGraphCanvasContextMenuSurface = useCallback((x: number, y: number) => {
    setCanvasContextMenu({ x, y });
  }, [setCanvasContextMenu]);

  const handleGraphCanvasPaneClickSurface = useCallback(() => {
    actionRefs.current.clearEdgeClickTimer();
    actionRefs.current.clearIntersectingNodes();
    setHoveredEdgeTooltip(null);
    setSelectedCanvasNodeId("");
    setSelectedEdgeId("");
    setEdgeToolbar(null);
    setCanvasContextMenu(null);
    setNodeContextMenu(null);
    setShiftSelectedNodes([]);
  }, [setCanvasContextMenu, setNodeContextMenu, setEdgeToolbar, setHoveredEdgeTooltip, setSelectedCanvasNodeId, setSelectedEdgeId, setShiftSelectedNodes]);

  const handleGraphCanvasPersistViewportSurface = useCallback(() => {
    const viewport = rfViewportRef.current;
    void actionRefs.current.persistGraphCanvasViewport({
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom,
    });
  }, [rfViewportRef]);

  const handleGraphCanvasDeleteEdgeFromID = useCallback((edgeId: string) => {
    const parts = edgeId.split(":");
    if (parts.length >= 3 && parts[0] === "link") {
      void actionRefs.current.handleDeleteEdge(parts[1], parts[2]);
    }
  }, []);

  const closeCanvasContextMenu = useCallback(() => {
    setCanvasContextMenu(null);
  }, [setCanvasContextMenu]);

  const openNodeContextMenu = useCallback((x: number, y: number, nodeId: string) => {
    setNodeContextMenu({ x, y, nodeId });
  }, [setNodeContextMenu]);

  const closeNodeContextMenu = useCallback(() => {
    setNodeContextMenu(null);
  }, [setNodeContextMenu]);

  const setNodeColorBridge = useCallback((nodeId: string, colorId: string | null) => {
    setNodeContextMenu(null);
    void actionRefs.current.handleSetNodeColor(nodeId, colorId);
  }, [setNodeContextMenu]);

  const deleteNodeBridge = useCallback((nodeId: string) => {
    setNodeContextMenu(null);
    actionRefs.current.handleCanvasDeleteNode(nodeId);
  }, [setNodeContextMenu]);

  const graphCanvasOverlayActions = useMemo<GraphCanvasOverlayActions>(() => ({
    clearEdgeClickTimer,
    selectEdge: setSelectedEdgeId,
    handleGraphCanvasEdgeClick: handleGraphCanvasEdgeClickBridge,
    handleGraphCanvasEdgeHover: handleGraphCanvasEdgeHoverBridge,
    clearHoveredEdgeTooltip: handleGraphCanvasClearHoveredTooltip,
    handleGraphCanvasEdgeDoubleClick: handleGraphCanvasEdgeDoubleClickBridge,
    setEdgeToolbarState: setEdgeToolbar,
    persistEdgeToolbar: handleGraphCanvasPersistEdgeToolbar,
    handleDeleteEdge: handleGraphCanvasDeleteEdgeBridge,
    onNodeClick: handleGraphCanvasOverlayNodeClickBridge,
    onNodeDoubleClick: handleGraphCanvasOverlayNodeDoubleClickBridge,
    onNodePointerDown: handleGraphCanvasOverlayNodePointerDownBridge,
    onHandlePointerDown: handleGraphCanvasOverlayHandlePointerDownBridge,
    onNodeDescriptionSave: handleGraphCanvasNodeDescriptionSaveBridge,
    onNodeResizePreview: handleGraphCanvasNodeResizePreviewBridge,
    onNodeResizeCommit: handleGraphCanvasNodeResizeCommitBridge,
    onBringNodeToFront: handleBringNodeToFrontBridge,
    onSendNodeToBack: handleSendNodeToBackBridge,
    onMerge: handleGraphCanvasMergeDocumentsBridge,
    closeCanvasContextMenu,
    openNodeContextMenu,
    closeNodeContextMenu,
    setNodeColor: setNodeColorBridge,
    deleteNode: deleteNodeBridge,
    createGraphDocument: handleGraphCanvasCreateDocumentBridge,
  }), [
    clearEdgeClickTimer,
    closeCanvasContextMenu,
    openNodeContextMenu,
    closeNodeContextMenu,
    setNodeColorBridge,
    deleteNodeBridge,
    handleGraphCanvasClearHoveredTooltip,
    handleGraphCanvasCreateDocumentBridge,
    handleGraphCanvasDeleteEdgeBridge,
    handleGraphCanvasEdgeClickBridge,
    handleGraphCanvasEdgeDoubleClickBridge,
    handleGraphCanvasEdgeHoverBridge,
    handleGraphCanvasMergeDocumentsBridge,
    handleGraphCanvasNodeDescriptionSaveBridge,
    handleGraphCanvasNodeResizeCommitBridge,
    handleGraphCanvasNodeResizePreviewBridge,
    handleGraphCanvasOverlayHandlePointerDownBridge,
    handleGraphCanvasOverlayNodeClickBridge,
    handleGraphCanvasOverlayNodeDoubleClickBridge,
    handleGraphCanvasOverlayNodePointerDownBridge,
    handleGraphCanvasPersistEdgeToolbar,
    handleBringNodeToFrontBridge,
    handleSendNodeToBackBridge,
    setEdgeToolbar,
    setSelectedEdgeId,
  ]);

  const graphCanvasSurfaceActions = useMemo<GraphCanvasSurfaceProps["actions"]>(() => ({
    setDragActive: handleGraphCanvasSetDragActive,
    handleFilesDrop: handleGraphCanvasFilesDropBridge,
    handleFilesDropFromURIs: handleGraphCanvasFilesDropFromURIsBridge,
    updateSearchTerm: handleGraphCanvasSearchTermChange,
    searchNext: handleGraphCanvasSearchNextBridge,
    searchPrevious: handleGraphCanvasSearchPreviousBridge,
    toggleLayout: handleGraphCanvasLayoutToggleBridge,
    setFlowInstance: handleGraphCanvasSetFlowInstance,
    handleNodesChange: handleGraphCanvasNodesChangeBridge,
    handleNodeClick: handleGraphCanvasNodeClickSurface,
    handleNodeDoubleClick: handleGraphCanvasNodeDoubleClickSurface,
    handleNodeDrag: handleGraphCanvasNodeDragSurface,
    handleNodeDragStop: handleGraphCanvasNodeDragStopSurface,
    openCanvasContextMenu: handleGraphCanvasContextMenuSurface,
    clearCanvasSelection: handleGraphCanvasPaneClickSurface,
    persistViewport: handleGraphCanvasPersistViewportSurface,
    deleteEdgeFromId: handleGraphCanvasDeleteEdgeFromID,
  }), [
    handleGraphCanvasContextMenuSurface,
    handleGraphCanvasDeleteEdgeFromID,
    handleGraphCanvasFilesDropBridge,
    handleGraphCanvasFilesDropFromURIsBridge,
    handleGraphCanvasLayoutToggleBridge,
    handleGraphCanvasNodeClickSurface,
    handleGraphCanvasNodeDoubleClickSurface,
    handleGraphCanvasNodeDragStopSurface,
    handleGraphCanvasNodeDragSurface,
    handleGraphCanvasNodesChangeBridge,
    handleGraphCanvasPaneClickSurface,
    handleGraphCanvasPersistViewportSurface,
    handleGraphCanvasSearchNextBridge,
    handleGraphCanvasSearchPreviousBridge,
    handleGraphCanvasSearchTermChange,
    handleGraphCanvasSetDragActive,
    handleGraphCanvasSetFlowInstance,
  ]);

  return {
    graphCanvasOverlayActions,
    graphCanvasSurfaceActions,
  };
}