import {
  useCallback,
  useMemo,
  useRef,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Node, NodeChange, ReactFlowInstance } from "@xyflow/react";

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
  handleMergeDocuments: () => Promise<void> | void;
  handleCreateGraphDocument: (type: GraphCreateType) => Promise<void> | void;
  handleGraphCanvasFilesDrop: (files: FileList | File[]) => Promise<void> | void;
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
  handleMergeDocuments,
  handleCreateGraphDocument,
  handleGraphCanvasFilesDrop,
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
  setShiftSelectedNodes,
  rfViewportRef,
}: UseGraphCanvasSurfaceActionsArgs): {
  graphCanvasOverlayActions: GraphCanvasOverlayActions;
  graphCanvasSurfaceActions: GraphCanvasSurfaceProps["actions"];
} {
  const actionRefs = useRef({
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
    handleMergeDocuments,
    handleCreateGraphDocument,
    handleGraphCanvasFilesDrop,
    handleToggleGraphCanvasLayout,
    handleGraphCanvasSearchNext,
    handleGraphCanvasSearchPrevious,
    handleGraphCanvasNodesChange,
    handleOpenCanvasDocument,
    updateGraphCanvasNodePosition,
    persistGraphCanvasPosition,
    persistGraphCanvasViewport,
  });

  actionRefs.current = {
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
    handleMergeDocuments,
    handleCreateGraphDocument,
    handleGraphCanvasFilesDrop,
    handleToggleGraphCanvasLayout,
    handleGraphCanvasSearchNext,
    handleGraphCanvasSearchPrevious,
    handleGraphCanvasNodesChange,
    handleOpenCanvasDocument,
    updateGraphCanvasNodePosition,
    persistGraphCanvasPosition,
    persistGraphCanvasViewport,
  };

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
    actionRefs.current.clearIntersectingNodes();
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
    setShiftSelectedNodes([]);
  }, [setCanvasContextMenu, setEdgeToolbar, setHoveredEdgeTooltip, setSelectedCanvasNodeId, setSelectedEdgeId, setShiftSelectedNodes]);

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
    onMerge: handleGraphCanvasMergeDocumentsBridge,
    closeCanvasContextMenu,
    createGraphDocument: handleGraphCanvasCreateDocumentBridge,
  }), [
    clearEdgeClickTimer,
    closeCanvasContextMenu,
    handleGraphCanvasClearHoveredTooltip,
    handleGraphCanvasCreateDocumentBridge,
    handleGraphCanvasDeleteEdgeBridge,
    handleGraphCanvasEdgeClickBridge,
    handleGraphCanvasEdgeDoubleClickBridge,
    handleGraphCanvasEdgeHoverBridge,
    handleGraphCanvasMergeDocumentsBridge,
    handleGraphCanvasNodeDescriptionSaveBridge,
    handleGraphCanvasOverlayHandlePointerDownBridge,
    handleGraphCanvasOverlayNodeClickBridge,
    handleGraphCanvasOverlayNodeDoubleClickBridge,
    handleGraphCanvasOverlayNodePointerDownBridge,
    handleGraphCanvasPersistEdgeToolbar,
    setEdgeToolbar,
    setSelectedEdgeId,
  ]);

  const graphCanvasSurfaceActions = useMemo<GraphCanvasSurfaceProps["actions"]>(() => ({
    setDragActive: handleGraphCanvasSetDragActive,
    handleFilesDrop: handleGraphCanvasFilesDropBridge,
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