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
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Info, Maximize2, Minimize2, PaintbrushVertical, Rows3, Search, Settings, Trash2, TriangleAlert, X } from "lucide-react";
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { AppSidebar } from "./components/AppSidebar";
import type { EdgeToolbarState, GraphCanvasOverlayController } from "./components/graphCanvasOverlayController";
import { GraphCanvasOverlayInteraction } from "./components/GraphCanvasOverlayInteraction";
import { GraphCanvasOverlayNodes } from "./components/GraphCanvasOverlayNodes";
import { GraphTree } from "./components/GraphTree";
import { HomeCalendarPanel } from "./components/HomeCalendarPanel";
import { GraphCanvasOverlayEdges } from "./components/GraphCanvasOverlayEdges";
import { TableOfContents } from "./components/TableOfContents";
import { DocumentPropertiesPanel } from "./components/DocumentPropertiesPanel";
import { Badge } from "./components/ui/badge";
import { Input } from "./components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./components/ui/breadcrumb";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { Label } from "./components/ui/label";
import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
import { Separator } from "./components/ui/separator";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { requestJSON, loadCalendarDocuments, loadWorkspaceSnapshot, selectWorkspace, uploadGraphFiles } from "./lib/api";
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
  applyGraphCanvasLayerGuidance,
  buildGraphCanvasFlowEdges,
  buildGraphCanvasFlowNodes,
  ContextEdge,
  EdgeEditContext,
  countConnectedGraphCanvasEdges,
  graphCanvasOverlayPosition,
  graphCanvasPositionMap,
  graphCanvasTypeLabel,
  normalizeGraphCanvasResponse,
  selectedGraphCanvasNode,
} from "./lib/graphCanvasUtils";
import { markdownToHTML, parseFlowReferenceHref, parseFlowDateHref } from "./richText";
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

