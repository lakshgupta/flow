import {
  applyNodeChanges,
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useViewport,
  type Edge,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Rows3, X } from "lucide-react";
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { AppSidebar } from "./components/AppSidebar";
import { DocumentEditorPane } from "./components/DocumentEditorPane";
import { GraphEmptyState } from "./components/GraphEmptyState";
import { GraphCanvasSurface } from "./components/GraphCanvasSurface";
import { HomeSurface } from "./components/HomeSurface";
import { RightRailControls } from "./components/RightRailControls";
import { SettingsDialog } from "./components/SettingsDialog";
import { GraphTreePanel, WorkspaceSelectorPanel } from "./components/WorkspaceSidebarPanels";
import { CreateNodeDialog, DeleteDocumentDialog, RenameDialog } from "./components/WorkflowDialogs";
import type { EdgeToolbarState, GraphCanvasOverlayController } from "./components/graphCanvasOverlayController";
import { GraphCanvasOverlayInteraction } from "./components/GraphCanvasOverlayInteraction";
import { GraphCanvasOverlayNodes } from "./components/GraphCanvasOverlayNodes";
import { GraphCanvasOverlayEdges } from "./components/GraphCanvasOverlayEdges";
import { RightRailCalendarPanel, RightRailSearchPanel } from "./components/RightRailPanels";
import { ThreadPanelStack } from "./components/ThreadPanels";
import { Badge } from "./components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./components/ui/breadcrumb";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { Separator } from "./components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { requestJSON, deregisterLocalWorkspace, loadCalendarDocuments, loadWorkspaceSnapshot, selectWorkspace, uploadGraphFiles } from "./lib/api";
import { useGraphCanvasSurfaceActions } from "./hooks/useGraphCanvasSurfaceActions";
import { useHomeSurfaceActions } from "./hooks/useHomeSurfaceActions";
import { useRightRailDocumentActions } from "./hooks/useRightRailDocumentActions";
import { useRightRailControlsActions } from "./hooks/useRightRailControlsActions";
import { useSidebarNavigationActions } from "./hooks/useSidebarNavigationActions";
import { useThreadPanelActions } from "./hooks/useThreadPanelActions";
import {
  createDocumentFormState,
  createGraphDocumentPayload,
  createHomeFormState,
  emptyDocumentFormState,
  emptyHomeFormState,
  fileNameFromPath,
  formatDocumentType,
  generateTOC,
  parseEnv,
  splitList,
} from "./lib/docUtils";
import {
  applyElkHorizontalLayout,
  buildGraphCanvasFlowEdges,
  buildGraphCanvasFlowNodes,
  ContextEdge,
  EdgeEditContext,
  countConnectedGraphCanvasEdges,
  graphCanvasOverlayPosition,
  graphCanvasPositionMap,
  graphCanvasTypeLabel,
    intersectingGraphCanvasNodeIds,
  normalizeGraphCanvasResponse,
  selectedGraphCanvasNode,
} from "./lib/graphCanvasUtils";
import { graphDirectoryColorHex, resolveGraphDirectoryColor } from "./lib/graphColors";
import { useTheme } from "./lib/theme";
import { todayString } from "./lib/dateEntries";
import { toErrorMessage } from "./lib/utils";
import type { EdgeTypes } from "@xyflow/react";

const EDGE_TYPES: EdgeTypes = { contextEdge: ContextEdge };

import { RichTextEditor, type RichTextEditorHandle } from "./components/editor/RichTextEditor";
import type {
  CalendarDocumentResponse,
  DeleteDocumentResponse,
  DocumentFormState,
  DocumentResponse,
  GraphCanvasFlowNodeData,
  GraphCanvasPosition,
  GraphCanvasResponse,
  GraphCanvasResponseWire,
  GraphCreateType,
  GraphLayoutPositionPayload,
  GraphLayoutResponse,
  GraphTreeFileData,
  GraphTreeResponse,
  HomeFormState,
  HomeResponse,
  NodeLink,
  SearchResult,
  SurfaceState,
  WorkspaceResponse,
} from "./types";
import "./styles.css";

type RightPanelTab = "calendar" | "search";
type DocumentOpenMode = "center" | "right-rail";
type CenterDocumentSidePanelMode = "hidden" | "toc" | "properties";
type ThreadDensityMode = "comfortable" | "dense" | "ultra";
type RenameDialogState =
  | { kind: "graph"; graphPath: string }
  | { kind: "node"; documentId: string; fileName: string };
type DeleteDialogState = {
  id: string;
  type: string;
  title: string;
  path: string;
  graphPath: string;
};

type DocumentLinkDetail = {
  nodeId: string;
  context: string;
  linkType: string;
  graphPath: string;
};

type EditableLinkDetail = {
  nodeId: string;
  context: string;
  linkType: string;
};

type ThreadDocumentEntry = {
  documentId: string;
  graphPath: string;
};

type ThreadAssetEntry = {
  id: string;
  href: string;
  name: string;
  graphPath: string;
  kind: "pdf" | "text";
};

function normalizeAppearance(value: unknown): "light" | "dark" | "system" {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

const HOME_THREAD_DOCUMENT_ID = "home";
const DEFAULT_DOCUMENT_TOC_RATIO = 0.18;
const MIN_DOCUMENT_TOC_RATIO = 0.14;
const MAX_DOCUMENT_TOC_RATIO = 0.32;
const MIN_THREAD_PANEL_WIDTH_PX = 420;
const THREAD_PANEL_VIEWPORT_MARGIN_PX = 112;
const DOCUMENT_FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

type SearchFilters = {
  q: string;
  tag: string;
  title: string;
  description: string;
  content: string;
};

function clampDocumentTOCRatio(value: number): number {
  return Math.min(Math.max(value, MIN_DOCUMENT_TOC_RATIO), MAX_DOCUMENT_TOC_RATIO);
}

function clampThreadPanelWidth(width: number): number {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const maxWidth = Math.max(MIN_THREAD_PANEL_WIDTH_PX, viewportWidth - THREAD_PANEL_VIEWPORT_MARGIN_PX);
  return Math.min(Math.max(width, MIN_THREAD_PANEL_WIDTH_PX), maxWidth);
}

function isValidDocumentFileName(value: string): boolean {
  return DOCUMENT_FILE_NAME_PATTERN.test(value);
}

function buildThreadAssetID(href: string, kind: "pdf" | "text"): string {
  return `asset:${kind}:${encodeURIComponent(href)}`;
}

function stripMarkdownExtension(value: string): string {
  return value.endsWith(".md") ? value.slice(0, -3) : value;
}

function remapGraphPath(path: string, currentPath: string, nextPath: string): string {
  if (path === currentPath) {
    return nextPath;
  }
  if (path.startsWith(currentPath + "/")) {
    return `${nextPath}${path.slice(currentPath.length)}`;
  }
  return path;
}

function buildSearchRequestPath(filters: SearchFilters, limit: number): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  const tag = filters.tag.trim();
  const title = filters.title.trim();
  const description = filters.description.trim();
  const content = filters.content.trim();

  if (q !== "") {
    params.set("q", q);
  }
  if (tag !== "") {
    params.set("tag", tag);
  }
  if (title !== "") {
    params.set("title", title);
  }
  if (description !== "") {
    params.set("description", description);
  }
  if (content !== "") {
    params.set("content", content);
  }

  params.set("limit", String(limit));
  return `/api/search?${params.toString()}`;
}

function buildGraphTreeFile(document: DocumentResponse): GraphTreeFileData {
  return {
    id: document.id,
    type: document.type,
    title: document.title,
    path: document.path,
    fileName: fileNameFromPath(document.path),
  };
}

function updateGraphTreeDocumentEntry(graphTree: GraphTreeResponse | null, previousDocument: DocumentResponse, nextDocument: DocumentResponse): GraphTreeResponse | null {
  if (graphTree === null) {
    return graphTree;
  }

  if (previousDocument.graph !== nextDocument.graph) {
    return graphTree;
  }

  let changed = false;
  const nextGraphs = graphTree.graphs.map((graphNode) => {
    if (graphNode.graphPath !== nextDocument.graph) {
      return graphNode;
    }

    const nextFiles = graphNode.files.map((file) => {
      if (file.id !== nextDocument.id) {
        return file;
      }

      changed = true;
      return buildGraphTreeFile(nextDocument);
    });

    return changed ? { ...graphNode, files: nextFiles } : graphNode;
  });

  return changed ? { ...graphTree, graphs: nextGraphs } : graphTree;
}

function updateGraphCanvasDocumentEntry(graphCanvas: GraphCanvasResponse | null, previousDocument: DocumentResponse, nextDocument: DocumentResponse): GraphCanvasResponse | null {
  if (graphCanvas === null) {
    return graphCanvas;
  }

  if (previousDocument.graph !== nextDocument.graph || graphCanvas.selectedGraph !== nextDocument.graph) {
    return graphCanvas;
  }

  let changed = false;
  const nextNodes = graphCanvas.nodes.map((node) => {
    if (node.id !== nextDocument.id) {
      return node;
    }

    changed = true;
    return {
      ...node,
      type: nextDocument.type,
      graph: nextDocument.graph,
      title: nextDocument.title,
      description: nextDocument.description,
      path: nextDocument.path,
      featureSlug: nextDocument.featureSlug,
      tags: nextDocument.tags,
      createdAt: nextDocument.createdAt,
      updatedAt: nextDocument.updatedAt,
    };
  });

  return changed ? { ...graphCanvas, nodes: nextNodes } : graphCanvas;
}


function FlowApp() {
  const { theme, setTheme } = useTheme();
  const rfViewport = useViewport();
  const graphCanvasFlowRef = useRef<ReactFlowInstance<GraphCanvasFlowNodeData> | null>(null);
  const rfViewportRef = useRef(rfViewport);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [graphTree, setGraphTree] = useState<GraphTreeResponse | null>(null);
  const [graphCanvasData, setGraphCanvasData] = useState<GraphCanvasResponse | null>(null);
  const [graphCanvasLoading, setGraphCanvasLoading] = useState<boolean>(false);
  const [graphCanvasError, setGraphCanvasError] = useState<string>("");
  const [graphCanvasPositions, setGraphCanvasPositions] = useState<Record<string, GraphCanvasPosition>>({});
  const [graphCanvasUserPositions, setGraphCanvasUserPositions] = useState<Record<string, GraphCanvasPosition>>({});
  const [graphCanvasHorizontalPositions, setGraphCanvasHorizontalPositions] = useState<Record<string, GraphCanvasPosition>>({});
  const [graphCanvasLayoutMode, setGraphCanvasLayoutMode] = useState<"user" | "horizontal">("user");
  const [graphCanvasResettingLayout, setGraphCanvasResettingLayout] = useState<boolean>(false);
  const [graphCanvasReloadToken, setGraphCanvasReloadToken] = useState<number>(0);
  const [graphCanvasNodeSearchTerm, setGraphCanvasNodeSearchTerm] = useState<string>("");
  const [graphCanvasNodeSearchIndex, setGraphCanvasNodeSearchIndex] = useState<number>(0);
  const [selectedCanvasNodeId, setSelectedCanvasNodeId] = useState<string>("");
  const [graphCreatePendingType, setGraphCreatePendingType] = useState<GraphCreateType | "">("");
  const [graphCreateError, setGraphCreateError] = useState<string>("");
  const [graphCanvasDragActive, setGraphCanvasDragActive] = useState<boolean>(false);
  const [activeSurface, setActiveSurface] = useState<SurfaceState>({ kind: "home" });
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [selectedDocumentOpenMode, setSelectedDocumentOpenMode] = useState<DocumentOpenMode>("right-rail");
  const [selectedDocument, setSelectedDocument] = useState<DocumentResponse | null>(null);
  const [documentThread, setDocumentThread] = useState<ThreadDocumentEntry[]>([]);
  const [threadDocumentsById, setThreadDocumentsById] = useState<Record<string, DocumentResponse>>({});
  const [threadAssetsById, setThreadAssetsById] = useState<Record<string, ThreadAssetEntry>>({});
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchTagQuery, setSearchTagQuery] = useState<string>("");
  const [searchTitleQuery, setSearchTitleQuery] = useState<string>("");
  const [searchDescriptionQuery, setSearchDescriptionQuery] = useState<string>("");
  const [searchContentQuery, setSearchContentQuery] = useState<string>("");
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const deferredSearchTagQuery = useDeferredValue(searchTagQuery.trim());
  const deferredSearchTitleQuery = useDeferredValue(searchTitleQuery.trim());
  const deferredSearchDescriptionQuery = useDeferredValue(searchDescriptionQuery.trim());
  const deferredSearchContentQuery = useDeferredValue(searchContentQuery.trim());
  const hasDeferredSearchFilter = deferredSearchQuery !== ""
    || deferredSearchTagQuery !== ""
    || deferredSearchTitleQuery !== ""
    || deferredSearchDescriptionQuery !== ""
    || deferredSearchContentQuery !== "";
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [searchError, setSearchError] = useState<string>("");
  const [panelError, setPanelError] = useState<string>("");
  const [stoppingGUI, setStoppingGUI] = useState<boolean>(false);
  const [rebuildingIndex, setRebuildingIndex] = useState<boolean>(false);
  const [switchingWorkspace, setSwitchingWorkspace] = useState<boolean>(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "theme" | "stop">("general");
  const [formState, setFormState] = useState<DocumentFormState>(emptyDocumentFormState);
  const [editableLinkDetails, setEditableLinkDetails] = useState<Record<string, { context: string; linkType: string }>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [deleteDialogTarget, setDeleteDialogTarget] = useState<DeleteDialogState | null>(null);
  const [createNodeDialog, setCreateNodeDialog] = useState<{ type: GraphCreateType; graphPath: string; origin: "canvas" | "sidebar" } | null>(null);
  const [createNodeFileName, setCreateNodeFileName] = useState<string>("");
  const [createNodeFileNameError, setCreateNodeFileNameError] = useState<string>("");
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [renameError, setRenameError] = useState<string>("");
  const [renamePending, setRenamePending] = useState<boolean>(false);
  const [edgeToolbar, setEdgeToolbar] = useState<EdgeToolbarState | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>("");
  const [hoveredEdgeTooltip, setHoveredEdgeTooltip] = useState<{ edgeId: string; context: string; x: number; y: number } | null>(null);
  const [homeFormState, setHomeFormState] = useState<HomeFormState>(emptyHomeFormState);
  const [calendarDocuments, setCalendarDocuments] = useState<CalendarDocumentResponse[]>([]);
  const [calendarError, setCalendarError] = useState<string>("");
  const [mutationError, setMutationError] = useState<string>("");
  const [mutationSuccess, setMutationSuccess] = useState<string>("");
  const [homeMutationError, setHomeMutationError] = useState<string>("");
  const [savingDocument, setSavingDocument] = useState<boolean>(false);
  const [deletingDocument, setDeletingDocument] = useState<boolean>(false);
  const [savingHome, setSavingHome] = useState<boolean>(false);
  const [calendarFocusDate, setCalendarFocusDate] = useState<string>(() => todayString());
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(256);
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(320);
  const [documentTOCRatio, setDocumentTOCRatio] = useState<number>(DEFAULT_DOCUMENT_TOC_RATIO);
  const [threadPanelWidths, setThreadPanelWidths] = useState<Record<string, number>>({});
  const [threadDensityMode, setThreadDensityMode] = useState<ThreadDensityMode>("comfortable");
  const [threadExpanded, setThreadExpanded] = useState<boolean>(false);
  const [centerDocumentSidePanelMode, setCenterDocumentSidePanelMode] = useState<CenterDocumentSidePanelMode>("hidden");
  const [homeTOCVisible, setHomeTOCVisible] = useState<boolean>(false);
  const [isResizingLeft, setIsResizingLeft] = useState<boolean>(false);
  const [isResizingRight, setIsResizingRight] = useState<boolean>(false);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [shiftSelectedNodes, setShiftSelectedNodes] = useState<string[]>([]);
  const [graphCanvasIntersectingNodeIds, setGraphCanvasIntersectingNodeIds] = useState<string[]>([]);
  const [graphCanvasIntersectionSourceId, setGraphCanvasIntersectionSourceId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connectingStartPos, setConnectingStartPos] = useState<{ x: number; y: number } | null>(null);
  const [connectingPointerPos, setConnectingPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [connectingTarget, setConnectingTarget] = useState<string | null>(null);

  const graphCanvasShellRef = useRef<HTMLDivElement | null>(null);
  const centerDocumentLayoutRef = useRef<HTMLDivElement | null>(null);
  const homeDocumentLayoutRef = useRef<HTMLDivElement | null>(null);
  const rightRailDocumentLayoutRef = useRef<HTMLDivElement | null>(null);
  const centerDocumentEditorRef = useRef<RichTextEditorHandle | null>(null);
  const homeDocumentEditorRef = useRef<RichTextEditorHandle | null>(null);
  const rightRailDocumentEditorRef = useRef<RichTextEditorHandle | null>(null);
  const connectingTargetRef = useRef<string | null>(null);
  const homeFormStateRef = useRef<HomeFormState>(emptyHomeFormState);
  const homeAutoSaveTimerRef = useRef<number | null>(null);
  const documentAutoSaveTimerRef = useRef<number | null>(null);
  const homeSavePromiseRef = useRef<Promise<void> | null>(null);
  const documentSavePromiseRef = useRef<Promise<void> | null>(null);
  const edgeClickTimerRef = useRef<number | null>(null);
  const documentThreadRef = useRef<ThreadDocumentEntry[]>([]);
  const threadStackRef = useRef<HTMLDivElement | null>(null);
  const selectedDocumentOpenModeRef = useRef<DocumentOpenMode>("right-rail");
  const formStateRef = useRef<DocumentFormState>(emptyDocumentFormState);
  const editableLinkDetailsRef = useRef<Record<string, { context: string; linkType: string }>>({});
  const selectedDocumentRef = useRef<DocumentResponse | null>(null);
  const graphCanvasDragRef = useRef<{
    documentId: string;
    offsetX: number;
    offsetY: number;
    shellLeft: number;
    shellTop: number;
    moved: boolean;
  } | null>(null);
  const graphCanvasUserPositionsRef = useRef<Record<string, GraphCanvasPosition>>({});
  const graphCanvasHorizontalPositionsRef = useRef<Record<string, GraphCanvasPosition>>({});
  const graphCanvasLayoutModeRef = useRef<"user" | "horizontal">("user");
  const graphCanvasPositionsRef = useRef<Record<string, GraphCanvasPosition>>({});
  const graphCanvasNodesRef = useRef<Node<GraphCanvasFlowNodeData>[]>([]);
  const selectedGraphPath = activeSurface.kind === "graph" ? activeSurface.graphPath : "";
  const [rightRailCollapsed, setRightRailCollapsed] = useState<boolean>(true);
  const [rightRailMaximized, setRightRailMaximized] = useState<boolean>(false);

  useEffect(() => {
    graphCanvasPositionsRef.current = graphCanvasPositions;
  }, [graphCanvasPositions]);

  useEffect(() => {
    graphCanvasUserPositionsRef.current = graphCanvasUserPositions;
  }, [graphCanvasUserPositions]);

  useEffect(() => {
    graphCanvasHorizontalPositionsRef.current = graphCanvasHorizontalPositions;
  }, [graphCanvasHorizontalPositions]);

  useEffect(() => {
    graphCanvasLayoutModeRef.current = graphCanvasLayoutMode;
  }, [graphCanvasLayoutMode]);

  useEffect(() => {
    rfViewportRef.current = rfViewport;
  }, [rfViewport]);

  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab | "document">("search");
  const [editorScrollTarget, setEditorScrollTarget] = useState<string | null>(null);

  const graphDirectoryColorsByPath = useMemo(() => {
    const next: Record<string, string> = {};
    for (const graphNode of graphTree?.graphs ?? []) {
      if ((graphNode.color ?? "").trim() !== "") {
        next[graphNode.graphPath] = graphNode.color ?? "";
      }
    }
    return next;
  }, [graphTree]);
  const graphCanvasNodes = buildGraphCanvasFlowNodes(
    graphCanvasData,
    graphCanvasPositions,
    selectedCanvasNodeId,
    selectedDocumentId,
    graphDirectoryColorsByPath,
  );
  graphCanvasNodesRef.current = graphCanvasNodes;
  const graphCanvasEdgesRaw = buildGraphCanvasFlowEdges(graphCanvasData, selectedCanvasNodeId);
  const graphCanvasEdges = selectedEdgeId === ""
    ? graphCanvasEdgesRaw
    : graphCanvasEdgesRaw.map((e) => e.id === selectedEdgeId ? { ...e, selected: true } : e);
  const normalizedGraphCanvasNodeSearchTerm = graphCanvasNodeSearchTerm.trim().toLowerCase();
  const graphCanvasNodeSearchMatches = useMemo(() => {
    if (normalizedGraphCanvasNodeSearchTerm === "") {
      return [] as Node<GraphCanvasFlowNodeData>[];
    }

    return graphCanvasNodes.filter((node) =>
      (node.data.title ?? "").toLowerCase().includes(normalizedGraphCanvasNodeSearchTerm),
    );
  }, [graphCanvasNodes, normalizedGraphCanvasNodeSearchTerm]);
  const graphCanvasNodeSearchHasMatches = graphCanvasNodeSearchMatches.length > 0;
  const graphCanvasNodeSearchSelectedIndex = graphCanvasNodeSearchMatches.findIndex((node) => node.id === selectedCanvasNodeId);
  const selectedGraphNode = graphTree?.graphs.find((graphNode) => graphNode.graphPath === selectedGraphPath) ?? null;
  const selectedCanvasNode = selectedGraphCanvasNode(graphCanvasData, selectedCanvasNodeId);
  const selectedDocumentGraphColor = selectedDocument !== null
    ? graphDirectoryColorHex(resolveGraphDirectoryColor(selectedDocument.graph, graphDirectoryColorsByPath))
    : undefined;
  const selectedDocumentTintStyle = selectedDocumentGraphColor
    ? ({ "--document-graph-color": selectedDocumentGraphColor } as React.CSSProperties)
    : undefined;
  const selectedCanvasNodeEdgeCount = countConnectedGraphCanvasEdges(graphCanvasData, selectedCanvasNodeId);
  const workspaceSurfaceSection = activeSurface.kind === "graph" ? "Content" : "Home";
  const workspaceSurfaceTitle = activeSurface.kind === "graph" ? selectedGraphNode?.displayName ?? selectedGraphPath : null;
  const trackedLocalWorkspaces = (workspace?.workspaces ?? []).filter((entry) => entry.scope === "local");
  const isHomeThreadRoot = documentThread.length > 0 && documentThread[0]?.documentId === HOME_THREAD_DOCUMENT_ID;
  const activeThreadTailId = documentThread.length > 0 ? documentThread[documentThread.length - 1]?.documentId ?? "" : "";
  const hasAssetThreadTail = activeThreadTailId !== "" && threadAssetsById[activeThreadTailId] !== undefined;
  const isCenterDocumentOpen = selectedDocumentId !== "" && selectedDocumentOpenMode === "center";
  const isThreadStackOpen = selectedDocumentOpenMode === "center"
    && (selectedDocumentId !== "" || hasAssetThreadTail || (isHomeThreadRoot && activeSurface.kind === "home"));
  const isSelectedDocumentLoading = selectedDocumentId !== "" && (selectedDocument === null || selectedDocument.id !== selectedDocumentId);
  const activeThreadDocumentId = selectedDocumentOpenMode === "center"
    ? (selectedDocumentId !== "" ? selectedDocumentId : activeSurface.kind === "home" ? HOME_THREAD_DOCUMENT_ID : activeThreadTailId)
    : activeThreadTailId;
  const showCenterDocumentSidePanel = centerDocumentSidePanelMode !== "hidden";
  const centerDocumentSidePanelLabel = centerDocumentSidePanelMode === "properties" ? "Document properties" : "Document table of contents";
  const centerDocumentSidePanelTitle = centerDocumentSidePanelMode === "properties" ? "Properties" : "Table of Contents";
  const centerDocumentSidePanelDescription = centerDocumentSidePanelMode === "properties"
    ? "Edit the markdown frontmatter fields for this document."
    : "Jump to headings in the current document.";
  const centerDocumentSidePanelResizerLabel = centerDocumentSidePanelMode === "properties"
    ? "Resize document properties"
    : "Resize table of contents";
  const hasRightRailDocument = selectedDocumentId !== "" && selectedDocumentOpenMode === "right-rail";
  const showRightRailDocumentButton = activeSurface.kind === "graph" && !isCenterDocumentOpen && (selectedCanvasNode !== null || hasRightRailDocument);
  const selectedNodeMatchesRightRailDocument = selectedCanvasNode !== null && hasRightRailDocument && selectedDocumentId === selectedCanvasNode.id;
  const nextThreadDensityMode: ThreadDensityMode = threadDensityMode === "comfortable"
    ? "dense"
    : threadDensityMode === "dense"
      ? "ultra"
      : "comfortable";
  const nextThreadDensityLabel = nextThreadDensityMode === "comfortable"
    ? "comfortable"
    : nextThreadDensityMode === "dense"
      ? "dense"
      : "ultra";
  const relationshipTagCatalog = useMemo(() => {
    const tagSet = new Set<string>();

    for (const edge of graphCanvasData?.edges ?? []) {
      if (edge.kind !== "link") {
        continue;
      }

      for (const tag of edge.relationships ?? []) {
        const trimmed = tag.trim();
        if (trimmed !== "") {
          tagSet.add(trimmed);
        }
      }
    }

    return Array.from(tagSet).sort((left, right) => left.localeCompare(right));
  }, [graphCanvasData?.edges]);
  const documentGraphById = useMemo(() => {
    const graphByID = new Map<string, string>();

    for (const graphNode of graphTree?.graphs ?? []) {
      for (const file of graphNode.files) {
        graphByID.set(file.id, graphNode.graphPath);
      }
    }

    return graphByID;
  }, [graphTree]);

  useEffect(() => {
    setGraphCanvasIntersectingNodeIds([]);
    setGraphCanvasIntersectionSourceId(null);
  }, [selectedGraphPath, graphCanvasData]);
  const threadPanels = useMemo(() => {
    return documentThread.map((entry, index) => {
      const isTail = index === documentThread.length - 1;
      const isActive = selectedDocumentOpenMode === "center" && activeThreadDocumentId === entry.documentId;
      const document = isActive && selectedDocument?.id === entry.documentId
        ? selectedDocument
        : threadDocumentsById[entry.documentId] ?? null;

      return {
        ...entry,
        document,
        isActive,
        isTail,
      };
    });
  }, [activeThreadDocumentId, documentThread, selectedDocument, selectedDocumentOpenMode, threadDocumentsById]);
  const activeThreadPanelKey = useMemo(() => {
    if (threadPanels.length === 0) {
      return "";
    }

    const activeIndex = threadPanels.findIndex((panel) => panel.isActive);
    const resolvedIndex = activeIndex >= 0 ? activeIndex : threadPanels.length - 1;
    const panel = threadPanels[resolvedIndex];
    if (panel === undefined) {
      return "";
    }

    return `${panel.documentId}:${resolvedIndex}`;
  }, [threadPanels]);
  const activeThreadPanelIndex = useMemo(() => {
    if (threadPanels.length === 0) {
      return -1;
    }

    const activeIndex = threadPanels.findIndex((panel) => panel.isActive);
    return activeIndex >= 0 ? activeIndex : threadPanels.length - 1;
  }, [threadPanels]);
  const selectedDocumentLinks = useMemo(() => {
    if (selectedDocument === null) {
      return {
        outgoing: [] as DocumentLinkDetail[],
        incoming: [] as DocumentLinkDetail[],
      };
    }

    const outgoing = (selectedDocument.links ?? []).map((link) => ({
      nodeId: link.node,
      context: link.context ?? "",
      linkType: (link.relationships ?? []).join(", "),
      graphPath: documentGraphById.get(link.node) ?? selectedDocument.graph,
    }));

    const incomingByNodeId = new Map<string, DocumentLinkDetail>();

    for (const nodeId of selectedDocument.relatedNoteIds ?? []) {
      incomingByNodeId.set(nodeId, {
        nodeId,
        context: "",
        linkType: "",
        graphPath: documentGraphById.get(nodeId) ?? selectedDocument.graph,
      });
    }

    for (const edge of graphCanvasData?.edges ?? []) {
      if (edge.kind !== "link" || edge.target !== selectedDocument.id) {
        continue;
      }

      const existing = incomingByNodeId.get(edge.source);
      incomingByNodeId.set(edge.source, {
        nodeId: edge.source,
        context: edge.context ?? existing?.context ?? "",
        linkType: edge.relationships?.join(", ") ?? existing?.linkType ?? "",
        graphPath: documentGraphById.get(edge.source) ?? selectedDocument.graph,
      });
    }

    const incoming = Array.from(incomingByNodeId.values());

    return { outgoing, incoming };
  }, [documentGraphById, graphCanvasData?.edges, selectedDocument]);

  const editableOutgoingLinks = useMemo((): EditableLinkDetail[] => {
    if (selectedDocument === null) {
      return [];
    }

    return splitList(formState.links).map((nodeId) => {
      const existing = editableLinkDetails[nodeId];
      return {
        nodeId,
        context: existing?.context ?? "",
        linkType: existing?.linkType ?? "",
      };
    });
  }, [editableLinkDetails, formState.links, selectedDocument]);

  const availableLinkTargets = useMemo((): string[] => {
    if (selectedDocument === null) {
      return [];
    }

    const linkedIDs = new Set(splitList(formState.links));
    const targets = new Set<string>();
    for (const graphNode of graphTree?.graphs ?? []) {
      for (const file of graphNode.files) {
        if (file.id === selectedDocument.id || linkedIDs.has(file.id)) {
          continue;
        }
        targets.add(file.id);
      }
    }

    return Array.from(targets).sort((left, right) => left.localeCompare(right));
  }, [formState.links, graphTree?.graphs, selectedDocument]);

  useEffect(() => {
    if (workspace === null) {
      return;
    }

    setDocumentTOCRatio(clampDocumentTOCRatio(workspace.panelWidths.documentTOCRatio));
  }, [workspace]);

  useEffect(() => {
    if (!isCenterDocumentOpen || selectedDocumentId === "") {
      return;
    }

    setCenterDocumentSidePanelMode("hidden");
  }, [isCenterDocumentOpen, selectedDocumentId]);

  useEffect(() => {
    if (selectedDocumentId !== "" || rightPanelTab !== "document") {
      return;
    }

    setRightPanelTab("search");
    setRightRailCollapsed(true);
  }, [rightPanelTab, selectedDocumentId]);

  const showFreshStartGuide = useMemo(() => {
    if (activeSurface.kind !== "home") {
      return false;
    }

    if ((graphTree?.graphs.length ?? 0) > 0) {
      return false;
    }

    const normalizedHomeBody = homeFormState.body.trim();
    return normalizedHomeBody === "" || normalizedHomeBody === "# Home";
  }, [activeSurface.kind, graphTree?.graphs.length, homeFormState.body]);
  const tocItems = useMemo(() => {
    if (activeSurface.kind === "home") {
      return generateTOC(homeFormState.body);
    }

    if (selectedDocument === null) {
      return [];
    }

    return generateTOC(formState.body);
  }, [activeSurface.kind, formState.body, homeFormState.body, selectedDocument]);

  useEffect(() => {
    documentThreadRef.current = documentThread;
  }, [documentThread]);

  useEffect(() => {
    selectedDocumentOpenModeRef.current = selectedDocumentOpenMode;
  }, [selectedDocumentOpenMode]);

  useEffect(() => {
    if (!isThreadStackOpen || activeThreadPanelKey === "") {
      return;
    }

    const stack = threadStackRef.current;
    if (stack === null) {
      return;
    }

    const panel = Array.from(stack.querySelectorAll<HTMLElement>("[data-thread-panel-key]"))
      .find((node) => node.dataset.threadPanelKey === activeThreadPanelKey);
    if (panel === undefined) {
      return;
    }

    const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeThreadPanelKey, isThreadStackOpen]);

  const moveThreadFocus = useCallback((delta: -1 | 1): void => {
    if (!isThreadStackOpen || threadPanels.length === 0 || activeThreadPanelIndex < 0) {
      return;
    }

    const nextIndex = Math.min(Math.max(activeThreadPanelIndex + delta, 0), threadPanels.length - 1);
    if (nextIndex === activeThreadPanelIndex) {
      return;
    }

    const nextPanel = threadPanels[nextIndex];
    if (nextPanel === undefined) {
      return;
    }

    void activateThreadDocument(nextPanel.documentId, nextPanel.graphPath);
  }, [activeThreadPanelIndex, isThreadStackOpen, threadPanels]);

  useEffect(() => {
    if (!isThreadStackOpen) {
      return;
    }

    function handleThreadKeyboardNavigate(event: KeyboardEvent): void {
      if (!event.altKey) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveThreadFocus(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveThreadFocus(1);
      }
    }

    window.addEventListener("keydown", handleThreadKeyboardNavigate);
    return () => {
      window.removeEventListener("keydown", handleThreadKeyboardNavigate);
    };
  }, [isThreadStackOpen, moveThreadFocus]);

  const syncSelectedDocumentState = useCallback((document: DocumentResponse | null, options?: { preserveFormState?: boolean }): void => {
    selectedDocumentRef.current = document;
    setSelectedDocument(document);

    if (document !== null && (selectedDocumentOpenModeRef.current === "center" || documentThreadRef.current.some((entry) => entry.documentId === document.id))) {
      setThreadDocumentsById((current) => ({ ...current, [document.id]: document }));
    }

    if (!options?.preserveFormState) {
      const nextFormState = createDocumentFormState(document);
      formStateRef.current = nextFormState;
      setFormState(nextFormState);
    }

    const nextLinkDetails = Object.fromEntries(
      (document?.links ?? []).map((link) => [
        link.node,
        {
          context: link.context ?? "",
          linkType: (link.relationships ?? []).join(", "),
        },
      ]),
    );
    editableLinkDetailsRef.current = nextLinkDetails;
    setEditableLinkDetails(nextLinkDetails);
  }, []);

  function syncDocumentBodyFromActiveEditor(): boolean {
    const editorHandle = selectedDocumentOpenMode === "center" ? centerDocumentEditorRef.current : rightRailDocumentEditorRef.current;
    if (editorHandle === null) {
      return false;
    }

    const nextBody = editorHandle.getMarkdown();
    if (nextBody === formStateRef.current.body) {
      return false;
    }

    const nextState = { ...formStateRef.current, body: nextBody };
    formStateRef.current = nextState;
    setFormState(nextState);
    return true;
  }

  function syncHomeBodyFromEditor(): boolean {
    if (homeDocumentEditorRef.current === null) {
      return false;
    }

    const nextBody = homeDocumentEditorRef.current.getMarkdown();
    if (nextBody === homeFormStateRef.current.body) {
      return false;
    }

    const nextState = { ...homeFormStateRef.current, body: nextBody };
    homeFormStateRef.current = nextState;
    setHomeFormState(nextState);
    return true;
  }

  function clearMutationFeedback(): void {
    setMutationError("");
    setMutationSuccess("");
  }

  function clearSurfaceFeedback(): void {
    clearMutationFeedback();
    setPanelError("");
  }

  const refreshCalendarDocumentList = useCallback(async (): Promise<void> => {
    try {
      const response = await loadCalendarDocuments();
      setCalendarDocuments(response);
      setCalendarError("");
    } catch (loadError) {
      setCalendarDocuments([]);
      setCalendarError(toErrorMessage(loadError));
    }
  }, []);

  function collapseRightRail(): void {
    const shouldResetNodeView = rightPanelTab === "calendar"
      && selectedDocumentOpenModeRef.current === "center"
      && documentThreadRef.current.length <= 1
      && documentThreadRef.current.length > 0;

    if (shouldResetNodeView) {
      setThreadExpanded(true);
    }

    setRightRailMaximized(false);
    setRightRailCollapsed(true);
  }

  function applyDocumentThread(nextThread: ThreadDocumentEntry[]): void {
    documentThreadRef.current = nextThread;
    setDocumentThread(nextThread);
    setThreadDocumentsById((current) => {
      const allowedIds = new Set(nextThread.map((entry) => entry.documentId));
      return Object.fromEntries(Object.entries(current).filter(([documentId]) => allowedIds.has(documentId)));
    });
    setThreadAssetsById((current) => {
      const allowedIDs = new Set(nextThread.map((entry) => entry.documentId));
      return Object.fromEntries(Object.entries(current).filter(([assetID]) => allowedIDs.has(assetID)));
    });
  }

  function clearDocumentThread(): void {
    setCenterDocumentSidePanelMode("hidden");
    applyDocumentThread([]);
  }

  function toggleRightPanel(tab: RightPanelTab | "document"): void {
    if (rightPanelTab === tab && !rightRailCollapsed) {
      collapseRightRail();
      return;
    }

    if (tab === "calendar") {
      setRightSidebarWidth((current) => Math.max(current, 300));
    }

    if (tab !== "document") {
      setRightRailMaximized(false);
    }

    setThreadExpanded(false);
    setRightPanelTab(tab);
    setRightRailCollapsed(false);
  }

  function toggleThreadExpanded(): void {
    setThreadExpanded((current) => {
      const next = !current;
      if (next) {
        setRightRailCollapsed(true);
        setRightRailMaximized(false);
      }
      return next;
    });
  }

  function toggleCenterDocumentSidePanel(panel: Exclude<CenterDocumentSidePanelMode, "hidden">): void {
    setCenterDocumentSidePanelMode((current) => (current === panel ? "hidden" : panel));
  }

  function handleDateOpen(date: string): void {
    setThreadExpanded(false);
    setRightSidebarWidth((current) => Math.max(current, 300));
    setCalendarFocusDate(date);
    setRightPanelTab("calendar");
    setRightRailCollapsed(false);
    setRightRailMaximized(false);
  }

  async function waitForEditorStateToSettle(): Promise<void> {
    await Promise.resolve();

    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      return;
    }

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }

  async function flushPendingDocumentSave(): Promise<void> {
    await waitForEditorStateToSettle();
    const hasUnsyncedEditorState = syncDocumentBodyFromActiveEditor();
    const hadPendingTimer = documentAutoSaveTimerRef.current !== null;

    if (hadPendingTimer) {
      clearTimeout(documentAutoSaveTimerRef.current);
      documentAutoSaveTimerRef.current = null;
    }

    if (documentSavePromiseRef.current !== null) {
      await documentSavePromiseRef.current;
    }

    if ((!hadPendingTimer && !hasUnsyncedEditorState) || selectedDocumentRef.current === null) {
      return;
    }

    await handleSaveDocument(selectedDocumentRef.current, formStateRef.current);
  }

  async function flushPendingHomeSave(): Promise<void> {
    await waitForEditorStateToSettle();
    const hasUnsyncedEditorState = syncHomeBodyFromEditor();
    const hadPendingTimer = homeAutoSaveTimerRef.current !== null;

    if (hadPendingTimer) {
      clearTimeout(homeAutoSaveTimerRef.current);
      homeAutoSaveTimerRef.current = null;
    }

    if (homeSavePromiseRef.current !== null) {
      await homeSavePromiseRef.current;
    }

    if (!hadPendingTimer && !hasUnsyncedEditorState) {
      return;
    }

    await handleSaveHomeContent(homeFormStateRef.current);
  }

  async function flushPendingActiveEditorSave(): Promise<void> {
    await flushPendingDocumentSave();
    await flushPendingHomeSave();
  }

  function openGraphSurface(graphPath: string): void {
    startTransition(() => {
      setActiveSurface({ kind: "graph", graphPath });
    });
  }

  function collapseDocumentRightRailIfOpen(): void {
    if (rightPanelTab === "document") {
      setRightPanelTab("search");
      setRightRailCollapsed(true);
    }
  }

  function syncCenterThreadSelection(documentId: string, canvasNodeId: string, document: DocumentResponse | null): void {
    setSelectedDocumentOpenMode("center");
    setSelectedDocumentId(documentId);
    setSelectedCanvasNodeId(canvasNodeId);
    syncSelectedDocumentState(document);
  }

  function resolveThreadBaseFromSource(sourceDocumentId: string, preferredGraphPath = ""): {
    baseThread: ThreadDocumentEntry[];
    resolvedGraphPath: string;
  } {
    const currentThread = documentThreadRef.current;
    const sourceIndex = currentThread.findIndex((entry) => entry.documentId === sourceDocumentId);
    const resolvedGraphPath = preferredGraphPath.trim() !== ""
      ? preferredGraphPath
      : currentThread[sourceIndex]?.graphPath
        ?? selectedDocumentRef.current?.graph
        ?? documentGraphById.get(sourceDocumentId)
        ?? selectedGraphPath;

    const baseThread = sourceIndex >= 0
      ? currentThread.slice(0, sourceIndex + 1)
      : sourceDocumentId === HOME_THREAD_DOCUMENT_ID
        ? [{ documentId: HOME_THREAD_DOCUMENT_ID, graphPath: "" }]
        : sourceDocumentId !== "" && resolvedGraphPath !== ""
          ? [{ documentId: sourceDocumentId, graphPath: resolvedGraphPath }]
          : [];

    return { baseThread, resolvedGraphPath };
  }

  async function openDocumentInCenter(documentId: string, graphPath: string): Promise<void> {
    await flushPendingActiveEditorSave();
    clearSurfaceFeedback();
    openGraphSurface(graphPath);
    setSelectedCanvasNodeId(documentId);
    setSelectedDocumentOpenMode("center");
    setCenterDocumentSidePanelMode("hidden");
    applyDocumentThread([{ documentId, graphPath }]);
    setSelectedDocumentId(documentId);
    setThreadExpanded(true);
    setRightRailCollapsed(true);
    if (rightPanelTab === "document") {
      setRightPanelTab("search");
    }
  }

  async function openDocumentInRightRail(documentId: string, graphPath: string): Promise<void> {
    await flushPendingActiveEditorSave();
    clearSurfaceFeedback();
    openGraphSurface(graphPath);
    setThreadExpanded(false);
    setSelectedCanvasNodeId(documentId);
    setSelectedDocumentOpenMode("right-rail");
    setSelectedDocumentId(documentId);
    setRightPanelTab("document");
    setRightRailMaximized(false);
    setRightRailCollapsed(false);
  }

  async function openDocumentInThreadFromSource(sourceDocumentId: string, targetDocumentId: string, graphPath: string): Promise<void> {
    await flushPendingActiveEditorSave();
    clearSurfaceFeedback();

    const { baseThread } = resolveThreadBaseFromSource(sourceDocumentId);

    const nextThread = [...baseThread, { documentId: targetDocumentId, graphPath }];
    applyDocumentThread(nextThread);
    setSelectedDocumentOpenMode("center");
    setSelectedDocumentId(targetDocumentId);
    setSelectedCanvasNodeId(targetDocumentId);
    setThreadExpanded(false);
    openGraphSurface(graphPath);
    collapseDocumentRightRailIfOpen();
  }

  async function openAssetInThreadFromSource(
    sourceDocumentID: string,
    sourceGraphPath: string,
    assetHref: string,
    assetName: string,
    kind: "pdf" | "text",
  ): Promise<void> {
    await flushPendingActiveEditorSave();
    clearSurfaceFeedback();

    const { baseThread, resolvedGraphPath } = resolveThreadBaseFromSource(sourceDocumentID, sourceGraphPath);

    const assetID = buildThreadAssetID(assetHref, kind);
    setThreadAssetsById((current) => ({
      ...current,
      [assetID]: {
        id: assetID,
        href: assetHref,
        name: assetName,
        graphPath: resolvedGraphPath,
        kind,
      },
    }));

    const nextThread = [...baseThread, { documentId: assetID, graphPath: resolvedGraphPath }];
    applyDocumentThread(nextThread);
    syncCenterThreadSelection("", sourceDocumentID === HOME_THREAD_DOCUMENT_ID ? "" : sourceDocumentID, null);
    setThreadExpanded(false);
    if (resolvedGraphPath !== "") {
      openGraphSurface(resolvedGraphPath);
    }

    collapseDocumentRightRailIfOpen();
  }

  async function activateThreadDocument(documentId: string, graphPath: string): Promise<void> {
    const threadAsset = threadAssetsById[documentId];
    if (threadAsset !== undefined) {
      await flushPendingActiveEditorSave();
      clearSurfaceFeedback();
      syncCenterThreadSelection("", "", null);
      if (graphPath.trim() !== "") {
        openGraphSurface(graphPath);
      }

      collapseDocumentRightRailIfOpen();
      return;
    }

    if (selectedDocumentOpenMode === "center" && activeThreadDocumentId === documentId) {
      return;
    }

    await flushPendingActiveEditorSave();
    clearSurfaceFeedback();

    if (documentId === HOME_THREAD_DOCUMENT_ID) {
      syncCenterThreadSelection("", "", null);
      startTransition(() => {
        setActiveSurface({ kind: "home" });
      });
      collapseDocumentRightRailIfOpen();
      return;
    }

    syncCenterThreadSelection(documentId, documentId, threadDocumentsById[documentId] ?? null);
    openGraphSurface(graphPath);
    collapseDocumentRightRailIfOpen();
  }

  async function closeDocumentThreadFrom(index: number): Promise<void> {
    await flushPendingActiveEditorSave();

    const nextThread = documentThreadRef.current.slice(0, index);
    clearSurfaceFeedback();
    applyDocumentThread(nextThread);
    setThreadExpanded(nextThread.length === 1);

    if (nextThread.length === 0) {
      setSelectedDocumentId("");
      setSelectedDocumentOpenMode("right-rail");
      syncSelectedDocumentState(null);
      return;
    }

    if (nextThread.length === 1 && nextThread[0]?.documentId === HOME_THREAD_DOCUMENT_ID) {
      clearDocumentThread();
      setSelectedDocumentId("");
      setSelectedDocumentOpenMode("right-rail");
      setSelectedCanvasNodeId("");
      syncSelectedDocumentState(null);
      startTransition(() => {
        setActiveSurface({ kind: "home" });
      });
      return;
    }

    const nextActive = nextThread[nextThread.length - 1];
    setSelectedDocumentOpenMode("center");
    setSelectedDocumentId(nextActive.documentId);
    setSelectedCanvasNodeId(nextActive.documentId);
    syncSelectedDocumentState(threadDocumentsById[nextActive.documentId] ?? null);
    startTransition(() => {
      setActiveSurface({ kind: "graph", graphPath: nextActive.graphPath });
    });
  }

  function toggleRightRailMaximized(): void {
    if (rightRailCollapsed) {
      return;
    }

    setRightRailMaximized((current) => !current);
  }

  function isPrimaryMouseButton(button: number): boolean {
    return button === 0;
  }

  function isAdditiveNodeSelection(event: Pick<React.MouseEvent, "shiftKey" | "ctrlKey" | "metaKey">): boolean {
    return event.shiftKey || event.ctrlKey || event.metaKey;
  }

  function handleGraphCanvasOverlayNodeClick(event: React.MouseEvent<HTMLDivElement>, nodeId: string): void {
    event.stopPropagation();
    setHoveredEdgeTooltip(null);
    setEdgeToolbar(null);
    if (isAdditiveNodeSelection(event)) {
      setShiftSelectedNodes((prev) => {
        if (prev.includes(nodeId)) {
          return prev.filter((id) => id !== nodeId);
        }
        if (prev.length > 0) {
          const firstType = graphCanvasNodes.find((n) => n.id === prev[0])?.data.type;
          if (firstType !== graphCanvasNodes.find((n) => n.id === nodeId)?.data.type) {
            return prev;
          }
        }
        return [...prev, nodeId];
      });
      return;
    }

    setSelectedCanvasNodeId(nodeId);
    setShiftSelectedNodes([]);
  }

  function handleGraphCanvasOverlayNodeDoubleClick(event: React.MouseEvent<HTMLDivElement>, nodeId: string): void {
    event.stopPropagation();
    handleOpenCanvasDocument(nodeId);
  }

  async function handleGraphCanvasNodeDescriptionSave(nodeId: string, description: string): Promise<void> {
    const currentNode = graphCanvasData?.nodes.find((node) => node.id === nodeId) ?? null;
    if (currentNode === null) {
      return;
    }

    const nextDescription = description.trim();
    if ((currentNode.description ?? "").trim() === nextDescription) {
      return;
    }

    try {
      const updatedDocument = await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(nodeId)}`, {
        method: "PUT",
        body: JSON.stringify({ description: nextDescription }),
      });

      setGraphCanvasData((current) => {
        if (current === null) {
          return current;
        }
        return {
          ...current,
          nodes: current.nodes.map((node) => {
            if (node.id !== updatedDocument.id) {
              return node;
            }
            return {
              ...node,
              type: updatedDocument.type,
              graph: updatedDocument.graph,
              title: updatedDocument.title,
              description: updatedDocument.description,
              path: updatedDocument.path,
              featureSlug: updatedDocument.featureSlug,
              tags: updatedDocument.tags,
              createdAt: updatedDocument.createdAt,
              updatedAt: updatedDocument.updatedAt,
            };
          }),
        };
      });

      if (selectedDocumentRef.current?.id === updatedDocument.id) {
        syncSelectedDocumentState(updatedDocument, { preserveFormState: false });
      }

      if (documentThreadRef.current.some((entry) => entry.documentId === updatedDocument.id)) {
        setThreadDocumentsById((current) => ({ ...current, [updatedDocument.id]: updatedDocument }));
      }
    } catch (mutationFailure) {
      setMutationError(toErrorMessage(mutationFailure));
    }
  }

  function startSidebarResize(
    event: React.MouseEvent<HTMLDivElement>,
    options: {
      startWidth: number;
      minWidth: number;
      maxWidth: number;
      direction: "left" | "right";
      setWidth: React.Dispatch<React.SetStateAction<number>>;
      setIsResizing: React.Dispatch<React.SetStateAction<boolean>>;
    },
  ): void {
    if (!isPrimaryMouseButton(event.button)) {
      return;
    }

    const startX = event.clientX;
    const { direction, maxWidth, minWidth, setIsResizing, setWidth, startWidth } = options;
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = direction === "left" ? startWidth + deltaX : startWidth - deltaX;
      setWidth(Math.min(Math.max(nextWidth, minWidth), maxWidth));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    event.preventDefault();
  }

  async function mutateEdge(
    method: "POST" | "DELETE" | "PATCH",
    payload: { fromId: string; toId: string; context?: string; relationships?: string[] },
  ): Promise<void> {
    try {
      setMutationError("");
      await requestJSON<DocumentResponse>("/api/links", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setGraphCanvasReloadToken((current) => current + 1);
    } catch (err) {
      setMutationError(toErrorMessage(err));
    }
  }

  useEffect(() => {
    const next = createHomeFormState(graphTree?.home ?? null);
    homeFormStateRef.current = next;
    setHomeFormState(next);
  }, [graphTree]);

  useEffect(() => {
    if (workspace !== null) {
      setTheme(normalizeAppearance(workspace.appearance));
    }
  }, [setTheme, workspace]);

  useEffect(() => {
    let cancelled = false;

    async function loadShell(): Promise<void> {
      try {
        setLoading(true);
        setError("");

        const snapshot = await loadWorkspaceSnapshot();
        if (cancelled) {
          return;
        }

        setWorkspace(snapshot.workspaceData);
        setGraphTree(snapshot.graphTreeData);
        setActiveSurface({ kind: "home" });
        void refreshCalendarDocumentList();
      } catch (loadError) {
        if (!cancelled) {
          setError(toErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadShell();

    return () => {
      cancelled = true;
    };
  }, [refreshCalendarDocumentList]);

  useEffect(() => {
    if (documentAutoSaveTimerRef.current !== null) {
      clearTimeout(documentAutoSaveTimerRef.current);
      documentAutoSaveTimerRef.current = null;
    }

    if (selectedDocumentId === "") {
      syncSelectedDocumentState(null);
      setPanelError("");
      return;
    }

    let cancelled = false;

    async function loadDocument(): Promise<void> {
      try {
        setPanelError("");
        const response = await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(selectedDocumentId)}`);
        if (!cancelled) {
          syncSelectedDocumentState(response);
        }
      } catch (loadError) {
        if (!cancelled) {
          syncSelectedDocumentState(null);
          setPanelError(toErrorMessage(loadError));
        }
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [selectedDocumentId, syncSelectedDocumentState]);

  useEffect(() => {
    let cancelled = false;

    async function loadSearch(): Promise<void> {
      if (!hasDeferredSearchFilter) {
        setSearchResults([]);
        setSearchError("");
        return;
      }

      try {
        setSearchError("");
        const response = await requestJSON<SearchResult[]>(buildSearchRequestPath({
          q: deferredSearchQuery,
          tag: deferredSearchTagQuery,
          title: deferredSearchTitleQuery,
          description: deferredSearchDescriptionQuery,
          content: deferredSearchContentQuery,
        }, 8));
        if (!cancelled) {
          setSearchResults(response);
        }
      } catch (loadError) {
        if (!cancelled) {
          setSearchResults([]);
          setSearchError(toErrorMessage(loadError));
        }
      }
    }

    void loadSearch();

    return () => {
      cancelled = true;
    };
  }, [
    deferredSearchContentQuery,
    deferredSearchDescriptionQuery,
    deferredSearchQuery,
    deferredSearchTagQuery,
    deferredSearchTitleQuery,
    hasDeferredSearchFilter,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function syncGraphCanvasLayout(): Promise<void> {
      if (graphCanvasData === null) {
        setGraphCanvasPositions({});
        setGraphCanvasUserPositions({});
        setGraphCanvasHorizontalPositions({});
        setGraphCanvasLayoutMode("user");
        return;
      }

      if (graphCanvasData.nodes.length === 0) {
        setGraphCanvasPositions({});
        setGraphCanvasUserPositions({});
        setGraphCanvasHorizontalPositions({});
        setGraphCanvasLayoutMode("user");
        return;
      }

      const serverPositions = graphCanvasPositionMap(graphCanvasData);
      const currentNodeIDs = new Set(graphCanvasData.nodes.map((node) => node.id));
      const preserveKnownPositions = (positions: Record<string, GraphCanvasPosition>): Record<string, GraphCanvasPosition> => {
        const next: Record<string, GraphCanvasPosition> = { ...serverPositions };
        for (const [documentId, position] of Object.entries(positions)) {
          if (currentNodeIDs.has(documentId)) {
            next[documentId] = position;
          }
        }
        return next;
      };

      if (graphCanvasLayoutModeRef.current === "horizontal") {
        const cachedHorizontal = graphCanvasHorizontalPositionsRef.current;
        if (Object.keys(cachedHorizontal).length > 0) {
          const nextPositions = preserveKnownPositions(cachedHorizontal);
          setGraphCanvasPositions(nextPositions);
          setGraphCanvasHorizontalPositions(nextPositions);
          setGraphCanvasLayoutMode("horizontal");
          return;
        }

        try {
          const nextPositions = await applyElkHorizontalLayout(graphCanvasData.nodes, graphCanvasData.edges);
          if (!cancelled) {
            const horizontalPositions = Object.keys(nextPositions).length > 0 ? nextPositions : serverPositions;
            setGraphCanvasPositions(horizontalPositions);
            setGraphCanvasHorizontalPositions(horizontalPositions);
            setGraphCanvasLayoutMode("horizontal");
          }
        } catch {
          if (!cancelled) {
            const fallbackPositions = serverPositions;
            setGraphCanvasPositions(fallbackPositions);
            setGraphCanvasHorizontalPositions(fallbackPositions);
            setGraphCanvasLayoutMode("horizontal");
          }
        }
        return;
      }

      const cachedUser = graphCanvasUserPositionsRef.current;
      if (Object.keys(cachedUser).length > 0) {
        const nextPositions = preserveKnownPositions(cachedUser);
        setGraphCanvasPositions(nextPositions);
        setGraphCanvasUserPositions(nextPositions);
        setGraphCanvasHorizontalPositions({});
        setGraphCanvasLayoutMode("user");
        return;
      }

      const hasPersistedPositions = graphCanvasData.nodes.some((node) => node.positionPersisted);
      if (hasPersistedPositions) {
        const nextPositions = serverPositions;
        setGraphCanvasPositions(nextPositions);
        setGraphCanvasUserPositions(nextPositions);
        setGraphCanvasHorizontalPositions({});
        setGraphCanvasLayoutMode("user");
        return;
      }

      try {
        const nextPositions = await applyElkHorizontalLayout(graphCanvasData.nodes, graphCanvasData.edges);
        if (!cancelled) {
          const initialPositions = Object.keys(nextPositions).length > 0 ? nextPositions : serverPositions;
          setGraphCanvasPositions(initialPositions);
          setGraphCanvasUserPositions(initialPositions);
          setGraphCanvasHorizontalPositions({});
          setGraphCanvasLayoutMode("user");
        }
      } catch {
        if (!cancelled) {
          const initialPositions = serverPositions;
          setGraphCanvasPositions(initialPositions);
          setGraphCanvasUserPositions(initialPositions);
          setGraphCanvasHorizontalPositions({});
          setGraphCanvasLayoutMode("user");
        }
      }
    }

    void syncGraphCanvasLayout();
    return () => {
      cancelled = true;
    };
  }, [graphCanvasData]);

  useEffect(() => {
    setGraphCanvasNodeSearchTerm("");
    setGraphCanvasNodeSearchIndex(0);
    setEdgeToolbar(null);

    if (selectedGraphPath === "") {
      setGraphCanvasData(null);
      setGraphCanvasLoading(false);
      setGraphCanvasError("");
      setGraphCanvasPositions({});
      setGraphCanvasUserPositions({});
      setGraphCanvasHorizontalPositions({});
      setGraphCanvasLayoutMode("user");
      setGraphCreateError("");
      setGraphCreatePendingType("");
      setSelectedCanvasNodeId("");
      return;
    }

    let cancelled = false;

    async function loadGraphCanvas(): Promise<void> {
      try {
        setGraphCanvasLoading(true);
        setGraphCanvasError("");

        const response = await requestJSON<GraphCanvasResponseWire>(`/api/graph-canvas?graph=${encodeURIComponent(selectedGraphPath)}`);
        if (cancelled) {
          return;
        }

        const normalized = normalizeGraphCanvasResponse(response);
        setGraphCanvasData(normalized);
        setSelectedCanvasNodeId((current) => (normalized.nodes.some((node) => node.id === current) ? current : ""));
      } catch (loadError) {
        if (!cancelled) {
          setGraphCanvasData(null);
          setGraphCanvasError(toErrorMessage(loadError));
          setSelectedCanvasNodeId("");
        }
      } finally {
        if (!cancelled) {
          setGraphCanvasLoading(false);
        }
      }
    }

    void loadGraphCanvas();

    return () => {
      cancelled = true;
    };
  }, [selectedGraphPath, graphCanvasReloadToken]);

  useEffect(() => {
    if (!graphCanvasNodeSearchHasMatches) {
      setGraphCanvasNodeSearchIndex(0);
      return;
    }

    if (graphCanvasNodeSearchIndex >= graphCanvasNodeSearchMatches.length) {
      setGraphCanvasNodeSearchIndex(0);
    }
  }, [graphCanvasNodeSearchHasMatches, graphCanvasNodeSearchIndex, graphCanvasNodeSearchMatches.length]);

  useEffect(() => {
    const shell = graphCanvasShellRef.current;
    if (shell === null) {
      return;
    }

    function handleCanvasPointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest("[data-edge-toolbar='true']") !== null) {
        return;
      }

      setEdgeToolbar(null);
    }

    shell.addEventListener("pointerdown", handleCanvasPointerDown);
    return () => {
      shell.removeEventListener("pointerdown", handleCanvasPointerDown);
    };
  }, [selectedGraphPath]);

  async function refreshShellViews(options?: { nextDocument?: DocumentResponse | null; nextDocumentId?: string; reloadCurrentDocument?: boolean }): Promise<void> {
    const snapshot = await loadWorkspaceSnapshot();
    setWorkspace(snapshot.workspaceData);
    setGraphTree(snapshot.graphTreeData);
    void refreshCalendarDocumentList();

    if (options && "nextDocument" in options) {
      syncSelectedDocumentState(options.nextDocument ?? null);
      setSelectedDocumentId(options.nextDocumentId ?? "");
    }

    if (options?.nextDocument !== undefined && options.nextDocument !== null) {
      startTransition(() => {
        setActiveSurface({ kind: "graph", graphPath: options.nextDocument?.graph ?? selectedGraphPath });
      });
      setSelectedCanvasNodeId(options.nextDocument.id);
    } else if (options?.reloadCurrentDocument && selectedDocumentId !== "") {
      try {
        const refreshedDocument = await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(selectedDocumentId)}`);
        syncSelectedDocumentState(refreshedDocument);
        setPanelError("");
      } catch (loadError) {
        syncSelectedDocumentState(null);
        setPanelError(toErrorMessage(loadError));
      }
    }

    if (activeSurface.kind === "graph") {
      const graphStillVisible = snapshot.graphTreeData.graphs.some((graphNode) => graphNode.graphPath === activeSurface.graphPath);
      if (!graphStillVisible) {
        startTransition(() => {
          setActiveSurface({ kind: "home" });
        });
        setGraphCanvasData(null);
        setGraphCanvasError("");
        setGraphCanvasPositions({});
        setSelectedCanvasNodeId("");
      } else {
        setGraphCanvasReloadToken((current) => current + 1);
      }
    }

    if (hasDeferredSearchFilter) {
      const response = await requestJSON<SearchResult[]>(buildSearchRequestPath({
        q: deferredSearchQuery,
        tag: deferredSearchTagQuery,
        title: deferredSearchTitleQuery,
        description: deferredSearchDescriptionQuery,
        content: deferredSearchContentQuery,
      }, 8));
      setSearchResults(response);
      setSearchError("");
    }
  }

  const calendarDocumentsForDisplay = useMemo((): CalendarDocumentResponse[] => {
    const documentsByID = new Map(calendarDocuments.map((document) => [document.id, document]));

    documentsByID.set("home", {
      id: "home",
      type: "home",
      graph: "",
      title: homeFormState.title,
      path: graphTree?.home.path ?? "data/home.md",
      body: homeFormState.body,
    });

    if (selectedDocumentId !== "") {
      const current = documentsByID.get(selectedDocumentId);
      documentsByID.set(selectedDocumentId, {
        id: selectedDocumentId,
        type: selectedDocument?.type ?? current?.type ?? "note",
        graph: selectedDocument?.graph ?? current?.graph ?? "",
        title: formState.title,
        path: selectedDocument?.path ?? current?.path ?? "",
        body: formState.body,
      });
    }

    return Array.from(documentsByID.values()).sort((left, right) => left.path.localeCompare(right.path));
  }, [calendarDocuments, formState.body, formState.title, graphTree?.home.path, homeFormState.body, homeFormState.title, selectedDocument, selectedDocumentId]);

  const handleSelectHomeRef = useRef<() => void>(() => {});
  const openDocumentInRightRailRef = useRef<(documentId: string, graphPath: string) => void>(() => {});

  function updateFormField(field: keyof DocumentFormState, value: string): void {
    setFormState((current) => {
      const next = { ...current, [field]: value };
      formStateRef.current = next;
      return next;
    });

    if (field === "links") {
      const allowed = new Set(splitList(value));
      setEditableLinkDetails((current) => {
        const next: Record<string, { context: string; linkType: string }> = {};
        for (const [nodeId, details] of Object.entries(current)) {
          if (allowed.has(nodeId)) {
            next[nodeId] = details;
          }
        }
        editableLinkDetailsRef.current = next;
        return next;
      });
    }

    if (documentAutoSaveTimerRef.current !== null) {
      clearTimeout(documentAutoSaveTimerRef.current);
    }
    documentAutoSaveTimerRef.current = window.setTimeout(() => {
      documentAutoSaveTimerRef.current = null;
      if (selectedDocumentRef.current !== null) {
        void handleSaveDocument(selectedDocumentRef.current, formStateRef.current);
      }
    }, 800);
  }

  function updateEditableLinkDetail(nodeId: string, field: "context" | "linkType", value: string): void {
    setEditableLinkDetails((current) => {
      const previous = current[nodeId] ?? { context: "", linkType: "" };
      const next = {
        ...current,
        [nodeId]: {
          ...previous,
          [field]: value,
        },
      };
      editableLinkDetailsRef.current = next;
      return next;
    });

    if (documentAutoSaveTimerRef.current !== null) {
      clearTimeout(documentAutoSaveTimerRef.current);
    }
    documentAutoSaveTimerRef.current = window.setTimeout(() => {
      documentAutoSaveTimerRef.current = null;
      if (selectedDocumentRef.current !== null) {
        void handleSaveDocument(selectedDocumentRef.current, formStateRef.current);
      }
    }, 800);
  }

  function addOutgoingLink(nodeId: string): void {
    const nextNodeID = nodeId.trim();
    if (nextNodeID === "" || selectedDocumentRef.current === null) {
      return;
    }

    if (nextNodeID === selectedDocumentRef.current.id) {
      setMutationError("Cannot link a document to itself.");
      return;
    }

    const currentLinkIDs = splitList(formStateRef.current.links);
    if (currentLinkIDs.includes(nextNodeID)) {
      return;
    }

    const nextLinkIDs = [...currentLinkIDs, nextNodeID];
    const nextState = { ...formStateRef.current, links: nextLinkIDs.join("\n") };
    formStateRef.current = nextState;
    setFormState(nextState);

    setEditableLinkDetails((current) => {
      const next = {
        ...current,
        [nextNodeID]: current[nextNodeID] ?? { context: "", linkType: "" },
      };
      editableLinkDetailsRef.current = next;
      return next;
    });

    if (documentAutoSaveTimerRef.current !== null) {
      clearTimeout(documentAutoSaveTimerRef.current);
    }
    documentAutoSaveTimerRef.current = window.setTimeout(() => {
      documentAutoSaveTimerRef.current = null;
      if (selectedDocumentRef.current !== null) {
        void handleSaveDocument(selectedDocumentRef.current, formStateRef.current);
      }
    }, 800);
  }

  function removeOutgoingLink(nodeId: string): void {
    const currentLinkIDs = splitList(formStateRef.current.links);
    if (!currentLinkIDs.includes(nodeId)) {
      return;
    }

    const nextLinkIDs = currentLinkIDs.filter((id) => id !== nodeId);
    const nextState = { ...formStateRef.current, links: nextLinkIDs.join("\n") };
    formStateRef.current = nextState;
    setFormState(nextState);

    setEditableLinkDetails((current) => {
      const next = { ...current };
      delete next[nodeId];
      editableLinkDetailsRef.current = next;
      return next;
    });

    if (documentAutoSaveTimerRef.current !== null) {
      clearTimeout(documentAutoSaveTimerRef.current);
    }
    documentAutoSaveTimerRef.current = window.setTimeout(() => {
      documentAutoSaveTimerRef.current = null;
      if (selectedDocumentRef.current !== null) {
        void handleSaveDocument(selectedDocumentRef.current, formStateRef.current);
      }
    }, 800);
  }

  function updateHomeFormField(field: keyof HomeFormState, value: string): void {
    setHomeFormState((current) => {
      const next = { ...current, [field]: value };
      homeFormStateRef.current = next;
      return next;
    });
    if (homeAutoSaveTimerRef.current !== null) {
      clearTimeout(homeAutoSaveTimerRef.current);
    }
    homeAutoSaveTimerRef.current = window.setTimeout(() => {
      homeAutoSaveTimerRef.current = null;
      void handleSaveHomeContent(homeFormStateRef.current);
    }, 800);
  }

  function clearContextPanel(): void {
    if (documentAutoSaveTimerRef.current !== null) {
      clearTimeout(documentAutoSaveTimerRef.current);
      documentAutoSaveTimerRef.current = null;
    }
    setSelectedDocumentId("");
    setSelectedDocumentOpenMode("right-rail");
    clearDocumentThread();
    syncSelectedDocumentState(null);
    setDeleteDialogTarget(null);
    setDeleteDialogOpen(false);
    clearSurfaceFeedback();
  }

  async function handleCloseContextPanel(): Promise<void> {
    await flushPendingDocumentSave();
    clearContextPanel();
  }

  function openDeleteDialog(target: DeleteDialogState): void {
    clearMutationFeedback();
    setDeleteDialogTarget(target);
    setDeleteDialogOpen(true);
  }

  function openDeleteDialogForSelectedDocument(): void {
    if (selectedDocument === null) {
      return;
    }

    openDeleteDialog({
      id: selectedDocument.id,
      type: selectedDocument.type,
      title: selectedDocument.title,
      path: selectedDocument.path,
      graphPath: selectedDocument.graph,
    });
  }

  async function handleSelectHome(): Promise<void> {
    await flushPendingActiveEditorSave();
    clearContextPanel();
    setGraphCanvasError("");
    setGraphCreateError("");
    setSelectedCanvasNodeId("");
    startTransition(() => {
      setActiveSurface({ kind: "home" });
    });
  }

  async function handleSelectGraph(graphPath: string): Promise<void> {
    await flushPendingActiveEditorSave();
    clearContextPanel();
    setGraphCanvasError("");
    setGraphCreateError("");
    setSelectedCanvasNodeId("");
    startTransition(() => {
      setActiveSurface({ kind: "graph", graphPath });
    });
  }

  function resolveDocumentGraphPath(documentId: string, fallbackGraphPath: string): string {
    return graphCanvasData?.nodes.find((node) => node.id === documentId)?.graph
      ?? documentGraphById.get(documentId)
      ?? fallbackGraphPath;
  }

  function handleOpenCanvasDocument(documentId: string): void {
    const graphPath = resolveDocumentGraphPath(documentId, selectedGraphPath);
    if (graphPath === "") {
      return;
    }
    void openDocumentInCenter(documentId, graphPath);
  }

  function handleSelectedNodeDocumentButtonClick(): void {
    if (selectedCanvasNode !== null && activeThreadDocumentId !== selectedCanvasNode.id) {
      const graphPath = resolveDocumentGraphPath(selectedCanvasNode.id, selectedGraphPath);
      if (graphPath === "") {
        return;
      }
      void openDocumentInCenter(selectedCanvasNode.id, graphPath);
      return;
    }

    if (documentThreadRef.current.length > 0) {
      void closeDocumentThreadFrom(documentThreadRef.current.length);
      return;
    }

    toggleRightPanel("document");
  }

  function updateGraphCanvasNodePosition(documentId: string, position: GraphCanvasPosition): void {
    setGraphCanvasPositions((current) => ({ ...current, [documentId]: position }));
    setGraphCanvasUserPositions((current) => ({ ...current, [documentId]: position }));

    if (graphCanvasLayoutMode === "horizontal") {
      setGraphCanvasLayoutMode("user");
    }
  }

  function clearGraphCanvasIntersections(): void {
    setGraphCanvasIntersectingNodeIds([]);
    setGraphCanvasIntersectionSourceId(null);
  }

  function updateGraphCanvasIntersections(documentId: string, position: GraphCanvasPosition): void {
    const candidateNodes = graphCanvasNodesRef.current;
    const candidateNode = candidateNodes.find((node) => node.id === documentId);
    if (candidateNode === undefined) {
      clearGraphCanvasIntersections();
      return;
    }

    const flow = graphCanvasFlowRef.current as (ReactFlowInstance<GraphCanvasFlowNodeData> & {
      getIntersectingNodes?: (node: Node<GraphCanvasFlowNodeData>) => Node<GraphCanvasFlowNodeData>[];
      getNode?: (id: string) => Node<GraphCanvasFlowNodeData> | undefined;
    }) | null;
    const draftNode = {
      ...(flow?.getNode?.(documentId) ?? candidateNode),
      position,
      positionAbsolute: position,
      width: candidateNode.width,
      height: candidateNode.height,
    } as Node<GraphCanvasFlowNodeData>;

    const fallbackIntersectingNodeIds = intersectingGraphCanvasNodeIds(candidateNodes, documentId, position);
    const helperIntersections = flow?.getIntersectingNodes?.(draftNode) ?? null;
    const helperIntersectingNodeIds = helperIntersections?.filter((node) => node.id !== documentId).map((node) => node.id) ?? [];
    const intersectingNodeIds = helperIntersectingNodeIds.length > 0
      ? helperIntersectingNodeIds
      : fallbackIntersectingNodeIds;

    setGraphCanvasIntersectionSourceId(intersectingNodeIds.length > 0 ? documentId : null);
    setGraphCanvasIntersectingNodeIds(intersectingNodeIds);
  }

  async function persistGraphCanvasPositions(positions: GraphLayoutPositionPayload[]): Promise<void> {
    if (selectedGraphPath === "" || positions.length === 0) {
      return;
    }

    const response = await requestJSON<GraphLayoutResponse>("/api/graph-layout", {
      method: "PUT",
      body: JSON.stringify({
        graph: selectedGraphPath,
        positions,
      }),
    });

    if (response.positions.length === 0) {
      return;
    }

    const persistedById = new Map(response.positions.map((item) => [item.documentId, { x: item.x, y: item.y }]));

    setGraphCanvasPositions((current) => {
      const next = { ...current };
      for (const [documentId, position] of persistedById.entries()) {
        next[documentId] = position;
      }
      return next;
    });

    setGraphCanvasUserPositions((current) => {
      const next = { ...current };
      for (const [documentId, position] of persistedById.entries()) {
        next[documentId] = position;
      }
      return next;
    });

    setGraphCanvasData((current) => {
      if (current === null) {
        return current;
      }

      return {
        ...current,
        nodes: current.nodes.map((node) => {
          const persisted = persistedById.get(node.id);
          if (persisted === undefined) {
            return node;
          }

          return {
            ...node,
            position: persisted,
            positionPersisted: true,
          };
        }),
      };
    });
  }

  async function persistGraphCanvasViewport(viewport: { x: number; y: number; zoom: number }): Promise<void> {
    if (selectedGraphPath === "") {
      return;
    }

    const response = await requestJSON<GraphLayoutResponse>("/api/graph-layout", {
      method: "PUT",
      body: JSON.stringify({
        graph: selectedGraphPath,
        positions: [],
        viewport,
      }),
    });

    if (response.viewport === undefined) {
      return;
    }

    setGraphCanvasData((current) => {
      if (current === null) {
        return current;
      }

      return {
        ...current,
        viewport: response.viewport ?? null,
      };
    });
  }

  async function persistGraphCanvasPosition(documentId: string, position: GraphCanvasPosition): Promise<void> {
    try {
      setGraphCanvasError("");
      const snapshotPositions = Object.entries({
        ...graphCanvasPositionsRef.current,
        [documentId]: position,
      }).map(([currentDocumentId, currentPosition]) => ({
        documentId: currentDocumentId,
        x: currentPosition.x,
        y: currentPosition.y,
      }));
      const next = snapshotPositions.length > 0 ? snapshotPositions : [{ documentId, x: position.x, y: position.y }];
      await persistGraphCanvasPositions(next);
    } catch (saveError) {
      setGraphCanvasError(toErrorMessage(saveError));
    }
  }

  async function handleToggleGraphCanvasLayout(): Promise<void> {
    if (graphCanvasData === null || graphCanvasData.nodes.length === 0) {
      return;
    }

    if (graphCanvasLayoutMode === "horizontal") {
      const nextUserPositions = Object.keys(graphCanvasUserPositions).length > 0
        ? graphCanvasUserPositions
        : graphCanvasPositionMap(graphCanvasData);
      setGraphCanvasPositions(nextUserPositions);
      setGraphCanvasLayoutMode("user");
      return;
    }

    try {
      setGraphCanvasError("");
      setGraphCanvasResettingLayout(true);
      const cachedHorizontal = graphCanvasHorizontalPositions;
      const nextPositions = Object.keys(cachedHorizontal).length > 0
        ? cachedHorizontal
        : await applyElkHorizontalLayout(graphCanvasData.nodes, graphCanvasData.edges);
      if (Object.keys(nextPositions).length === 0) {
        return;
      }

      setGraphCanvasPositions(nextPositions);
      setGraphCanvasHorizontalPositions(nextPositions);
      setGraphCanvasLayoutMode("horizontal");
    } catch (layoutError) {
      setGraphCanvasError(toErrorMessage(layoutError));
    } finally {
      setGraphCanvasResettingLayout(false);
    }
  }

  function focusGraphCanvasSearchMatch(nextIndex: number): void {
    if (!graphCanvasNodeSearchHasMatches) {
      return;
    }

    const normalizedIndex = ((nextIndex % graphCanvasNodeSearchMatches.length) + graphCanvasNodeSearchMatches.length)
      % graphCanvasNodeSearchMatches.length;
    const targetNode = graphCanvasNodeSearchMatches[normalizedIndex];
    if (targetNode === undefined) {
      return;
    }

    setGraphCanvasNodeSearchIndex(normalizedIndex);
    setSelectedCanvasNodeId(targetNode.id);
    setSelectedEdgeId("");

    const centerX = targetNode.position.x + (targetNode.width ?? 0) / 2;
    const centerY = targetNode.position.y + (targetNode.height ?? 0) / 2;
    const flow = graphCanvasFlowRef.current as (ReactFlowInstance<GraphCanvasFlowNodeData> & {
      setCenter?: (x: number, y: number, options?: { zoom?: number; duration?: number }) => void;
    }) | null;
    flow?.setCenter?.(centerX, centerY, { zoom: rfViewport.zoom, duration: 220 });
  }

  function handleGraphCanvasSearchNext(): void {
    if (!graphCanvasNodeSearchHasMatches) {
      return;
    }

    if (graphCanvasNodeSearchSelectedIndex < 0) {
      focusGraphCanvasSearchMatch(0);
      return;
    }

    focusGraphCanvasSearchMatch(graphCanvasNodeSearchSelectedIndex + 1);
  }

  function handleGraphCanvasSearchPrevious(): void {
    if (!graphCanvasNodeSearchHasMatches) {
      return;
    }

    if (graphCanvasNodeSearchSelectedIndex < 0) {
      focusGraphCanvasSearchMatch(graphCanvasNodeSearchMatches.length - 1);
      return;
    }

    focusGraphCanvasSearchMatch(graphCanvasNodeSearchSelectedIndex - 1);
  }

  function handleGraphCanvasNodesChange(changes: NodeChange<Node<GraphCanvasFlowNodeData>>[]): void {
    setGraphCanvasPositions((current) => {
      const currentNodes = graphCanvasNodes.map((node) => ({ ...node, position: current[node.id] ?? node.position }));
      const nextNodes = applyNodeChanges(changes, currentNodes);
      return Object.fromEntries(nextNodes.map((node) => [node.id, node.position]));
    });
  }

  function handleSelectDocument(documentId: string, graphPath: string): void {
    void openDocumentInCenter(documentId, graphPath);
  }

  function handleInspectDocument(documentId: string, graphPath: string): void {
    void openDocumentInRightRail(documentId, graphPath);
  }

  function handleInlineReferenceOpen(sourceDocumentId: string, documentId: string, graphPath: string, openMode: DocumentOpenMode): void {
    const nextGraphPath = graphPath || documentGraphById.get(documentId) || selectedGraphPath;
    if (nextGraphPath === "") {
      return;
    }

    if (openMode === "center" || sourceDocumentId !== "") {
      void openDocumentInThreadFromSource(sourceDocumentId, documentId, nextGraphPath);
      return;
    }

    void openDocumentInRightRail(documentId, nextGraphPath);
  }

  handleSelectHomeRef.current = () => {
    void handleSelectHome();
  };
  openDocumentInRightRailRef.current = (documentId: string, graphPath: string) => {
    void openDocumentInRightRail(documentId, graphPath);
  };

  const handleRightRailSearchResultNavigate = useCallback((result: SearchResult): void => {
    if (result.type === "home") {
      handleSelectHomeRef.current();
      return;
    }

    openDocumentInRightRailRef.current(result.id, result.graph);
  }, []);

  const handleRightRailCalendarDocumentOpen = useCallback((document: CalendarDocumentResponse): void => {
    if (document.type === "home") {
      handleSelectHomeRef.current();
      return;
    }

    openDocumentInRightRailRef.current(document.id, document.graph);
  }, []);

  function handleTOCNavigate(itemId: string): void {
    if (activeSurface.kind === "home" || selectedDocument !== null) {
      setEditorScrollTarget(itemId);
      return;
    }

    const element = document.getElementById(itemId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function updateWorkspaceSettings(payload: {
    appearance?: "light" | "dark" | "system";
    panelWidths?: {
      leftRatio: number;
      rightRatio: number;
      documentTOCRatio: number;
    };
  }): Promise<WorkspaceResponse> {
    return requestJSON<WorkspaceResponse>("/api/workspace", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async function persistDocumentTOCRatio(nextRatio: number): Promise<void> {
    if (workspace === null) {
      return;
    }

    try {
      const updatedWorkspace = await updateWorkspaceSettings({
        panelWidths: {
          leftRatio: workspace.panelWidths.leftRatio,
          rightRatio: workspace.panelWidths.rightRatio,
          documentTOCRatio: nextRatio,
        },
      });
      setWorkspace(updatedWorkspace);
    } catch (saveError) {
      setError(toErrorMessage(saveError));
    }
  }

  async function handleAppearanceChange(nextAppearance: "light" | "dark" | "system"): Promise<void> {
    const previousAppearance = theme;
    setTheme(nextAppearance);

    try {
      const updatedWorkspace = await updateWorkspaceSettings({ appearance: nextAppearance });
      setWorkspace(updatedWorkspace);
      setError("");
    } catch (saveError) {
      setTheme(previousAppearance);
      setError(toErrorMessage(saveError));
    }
  }

  async function handleRebuildIndex(): Promise<void> {
    try {
      setRebuildingIndex(true);
      setMutationError("");
      setMutationSuccess("");
      await requestJSON<{ rebuilt: boolean }>("/api/index/rebuild", {
        method: "POST",
      });
      await refreshShellViews({ reloadCurrentDocument: true });
      setMutationSuccess("Index refreshed.");
    } catch (rebuildError) {
      setMutationError(toErrorMessage(rebuildError));
    } finally {
      setRebuildingIndex(false);
    }
  }

  async function handleWorkspaceSelection(nextWorkspacePath: string): Promise<void> {
    const currentWorkspacePath = workspace?.workspacePath ?? "";
    const normalizedNextPath = nextWorkspacePath.trim();
    if (normalizedNextPath === "" || normalizedNextPath === currentWorkspacePath) {
      return;
    }

    try {
      setMutationError("");
      setSwitchingWorkspace(true);
      await selectWorkspace(normalizedNextPath);
      const snapshot = await loadWorkspaceSnapshot();
      setWorkspace(snapshot.workspaceData);
      setGraphTree(snapshot.graphTreeData);
      setSelectedDocumentId("");
      setActiveSurface({ kind: "home" });
      setGraphCanvasData(null);
      setGraphCanvasReloadToken((current) => current + 1);
      void refreshCalendarDocumentList();
    } catch (err) {
      setMutationError(toErrorMessage(err));
    } finally {
      setSwitchingWorkspace(false);
    }
  }

  async function handleWorkspaceDeregister(workspacePath: string): Promise<void> {
    if (workspace === null || !workspace.workspaceSelectionEnabled) {
      return;
    }

    const normalizedWorkspacePath = workspacePath.trim();
    if (normalizedWorkspacePath === "") {
      return;
    }

    const confirmed = window.confirm(
      `De-register local workspace?\n\n${normalizedWorkspacePath}\n\nThis removes it from the global workspace list only. Files are not deleted.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setMutationError("");
      setSwitchingWorkspace(true);
      await deregisterLocalWorkspace(normalizedWorkspacePath);
      const snapshot = await loadWorkspaceSnapshot();
      setWorkspace(snapshot.workspaceData);
      setGraphTree(snapshot.graphTreeData);
      setSelectedDocumentId("");
      setActiveSurface({ kind: "home" });
      setGraphCanvasData(null);
      setGraphCanvasReloadToken((current) => current + 1);
      setMutationSuccess("Local workspace de-registered.");
      void refreshCalendarDocumentList();
    } catch (err) {
      setMutationError(toErrorMessage(err));
    } finally {
      setSwitchingWorkspace(false);
    }
  }

  function beginDocumentTOCResize(event: React.MouseEvent<HTMLDivElement>, layout: HTMLDivElement | null): void {
    if (!isPrimaryMouseButton(event.button) || layout === null) {
      return;
    }

    const layoutBounds = layout.getBoundingClientRect();
    if (layoutBounds.width <= 0) {
      return;
    }

    let nextRatio = documentTOCRatio;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const tocWidth = layoutBounds.right - moveEvent.clientX;
      nextRatio = clampDocumentTOCRatio(tocWidth / layoutBounds.width);
      setDocumentTOCRatio(nextRatio);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      void persistDocumentTOCRatio(nextRatio);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    event.preventDefault();
  }

  function handleDocumentTOCResizeMouseDown(event: React.MouseEvent<HTMLDivElement>): void {
    beginDocumentTOCResize(event, centerDocumentLayoutRef.current);
  }

  function beginThreadPanelResize(event: React.MouseEvent<HTMLDivElement>, panel: HTMLElement | null, panelKey: string): void {
    if (!isPrimaryMouseButton(event.button) || panel === null) {
      return;
    }

    const bounds = panel.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }

    const startX = event.clientX;
    const startWidth = bounds.width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setThreadPanelWidths((prev) => ({ ...prev, [panelKey]: clampThreadPanelWidth(startWidth + deltaX) }));
    };

    const handleMouseUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    event.preventDefault();
    event.stopPropagation();
  }

  function handleHomeDocumentTOCResizeMouseDown(event: React.MouseEvent<HTMLDivElement>): void {
    beginDocumentTOCResize(event, homeDocumentLayoutRef.current);
  }

  function handleRightRailDocumentTOCResizeMouseDown(event: React.MouseEvent<HTMLDivElement>): void {
    beginDocumentTOCResize(event, rightRailDocumentLayoutRef.current);
  }

  function handleCreateGraphDocument(type: GraphCreateType): void {
    if (selectedGraphPath === "") {
      return;
    }
    setCreateNodeDialog({ type, graphPath: selectedGraphPath, origin: "canvas" });
    setCreateNodeFileName("");
    setCreateNodeFileNameError("");
  }

  async function handleGraphCanvasFilesDrop(files: FileList | File[]): Promise<void> {
    if (selectedGraphPath === "") {
      return;
    }

    try {
      clearMutationFeedback();
      const result = await uploadGraphFiles(selectedGraphPath, files);
      if (result.created.length > 0) {
        const firstCreated = result.created[0];
        setSelectedDocumentOpenMode("right-rail");
        setRightPanelTab("document");
        setRightRailCollapsed(false);
        await refreshShellViews({ nextDocument: firstCreated, nextDocumentId: firstCreated.id });
        setSelectedCanvasNodeId(firstCreated.id);

        const failureCount = result.failed?.length ?? 0;
        if (failureCount > 0) {
          setMutationSuccess(`Imported ${result.created.length} files with ${failureCount} skipped.`);
        } else {
          setMutationSuccess(`Imported ${result.created.length} files into ${selectedGraphPath}.`);
        }
      }

      if ((result.failed?.length ?? 0) > 0 && result.created.length === 0) {
        setMutationError(result.failed?.[0]?.error ?? "File import failed.");
      }
    } catch (dropError) {
      setMutationError(toErrorMessage(dropError));
    }
  }

  async function handleSidebarCreateGraph(name: string): Promise<void> {
    try {
      await requestJSON<{ name: string }>("/api/graphs", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      const snapshot = await loadWorkspaceSnapshot();
      setGraphTree(snapshot.graphTreeData);
    } catch (err) {
      setMutationError(toErrorMessage(err));
    }
  }

  async function handleSidebarSetGraphColor(graphPath: string, color: string | null): Promise<void> {
    try {
      clearMutationFeedback();
      await requestJSON<{ name: string; color?: string }>(`/api/graphs/${encodeURIComponent(graphPath)}/color`, {
        method: "PUT",
        body: JSON.stringify({ color: color ?? "" }),
      });

      const snapshot = await loadWorkspaceSnapshot();
      setGraphTree(snapshot.graphTreeData);
    } catch (err) {
      setMutationError(toErrorMessage(err));
    }
  }

  function handleSidebarCreateNode(graphPath: string, type: "note" | "task" | "command" = "note"): void {
    setCreateNodeDialog({ type, graphPath, origin: "sidebar" });
    setCreateNodeFileName("");
    setCreateNodeFileNameError("");
  }

  function handleSidebarRenameGraph(graphPath: string): void {
    clearMutationFeedback();
    setRenameDialog({ kind: "graph", graphPath });
    setRenameValue(graphPath);
    setRenameError("");
  }

  function handleSidebarRenameNode(documentId: string, fileName: string): void {
    clearMutationFeedback();
    setRenameDialog({ kind: "node", documentId, fileName });
    setRenameValue(stripMarkdownExtension(fileName));
    setRenameError("");
  }

  function handleSidebarDeleteNode(file: GraphTreeFileData, graphPath: string): void {
    openDeleteDialog({
      id: file.id,
      type: file.type,
      title: file.title,
      path: file.path,
      graphPath,
    });
  }

  async function handleSidebarMoveNode(file: GraphTreeFileData, sourceGraphPath: string, targetGraphPath: string): Promise<void> {
    if (sourceGraphPath === targetGraphPath) {
      return;
    }

    try {
      clearMutationFeedback();
      await flushPendingActiveEditorSave();

      const updatedDocument = await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(file.id)}`, {
        method: "PUT",
        body: JSON.stringify({ graph: targetGraphPath }),
      });

      if (selectedDocumentId === updatedDocument.id) {
        await refreshShellViews({ nextDocument: updatedDocument, nextDocumentId: updatedDocument.id });
      } else {
        await refreshShellViews();
      }

      setMutationSuccess(`${formatDocumentType(updatedDocument.type)} moved to ${targetGraphPath}.`);
    } catch (moveFailure) {
      setMutationError(toErrorMessage(moveFailure));
    }
  }

  async function handleConfirmCreateNode(): Promise<void> {
    if (createNodeDialog === null) {
      return;
    }
    const trimmed = createNodeFileName.trim();
    if (trimmed === "") {
      setCreateNodeFileNameError("File name is required.");
      return;
    }
    if (!isValidDocumentFileName(trimmed)) {
      setCreateNodeFileNameError("Use only letters, numbers, hyphens, underscores, dots, and slashes.");
      return;
    }
    const { type, graphPath, origin } = createNodeDialog;
    setCreateNodeDialog(null);
    try {
      setGraphCreatePendingType(type);
      setGraphCreateError("");
      const createdDocument = await requestJSON<DocumentResponse>("/api/documents", {
        method: "POST",
        body: JSON.stringify(createGraphDocumentPayload(type, graphPath, trimmed)),
      });
      setSelectedDocumentOpenMode("right-rail");
      setRightPanelTab("document");
      setRightRailCollapsed(false);
      await refreshShellViews({ nextDocument: createdDocument, nextDocumentId: createdDocument.id });
      setSelectedCanvasNodeId(createdDocument.id);
      if (origin === "canvas") {
        setMutationError("");
        setMutationSuccess(`${formatDocumentType(createdDocument.type)} created.`);
      }
    } catch (createError) {
      setGraphCreateError(toErrorMessage(createError));
    } finally {
      setGraphCreatePendingType("");
    }
  }

  async function handleConfirmRename(): Promise<void> {
    if (renameDialog === null || renamePending) {
      return;
    }

    const trimmed = renameValue.trim();
    if (trimmed === "") {
      setRenameError(renameDialog.kind === "graph" ? "Graph name is required." : "File name is required.");
      return;
    }

    if (renameDialog.kind === "graph") {
      if (trimmed === renameDialog.graphPath) {
        setRenameError("Graph name must change.");
        return;
      }
    } else {
      if (!isValidDocumentFileName(trimmed)) {
        setRenameError("Use only letters, numbers, hyphens, underscores, dots, and slashes.");
        return;
      }
      if (stripMarkdownExtension(renameDialog.fileName) === trimmed) {
        setRenameError("File name must change.");
        return;
      }
    }

    setRenamePending(true);
    try {
      if (renameDialog.kind === "graph") {
        await requestJSON<{ name: string }>(`/api/graphs/${encodeURIComponent(renameDialog.graphPath)}`, {
          method: "PATCH",
          body: JSON.stringify({ name: trimmed }),
        });

        const selectedDocumentGraphPath = selectedDocument?.graph ?? documentGraphById.get(selectedDocumentId) ?? "";
        const selectedDocumentAffected =
          selectedDocumentId !== "" &&
          (selectedDocumentGraphPath === renameDialog.graphPath || selectedDocumentGraphPath.startsWith(renameDialog.graphPath + "/"));
        const refreshedSelectedDocument = selectedDocumentAffected
          ? await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(selectedDocumentId)}`)
          : undefined;

        setRenameDialog(null);
        await refreshShellViews(refreshedSelectedDocument !== undefined
          ? { nextDocument: refreshedSelectedDocument, nextDocumentId: refreshedSelectedDocument.id }
          : undefined);

        if (activeSurface.kind === "graph") {
          const nextGraphPath = remapGraphPath(activeSurface.graphPath, renameDialog.graphPath, trimmed);
          if (nextGraphPath !== activeSurface.graphPath) {
            startTransition(() => setActiveSurface({ kind: "graph", graphPath: nextGraphPath }));
          }
        }

        setMutationError("");
        setMutationSuccess(`Graph renamed to ${trimmed}.`);
      } else {
        const updatedDocument = await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(renameDialog.documentId)}`, {
          method: "PUT",
          body: JSON.stringify({ fileName: trimmed }),
        });

        setRenameDialog(null);
        if (selectedDocumentId === updatedDocument.id) {
          await refreshShellViews({ nextDocument: updatedDocument, nextDocumentId: updatedDocument.id });
        } else {
          await refreshShellViews();
        }

        setMutationError("");
        setMutationSuccess(`${formatDocumentType(updatedDocument.type)} renamed to ${fileNameFromPath(updatedDocument.path)}.`);
      }
    } catch (renameFailure) {
      setRenameError(toErrorMessage(renameFailure));
    } finally {
      setRenamePending(false);
    }
  }

  async function handleSidebarDeleteGraph(graphPath: string): Promise<void> {
    try {
      await requestJSON<{ deleted: boolean }>(`/api/graphs/${encodeURIComponent(graphPath)}`, {
        method: "DELETE",
      });
      const snapshot = await loadWorkspaceSnapshot();
      setGraphTree(snapshot.graphTreeData);
      if (activeSurface.kind === "graph" && (activeSurface.graphPath === graphPath || activeSurface.graphPath.startsWith(graphPath + "/"))) {
        startTransition(() => setActiveSurface({ kind: "home" }));
        setGraphCanvasData(null);
        setSelectedCanvasNodeId("");
        setSelectedDocumentId("");
        syncSelectedDocumentState(null);
      }
    } catch (err) {
      setMutationError(toErrorMessage(err));
    }
  }

  function handleGraphCanvasOverlayPointerDown(event: React.PointerEvent<HTMLDivElement>, documentId: string): void {
    if (!isPrimaryMouseButton(event.button)) {
      return;
    }

    // Cmd/Ctrl/Shift click is selection-only and should not start drag handling.
    if (isAdditiveNodeSelection(event)) {
      return;
    }

    const shell = graphCanvasShellRef.current;
    if (shell === null) {
      return;
    }

    const node = graphCanvasNodes.find((candidate) => candidate.id === documentId);
    if (node === undefined) {
      return;
    }

    const shellBounds = shell.getBoundingClientRect();
    const position = graphCanvasOverlayPosition(node);
    const { x: vpX, y: vpY, zoom } = rfViewport;
    const screenX = position.x * zoom + vpX;
    const screenY = position.y * zoom + vpY;
    graphCanvasDragRef.current = {
      documentId,
      offsetX: event.clientX - shellBounds.left - screenX,
      offsetY: event.clientY - shellBounds.top - screenY,
      shellLeft: shellBounds.left,
      shellTop: shellBounds.top,
      moved: false,
    };
    event.stopPropagation();
    event.preventDefault();

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const dragState = graphCanvasDragRef.current;
      if (dragState === null) {
        return;
      }

      const nextScreenX = pointerEvent.clientX - dragState.shellLeft - dragState.offsetX;
      const nextScreenY = pointerEvent.clientY - dragState.shellTop - dragState.offsetY;
      const nextX = (nextScreenX - vpX) / zoom;
      const nextY = (nextScreenY - vpY) / zoom;
      if (!dragState.moved && (Math.abs(nextX - position.x) > 3 || Math.abs(nextY - position.y) > 3)) {
        dragState.moved = true;
      }

      const nextPosition = {
        x: nextX,
        y: nextY,
      };
      if (dragState.moved) {
        updateGraphCanvasNodePosition(dragState.documentId, nextPosition);
        updateGraphCanvasIntersections(dragState.documentId, nextPosition);
      }
    };

    const handlePointerUp = (pointerEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      const dragState = graphCanvasDragRef.current;
      graphCanvasDragRef.current = null;
      if (dragState === null || !dragState.moved) {
        return;
      }

      const nextPosition = {
        x: (pointerEvent.clientX - dragState.shellLeft - dragState.offsetX - vpX) / zoom,
        y: (pointerEvent.clientY - dragState.shellTop - dragState.offsetY - vpY) / zoom,
      };
      updateGraphCanvasNodePosition(dragState.documentId, nextPosition);
      clearGraphCanvasIntersections();
      void persistGraphCanvasPosition(dragState.documentId, nextPosition);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleLeftSidebarMouseDown(event: React.MouseEvent<HTMLDivElement>): void {
    startSidebarResize(event, {
      startWidth: leftSidebarWidth,
      minWidth: 160,
      maxWidth: 520,
      direction: "left",
      setWidth: setLeftSidebarWidth,
      setIsResizing: setIsResizingLeft,
    });
  }

  function handleRightSidebarMouseDown(event: React.MouseEvent<HTMLDivElement>): void {
    startSidebarResize(event, {
      startWidth: rightSidebarWidth,
      minWidth: 224,
      maxWidth: 640,
      direction: "right",
      setWidth: setRightSidebarWidth,
      setIsResizing: setIsResizingRight,
    });
  }

  async function handleStopGUI(): Promise<void> {
    try {
      setStoppingGUI(true);
      await requestJSON<{ stopping: boolean }>("/api/gui/stop", { method: "POST" });
    } catch (stopError) {
      setError(toErrorMessage(stopError));
    } finally {
      setStoppingGUI(false);
    }
  }

  async function handleSaveDocument(doc: DocumentResponse, state: DocumentFormState): Promise<void> {
    const savePromise = (async () => {
      setSavingDocument(true);
      setMutationError("");

      try {
        const existingLinksByNode = new Map((selectedDocumentRef.current?.links ?? []).map((link) => [link.node, link]));
        const currentEditableLinks = editableLinkDetailsRef.current;
        const payload: Record<string, unknown> = {
          title: state.title,
          description: state.description,
          graph: state.graph,
          tags: splitList(state.tags),
          body: state.body,
          links: splitList(state.links).map((id): NodeLink => {
            const existing = existingLinksByNode.get(id);
            const details = currentEditableLinks[id];
            const linkTypeValue = details?.linkType ?? (existing?.relationships ?? []).join(", ");
            return {
              node: id,
              context: details?.context ?? existing?.context ?? "",
              relationships: splitList(linkTypeValue),
            };
          }),
        };

        if (doc.type === "task") {
          payload.status = state.status;
        }

        if (doc.type === "command") {
          payload.name = state.name;
          payload.run = state.run;
          payload.env = parseEnv(state.env);
        }

        const updatedDocument = await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(doc.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        if (selectedDocumentRef.current?.id === updatedDocument.id) {
          syncSelectedDocumentState(updatedDocument, { preserveFormState: true });
        }
        if (documentThreadRef.current.some((entry) => entry.documentId === updatedDocument.id)) {
          setThreadDocumentsById((current) => ({ ...current, [updatedDocument.id]: updatedDocument }));
        }
        setGraphTree((current) => updateGraphTreeDocumentEntry(current, doc, updatedDocument));
        setGraphCanvasData((current) => updateGraphCanvasDocumentEntry(current, doc, updatedDocument));
      } catch (mutationFailure) {
        setMutationError(toErrorMessage(mutationFailure));
      } finally {
        setSavingDocument(false);
      }
    })();

    documentSavePromiseRef.current = savePromise;

    try {
      await savePromise;
    } finally {
      if (documentSavePromiseRef.current === savePromise) {
        documentSavePromiseRef.current = null;
      }
    }
  }

  async function handleSaveHomeContent(state: HomeFormState): Promise<void> {
    const savePromise = (async () => {
      setSavingHome(true);
      setHomeMutationError("");

      try {
        const updatedHome = await requestJSON<HomeResponse>("/api/home", {
          method: "PUT",
          body: JSON.stringify({
            title: state.title,
            description: state.description,
            body: state.body,
          }),
        });

        setGraphTree((current) => (current === null ? current : { ...current, home: updatedHome }));
      } catch (mutationFailure) {
        setHomeMutationError(toErrorMessage(mutationFailure));
      } finally {
        setSavingHome(false);
      }
    })();

    homeSavePromiseRef.current = savePromise;

    try {
      await savePromise;
    } finally {
      if (homeSavePromiseRef.current === savePromise) {
        homeSavePromiseRef.current = null;
      }
    }
  }

  function handleConnectionHandlePointerDown(event: React.PointerEvent<HTMLDivElement>, sourceId: string): void {
    event.preventDefault();
    event.stopPropagation();
    const shell = graphCanvasShellRef.current;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;
    setConnectingFrom(sourceId);
    setConnectingStartPos({ x: startX, y: startY });
    setConnectingPointerPos({ x: startX, y: startY });
    setConnectingTarget(null);
    connectingTargetRef.current = null;

    function onPointerMove(e: PointerEvent): void {
      const s = graphCanvasShellRef.current;
      if (!s) return;
      const r = s.getBoundingClientRect();
      setConnectingPointerPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      let hit: string | null = null;
      for (const el of elements) {
        if (el instanceof HTMLElement) {
          const nodeId = el.getAttribute("data-nodeid");
          if (nodeId && nodeId !== sourceId) { hit = nodeId; break; }
        }
      }
      setConnectingTarget(hit);
      connectingTargetRef.current = hit;
    }

    function onPointerUp(): void {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      const target = connectingTargetRef.current;
      connectingTargetRef.current = null;
      setConnectingFrom(null);
      setConnectingStartPos(null);
      setConnectingPointerPos(null);
      setConnectingTarget(null);
      if (target !== null) void handleCreateEdge(sourceId, target);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  async function handleCreateEdge(sourceId: string, targetId: string): Promise<void> {
    await mutateEdge("POST", { fromId: sourceId, toId: targetId, context: "" });
  }

  async function handleDeleteEdge(sourceId: string, targetId: string): Promise<void> {
    await mutateEdge("DELETE", { fromId: sourceId, toId: targetId });
  }

  async function handlePersistEdgeToolbar(state: EdgeToolbarState): Promise<void> {
    await mutateEdge("PATCH", {
      fromId: state.sourceId,
      toId: state.targetId,
      context: state.context,
      relationships: state.relationships,
    });
    setEdgeToolbar((current) => current?.edgeId === state.edgeId ? { ...current, context: state.context, relationships: state.relationships } : current);
  }

  function clearEdgeClickTimer(): void {
    if (edgeClickTimerRef.current !== null) {
      window.clearTimeout(edgeClickTimerRef.current);
      edgeClickTimerRef.current = null;
    }
  }

  function handleGraphCanvasEdgeClick(edge: {
    edgeId: string;
    sourceId: string;
    targetId: string;
    context: string;
    relationships: string[];
    x: number;
    y: number;
  }): void {
    clearEdgeClickTimer();
    setSelectedEdgeId(edge.edgeId);
    setEdgeToolbar({
      edgeId: edge.edgeId,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      context: edge.context,
      relationships: edge.relationships,
      x: edge.x,
      y: edge.y,
    });
  }

  function handleGraphCanvasEdgeDoubleClick(sourceId: string, targetId: string, context: string, edgeId: string): void {
    setSelectedEdgeId(edgeId);
    void handleOpenCanvasDocument(sourceId);
  }

  function handleGraphCanvasEdgeHover(edgeId: string, context: string, x: number, y: number): void {
    if (context.trim() === "") {
      setHoveredEdgeTooltip(null);
      return;
    }
    setHoveredEdgeTooltip({ edgeId, context, x, y });
  }

  // Stable callback retained for ContextEdge compatibility.
  const handleEdgeDoubleClickAction = useCallback((sourceId: string, targetId: string, context: string) => {
    setEdgeToolbar({
      edgeId: `link:${sourceId}:${targetId}`,
      sourceId,
      targetId,
      context,
      relationships: [],
      x: 0,
      y: 0,
    });
  }, []);

  async function handleMergeDocuments(): Promise<void> {
    if (shiftSelectedNodes.length < 2) return;
    try {
      clearMutationFeedback();
      const mergedDocument = await requestJSON<DocumentResponse>("/api/documents/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: shiftSelectedNodes }),
      });
      const snapshot = await loadWorkspaceSnapshot();
      setGraphTree(snapshot.graphTreeData);
      setShiftSelectedNodes([]);
      setSelectedDocumentOpenMode("right-rail");
      setRightPanelTab("document");
      setRightRailCollapsed(false);
      await refreshShellViews({ nextDocument: mergedDocument, nextDocumentId: mergedDocument.id });
      setSelectedCanvasNodeId(mergedDocument.id);
      setMutationSuccess("Documents merged.");
    } catch (mergeFailure) {
      setMutationError(toErrorMessage(mergeFailure));
    }
  }

  async function handleDeleteDocument(): Promise<void> {
    if (deleteDialogTarget === null) {
      return;
    }

    try {
      setDeletingDocument(true);
      clearMutationFeedback();

      const response = await requestJSON<DeleteDocumentResponse>(`/api/documents/${encodeURIComponent(deleteDialogTarget.id)}`, {
        method: "DELETE",
      });

      const deletedSelectedDocument = selectedDocumentId === deleteDialogTarget.id;
      if (documentThreadRef.current.some((entry) => entry.documentId === deleteDialogTarget.id)) {
        const deleteIndex = documentThreadRef.current.findIndex((entry) => entry.documentId === deleteDialogTarget.id);
        applyDocumentThread(deleteIndex > 0 ? documentThreadRef.current.slice(0, deleteIndex) : []);
      }
      setDeleteDialogTarget(null);
      if (deletedSelectedDocument) {
        await refreshShellViews({ nextDocument: null, nextDocumentId: "" });
      } else {
        await refreshShellViews();
      }
      setMutationSuccess(`${formatDocumentType(deleteDialogTarget.type)} deleted from ${response.path}.`);
    } catch (mutationFailure) {
      setMutationError(toErrorMessage(mutationFailure));
    } finally {
      setDeletingDocument(false);
    }
  }

  const threadPanelActions = useThreadPanelActions({
    activateThreadDocument,
    setThreadDensityMode,
    toggleThreadExpanded,
    moveThreadFocus,
    toggleRightRailMaximized,
    closeDocumentThreadFrom,
    updateHomeFormField,
    handleInlineReferenceOpen,
    handleDateOpen,
    openAssetInThreadFromSource,
    setEditorScrollTarget,
    updateFormField,
    toggleCenterDocumentSidePanel,
    handleDocumentTOCResizeMouseDown,
    handleTOCNavigate,
    addOutgoingLink,
    removeOutgoingLink,
    updateEditableLinkDetail,
    beginThreadPanelResize,
  });

  const rightRailDocumentActions = useRightRailDocumentActions({
    toggleRightRailMaximized,
    openDeleteDialogForSelectedDocument,
    handleCloseContextPanel,
    updateFormField,
    handleInlineReferenceOpen,
    handleDateOpen,
    openAssetInThreadFromSource,
    setEditorScrollTarget,
    handleGraphCanvasFilesDrop,
    handleInspectDocument,
    handleRightRailDocumentTOCResizeMouseDown,
    handleTOCNavigate,
    selectedDocumentRef,
  });

  const sidebarNavigationActions = useSidebarNavigationActions({
    handleWorkspaceSelection,
    handleSelectHome,
    handleSelectGraph,
    handleSelectDocument,
    handleSidebarCreateGraph,
    handleSidebarCreateNode,
    handleSidebarRenameGraph,
    handleSidebarRenameNode,
    handleSidebarMoveNode,
    handleSidebarDeleteNode,
    handleSidebarDeleteGraph,
    handleSidebarSetGraphColor,
  });

  const { graphCanvasOverlayActions, graphCanvasSurfaceActions } = useGraphCanvasSurfaceActions({
    clearEdgeClickTimer,
    updateIntersectingNodes: updateGraphCanvasIntersections,
    clearIntersectingNodes: clearGraphCanvasIntersections,
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
  });

  const graphCanvasOverlayController = useMemo<GraphCanvasOverlayController>(() => ({
    state: {
      edges: graphCanvasData?.edges ?? [],
      graphCanvasNodes,
      rfViewport,
      intersectingNodeIds: graphCanvasIntersectingNodeIds,
      intersectingSourceNodeId: graphCanvasIntersectionSourceId,
      selectedCanvasNodeId,
      selectedEdgeId,
      hoveredEdgeTooltip,
      edgeToolbar,
      relationshipTagCatalog,
      shiftSelectedNodes,
      connectingTarget,
      canvasContextMenu,
      connectingFrom,
      connectingPointerPos,
      connectingStartPos,
    },
    actions: graphCanvasOverlayActions,
  }), [
    canvasContextMenu,
    connectingFrom,
    connectingPointerPos,
    connectingStartPos,
    connectingTarget,
    edgeToolbar,
    graphCanvasData?.edges,
    graphCanvasIntersectingNodeIds,
    graphCanvasIntersectionSourceId,
    graphCanvasNodes,
    graphCanvasOverlayActions,
    hoveredEdgeTooltip,
    relationshipTagCatalog,
    rfViewport,
    selectedCanvasNodeId,
    selectedEdgeId,
    shiftSelectedNodes,
  ]);

  const homeSurfaceActions = useHomeSurfaceActions({
    setHomeTOCVisible,
    updateHomeFormField,
    handleInlineReferenceOpen,
    handleDateOpen,
    openAssetInThreadFromSource,
    setEditorScrollTarget,
    handleHomeDocumentTOCResizeMouseDown,
    handleTOCNavigate,
    homeThreadDocumentId: HOME_THREAD_DOCUMENT_ID,
  });

  const graphEmptyStateActions = useMemo(() => ({
    setDragActive: graphCanvasSurfaceActions.setDragActive,
    handleFilesDrop: graphCanvasSurfaceActions.handleFilesDrop,
    createGraphDocument: graphCanvasOverlayActions.createGraphDocument,
  }), [
    graphCanvasOverlayActions,
    graphCanvasSurfaceActions,
  ]);

  const settingsDialogActionRefs = useRef({
    setSettingsDialogOpen,
    setSettingsTab,
    handleRebuildIndex,
    handleWorkspaceDeregister,
    handleAppearanceChange,
    handleStopGUI,
  });

  settingsDialogActionRefs.current.setSettingsDialogOpen = setSettingsDialogOpen;
  settingsDialogActionRefs.current.setSettingsTab = setSettingsTab;
  settingsDialogActionRefs.current.handleRebuildIndex = handleRebuildIndex;
  settingsDialogActionRefs.current.handleWorkspaceDeregister = handleWorkspaceDeregister;
  settingsDialogActionRefs.current.handleAppearanceChange = handleAppearanceChange;
  settingsDialogActionRefs.current.handleStopGUI = handleStopGUI;

  const handleSettingsDialogOpenChange = useCallback((open: boolean) => {
    settingsDialogActionRefs.current.setSettingsDialogOpen(open);
  }, []);

  const handleSettingsDialogTabChange = useCallback((tab: "general" | "theme" | "stop") => {
    settingsDialogActionRefs.current.setSettingsTab(tab);
  }, []);

  const handleSettingsDialogRebuildIndex = useCallback(() => {
    void settingsDialogActionRefs.current.handleRebuildIndex();
  }, []);

  const handleSettingsDialogDeregisterWorkspace = useCallback((workspacePath: string) => {
    void settingsDialogActionRefs.current.handleWorkspaceDeregister(workspacePath);
  }, []);

  const handleSettingsDialogAppearanceChange = useCallback((appearance: "light" | "dark" | "system") => {
    void settingsDialogActionRefs.current.handleAppearanceChange(appearance);
  }, []);

  const handleSettingsDialogStopGUI = useCallback(() => {
    void settingsDialogActionRefs.current.handleStopGUI();
  }, []);

  const settingsDialogActions = useMemo(() => ({
    setOpen: handleSettingsDialogOpenChange,
    setTab: handleSettingsDialogTabChange,
    rebuildIndex: handleSettingsDialogRebuildIndex,
    deregisterWorkspace: handleSettingsDialogDeregisterWorkspace,
    changeAppearance: handleSettingsDialogAppearanceChange,
    stopGUI: handleSettingsDialogStopGUI,
  }), [
    handleSettingsDialogAppearanceChange,
    handleSettingsDialogDeregisterWorkspace,
    handleSettingsDialogOpenChange,
    handleSettingsDialogRebuildIndex,
    handleSettingsDialogStopGUI,
    handleSettingsDialogTabChange,
  ]);

  const rightRailControlsActions = useRightRailControlsActions({
    setSettingsDialogOpen,
    toggleRightPanel,
    handleSelectedNodeDocumentButtonClick,
  });

  const settingsDialogProps = useMemo(() => ({
    open: settingsDialogOpen,
    settingsTab,
    workspace,
    trackedLocalWorkspaces,
    switchingWorkspace,
    rebuildingIndex,
    stoppingGUI,
    appearance: normalizeAppearance(theme),
    actions: settingsDialogActions,
  }), [
    rebuildingIndex,
    settingsDialogActions,
    settingsDialogOpen,
    settingsTab,
    stoppingGUI,
    switchingWorkspace,
    theme,
    trackedLocalWorkspaces,
    workspace,
  ]);

  const deleteDocumentDialogActionRefs = useRef({
    setDeleteDialogOpen,
    setDeleteDialogTarget,
    handleDeleteDocument,
  });

  deleteDocumentDialogActionRefs.current.setDeleteDialogOpen = setDeleteDialogOpen;
  deleteDocumentDialogActionRefs.current.setDeleteDialogTarget = setDeleteDialogTarget;
  deleteDocumentDialogActionRefs.current.handleDeleteDocument = handleDeleteDocument;

  const handleDeleteDocumentDialogOpenChange = useCallback((open: boolean) => {
    deleteDocumentDialogActionRefs.current.setDeleteDialogOpen(open);
    if (!open) {
      deleteDocumentDialogActionRefs.current.setDeleteDialogTarget(null);
    }
  }, []);

  const handleDeleteDocumentDialogCancel = useCallback(() => {
    deleteDocumentDialogActionRefs.current.setDeleteDialogTarget(null);
    deleteDocumentDialogActionRefs.current.setDeleteDialogOpen(false);
  }, []);

  const handleDeleteDocumentDialogConfirm = useCallback(() => {
    deleteDocumentDialogActionRefs.current.setDeleteDialogOpen(false);
    void deleteDocumentDialogActionRefs.current.handleDeleteDocument();
  }, []);

  const deleteDocumentDialogActions = useMemo(() => ({
    setOpen: handleDeleteDocumentDialogOpenChange,
    cancel: handleDeleteDocumentDialogCancel,
    confirm: handleDeleteDocumentDialogConfirm,
  }), [
    handleDeleteDocumentDialogCancel,
    handleDeleteDocumentDialogConfirm,
    handleDeleteDocumentDialogOpenChange,
  ]);

  const createNodeDialogActionRefs = useRef({
    setCreateNodeDialog,
    setCreateNodeFileName,
    setCreateNodeFileNameError,
    handleConfirmCreateNode,
  });

  createNodeDialogActionRefs.current.setCreateNodeDialog = setCreateNodeDialog;
  createNodeDialogActionRefs.current.setCreateNodeFileName = setCreateNodeFileName;
  createNodeDialogActionRefs.current.setCreateNodeFileNameError = setCreateNodeFileNameError;
  createNodeDialogActionRefs.current.handleConfirmCreateNode = handleConfirmCreateNode;

  const handleCreateNodeDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      createNodeDialogActionRefs.current.setCreateNodeDialog(null);
    }
  }, []);

  const handleCreateNodeDialogFileNameChange = useCallback((value: string) => {
    createNodeDialogActionRefs.current.setCreateNodeFileName(value);
    createNodeDialogActionRefs.current.setCreateNodeFileNameError("");
  }, []);

  const handleCreateNodeDialogCancel = useCallback(() => {
    createNodeDialogActionRefs.current.setCreateNodeDialog(null);
  }, []);

  const handleCreateNodeDialogConfirm = useCallback(() => {
    void createNodeDialogActionRefs.current.handleConfirmCreateNode();
  }, []);

  const createNodeDialogActions = useMemo(() => ({
    setOpen: handleCreateNodeDialogOpenChange,
    setFileName: handleCreateNodeDialogFileNameChange,
    cancel: handleCreateNodeDialogCancel,
    confirm: handleCreateNodeDialogConfirm,
  }), [
    handleCreateNodeDialogCancel,
    handleCreateNodeDialogConfirm,
    handleCreateNodeDialogFileNameChange,
    handleCreateNodeDialogOpenChange,
  ]);

  const renameDialogActionRefs = useRef({
    setRenameDialog,
    setRenameValue,
    setRenameError,
    handleConfirmRename,
  });

  renameDialogActionRefs.current.setRenameDialog = setRenameDialog;
  renameDialogActionRefs.current.setRenameValue = setRenameValue;
  renameDialogActionRefs.current.setRenameError = setRenameError;
  renameDialogActionRefs.current.handleConfirmRename = handleConfirmRename;

  const handleRenameDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      renameDialogActionRefs.current.setRenameDialog(null);
    }
  }, []);

  const handleRenameDialogValueChange = useCallback((value: string) => {
    renameDialogActionRefs.current.setRenameValue(value);
    renameDialogActionRefs.current.setRenameError("");
  }, []);

  const handleRenameDialogCancel = useCallback(() => {
    renameDialogActionRefs.current.setRenameDialog(null);
  }, []);

  const handleRenameDialogConfirm = useCallback(() => {
    void renameDialogActionRefs.current.handleConfirmRename();
  }, []);

  const renameDialogActions = useMemo(() => ({
    setOpen: handleRenameDialogOpenChange,
    setValue: handleRenameDialogValueChange,
    cancel: handleRenameDialogCancel,
    confirm: handleRenameDialogConfirm,
  }), [
    handleRenameDialogCancel,
    handleRenameDialogConfirm,
    handleRenameDialogOpenChange,
    handleRenameDialogValueChange,
  ]);

  if (loading) {
    return (
      <main className="app-shell app-shell-loading">
        <Card className="loading-card shell-loading-card">
          <CardHeader>
            <p className="eyebrow">Flow GUI</p>
            <h1 className="shell-loading-title">Loading workspace state</h1>
          </CardHeader>
          <CardContent>
            <p>Fetching the Home surface, graph tree, split-pane ratios, and contextual document state.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error !== "" && workspace === null) {
    return (
      <main className="app-shell app-shell-loading">
        <Card className="loading-card loading-card-error shell-loading-card">
          <CardHeader>
            <p className="eyebrow">Flow GUI</p>
            <h1 className="shell-loading-title">Workspace load failed</h1>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const renderCenterDocumentShell = (isMaximizedRightRail: boolean) => (
    <ThreadPanelStack
      panelError={panelError}
      mutationError={mutationError}
      mutationSuccess={mutationSuccess}
      isMaximizedRightRail={isMaximizedRightRail}
      threadExpanded={threadExpanded}
      threadDensityMode={threadDensityMode}
      nextThreadDensityLabel={nextThreadDensityLabel}
      nextThreadDensityMode={nextThreadDensityMode}
      threadPanels={threadPanels}
      activeThreadPanelIndex={activeThreadPanelIndex}
      threadStackRef={threadStackRef}
      threadPanelWidths={threadPanelWidths}
      graphDirectoryColorsByPath={graphDirectoryColorsByPath}
      threadAssetsById={threadAssetsById}
      homeThreadDocumentId={HOME_THREAD_DOCUMENT_ID}
      homeFormState={homeFormState}
      homeInlineReferences={graphTree?.home.inlineReferences}
      formState={formState}
      selectedDocument={selectedDocument}
      selectedDocumentId={selectedDocumentId}
      selectedDocumentInlineReferences={selectedDocument?.inlineReferences}
      isSelectedDocumentLoading={isSelectedDocumentLoading}
      savingHome={savingHome}
      savingDocument={savingDocument}
      centerDocumentLayoutRef={centerDocumentLayoutRef}
      centerDocumentEditorRef={centerDocumentEditorRef}
      centerDocumentSidePanelMode={centerDocumentSidePanelMode}
      showCenterDocumentSidePanel={showCenterDocumentSidePanel}
      centerDocumentSidePanelLabel={centerDocumentSidePanelLabel}
      centerDocumentSidePanelTitle={centerDocumentSidePanelTitle}
      centerDocumentSidePanelDescription={centerDocumentSidePanelDescription}
      centerDocumentSidePanelResizerLabel={centerDocumentSidePanelResizerLabel}
      documentTOCRatio={documentTOCRatio}
      tocItems={tocItems}
      selectedDocumentLinks={selectedDocumentLinks}
      editableOutgoingLinks={editableOutgoingLinks}
      availableLinkTargets={availableLinkTargets}
      editorScrollTarget={editorScrollTarget}
      actions={threadPanelActions}
    />
  );

  return (
    <SidebarProvider
      className={isResizingLeft ? "is-resizing-sidebar" : undefined}
      style={{ "--sidebar-width": `${leftSidebarWidth}px` } as React.CSSProperties}
    >
      {error !== "" ? <p className="status-line status-line-error">{error}</p> : null}
      <AppSidebar
        onResizeMouseDown={handleLeftSidebarMouseDown}
        topContent={<WorkspaceSelectorPanel workspace={workspace} switchingWorkspace={switchingWorkspace} actions={sidebarNavigationActions} />}
        navigationContent={<GraphTreePanel graphTree={graphTree} activeSurface={activeSurface} selectedDocumentId={selectedDocumentId} actions={sidebarNavigationActions} />}
      />
      <SidebarInset>
        <header className="workspace-shell-header">
            <div className="workspace-shell-header-leading">
              <SidebarTrigger />
              <Separator className="workspace-shell-header-separator" orientation="vertical" />
              <Breadcrumb className="workspace-shell-breadcrumb">
                <BreadcrumbList>
                  <BreadcrumbItem>Workspace</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  {workspaceSurfaceTitle === null ? (
                    <BreadcrumbItem>
                      <BreadcrumbPage>{workspaceSurfaceSection}</BreadcrumbPage>
                    </BreadcrumbItem>
                  ) : (
                    <>
                      <BreadcrumbItem>{workspaceSurfaceSection}</BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>{workspaceSurfaceTitle}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <DeleteDocumentDialog
            open={deleteDialogOpen}
            target={deleteDialogTarget}
            savingDocument={savingDocument}
            deletingDocument={deletingDocument}
            actions={deleteDocumentDialogActions}
          />

          <div className="workspace-shell-body">
        <section className="middle-shell">
          {isThreadStackOpen ? (
            renderCenterDocumentShell(false)
          ) : activeSurface.kind === "home" ? (
            <HomeSurface
              homeMutationError={homeMutationError}
              homeTOCVisible={homeTOCVisible}
              showFreshStartGuide={showFreshStartGuide}
              homeDocumentLayoutRef={homeDocumentLayoutRef}
              homeDocumentEditorRef={homeDocumentEditorRef}
              documentTOCRatio={documentTOCRatio}
              homeInlineReferences={graphTree?.home.inlineReferences}
              editorScrollTarget={editorScrollTarget}
              homeFormState={homeFormState}
              tocItems={tocItems}
              actions={homeSurfaceActions}
            />
          ) : (
            <div className="graph-canvas-outer">
                    {graphCanvasError !== "" ? (
                      <div className="detail-empty shell-inner-card">
                        <p>Graph canvas data could not be loaded for this graph.</p>
                      </div>
                    ) : graphCanvasLoading ? (
                      <div className="detail-empty shell-inner-card">
                        <p>Loading graph canvas nodes and projected edges.</p>
                      </div>
                    ) : graphCanvasData !== null && graphCanvasData.nodes.length === 0 ? (
                      <GraphEmptyState
                        selectedGraphPath={selectedGraphPath}
                        graphCanvasDragActive={graphCanvasDragActive}
                        graphCreateError={graphCreateError}
                        graphCreatePendingType={graphCreatePendingType}
                        actions={graphEmptyStateActions}
                      />
                    ) : graphCanvasData === null ? (
                      <div className="detail-empty shell-inner-card">
                        <p>Graph canvas data is not available yet.</p>
                      </div>
                    ) : (
                      <GraphCanvasSurface
                        graphCanvasShellRef={graphCanvasShellRef}
                        selectedGraphPath={selectedGraphPath}
                        graphCanvasDragActive={graphCanvasDragActive}
                        connectingFrom={connectingFrom}
                        graphCanvasData={graphCanvasData}
                        graphCanvasNodes={graphCanvasNodes}
                        graphCanvasEdges={graphCanvasEdges}
                        edgeTypes={EDGE_TYPES}
                        graphCanvasNodeSearchTerm={graphCanvasNodeSearchTerm}
                        graphCanvasNodeSearchHasMatches={graphCanvasNodeSearchHasMatches}
                        graphCanvasNodeSearchSelectedIndex={graphCanvasNodeSearchSelectedIndex}
                        graphCanvasNodeSearchMatchCount={graphCanvasNodeSearchMatches.length}
                        normalizedGraphCanvasNodeSearchTerm={normalizedGraphCanvasNodeSearchTerm}
                        graphCanvasResettingLayout={graphCanvasResettingLayout}
                        graphCanvasLayoutMode={graphCanvasLayoutMode}
                        overlayController={graphCanvasOverlayController}
                        edgeDoubleClickAction={handleEdgeDoubleClickAction}
                        actions={graphCanvasSurfaceActions}
                      />
                    )}
            </div>
          )}
        </section>
        <aside
          className="app-right-sidebar"
          aria-label="Right pane"
          data-open={rightRailCollapsed ? "false" : "true"}
          data-focus={!rightRailCollapsed && rightRailMaximized ? "true" : "false"}
          style={!rightRailCollapsed && !rightRailMaximized ? { width: `${rightSidebarWidth}px`, ...(isResizingRight ? { transition: "none" } : {}) } : undefined}
        >
          {!rightRailCollapsed && !rightRailMaximized && (
            <div className="right-sidebar-resize-handle" onMouseDown={handleRightSidebarMouseDown} />
          )}
          <div className="right-sidebar-panel">
            {!rightRailCollapsed && (rightPanelTab === "document" && hasRightRailDocument ? (
              rightRailMaximized ? (
                renderCenterDocumentShell(true)
              ) : (
                <DocumentEditorPane
                  selectedDocument={selectedDocument}
                  formState={formState}
                  panelError={panelError}
                  mutationError={mutationError}
                  mutationSuccess={mutationSuccess}
                  savingDocument={savingDocument}
                  deletingDocument={deletingDocument}
                  isMaximized={rightRailMaximized}
                  tintColor={selectedDocumentGraphColor}
                  tintStyle={selectedDocumentTintStyle}
                  documentTOCRatio={documentTOCRatio}
                  tocItems={tocItems}
                  outgoingLinks={selectedDocumentLinks.outgoing}
                  incomingLinks={selectedDocumentLinks.incoming}
                  rightRailDocumentLayoutRef={rightRailDocumentLayoutRef}
                  rightRailDocumentEditorRef={rightRailDocumentEditorRef}
                  editorScrollTarget={editorScrollTarget}
                  actions={rightRailDocumentActions}
                />
              )
            ) : rightPanelTab === "search" ? (
              <RightRailSearchPanel
                searchQuery={searchQuery}
                searchTagQuery={searchTagQuery}
                searchTitleQuery={searchTitleQuery}
                searchDescriptionQuery={searchDescriptionQuery}
                searchContentQuery={searchContentQuery}
                searchError={searchError}
                hasDeferredSearchFilter={hasDeferredSearchFilter}
                searchResults={searchResults}
                setSearchQuery={setSearchQuery}
                setSearchTagQuery={setSearchTagQuery}
                setSearchTitleQuery={setSearchTitleQuery}
                setSearchDescriptionQuery={setSearchDescriptionQuery}
                setSearchContentQuery={setSearchContentQuery}
                onResultNavigate={handleRightRailSearchResultNavigate}
              />
            ) : rightPanelTab === "calendar" ? (
              <RightRailCalendarPanel
                documents={calendarDocumentsForDisplay}
                selectedDate={calendarFocusDate}
                onDateChange={setCalendarFocusDate}
                onDocumentOpen={handleRightRailCalendarDocumentOpen}
                error={calendarError}
              />
            ) : null)}
          </div>
        </aside>
        </div>
        <RightRailControls
          searchActive={rightPanelTab === "search" && !rightRailCollapsed}
          calendarActive={rightPanelTab === "calendar" && !rightRailCollapsed}
          showDocumentButton={showRightRailDocumentButton}
          documentActive={rightPanelTab === "document" && !rightRailCollapsed && selectedNodeMatchesRightRailDocument}
          settingsDialog={settingsDialogProps}
          actions={rightRailControlsActions}
        />
      </SidebarInset>
      <CreateNodeDialog
        dialog={createNodeDialog}
        fileName={createNodeFileName}
        fileNameError={createNodeFileNameError}
        pending={graphCreatePendingType !== ""}
        actions={createNodeDialogActions}
      />
      <RenameDialog
        dialog={renameDialog}
        value={renameValue}
        error={renameError}
        pending={renamePending}
        actions={renameDialogActions}
      />
    </SidebarProvider>
  );
}

export function App() {
  return (
    <TooltipProvider>
      <ReactFlowProvider>
        <FlowApp />
      </ReactFlowProvider>
    </TooltipProvider>
  );
}