const HOME_THREAD_DOCUMENT_ID = "home";
const DEFAULT_DOCUMENT_TOC_RATIO = 0.18;
const MIN_DOCUMENT_TOC_RATIO = 0.14;
const MAX_DOCUMENT_TOC_RATIO = 0.32;
const MIN_THREAD_PANEL_WIDTH_PX = 420;
const THREAD_PANEL_VIEWPORT_MARGIN_PX = 112;
const DOCUMENT_FILE_NAME_PATTERN = /^[a-z0-9][a-z0-9._/-]*$/;

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
  const selectedGraphPath = activeSurface.kind === "graph" ? activeSurface.graphPath : "";
  const [rightRailCollapsed, setRightRailCollapsed] = useState<boolean>(true);
  const [rightRailMaximized, setRightRailMaximized] = useState<boolean>(false);

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
  const selectedCanvasNodeEdgeCount = countConnectedGraphCanvasEdges(graphCanvasData, selectedCanvasNodeId);
  const workspaceSurfaceSection = activeSurface.kind === "graph" ? "Content" : "Home";
  const workspaceSurfaceTitle = activeSurface.kind === "graph" ? selectedGraphNode?.displayName ?? selectedGraphPath : null;
  const isHomeThreadRoot = documentThread.length > 0 && documentThread[0]?.documentId === HOME_THREAD_DOCUMENT_ID;
  const isCenterDocumentOpen = selectedDocumentId !== "" && selectedDocumentOpenMode === "center";
  const isThreadStackOpen = selectedDocumentOpenMode === "center" && (selectedDocumentId !== "" || (isHomeThreadRoot && activeSurface.kind === "home"));
  const isSelectedDocumentLoading = selectedDocumentId !== "" && (selectedDocument === null || selectedDocument.id !== selectedDocumentId);
  const activeThreadTailId = documentThread.length > 0 ? documentThread[documentThread.length - 1]?.documentId ?? "" : "";
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
  const graphCanvasOverlayController: GraphCanvasOverlayController = {
    state: {
      edges: graphCanvasData?.edges ?? [],
      graphCanvasNodes,
      rfViewport,
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
    actions: {
      clearEdgeClickTimer,
      selectEdge: setSelectedEdgeId,
      handleGraphCanvasEdgeClick,
      handleGraphCanvasEdgeHover,
      clearHoveredEdgeTooltip: (edgeId) => {
        setHoveredEdgeTooltip((current) => current?.edgeId === edgeId ? null : current);
      },
      handleGraphCanvasEdgeDoubleClick,
      setEdgeToolbarState: setEdgeToolbar,
      persistEdgeToolbar: handlePersistEdgeToolbar,
      handleDeleteEdge,
      onNodeClick: handleGraphCanvasOverlayNodeClick,
      onNodeDoubleClick: handleGraphCanvasOverlayNodeDoubleClick,
      onNodePointerDown: handleGraphCanvasOverlayPointerDown,
      onHandlePointerDown: handleConnectionHandlePointerDown,
      onNodeDescriptionSave: (nodeId, description) => {
        void handleGraphCanvasNodeDescriptionSave(nodeId, description);
      },
      onMerge: () => {
        void handleMergeDocuments();
      },
      closeCanvasContextMenu: () => {
        setCanvasContextMenu(null);
      },
      createGraphDocument: (type) => {
        void handleCreateGraphDocument(type);
      },
    },
  };
  const documentGraphById = useMemo(() => {
    const graphByID = new Map<string, string>();

    for (const graphNode of graphTree?.graphs ?? []) {
      for (const file of graphNode.files) {
        graphByID.set(file.id, graphNode.graphPath);
      }
    }

    return graphByID;
  }, [graphTree]);
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

  async function openDocumentInCenter(documentId: string, graphPath: string): Promise<void> {
    await flushPendingActiveEditorSave();
    clearSurfaceFeedback();
    startTransition(() => {
      setActiveSurface({ kind: "graph", graphPath });
    });
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
    startTransition(() => {
      setActiveSurface({ kind: "graph", graphPath });
    });
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

    const currentThread = documentThreadRef.current;
    const sourceIndex = currentThread.findIndex((entry) => entry.documentId === sourceDocumentId);
    const sourceGraphPath = currentThread[sourceIndex]?.graphPath
      ?? selectedDocumentRef.current?.graph
      ?? documentGraphById.get(sourceDocumentId)
      ?? selectedGraphPath;

    const baseThread = sourceIndex >= 0
      ? currentThread.slice(0, sourceIndex + 1)
      : sourceDocumentId === HOME_THREAD_DOCUMENT_ID
        ? [{ documentId: HOME_THREAD_DOCUMENT_ID, graphPath: "" }]
      : sourceDocumentId !== "" && sourceGraphPath !== ""
        ? [{ documentId: sourceDocumentId, graphPath: sourceGraphPath }]
        : [];

    const nextThread = [...baseThread, { documentId: targetDocumentId, graphPath }];
    applyDocumentThread(nextThread);
    setSelectedDocumentOpenMode("center");
    setSelectedDocumentId(targetDocumentId);
    setSelectedCanvasNodeId(targetDocumentId);
    setThreadExpanded(false);
    startTransition(() => {
      setActiveSurface({ kind: "graph", graphPath });
    });

    if (rightPanelTab === "document") {
      setRightPanelTab("search");
      setRightRailCollapsed(true);
    }
  }

  async function activateThreadDocument(documentId: string, graphPath: string): Promise<void> {
    if (selectedDocumentOpenMode === "center" && activeThreadDocumentId === documentId) {
      return;
    }

    await flushPendingActiveEditorSave();
    clearSurfaceFeedback();

    if (documentId === HOME_THREAD_DOCUMENT_ID) {
      setSelectedDocumentOpenMode("center");
      setSelectedDocumentId("");
      setSelectedCanvasNodeId("");
      syncSelectedDocumentState(null);
      startTransition(() => {
        setActiveSurface({ kind: "home" });
      });
      if (rightPanelTab === "document") {
        setRightPanelTab("search");
        setRightRailCollapsed(true);
      }
      return;
    }

    setSelectedDocumentOpenMode("center");
    setSelectedDocumentId(documentId);
    setSelectedCanvasNodeId(documentId);
    syncSelectedDocumentState(threadDocumentsById[documentId] ?? null);
    startTransition(() => {
      setActiveSurface({ kind: "graph", graphPath });
    });

    if (rightPanelTab === "document") {
      setRightPanelTab("search");
      setRightRailCollapsed(true);
    }
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
      setTheme(workspace.appearance);
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

      const hasPersistedPositions = graphCanvasData.nodes.some((node) => node.positionPersisted);
      if (hasPersistedPositions) {
        const nextPositions = graphCanvasPositionMap(graphCanvasData);
        setGraphCanvasPositions(nextPositions);
        setGraphCanvasUserPositions(nextPositions);
        setGraphCanvasHorizontalPositions({});
        setGraphCanvasLayoutMode("user");
        return;
      }

      try {
        const nextPositions = await applyElkHorizontalLayout(graphCanvasData.nodes, graphCanvasData.edges);
        if (!cancelled) {
          const initialPositions = Object.keys(nextPositions).length > 0 ? nextPositions : graphCanvasPositionMap(graphCanvasData);
          setGraphCanvasPositions(initialPositions);
          setGraphCanvasUserPositions(initialPositions);
          setGraphCanvasHorizontalPositions({});
          setGraphCanvasLayoutMode("user");
        }
      } catch {
        if (!cancelled) {
          const initialPositions = graphCanvasPositionMap(graphCanvasData);
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

  function handleOpenCanvasDocument(documentId: string): void {
    void openDocumentInCenter(documentId, selectedGraphPath);
  }

  function handleSelectedNodeDocumentButtonClick(): void {
    if (selectedCanvasNode !== null && activeThreadDocumentId !== selectedCanvasNode.id) {
      void openDocumentInCenter(selectedCanvasNode.id, selectedGraphPath);
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

  function snapshotGraphCanvasPositions(documentIds?: Set<string>): GraphLayoutPositionPayload[] {
    const flow = graphCanvasFlowRef.current;
    if (flow === null) {
      return [];
    }

    // Use React Flow's save payload format (toObject) and persist only node coordinates.
    const snapshot = flow.toObject();
    return snapshot.nodes
      .filter((node) => (documentIds === undefined ? true : documentIds.has(node.id)))
      .map((node) => ({
        documentId: node.id,
        x: node.position.x,
        y: node.position.y,
      }));
  }

  async function persistGraphCanvasPosition(documentId: string, position: GraphCanvasPosition): Promise<void> {
    try {
      setGraphCanvasError("");
      const snapshotPositions = snapshotGraphCanvasPositions(new Set([documentId]));
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

  function handleSearchResultNavigate(result: SearchResult): void {
    if (result.type === "home") {
      void handleSelectHome();
      return;
    }
    void openDocumentInRightRail(result.id, result.graph);
  }

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

  async function persistDocumentTOCRatio(nextRatio: number): Promise<void> {
    if (workspace === null) {
      return;
    }

    try {
      const updatedWorkspace = await requestJSON<WorkspaceResponse>("/api/workspace", {
        method: "PUT",
        body: JSON.stringify({
          panelWidths: {
            leftRatio: workspace.panelWidths.leftRatio,
            rightRatio: workspace.panelWidths.rightRatio,
            documentTOCRatio: nextRatio,
          },
        }),
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
      const updatedWorkspace = await requestJSON<WorkspaceResponse>("/api/workspace", {
        method: "PUT",
        body: JSON.stringify({
          appearance: nextAppearance,
        }),
      });
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
      setCreateNodeFileNameError("Use only lowercase letters, numbers, hyphens, underscores, dots, and slashes.");
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
        setRenameError("Use only lowercase letters, numbers, hyphens, underscores, dots, and slashes.");
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

      const nextPosition = applyGraphCanvasLayerGuidance(
        {
          x: nextX,
          y: nextY,
        },
        graphCanvasData?.layerGuidance ?? null,
      );
      if (dragState.moved) {
        updateGraphCanvasNodePosition(dragState.documentId, nextPosition);
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

      const nextPosition = applyGraphCanvasLayerGuidance(
        {
          x: (pointerEvent.clientX - dragState.shellLeft - dragState.offsetX - vpX) / zoom,
          y: (pointerEvent.clientY - dragState.shellTop - dragState.offsetY - vpY) / zoom,
        },
        graphCanvasData?.layerGuidance ?? null,
      );
      updateGraphCanvasNodePosition(dragState.documentId, nextPosition);
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
    <div className="center-document-shell" data-thread-expanded={threadExpanded ? "true" : "false"}>
      {panelError !== "" ? <p className="status-line status-line-error">{panelError}</p> : null}
      {mutationError !== "" ? <p className="status-line status-line-error">{mutationError}</p> : null}
      {mutationSuccess !== "" ? <p className="status-line status-line-success">{mutationSuccess}</p> : null}

      {threadPanels.length === 0 ? (
        <div className="detail-empty">
          <p>Loading document content.</p>
        </div>
      ) : (
        <div
          ref={threadStackRef}
          className="thread-stack"
          data-density={threadDensityMode}
          data-multi-thread={threadPanels.length > 1 ? "true" : "false"}
          aria-label="Document thread"
        >
          {threadPanels.map((panel, index) => {
            const panelIsHome = panel.documentId === HOME_THREAD_DOCUMENT_ID;
            const panelDocument = panel.document;
            const panelTitle = panelIsHome
              ? homeFormState.title
              : panel.isActive ? formState.title : panelDocument?.title ?? panel.documentId;
            const panelDescription = panelIsHome
              ? homeFormState.description
              : panel.isActive ? formState.description : panelDocument?.description ?? "";
            const panelDocumentIsLoading = !panelIsHome && panel.isActive && isSelectedDocumentLoading && selectedDocumentId === panel.documentId;

            const panelKey = `${panel.documentId}:${index}`;
            const panelCustomWidth = threadPanelWidths[panelKey];
            const panelGraphColor = panelIsHome
              ? undefined
              : graphDirectoryColorHex(resolveGraphDirectoryColor(panel.graphPath, graphDirectoryColorsByPath));
            const threadPanelStyle = {
              ...(panelCustomWidth !== undefined ? { "--thread-panel-width": `${panelCustomWidth}px` } : {}),
              ...(panelGraphColor !== undefined ? { "--thread-graph-color": panelGraphColor } : {}),
            } as React.CSSProperties;

            return (
              <section
                key={`${panel.documentId}:${index}`}
                className={`thread-panel ${panel.isActive ? "thread-panel-active" : "thread-panel-readonly"} ${panelGraphColor ? "thread-panel-tinted" : ""}`}
                aria-label={panel.isActive ? `Active thread document ${panelTitle}` : `Thread document ${panelTitle}`}
                data-active={panel.isActive ? "true" : "false"}
                data-thread-panel-key={panelKey}
                style={threadPanelStyle}
                onClick={(event) => {
                  if (panel.isActive) {
                    return;
                  }
                  const target = event.target;
                  if (!(target instanceof HTMLElement)) {
                    return;
                  }
                  if (target.closest("button") !== null || target.closest("a") !== null) {
                    return;
                  }
                  void activateThreadDocument(panel.documentId, panel.graphPath);
                }}
              >
                <div className="thread-panel-header">
                  <div className="thread-panel-header-leading">
                    {panelIsHome ? (
                      <Badge variant="outline" className="center-document-type-badge">Home</Badge>
                    ) : panelDocument !== null ? (
                      <Badge variant="outline" className="center-document-type-badge">{formatDocumentType(panelDocument.type)}</Badge>
                    ) : null}
                  </div>
                  <div className="thread-panel-header-actions">
                    {panel.isActive ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Switch to ${nextThreadDensityLabel} thread density`}
                          title={`Switch to ${nextThreadDensityLabel} thread density`}
                          onClick={() => setThreadDensityMode(nextThreadDensityMode)}
                        >
                          <Rows3 size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={threadExpanded ? "Restore thread width" : "Expand thread to full width"}
                          title={threadExpanded ? "Restore thread width" : "Expand thread to full width"}
                          onClick={() => toggleThreadExpanded()}
                        >
                          {threadExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Previous thread panel"
                          title="Previous thread panel (Alt + Left)"
                          disabled={activeThreadPanelIndex <= 0}
                          onClick={() => moveThreadFocus(-1)}
                        >
                          <ChevronLeft size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Next thread panel"
                          title="Next thread panel (Alt + Right)"
                          disabled={activeThreadPanelIndex < 0 || activeThreadPanelIndex >= threadPanels.length - 1}
                          onClick={() => moveThreadFocus(1)}
                        >
                          <ChevronRight size={16} />
                        </Button>
                        {panelIsHome ? <>{savingHome && <span className="home-save-success">Saving…</span>}</> : (
                          <>
                            {savingDocument && <span className="home-save-success">Saving…</span>}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="center-document-toolbar-toggle"
                              data-active={centerDocumentSidePanelMode === "toc" ? "true" : "false"}
                              aria-label="Toggle table of contents"
                              aria-pressed={centerDocumentSidePanelMode === "toc"}
                              title="Toggle table of contents"
                              onClick={() => toggleCenterDocumentSidePanel("toc")}
                            >
                              <FileText size={16} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="center-document-toolbar-toggle"
                              data-active={centerDocumentSidePanelMode === "properties" ? "true" : "false"}
                              aria-label="Toggle document properties"
                              aria-pressed={centerDocumentSidePanelMode === "properties"}
                              title="Toggle document properties"
                              onClick={() => toggleCenterDocumentSidePanel("properties")}
                            >
                              <Info size={16} />
                            </Button>
                          </>
                        )}
                        {isMaximizedRightRail && (
                          <Button
                            onClick={() => toggleRightRailMaximized()}
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Minimize right pane"
                            title="Minimize right pane"
                          >
                            <Minimize2 size={16} />
                          </Button>
                        )}
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Close thread from ${panelTitle || panel.documentId}`}
                      title="Close thread"
                      onClick={() => void closeDocumentThreadFrom(index)}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </div>

                {panel.isActive && panelDocumentIsLoading ? (
                  <div className="detail-empty thread-panel-loading">
                    <p>Loading document content.</p>
                  </div>
                ) : panel.isActive && panelIsHome ? (
                  <div className="thread-panel-shell thread-panel-shell-home">
                    <div className="thread-panel-title-block">
                      <input
                        className="center-document-toolbar-title"
                        placeholder="Home title"
                        value={homeFormState.title}
                        onChange={(event) => updateHomeFormField("title", event.target.value)}
                        aria-label="Home title"
                      />
                    </div>
                    <div className="center-document-main home-document home-thread-main">
                      <div className="home-document-body center-document-body home-thread-body">
                        <RichTextEditor
                          ariaLabel="Home body editor"
                          className="home-editor"
                          inlineReferences={graphTree?.home.inlineReferences}
                          onChange={(value) => updateHomeFormField("body", value)}
                          onReferenceOpen={(documentId, graphPath) => handleInlineReferenceOpen(HOME_THREAD_DOCUMENT_ID, documentId, graphPath, "center")}
                          onDateOpen={handleDateOpen}
                          onScrollCompleted={() => setEditorScrollTarget(null)}
                          placeholder="Start writing…"
                          scrollToHeadingSlug={editorScrollTarget}
                          value={homeFormState.body}
                        />
                      </div>
                    </div>
                  </div>
                ) : panel.isActive ? (
                  <div className="thread-panel-shell">
                    <div className="thread-panel-title-block">
                      <input
                        className="center-document-toolbar-title"
                        placeholder="Document title"
                        value={formState.title}
                        onChange={(event) => updateFormField("title", event.target.value)}
                        aria-label="Document title"
                      />
                    </div>

                    <div
                      ref={centerDocumentLayoutRef}
                      className="center-document-layout"
                      aria-label="Document content layout"
                      data-side-panel={centerDocumentSidePanelMode}
                      style={{ "--document-toc-ratio": documentTOCRatio.toString() } as React.CSSProperties}
                    >
                      <div className="center-document-main home-document">
                        <div className="home-document-body center-document-body">
                          <RichTextEditor
                            ariaLabel="Document body editor"
                            inlineReferences={selectedDocument?.inlineReferences}
                            onChange={(value) => updateFormField("body", value)}
                            onReferenceOpen={(documentId, graphPath) => handleInlineReferenceOpen(panel.documentId, documentId, graphPath, "center")}
                            onDateOpen={handleDateOpen}
                            ref={centerDocumentEditorRef}
                            onScrollCompleted={() => setEditorScrollTarget(null)}
                            placeholder="Type / for headings, lists, quotes, links, and highlights"
                            scrollToHeadingSlug={editorScrollTarget}
                            value={formState.body}
                          />
                        </div>
                      </div>

                      {showCenterDocumentSidePanel && selectedDocument !== null ? (
                        <>
                          <div
                            className="center-document-toc-resizer"
                            onMouseDown={handleDocumentTOCResizeMouseDown}
                            role="separator"
                            aria-label={centerDocumentSidePanelResizerLabel}
                            aria-orientation="vertical"
                          />

                          <aside className="center-document-side-panel" aria-label={centerDocumentSidePanelLabel}>
                            <div className="center-document-toc-header center-document-side-panel-header">
                              <h4>{centerDocumentSidePanelTitle}</h4>
                              <p>{centerDocumentSidePanelDescription}</p>
                            </div>

                            {centerDocumentSidePanelMode === "toc" ? (
                              <TableOfContents items={tocItems} onNavigate={handleTOCNavigate} />
                            ) : (
                              <DocumentPropertiesPanel
                                selectedDocument={selectedDocument}
                                formState={formState}
                                linkStats={selectedDocumentLinks}
                                editableOutgoingLinks={editableOutgoingLinks}
                                availableLinkTargets={availableLinkTargets}
                                onAddOutgoingLink={addOutgoingLink}
                                onRemoveOutgoingLink={removeOutgoingLink}
                                onUpdateLinkDetail={updateEditableLinkDetail}
                                updateFormField={updateFormField}
                              />
                            )}
                          </aside>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : panelIsHome ? (
                  <div className="thread-panel-shell thread-panel-shell-readonly">
                    <div className="thread-panel-title-block">
                      <h2 className="thread-panel-title">{panelTitle}</h2>
                      {panelDescription.trim() !== "" ? <p className="thread-panel-description">{panelDescription}</p> : null}
                    </div>
                    <div
                      className="thread-panel-readonly-body thread-panel-readonly-body-home"
                      onClickCapture={(event) => {
                        const target = event.target;
                        if (!(target instanceof HTMLElement)) {
                          return;
                        }

                        const anchor = target.closest("a");
                        if (!(anchor instanceof HTMLAnchorElement)) {
                          return;
                        }

                        const href = anchor.getAttribute("href") ?? anchor.href;

                        const dateResult = parseFlowDateHref(href);
                        if (dateResult !== null) {
                          event.preventDefault();
                          handleDateOpen(dateResult.date);
                          return;
                        }

                        const reference = parseFlowReferenceHref(href);
                        if (reference === null) {
                          return;
                        }

                        event.preventDefault();
                        void handleInlineReferenceOpen(HOME_THREAD_DOCUMENT_ID, reference.documentId, reference.graphPath, "center");
                      }}
                    >
                      <div
                        className="ProseMirror thread-panel-rendered-markdown"
                        aria-label="Thread panel content for Home"
                        dangerouslySetInnerHTML={{ __html: markdownToHTML(homeFormState.body, graphTree?.home.inlineReferences) }}
                      />
                    </div>
                  </div>
                ) : panelDocument === null ? (
                  <div className="detail-empty thread-panel-loading">
                    <p>Loading document content.</p>
                  </div>
                ) : (
                  <div className="thread-panel-shell thread-panel-shell-readonly">
                    <div className="thread-panel-title-block">
                      <h2 className="thread-panel-title">{panelTitle}</h2>
                      {panelDescription.trim() !== "" ? <p className="thread-panel-description">{panelDescription}</p> : null}
                    </div>
                    <div
                      className="thread-panel-readonly-body"
                      onClickCapture={(event) => {
                        const target = event.target;
                        if (!(target instanceof HTMLElement)) {
                          return;
                        }

                        const anchor = target.closest("a");
                        if (!(anchor instanceof HTMLAnchorElement)) {
                          return;
                        }

                        const href = anchor.getAttribute("href") ?? anchor.href;

                        const dateResult = parseFlowDateHref(href);
                        if (dateResult !== null) {
                          event.preventDefault();
                          handleDateOpen(dateResult.date);
                          return;
                        }

                        const reference = parseFlowReferenceHref(href);
                        if (reference === null) {
                          return;
                        }

                        event.preventDefault();
                        void handleInlineReferenceOpen(panel.documentId, reference.documentId, reference.graphPath, "center");
                      }}
                    >
                      <div
                        className="ProseMirror thread-panel-rendered-markdown"
                        aria-label={`Thread panel content for ${panelTitle}`}
                        dangerouslySetInnerHTML={{ __html: markdownToHTML(panelDocument.body, panelDocument.inlineReferences) }}
                      />
                    </div>
                  </div>
                )}

                <div
                  className="thread-panel-resize-handle"
                  role="separator"
                  aria-label="Resize thread panel"
                  aria-orientation="vertical"
                  onMouseDown={(event) => {
                    const panelElement = event.currentTarget.closest(".thread-panel");
                    beginThreadPanelResize(event, panelElement instanceof HTMLElement ? panelElement : null, panelKey);
                  }}
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <SidebarProvider
      className={isResizingLeft ? "is-resizing-sidebar" : undefined}
      style={{ "--sidebar-width": `${leftSidebarWidth}px` } as React.CSSProperties}
    >
      {error !== "" ? <p className="status-line status-line-error">{error}</p> : null}
      <AppSidebar
        onResizeMouseDown={handleLeftSidebarMouseDown}
        topContent={workspace?.workspaceSelectionEnabled ? (
          <div className="flex flex-col gap-2 px-2 pb-2">
            <Label htmlFor="sidebar-workspace-select">Workspace</Label>
            <select
              id="sidebar-workspace-select"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={workspace.workspacePath}
              onChange={(event) => {
                void handleWorkspaceSelection(event.target.value);
              }}
              disabled={switchingWorkspace}
            >
              {(workspace.workspaces ?? [{ scope: workspace.scope, workspacePath: workspace.workspacePath }]).map((item) => (
                <option key={`${item.scope}:${item.workspacePath}`} value={item.workspacePath}>
                  {item.scope === "global" ? `* ${item.workspacePath}` : item.workspacePath}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        navigationContent={(
          <GraphTree
            graphTree={graphTree}
            activeSurface={activeSurface}
            selectedDocumentId={selectedDocumentId}
            onSelectHome={handleSelectHome}
            onSelectGraph={handleSelectGraph}
            onOpenDocument={(documentId, graphPath) => handleSelectDocument(documentId, graphPath)}
            onCreateGraph={(name) => void handleSidebarCreateGraph(name)}
            onCreateNode={(graphPath, type) => void handleSidebarCreateNode(graphPath, type)}
            onRenameGraph={handleSidebarRenameGraph}
            onRenameNode={handleSidebarRenameNode}
            onDeleteNode={handleSidebarDeleteNode}
            onDeleteGraph={(graphPath) => void handleSidebarDeleteGraph(graphPath)}
            onSetGraphColor={(graphPath, color) => void handleSidebarSetGraphColor(graphPath, color)}
          />
        )}
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

          <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setDeleteDialogTarget(null);
            }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete document?</DialogTitle>
                <DialogDescription>
                  {deleteDialogTarget === null
                    ? "This removes the selected document from the workspace."
                    : `This removes ${deleteDialogTarget.title} from the workspace.`}
                </DialogDescription>
              </DialogHeader>
              <div className="shell-dialog-actions">
                <Button onClick={() => { setDeleteDialogTarget(null); setDeleteDialogOpen(false); }} type="button" variant="secondary">
                  Cancel
                </Button>
                <Button
                  disabled={savingDocument || deletingDocument || deleteDialogTarget === null}
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    void handleDeleteDocument();
                  }}
                  type="button"
                  variant="destructive"
                >
                  {deletingDocument ? "Deleting..." : "Delete document"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="workspace-shell-body">
        <section className="middle-shell">
          {isThreadStackOpen ? (
            renderCenterDocumentShell(false)
          ) : activeSurface.kind === "home" ? (
            <div className="home-surface">
              {homeMutationError !== "" && <p className="status-line status-line-error home-status-message">{homeMutationError}</p>}
              <div className="home-surface-toolbar">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="center-document-toolbar-toggle"
                  data-active={homeTOCVisible ? "true" : "false"}
                  aria-label={homeTOCVisible ? "Hide table of contents" : "Show table of contents"}
                  aria-pressed={homeTOCVisible}
                  title={homeTOCVisible ? "Hide table of contents" : "Show table of contents"}
                  onClick={() => setHomeTOCVisible((current) => !current)}
                >
                  <FileText size={16} />
                </Button>
              </div>
              {showFreshStartGuide && (
                <section className="fresh-start-panel shell-inner-card" aria-label="Fresh workspace guide">
                  <div className="fresh-start-copy">
                    <p className="section-kicker">Fresh Workspace</p>
                    <h3>Start with Home or create your first graph.</h3>
                    <p>
                      The app is loaded. This workspace is just pristine: Home only contains its default heading, and there are no graph documents yet.
                    </p>
                    <ul className="fresh-start-list">
                      <li>Use the add button in the Content section to create your first graph or directory.</li>
                      <li>Write project context directly in Home below.</li>
                      <li>Once a graph has files, it will appear in the left tree with its documents underneath.</li>
                    </ul>
                  </div>
                </section>
              )}
              <div
                ref={homeDocumentLayoutRef}
                className="home-document-layout center-document-layout"
                aria-label="Home content layout"
                data-side-panel={homeTOCVisible ? "toc" : "hidden"}
                style={{ "--document-toc-ratio": documentTOCRatio.toString() } as React.CSSProperties}
              >
                <div className="center-document-main">
                  <RichTextEditor
                    ariaLabel="Home body editor"
                    className="home-editor"
                    inlineReferences={graphTree?.home.inlineReferences}
                    ref={homeDocumentEditorRef}
                    onChange={(value) => updateHomeFormField("body", value)}
                    onReferenceOpen={(documentId, graphPath) => handleInlineReferenceOpen(HOME_THREAD_DOCUMENT_ID, documentId, graphPath, "center")}
                    onDateOpen={handleDateOpen}
                    onScrollCompleted={() => setEditorScrollTarget(null)}
                    placeholder="Start writing…"
                    scrollToHeadingSlug={editorScrollTarget}
                    value={homeFormState.body}
                  />
                </div>

                {homeTOCVisible ? (
                  <>
                    <div
                      className="center-document-toc-resizer"
                      onMouseDown={handleHomeDocumentTOCResizeMouseDown}
                      role="separator"
                      aria-label="Resize table of contents"
                      aria-orientation="vertical"
                    />

                    <aside className="center-document-toc" aria-label="Document table of contents">
                      <div className="center-document-toc-header">
                        <h4>Table of Contents</h4>
                      </div>
                      {tocItems.length > 0 ? (
                        <nav className="toc-nav">
                          <ul className="toc-list">
                            {tocItems.map((item, index) => (
                              <li key={index} className={`toc-item toc-level-${item.level}`} style={{ marginLeft: `${(item.level - 1) * 1}rem` }}>
                                <button
                                  type="button"
                                  className="toc-link"
                                  onClick={() => handleTOCNavigate(item.id)}
                                >
                                  {item.text}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </nav>
                      ) : (
                        <p className="empty-state-inline">No headings yet.</p>
                      )}
                    </aside>
                  </>
                ) : null}
              </div>
            </div>
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
                      <section
                        className={`graph-empty-state shell-inner-card${graphCanvasDragActive ? " graph-canvas-shell-dragover" : ""}`}
                        onDragEnter={(event) => {
                          event.preventDefault();
                          if (selectedGraphPath !== "") {
                            setGraphCanvasDragActive(true);
                          }
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "copy";
                          if (selectedGraphPath !== "") {
                            setGraphCanvasDragActive(true);
                          }
                        }}
                        onDragLeave={(event) => {
                          event.preventDefault();
                          const related = event.relatedTarget;
                          if (related instanceof HTMLElement && event.currentTarget.contains(related)) {
                            return;
                          }
                          setGraphCanvasDragActive(false);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          setGraphCanvasDragActive(false);
                          if (selectedGraphPath === "") {
                            return;
                          }
                          const files = event.dataTransfer.files;
                          if (!files || files.length === 0) {
                            return;
                          }
                          void handleGraphCanvasFilesDrop(files);
                        }}
                      >
                        <div className="graph-empty-state-copy">
                          <p className="section-kicker">Empty Graph</p>
                          <h3>Start this canvas with the first document.</h3>
                          <p>
                            Create a note, task, or command directly in <strong>{selectedGraphPath}</strong>. The new document will open in the
                            right pane immediately.
                          </p>
                        </div>

                        {graphCreateError !== "" ? <p className="status-line status-line-error">{graphCreateError}</p> : null}

                        <div className="graph-create-grid">
                          <button
                            className="graph-create-action graph-create-action-note"
                            onClick={() => void handleCreateGraphDocument("note")}
                            disabled={graphCreatePendingType !== ""}
                            type="button"
                          >
                            <span className="graph-create-action-type">Note</span>
                            <strong>Capture context</strong>
                            <span>Start a knowledge card for design details, links, or working notes.</span>
                          </button>
                          <button
                            className="graph-create-action graph-create-action-task"
                            onClick={() => void handleCreateGraphDocument("task")}
                            disabled={graphCreatePendingType !== ""}
                            type="button"
                          >
                            <span className="graph-create-action-type">Task</span>
                            <strong>Define work</strong>
                            <span>Drop in a dependency-ready task and refine status, links, and body in the editor.</span>
                          </button>
                          <button
                            className="graph-create-action graph-create-action-command"
                            onClick={() => void handleCreateGraphDocument("command")}
                            disabled={graphCreatePendingType !== ""}
                            type="button"
                          >
                            <span className="graph-create-action-type">Command</span>
                            <strong>Add execution</strong>
                            <span>Seed a runnable command document with a placeholder name and shell step.</span>
                          </button>
                        </div>

                        {graphCreatePendingType !== "" ? <p className="empty-state-inline">Creating {graphCreatePendingType}...</p> : null}
                      </section>
                    ) : graphCanvasData === null ? (
                      <div className="detail-empty shell-inner-card">
                        <p>Graph canvas data is not available yet.</p>
                      </div>
                    ) : (
                      <div
                        ref={graphCanvasShellRef}
                        className={`graph-canvas-shell${connectingFrom !== null ? " canvas-connecting-mode" : ""}${graphCanvasDragActive ? " graph-canvas-shell-dragover" : ""}`}
                        onDragEnter={(event) => {
                          event.preventDefault();
                          if (selectedGraphPath !== "") {
                            setGraphCanvasDragActive(true);
                          }
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "copy";
                          if (selectedGraphPath !== "") {
                            setGraphCanvasDragActive(true);
                          }
                        }}
                        onDragLeave={(event) => {
                          event.preventDefault();
                          const related = event.relatedTarget;
                          if (related instanceof HTMLElement && event.currentTarget.contains(related)) {
                            return;
                          }
                          setGraphCanvasDragActive(false);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          setGraphCanvasDragActive(false);
                          if (selectedGraphPath === "") {
                            return;
                          }
                          const files = event.dataTransfer.files;
                          if (!files || files.length === 0) {
                            return;
                          }
                          void handleGraphCanvasFilesDrop(files);
                        }}
                      >
                        <div className="graph-canvas-toolbar">
                          <div className="graph-canvas-node-search" role="search" aria-label="Graph canvas node search">
                            <Search size={14} aria-hidden="true" />
                            <Input
                              type="search"
                              value={graphCanvasNodeSearchTerm}
                              onChange={(event) => {
                                setGraphCanvasNodeSearchTerm(event.target.value);
                                setGraphCanvasNodeSearchIndex(0);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "ArrowDown") {
                                  event.preventDefault();
                                  handleGraphCanvasSearchNext();
                                  return;
                                }

                                if (event.key === "ArrowUp") {
                                  event.preventDefault();
                                  handleGraphCanvasSearchPrevious();
                                  return;
                                }

                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  if (event.shiftKey) {
                                    handleGraphCanvasSearchPrevious();
                                    return;
                                  }
                                  handleGraphCanvasSearchNext();
                                }
                              }}
                              placeholder="Search nodes by title"
                              aria-label="Search graph nodes"
                              className="graph-canvas-node-search-input"
                            />
                            <span className="graph-canvas-node-search-count" aria-live="polite">
                              {graphCanvasNodeSearchHasMatches
                                ? `${Math.max(graphCanvasNodeSearchSelectedIndex + 1, 0)}/${graphCanvasNodeSearchMatches.length}`
                                : normalizedGraphCanvasNodeSearchTerm === "" ? "" : "0"}
                            </span>
                            <button
                              type="button"
                              className="graph-canvas-node-search-nav"
                              aria-label="Previous matching node"
                              onClick={handleGraphCanvasSearchPrevious}
                              disabled={!graphCanvasNodeSearchHasMatches}
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <button
                              type="button"
                              className="graph-canvas-node-search-nav"
                              aria-label="Next matching node"
                              onClick={handleGraphCanvasSearchNext}
                              disabled={!graphCanvasNodeSearchHasMatches}
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                          <button
                            className="graph-canvas-layout-reset"
                            type="button"
                            onClick={() => void handleToggleGraphCanvasLayout()}
                            disabled={graphCanvasResettingLayout}
                            aria-label={graphCanvasLayoutMode === "horizontal" ? "Switch to user-adjusted layout" : "Switch to horizontal layout"}
                            aria-pressed={graphCanvasLayoutMode === "horizontal"}
                            title={graphCanvasLayoutMode === "horizontal" ? "Switch to user-adjusted layout" : "Switch to horizontal layout"}
                          >
                            {graphCanvasLayoutMode === "horizontal" ? <PaintbrushVertical size={14} /> : <Rows3 size={14} />}
                          </button>
                        </div>
                        <EdgeEditContext.Provider value={handleEdgeDoubleClickAction}>
                        <ReactFlow
                          key={selectedGraphPath}
                          onInit={(instance) => {
                            graphCanvasFlowRef.current = instance;
                          }}
                          defaultViewport={graphCanvasData.viewport ?? { x: 0, y: 0, zoom: 1 }}
                          minZoom={0.5}
                          maxZoom={1.6}
                          nodes={graphCanvasNodes}
                          edges={graphCanvasEdges}
                          onNodesChange={handleGraphCanvasNodesChange}
                          onNodeClick={(_, node) => {
                            clearEdgeClickTimer();
                            setSelectedCanvasNodeId(node.id);
                            setSelectedEdgeId("");
                            setEdgeToolbar(null);
                          }}
                          onNodeDoubleClick={(_, node) => {
                            handleOpenCanvasDocument(node.id);
                          }}
                          onNodeDrag={(_, node) => {
                            updateGraphCanvasNodePosition(node.id, applyGraphCanvasLayerGuidance(node.position, graphCanvasData?.layerGuidance ?? null));
                          }}
                          onNodeDragStop={(_, node) => {
                            const nextPosition = applyGraphCanvasLayerGuidance(node.position, graphCanvasData?.layerGuidance ?? null);
                            updateGraphCanvasNodePosition(node.id, nextPosition);
                            void persistGraphCanvasPosition(node.id, nextPosition);
                          }}
                          onPaneContextMenu={(event) => {
                            event.preventDefault();
                            const shell = graphCanvasShellRef.current;
                            if (!shell) return;
                            const rect = shell.getBoundingClientRect();
                            setCanvasContextMenu({ x: event.clientX - rect.left, y: event.clientY - rect.top });
                          }}
                          onPaneClick={() => {
                            clearEdgeClickTimer();
                            setHoveredEdgeTooltip(null);
                            setSelectedCanvasNodeId("");
                            setSelectedEdgeId("");
                            setEdgeToolbar(null);
                            setCanvasContextMenu(null);
                            setShiftSelectedNodes([]);
                          }}
                          onMoveEnd={() => {
                            void persistGraphCanvasViewport({
                              x: rfViewport.x,
                              y: rfViewport.y,
                              zoom: rfViewport.zoom,
                            });
                          }}
                          nodesDraggable={false}
                          panOnDrag
                          zoomOnScroll
                          zoomOnPinch
                          zoomOnDoubleClick={false}
                          nodesConnectable={false}
                          elementsSelectable
                          proOptions={{ hideAttribution: true }}
                          edgeTypes={EDGE_TYPES}
                          onEdgeContextMenu={(event, edge: Edge) => {
                            event.preventDefault();
                            const parts = edge.id.split(":");
                            if (parts.length >= 3 && parts[0] === "link") {
                              void handleDeleteEdge(parts[1], parts[2]);
                            }
                          }}
                        >
                          <Controls showInteractive={false} />
                          <Background gap={32} color="var(--muted-foreground)" />
                        </ReactFlow>
                        </EdgeEditContext.Provider>
                        <GraphCanvasOverlayInteraction controller={graphCanvasOverlayController} />
                        <div className="graph-canvas-overlay">
                          <GraphCanvasOverlayEdges controller={graphCanvasOverlayController} />
                          <GraphCanvasOverlayNodes controller={graphCanvasOverlayController} />
                        </div>
                      </div>
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
                <div className="sidebar-document-panel" aria-label="Graph node document panel">
                <div className="sidebar-document-toolbar">
                  <div className="center-document-toolbar-leading">
                    {selectedDocument !== null && (
                      <Badge variant="outline">{formatDocumentType(selectedDocument.type)}</Badge>
                    )}
                    {savingDocument && <span className="home-save-success">Saving…</span>}
                  </div>
                  <div className="sidebar-document-toolbar-actions">
                    <Button
                      onClick={() => toggleRightRailMaximized()}
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={rightRailMaximized ? "Minimize right pane" : "Maximize right pane"}
                    >
                      {rightRailMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </Button>
                    {selectedDocument !== null && (
                      <Button onClick={openDeleteDialogForSelectedDocument} disabled={deletingDocument} type="button" variant="ghost" size="sm">
                        <Trash2 size={16} />
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        void handleCloseContextPanel();
                      }}
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Close document"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </div>

                {panelError !== "" ? <p className="status-line status-line-error">{panelError}</p> : null}
                {mutationError !== "" ? <p className="status-line status-line-error">{mutationError}</p> : null}
                {mutationSuccess !== "" ? <p className="status-line status-line-success">{mutationSuccess}</p> : null}

                {selectedDocument === null ? (
                  <div className="detail-empty">
                    <p>Loading document content.</p>
                  </div>
                ) : (
                  <div
                    ref={rightRailDocumentLayoutRef}
                    className="sidebar-document-layout"
                    aria-label="Graph node document"
                    style={{ "--document-toc-ratio": documentTOCRatio.toString() } as React.CSSProperties}
                  >
                    <div className="home-document">
                      <div className="home-document-header">
                        <input
                          className="home-document-title"
                          placeholder="Document title"
                          value={formState.title}
                          onChange={(event) => updateFormField("title", event.target.value)}
                          aria-label="Document title"
                        />
                        <input
                          className="home-document-description"
                          placeholder="Add a brief description…"
                          value={formState.description}
                          onChange={(event) => updateFormField("description", event.target.value)}
                          aria-label="Document description"
                        />
                      </div>
                      <div className="home-document-body sidebar-document-body">
                        <RichTextEditor
                          ariaLabel="Context document editor"
                          inlineReferences={selectedDocument.inlineReferences}
                          onChange={(value) => updateFormField("body", value)}
                          onReferenceOpen={(documentId, graphPath) => handleInlineReferenceOpen(selectedDocument.id, documentId, graphPath, "right-rail")}
                          onDateOpen={handleDateOpen}
                          referenceLookupGraph={selectedDocument.graph}
                          ref={rightRailDocumentEditorRef}
                          onScrollCompleted={() => setEditorScrollTarget(null)}
                          placeholder="Type / for headings, lists, quotes, links, and highlights"
                          scrollToHeadingSlug={editorScrollTarget}
                          value={formState.body}
                        />
                      </div>

                      {(selectedDocument.tags ?? []).length > 0 && (
                        <div className="chip-list">
                          {(selectedDocument.tags ?? []).map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {selectedDocumentLinks.outgoing.length > 0 && (
                        <section className="detail-section">
                          <h4>Outgoing Links</h4>
                          <div className="link-list">
                            {selectedDocumentLinks.outgoing.map((link) => (
                              <Button
                                key={`${link.nodeId}:${link.context}`}
                                variant="outline"
                                size="sm"
                                onClick={() => handleInspectDocument(link.nodeId, link.graphPath)}
                                className="rounded-full h-7 px-3 text-xs"
                                type="button"
                              >
                                {link.nodeId}{link.context ? ` — ${link.context}` : ""}
                              </Button>
                            ))}
                          </div>
                        </section>
                      )}

                      {selectedDocumentLinks.incoming.length > 0 && (
                        <section className="detail-section">
                          <h4>Incoming Links</h4>
                          <div className="link-list">
                            {selectedDocumentLinks.incoming.map((link) => (
                              <Button
                                key={`${link.nodeId}:${link.context}`}
                                variant="outline"
                                size="sm"
                                onClick={() => handleInspectDocument(link.nodeId, link.graphPath)}
                                className="rounded-full h-7 px-3 text-xs"
                                type="button"
                              >
                                {link.nodeId}{link.context ? ` — ${link.context}` : ""}
                              </Button>
                            ))}
                          </div>
                        </section>
                      )}

                      {selectedDocument.run && (
                        <section className="detail-section">
                          <h4>Run Command</h4>
                          <pre className="run-block">{selectedDocument.run}</pre>
                        </section>
                      )}
                    </div>

                    <div
                      className="sidebar-document-toc-resizer"
                      onMouseDown={handleRightRailDocumentTOCResizeMouseDown}
                      role="separator"
                      aria-label="Resize table of contents"
                      aria-orientation="vertical"
                    />

                    <aside className="sidebar-document-toc" aria-label="Document table of contents">
                      <div className="sidebar-document-toc-header">
                        <h4>Table of Contents</h4>
                      </div>
                      {tocItems.length > 0 ? (
                        <nav className="toc-nav">
                          <ul className="toc-list">
                            {tocItems.map((item, index) => (
                              <li key={index} className={`toc-item toc-level-${item.level}`} style={{ marginLeft: `${(item.level - 1) * 1}rem` }}>
                                <button
                                  type="button"
                                  className="toc-link"
                                  onClick={() => handleTOCNavigate(item.id)}
                                >
                                  {item.text}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </nav>
                      ) : (
                        <p className="empty-state-inline">No headings yet.</p>
                      )}
                    </aside>
                  </div>
                )}
              </div>
              )
            ) : rightPanelTab === "search" ? (
              <Card className="detail-card-context shell-context-card">
                <CardHeader className="panel-header shell-context-header">
                  <div>
                    <h3>Search</h3>
                  </div>
                </CardHeader>
                <CardContent className="shell-context-content">
                  <div className="right-search-field">
                    <Search aria-hidden="true" className="right-search-icon" size={16} />
                    <Input
                      aria-label="Search all fields"
                      autoFocus
                      className="shell-search-input shell-search-input-with-icon"
                      placeholder="Any field"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      aria-label="Search by tag"
                      placeholder="Tag"
                      value={searchTagQuery}
                      onChange={(e) => setSearchTagQuery(e.target.value)}
                    />
                    <Input
                      aria-label="Search by title"
                      placeholder="Title"
                      value={searchTitleQuery}
                      onChange={(e) => setSearchTitleQuery(e.target.value)}
                    />
                    <Input
                      aria-label="Search by description"
                      placeholder="Description"
                      value={searchDescriptionQuery}
                      onChange={(e) => setSearchDescriptionQuery(e.target.value)}
                    />
                    <Input
                      aria-label="Search by content"
                      placeholder="Content"
                      value={searchContentQuery}
                      onChange={(e) => setSearchContentQuery(e.target.value)}
                    />
                  </div>
                  {searchError !== "" && <p className="status-line status-line-error">{searchError}</p>}
                  {hasDeferredSearchFilter && (
                    <div className="search-results">
                      {searchResults.length === 0 ? (
                        <p className="empty-state-inline">No indexed matches.</p>
                      ) : (
                        searchResults.map((result) => (
                          <button
                            key={result.id}
                            className="search-result"
                            type="button"
                            onClick={() => handleSearchResultNavigate(result)}
                          >
                            <span className="search-result-type">{formatDocumentType(result.type)}</span>
                            <strong>{result.title}</strong>
                              <span className="item-file-name">{result.type === "home" ? "Workspace Home" : fileNameFromPath(result.path)}</span>
                            <span className="item-path">{result.path}</span>
                            {result.type !== "home" && <span>{result.graph}</span>}
                            {result.description !== "" && <p className="search-result-description">{result.description}</p>}
                            <p>{result.snippet}</p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : rightPanelTab === "calendar" ? (
                <Card className="detail-card-context shell-context-card home-cal-card">
                  <CardContent className="shell-context-content p-0">
                    <HomeCalendarPanel
                      documents={calendarDocumentsForDisplay}
                      selectedDate={calendarFocusDate}
                      onDateChange={setCalendarFocusDate}
                      onDocumentOpen={(doc) => {
                        if (doc.type === "home") {
                          void handleSelectHome();
                        } else {
                          handleSelectDocument(doc.id, doc.graph);
                        }
                      }}
                      error={calendarError}
                    />
                  </CardContent>
                </Card>
              ) : null)}
          </div>
        </aside>
        </div>
        <div className="right-sidebar-icons">
            <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="right-rail-icon-btn"
                    aria-label="Settings"
                    onClick={() => setSettingsDialogOpen(true)}
                  >
                    <Settings size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Settings</TooltipContent>
            </Tooltip>
            <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
              <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
                <DialogTitle className="sr-only">Settings</DialogTitle>
                <DialogDescription className="sr-only">Customize your settings here.</DialogDescription>
                <SidebarProvider className="items-start">
                  <Sidebar collapsible="none" className="hidden md:flex">
                    <SidebarContent>
                      <SidebarGroup>
                        <SidebarGroupContent>
                          <SidebarMenu>
                            {[
                              { value: "general" as const, label: "General", icon: Info },
                              { value: "theme" as const, label: "Appearance", icon: PaintbrushVertical },
                              { value: "stop" as const, label: "Danger Zone", icon: TriangleAlert },
                            ].map((item) => (
                              <SidebarMenuItem key={item.value}>
                                <SidebarMenuButton
                                  isActive={settingsTab === item.value}
                                  onClick={() => setSettingsTab(item.value)}
                                >
                                  <item.icon />
                                  <span>{item.label}</span>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </SidebarGroupContent>
                      </SidebarGroup>
                    </SidebarContent>
                  </Sidebar>
                  <main className="flex h-[480px] flex-1 flex-col overflow-hidden">
                    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                      <Breadcrumb>
                        <BreadcrumbList>
                          <BreadcrumbItem className="hidden md:block">
                            <span className="text-sm text-muted-foreground">Settings</span>
                          </BreadcrumbItem>
                          <BreadcrumbSeparator />
                          <BreadcrumbItem>
                            <BreadcrumbPage>
                              {settingsTab === "general" ? "General" : settingsTab === "theme" ? "Appearance" : "Danger Zone"}
                            </BreadcrumbPage>
                          </BreadcrumbItem>
                        </BreadcrumbList>
                      </Breadcrumb>
                    </header>
                    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
                      {settingsTab === "general" && (
                        workspace ? (
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                              <Label>Path</Label>
                              <div className="text-sm text-muted-foreground break-all">{workspace.workspacePath}</div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Label>Scope</Label>
                              <div className="text-sm text-muted-foreground">{workspace.scope}</div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Label>GUI Port</Label>
                              <div className="text-sm text-muted-foreground">{workspace.guiPort}</div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Label>Config</Label>
                              <div className="text-sm text-muted-foreground break-all">{workspace.configPath}</div>
                            </div>
                            <div className="flex flex-col gap-3 rounded-lg border p-4">
                              <div className="flex flex-col gap-1">
                                <Label>Refresh index</Label>
                                <p className="text-sm text-muted-foreground">
                                  Rebuild the derived index after files are changed outside the app so search, graphs, and open documents reflect the latest state.
                                </p>
                              </div>
                              <div>
                                <Button disabled={rebuildingIndex} onClick={() => void handleRebuildIndex()} type="button" variant="outline">
                                  {rebuildingIndex ? "Refreshing index..." : "Refresh index"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No workspace loaded.</p>
                        )
                      )}
                      {settingsTab === "theme" && (
                        <RadioGroup value={theme} onValueChange={(v) => { void handleAppearanceChange(v as "light" | "dark" | "system"); }}>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="light" id="r1" />
                            <Label htmlFor="r1">Light</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="dark" id="r2" />
                            <Label htmlFor="r2">Dark</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="system" id="r3" />
                            <Label htmlFor="r3">System</Label>
                          </div>
                        </RadioGroup>
                      )}
                      {settingsTab === "stop" && (
                        <div className="flex flex-col gap-4">
                          <p className="text-sm text-muted-foreground">
                            This closes the loopback server for the current workspace until you run Flow GUI again.
                          </p>
                          <Button disabled={stoppingGUI} onClick={() => void handleStopGUI()} type="button" variant="destructive">
                            {stoppingGUI ? "Stopping GUI..." : "Stop GUI"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </main>
                </SidebarProvider>
              </DialogContent>
            </Dialog>
            <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`right-rail-icon-btn${rightPanelTab === "search" && !rightRailCollapsed ? " right-rail-icon-btn-active" : ""}`}
                    aria-label="Search"
                    onClick={() => toggleRightPanel("search")}
                  >
                    <Search size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Search</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`right-rail-icon-btn${rightPanelTab === "calendar" && !rightRailCollapsed ? " right-rail-icon-btn-active" : ""}`}
                    aria-label="Calendar"
                    onClick={() => toggleRightPanel("calendar")}
                  >
                    <CalendarDays size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Calendar</TooltipContent>
            </Tooltip>
            <Tooltip>
                {showRightRailDocumentButton ? (
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`right-rail-icon-btn${rightPanelTab === "document" && !rightRailCollapsed && selectedNodeMatchesRightRailDocument ? " right-rail-icon-btn-active" : ""}`}
                      aria-label="Document"
                      onClick={() => handleSelectedNodeDocumentButtonClick()}
                    >
                      <FileText size={18} />
                    </button>
                  </TooltipTrigger>
                ) : null}
                {showRightRailDocumentButton ? <TooltipContent side="left">Document</TooltipContent> : null}
            </Tooltip>
          </div>
      </SidebarInset>
      <Dialog open={createNodeDialog !== null} onOpenChange={(open) => { if (!open) setCreateNodeDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New {createNodeDialog ? formatDocumentType(createNodeDialog.type) : ""}</DialogTitle>
            <DialogDescription>
              Choose a file name for the new document. Use lowercase letters, numbers, and hyphens.
            </DialogDescription>
          </DialogHeader>
          <div className="shell-dialog-actions" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
            <Label htmlFor="create-node-filename">File name</Label>
            <Input
              id="create-node-filename"
              value={createNodeFileName}
              onChange={(e) => { setCreateNodeFileName(e.target.value); setCreateNodeFileNameError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") void handleConfirmCreateNode(); }}
              placeholder="my-task"
              autoFocus
            />
            {createNodeFileNameError !== "" && <p className="status-line status-line-error">{createNodeFileNameError}</p>}
            <div className="shell-dialog-actions">
              <Button onClick={() => setCreateNodeDialog(null)} type="button" variant="secondary">Cancel</Button>
              <Button onClick={() => void handleConfirmCreateNode()} type="button" disabled={graphCreatePendingType !== ""}>
                {graphCreatePendingType !== "" ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={renameDialog !== null} onOpenChange={(open) => { if (!open) setRenameDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{renameDialog?.kind === "graph" ? "Rename graph" : "Rename node"}</DialogTitle>
            <DialogDescription>
              {renameDialog?.kind === "graph"
                ? "Choose the new graph path for this content tree entry."
                : "Choose the new file name for this node. The .md extension is optional."}
            </DialogDescription>
          </DialogHeader>
          <div className="shell-dialog-actions" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
            <Label htmlFor="rename-input">{renameDialog?.kind === "graph" ? "Graph path" : "File name"}</Label>
            <Input
              id="rename-input"
              value={renameValue}
              onChange={(e) => { setRenameValue(e.target.value); setRenameError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") void handleConfirmRename(); }}
              placeholder={renameDialog?.kind === "graph" ? "projects/backend" : "my-task"}
              autoFocus
            />
            {renameError !== "" && <p className="status-line status-line-error">{renameError}</p>}
            <div className="shell-dialog-actions">
              <Button onClick={() => setRenameDialog(null)} type="button" variant="secondary">Cancel</Button>
              <Button onClick={() => void handleConfirmRename()} type="button" disabled={renamePending}>
                {renamePending ? "Renaming..." : "Rename"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
