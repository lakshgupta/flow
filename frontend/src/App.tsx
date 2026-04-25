import {
  applyNodeChanges,
  Background,
  Controls,
  getSmoothStepPath,
  ReactFlow,
  ReactFlowProvider,
  useViewport,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { CalendarDays, CheckSquare, FileText, Info, Maximize2, Minimize2, PaintbrushVertical, Search, Settings, Terminal, Trash2, TriangleAlert, X } from "lucide-react";
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { AppSidebar } from "./components/AppSidebar";
import { GraphTree } from "./components/GraphTree";
import { HomeCalendarPanel } from "./components/HomeCalendarPanel";
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
import { requestJSON, loadCalendarDocuments, loadWorkspaceSnapshot } from "./lib/api";
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
  applyForceLayout,
  applyGraphCanvasLayerGuidance,
  buildGraphCanvasFlowEdges,
  buildGraphCanvasFlowNodes,
  ContextEdge,
  EdgeEditContext,
  countConnectedGraphCanvasEdges,
  graphCanvasOverlayPosition,
  graphCanvasTypeLabel,
  normalizeGraphCanvasResponse,
  selectedGraphCanvasNode,
  pickBestEdgePorts,
} from "./lib/graphCanvasUtils";
import { useTheme } from "./lib/theme";
import { todayString } from "./lib/dateEntries";
import { toErrorMessage } from "./lib/utils";
import type { EdgeTypes } from "@xyflow/react";

const EDGE_TYPES: EdgeTypes = { contextEdge: ContextEdge };

import { RichTextEditor } from "./components/editor/RichTextEditor";
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
  graphPath: string;
};

const DEFAULT_DOCUMENT_TOC_RATIO = 0.18;
const MIN_DOCUMENT_TOC_RATIO = 0.14;
const MAX_DOCUMENT_TOC_RATIO = 0.32;
const DOCUMENT_FILE_NAME_PATTERN = /^[a-z0-9][a-z0-9._/-]*$/;

function clampDocumentTOCRatio(value: number): number {
  return Math.min(Math.max(value, MIN_DOCUMENT_TOC_RATIO), MAX_DOCUMENT_TOC_RATIO);
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


function FlowApp() {
  const { theme, setTheme } = useTheme();
  const rfViewport = useViewport();
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [graphTree, setGraphTree] = useState<GraphTreeResponse | null>(null);
  const [graphCanvasData, setGraphCanvasData] = useState<GraphCanvasResponse | null>(null);
  const [graphCanvasLoading, setGraphCanvasLoading] = useState<boolean>(false);
  const [graphCanvasError, setGraphCanvasError] = useState<string>("");
  const [graphCanvasPositions, setGraphCanvasPositions] = useState<Record<string, GraphCanvasPosition>>({});
  const [graphCanvasReloadToken, setGraphCanvasReloadToken] = useState<number>(0);
  const [selectedCanvasNodeId, setSelectedCanvasNodeId] = useState<string>("");
  const [graphCreatePendingType, setGraphCreatePendingType] = useState<GraphCreateType | "">("");
  const [graphCreateError, setGraphCreateError] = useState<string>("");
  const [activeSurface, setActiveSurface] = useState<SurfaceState>({ kind: "home" });
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [selectedDocumentOpenMode, setSelectedDocumentOpenMode] = useState<DocumentOpenMode>("right-rail");
  const [selectedDocument, setSelectedDocument] = useState<DocumentResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [searchError, setSearchError] = useState<string>("");
  const [panelError, setPanelError] = useState<string>("");
  const [stoppingGUI, setStoppingGUI] = useState<boolean>(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "theme" | "stop">("general");
  const [formState, setFormState] = useState<DocumentFormState>(emptyDocumentFormState);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [deleteDialogTarget, setDeleteDialogTarget] = useState<DeleteDialogState | null>(null);
  const [createNodeDialog, setCreateNodeDialog] = useState<{ type: GraphCreateType; graphPath: string; origin: "canvas" | "sidebar" } | null>(null);
  const [createNodeFileName, setCreateNodeFileName] = useState<string>("");
  const [createNodeFileNameError, setCreateNodeFileNameError] = useState<string>("");
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [renameError, setRenameError] = useState<string>("");
  const [renamePending, setRenamePending] = useState<boolean>(false);
  const [editingEdge, setEditingEdge] = useState<{ sourceId: string; targetId: string; context: string } | null>(null);
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
  const [centerDocumentSidePanelMode, setCenterDocumentSidePanelMode] = useState<CenterDocumentSidePanelMode>("toc");
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
  const connectingTargetRef = useRef<string | null>(null);
  const homeFormStateRef = useRef<HomeFormState>(emptyHomeFormState);
  const homeAutoSaveTimerRef = useRef<number | null>(null);
  const documentAutoSaveTimerRef = useRef<number | null>(null);
  const edgeClickTimerRef = useRef<number | null>(null);
  const formStateRef = useRef<DocumentFormState>(emptyDocumentFormState);
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

  const graphCanvasNodes = buildGraphCanvasFlowNodes(graphCanvasData, graphCanvasPositions, selectedCanvasNodeId, selectedDocumentId);
  const graphCanvasEdgesRaw = buildGraphCanvasFlowEdges(graphCanvasData, selectedCanvasNodeId);
  const graphCanvasEdges = selectedEdgeId === ""
    ? graphCanvasEdgesRaw
    : graphCanvasEdgesRaw.map((e) => e.id === selectedEdgeId ? { ...e, selected: true } : e);
  const selectedGraphNode = graphTree?.graphs.find((graphNode) => graphNode.graphPath === selectedGraphPath) ?? null;
  const selectedCanvasNode = selectedGraphCanvasNode(graphCanvasData, selectedCanvasNodeId);
  const selectedCanvasNodeEdgeCount = countConnectedGraphCanvasEdges(graphCanvasData, selectedCanvasNodeId);
  const workspaceSurfaceSection = activeSurface.kind === "graph" ? "Content" : "Home";
  const workspaceSurfaceTitle = activeSurface.kind === "graph" ? selectedGraphNode?.displayName ?? selectedGraphPath : null;
  const isCenterDocumentOpen = selectedDocumentId !== "" && selectedDocumentOpenMode === "center";
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
  const documentGraphById = useMemo(() => {
    const graphByID = new Map<string, string>();

    for (const graphNode of graphTree?.graphs ?? []) {
      for (const file of graphNode.files) {
        graphByID.set(file.id, graphNode.graphPath);
      }
    }

    return graphByID;
  }, [graphTree]);
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
      graphPath: documentGraphById.get(link.node) ?? selectedDocument.graph,
    }));

    const incomingByNodeId = new Map<string, DocumentLinkDetail>();

    for (const nodeId of selectedDocument.relatedNoteIds ?? []) {
      incomingByNodeId.set(nodeId, {
        nodeId,
        context: "",
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
        graphPath: documentGraphById.get(edge.source) ?? selectedDocument.graph,
      });
    }

    const incoming = Array.from(incomingByNodeId.values());

    return { outgoing, incoming };
  }, [documentGraphById, graphCanvasData?.edges, selectedDocument]);

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

    setCenterDocumentSidePanelMode("toc");
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

  const syncSelectedDocumentState = useCallback((document: DocumentResponse | null): void => {
    selectedDocumentRef.current = document;
    setSelectedDocument(document);
    const nextFormState = createDocumentFormState(document);
    formStateRef.current = nextFormState;
    setFormState(nextFormState);
  }, []);

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
    setRightRailMaximized(false);
    setRightRailCollapsed(true);
  }

  function toggleRightPanel(tab: RightPanelTab | "document"): void {
    if (rightPanelTab === tab && !rightRailCollapsed) {
      collapseRightRail();
      return;
    }

    if (tab !== "document") {
      setRightRailMaximized(false);
    }

    setRightPanelTab(tab);
    setRightRailCollapsed(false);
  }

  function toggleCenterDocumentSidePanel(panel: Exclude<CenterDocumentSidePanelMode, "hidden">): void {
    setCenterDocumentSidePanelMode((current) => (current === panel ? "hidden" : panel));
  }

  function openDocumentInCenter(documentId: string, graphPath: string): void {
    clearSurfaceFeedback();
    startTransition(() => {
      setActiveSurface({ kind: "graph", graphPath });
    });
    setSelectedCanvasNodeId(documentId);
    setSelectedDocumentOpenMode("center");
    setSelectedDocumentId(documentId);
    if (rightPanelTab === "document") {
      setRightPanelTab("search");
      setRightRailCollapsed(true);
    }
  }

  function openDocumentInRightRail(documentId: string, graphPath: string): void {
    clearSurfaceFeedback();
    startTransition(() => {
      setActiveSurface({ kind: "graph", graphPath });
    });
    setSelectedCanvasNodeId(documentId);
    setSelectedDocumentOpenMode("right-rail");
    setSelectedDocumentId(documentId);
    setRightPanelTab("document");
    setRightRailMaximized(false);
    setRightRailCollapsed(false);
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
    payload: { fromId: string; toId: string; context?: string },
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

  function openEdgeEditor(sourceId: string, targetId: string, context: string, edgeId?: string): void {
    clearEdgeClickTimer();
    if (edgeId !== undefined) {
      setSelectedEdgeId(edgeId);
    }
    setEditingEdge({ sourceId, targetId, context });
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
      if (deferredSearchQuery === "") {
        setSearchResults([]);
        setSearchError("");
        return;
      }

      try {
        setSearchError("");
        const response = await requestJSON<SearchResult[]>(`/api/search?q=${encodeURIComponent(deferredSearchQuery)}&limit=8`);
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
  }, [deferredSearchQuery]);

  useEffect(() => {
    if (graphCanvasData === null) {
      setGraphCanvasPositions({});
      return;
    }
    setGraphCanvasPositions(applyForceLayout(graphCanvasData.nodes, graphCanvasData.edges));
  }, [graphCanvasData]);

  useEffect(() => {
    if (selectedGraphPath === "") {
      setGraphCanvasData(null);
      setGraphCanvasLoading(false);
      setGraphCanvasError("");
      setGraphCanvasPositions({});
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

  async function refreshShellViews(options?: { nextDocument?: DocumentResponse | null; nextDocumentId?: string }): Promise<void> {
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

    if (deferredSearchQuery !== "") {
      const response = await requestJSON<SearchResult[]>(`/api/search?q=${encodeURIComponent(deferredSearchQuery)}&limit=8`);
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
    syncSelectedDocumentState(null);
    setDeleteDialogTarget(null);
    setDeleteDialogOpen(false);
    clearSurfaceFeedback();
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

  function handleSelectHome(): void {
    clearContextPanel();
    setGraphCanvasError("");
    setGraphCreateError("");
    setSelectedCanvasNodeId("");
    startTransition(() => {
      setActiveSurface({ kind: "home" });
    });
  }

  function handleSelectGraph(graphPath: string): void {
    clearContextPanel();
    setGraphCanvasError("");
    setGraphCreateError("");
    setSelectedCanvasNodeId("");
    startTransition(() => {
      setActiveSurface({ kind: "graph", graphPath });
    });
  }

  function handleOpenCanvasDocument(documentId: string): void {
    openDocumentInRightRail(documentId, selectedGraphPath);
  }

  function handleSelectedNodeDocumentButtonClick(): void {
    if (selectedCanvasNode !== null && !selectedNodeMatchesRightRailDocument) {
      openDocumentInRightRail(selectedCanvasNode.id, selectedGraphPath);
      return;
    }

    toggleRightPanel("document");
  }

  function updateGraphCanvasNodePosition(documentId: string, position: GraphCanvasPosition): void {
    setGraphCanvasPositions((current) => ({ ...current, [documentId]: position }));
  }

  async function persistGraphCanvasPosition(documentId: string, position: GraphCanvasPosition): Promise<void> {
    if (selectedGraphPath === "") {
      return;
    }

    try {
      setGraphCanvasError("");
      const response = await requestJSON<GraphLayoutResponse>("/api/graph-layout", {
        method: "PUT",
        body: JSON.stringify({
          graph: selectedGraphPath,
          positions: [{ documentId, x: position.x, y: position.y }],
        }),
      });
      const persistedPosition = response.positions[0];
      if (persistedPosition === undefined) {
        return;
      }

      setGraphCanvasData((current) => {
        if (current === null) {
          return current;
        }

        return {
          ...current,
          nodes: current.nodes.map((node) =>
            node.id === documentId
              ? {
                  ...node,
                  position: { x: persistedPosition.x, y: persistedPosition.y },
                  positionPersisted: true,
                }
              : node,
          ),
        };
      });
    } catch (saveError) {
      setGraphCanvasError(toErrorMessage(saveError));
    }
  }

  function handleGraphCanvasNodesChange(changes: NodeChange<Node<GraphCanvasFlowNodeData>>[]): void {
    setGraphCanvasPositions((current) => {
      const currentNodes = graphCanvasNodes.map((node) => ({ ...node, position: current[node.id] ?? node.position }));
      const nextNodes = applyNodeChanges(changes, currentNodes);
      return Object.fromEntries(nextNodes.map((node) => [node.id, node.position]));
    });
  }

  function handleSelectDocument(documentId: string, graphPath: string): void {
    openDocumentInCenter(documentId, graphPath);
  }

  function handleInspectDocument(documentId: string, graphPath: string): void {
    openDocumentInRightRail(documentId, graphPath);
  }

  function handleSearchResultNavigate(result: SearchResult): void {
    if (result.type === "home") {
      handleSelectHome();
      return;
    }
    openDocumentInRightRail(result.id, result.graph);
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
      if (origin === "canvas") {
        setSelectedDocumentOpenMode("right-rail");
        setRightPanelTab("document");
        setRightRailCollapsed(false);
        await refreshShellViews({ nextDocument: createdDocument, nextDocumentId: createdDocument.id });
        setSelectedCanvasNodeId(createdDocument.id);
        setMutationError("");
        setMutationSuccess(`${formatDocumentType(createdDocument.type)} created.`);
      } else {
        const snapshot = await loadWorkspaceSnapshot();
        setGraphTree(snapshot.graphTreeData);
        startTransition(() => setActiveSurface({ kind: "graph", graphPath }));
        setSelectedCanvasNodeId(createdDocument.id);
        setSelectedDocumentOpenMode("right-rail");
        setSelectedDocumentId(createdDocument.id);
        setRightPanelTab("document");
        setRightRailCollapsed(false);
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
    try {
      setSavingDocument(true);
      setMutationError("");

      const payload: Record<string, unknown> = {
        title: state.title,
        description: state.description,
        graph: state.graph,
        tags: splitList(state.tags),
        body: state.body,
        links: splitList(state.links).map((id): NodeLink => ({ node: id })),
      };

      if (doc.type === "task") {
        payload.status = state.status;
        payload.dependsOn = splitList(state.dependsOn);
      }

      if (doc.type === "command") {
        payload.name = state.name;
        payload.run = state.run;
        payload.dependsOn = splitList(state.dependsOn);
        payload.env = parseEnv(state.env);
      }

      const updatedDocument = await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(doc.id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      await refreshShellViews({ nextDocument: updatedDocument, nextDocumentId: updatedDocument.id });
    } catch (mutationFailure) {
      setMutationError(toErrorMessage(mutationFailure));
    } finally {
      setSavingDocument(false);
    }
  }

  async function handleSaveHomeContent(state: HomeFormState): Promise<void> {
    try {
      setSavingHome(true);
      setHomeMutationError("");

      await requestJSON<HomeResponse>("/api/home", {
        method: "PUT",
        body: JSON.stringify({
          title: state.title,
          description: state.description,
          body: state.body,
        }),
      });

      await refreshShellViews();
    } catch (mutationFailure) {
      setHomeMutationError(toErrorMessage(mutationFailure));
    } finally {
      setSavingHome(false);
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

  async function handleUpdateEdgeContext(sourceId: string, targetId: string, context: string): Promise<void> {
    await mutateEdge("PATCH", { fromId: sourceId, toId: targetId, context });
  }

  function clearEdgeClickTimer(): void {
    if (edgeClickTimerRef.current !== null) {
      window.clearTimeout(edgeClickTimerRef.current);
      edgeClickTimerRef.current = null;
    }
  }

  function handleGraphCanvasEdgeClick(edgeId: string, sourceId: string): void {
    clearEdgeClickTimer();
    setSelectedEdgeId(edgeId);
    edgeClickTimerRef.current = window.setTimeout(() => {
      edgeClickTimerRef.current = null;
      handleOpenCanvasDocument(sourceId);
    }, 220);
  }

  function handleGraphCanvasEdgeDoubleClick(sourceId: string, targetId: string, context: string, edgeId: string): void {
    openEdgeEditor(sourceId, targetId, context, edgeId);
  }

  function handleGraphCanvasEdgeHover(edgeId: string, context: string, x: number, y: number): void {
    if (context.trim() === "") {
      setHoveredEdgeTooltip(null);
      return;
    }
    setHoveredEdgeTooltip({ edgeId, context, x, y });
  }

  // Stable callback passed via context into ContextEdge for the "edit context" button.
  const handleEdgeDoubleClickAction = useCallback((sourceId: string, targetId: string, context: string) => {
    openEdgeEditor(sourceId, targetId, context);
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
    <div className="center-document-shell">
      <div className="center-document-toolbar">
        <div className="center-document-toolbar-leading">
          {selectedDocument !== null && (
            <Badge variant="outline" className="center-document-type-badge">{formatDocumentType(selectedDocument.type)}</Badge>
          )}
          {selectedDocument !== null && (
            <>
              <Separator className="center-document-toolbar-separator" orientation="vertical" />
              <input
                className="center-document-toolbar-title"
                placeholder="Document title"
                value={formState.title}
                onChange={(event) => updateFormField("title", event.target.value)}
                aria-label="Document title"
              />
            </>
          )}
          {savingDocument && <span className="home-save-success">Saving…</span>}
        </div>
        <div className="center-document-toolbar-actions">
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
                onChange={(value) => updateFormField("body", value)}
                onScrollCompleted={() => setEditorScrollTarget(null)}
                placeholder="Type / for headings, lists, quotes, links, and highlights"
                scrollToHeadingSlug={editorScrollTarget}
                value={formState.body}
              />
            </div>
          </div>

          {showCenterDocumentSidePanel ? (
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
                    updateFormField={updateFormField}
                  />
                )}
              </aside>
            </>
          ) : null}
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
          {activeSurface.kind === "home" ? (
            <div className="home-surface">
              {homeMutationError !== "" && <p className="status-line status-line-error home-status-message">{homeMutationError}</p>}
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
                style={{ "--document-toc-ratio": documentTOCRatio.toString() } as React.CSSProperties}
              >
                <div className="center-document-main">
                  <RichTextEditor
                    ariaLabel="Home body editor"
                    className="home-editor"
                    onChange={(value) => updateHomeFormField("body", value)}
                    onScrollCompleted={() => setEditorScrollTarget(null)}
                    placeholder="Start writing…"
                    scrollToHeadingSlug={editorScrollTarget}
                    value={homeFormState.body}
                  />
                </div>

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
              </div>
            </div>
          ) : isCenterDocumentOpen ? (
            renderCenterDocumentShell(false)
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
                      <section className="graph-empty-state shell-inner-card">
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
                      <div ref={graphCanvasShellRef} className="graph-canvas-shell">
                        <EdgeEditContext.Provider value={handleEdgeDoubleClickAction}>
                        <ReactFlow
                          key={selectedGraphPath}
                          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                          minZoom={0.5}
                          maxZoom={1.6}
                          nodes={graphCanvasNodes}
                          edges={graphCanvasEdges}
                          onNodesChange={handleGraphCanvasNodesChange}
                          onNodeClick={(_, node) => {
                            clearEdgeClickTimer();
                            setSelectedCanvasNodeId(node.id);
                            setSelectedEdgeId("");
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
                          onPaneClick={() => { clearEdgeClickTimer(); setHoveredEdgeTooltip(null); setSelectedCanvasNodeId(""); setSelectedEdgeId(""); setCanvasContextMenu(null); setShiftSelectedNodes([]); }}
                          nodesDraggable={false}
                          panOnDrag
                          zoomOnScroll
                          zoomOnPinch
                          zoomOnDoubleClick={false}
                          nodesConnectable={false}
                          elementsSelectable
                          proOptions={{ hideAttribution: true }}
                          edgeTypes={EDGE_TYPES}
                          onEdgeClick={(_, edge) => {
                            const parts = edge.id.split(":");
                            if (parts.length >= 3 && parts[0] === "link") {
                              setSelectedEdgeId(edge.id);
                              handleOpenCanvasDocument(parts[1]);
                            }
                          }}
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
                        {canvasContextMenu && (
                          <div
                            className="canvas-context-menu"
                            style={{ left: canvasContextMenu.x, top: canvasContextMenu.y }}
                            onContextMenu={(e) => e.preventDefault()}
                          >
                            <button type="button" className="flow-dropdown-item" onClick={() => { setCanvasContextMenu(null); void handleCreateGraphDocument("note"); }}>
                              <FileText size={13} /> Add note
                            </button>
                            <button type="button" className="flow-dropdown-item" onClick={() => { setCanvasContextMenu(null); void handleCreateGraphDocument("task"); }}>
                              <CheckSquare size={13} /> Add task
                            </button>
                            <button type="button" className="flow-dropdown-item" onClick={() => { setCanvasContextMenu(null); void handleCreateGraphDocument("command"); }}>
                              <Terminal size={13} /> Add command
                            </button>
                          </div>
                        )}
                        {connectingFrom !== null && connectingPointerPos !== null && connectingStartPos !== null && (
                          <svg
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9998 }}
                          >
                            <line
                              x1={connectingStartPos.x}
                              y1={connectingStartPos.y}
                              x2={connectingPointerPos.x}
                              y2={connectingPointerPos.y}
                              stroke="var(--graph-edge)"
                              strokeWidth={2.5}
                              strokeDasharray="6 4"
                            />
                            <circle
                              cx={connectingPointerPos.x}
                              cy={connectingPointerPos.y}
                              r={5}
                              fill={connectingTarget !== null ? "var(--graph-edge)" : "var(--graph-edge-hover)"}
                            />
                          </svg>
                        )}
                        <div className="graph-canvas-overlay">
                          {graphCanvasData.edges.length > 0 && (
                            <svg
                              style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                overflow: "visible",
                                pointerEvents: "none",
                              }}
                            >
                              <defs>
                                <marker id="graph-canvas-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                                  <path d="M 0 0 L 10 3.5 L 0 7 Z" fill="var(--graph-edge)" />
                                </marker>
                                <marker id="graph-canvas-arrow-dim" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                                  <path d="M 0 0 L 10 3.5 L 0 7 Z" fill="var(--graph-edge-dim)" />
                                </marker>
                              </defs>
                              <g transform={`translate(${rfViewport.x} ${rfViewport.y}) scale(${rfViewport.zoom})`}>
                                {graphCanvasData.edges.map((edge) => {
                                  const sourceNode = graphCanvasNodes.find((node) => node.id === edge.source);
                                  const targetNode = graphCanvasNodes.find((node) => node.id === edge.target);
                                  if (!sourceNode || !targetNode) return null;
                                  const sourcePos = graphCanvasOverlayPosition(sourceNode);
                                  const targetPos = graphCanvasOverlayPosition(targetNode);
                                  const isConnected = selectedCanvasNodeId !== "" &&
                                    (edge.source === selectedCanvasNodeId || edge.target === selectedCanvasNodeId);
                                  const hasSelection = selectedCanvasNodeId !== "";
                                  const isSelectedEdge = edge.id === selectedEdgeId;
                                  const stroke = hasSelection ? (isConnected ? "var(--graph-edge)" : "var(--graph-edge-dim)") : "var(--graph-edge)";
                                  const strokeWidth = isSelectedEdge ? 3.4 : hasSelection ? (isConnected ? 2.6 : 1.25) : 2;
                                  const opacity = hasSelection ? (isConnected ? 1 : 0.25) : 0.85;
                                  const ports = pickBestEdgePorts(sourcePos, targetPos);
                                  const [edgePath, labelX, labelY] = getSmoothStepPath({ ...ports, borderRadius: 8 });
                                  const markerId = (isConnected || !hasSelection) ? "graph-canvas-arrow" : "graph-canvas-arrow-dim";
                                  return (
                                    <g key={edge.id}>
                                      <path
                                        d={edgePath}
                                        stroke="transparent"
                                        strokeWidth={20}
                                        strokeOpacity={0}
                                        fill="none"
                                        pointerEvents="stroke"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleGraphCanvasEdgeClick(edge.id, edge.source);
                                        }}
                                        onMouseEnter={() => {
                                          handleGraphCanvasEdgeHover(
                                            edge.id,
                                            edge.context ?? "",
                                            labelX * rfViewport.zoom + rfViewport.x,
                                            labelY * rfViewport.zoom + rfViewport.y,
                                          );
                                        }}
                                        onMouseLeave={() => {
                                          setHoveredEdgeTooltip((current) => current?.edgeId === edge.id ? null : current);
                                        }}
                                        onDoubleClick={(event) => {
                                          event.stopPropagation();
                                          handleGraphCanvasEdgeDoubleClick(edge.source, edge.target, edge.context ?? "", edge.id);
                                        }}
                                        onContextMenu={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          void handleDeleteEdge(edge.source, edge.target);
                                        }}
                                      />
                                      <path
                                        d={edgePath}
                                        stroke={stroke}
                                        strokeWidth={strokeWidth}
                                        fill="none"
                                        opacity={opacity}
                                        markerEnd={`url(#${markerId})`}
                                        pointerEvents="none"
                                      >
                                        {edge.context ? <title>{edge.context}</title> : null}
                                      </path>
                                    </g>
                                  );
                                })}
                              </g>
                            </svg>
                          )}
                          {hoveredEdgeTooltip !== null && (
                            <div
                              className="graph-edge-hover-tooltip"
                              style={{
                                left: hoveredEdgeTooltip.x,
                                top: hoveredEdgeTooltip.y,
                                transform: "translate(-50%, calc(-100% - 10px))",
                              }}
                            >
                              {hoveredEdgeTooltip.context}
                            </div>
                          )}
                          {graphCanvasNodes.map((node) => {
                            const position = graphCanvasOverlayPosition(node);
                            const screenX = position.x * rfViewport.zoom + rfViewport.x;
                            const screenY = position.y * rfViewport.zoom + rfViewport.y;
                            return (
                              <div
                                key={node.id}
                                data-nodeid={node.id}
                                className={[
                                  "graph-canvas-overlay-node",
                                  shiftSelectedNodes.includes(node.id) ? "canvas-node-shift-selected" : "",
                                  connectingTarget === node.id ? "canvas-node-connecting-target" : "",
                                ].filter(Boolean).join(" ")}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setHoveredEdgeTooltip(null);
                                  if (isAdditiveNodeSelection(event)) {
                                    setShiftSelectedNodes((prev) => {
                                      if (prev.includes(node.id)) {
                                        return prev.filter((id) => id !== node.id);
                                      }
                                      if (prev.length > 0) {
                                        const firstType = graphCanvasNodes.find((n) => n.id === prev[0])?.data.type;
                                        if (firstType !== node.data.type) return prev;
                                      }
                                      return [...prev, node.id];
                                    });
                                  } else {
                                    setSelectedCanvasNodeId(node.id);
                                    setShiftSelectedNodes([]);
                                  }
                                }}
                                onDoubleClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenCanvasDocument(node.id);
                                }}
                                onPointerDown={(event) => handleGraphCanvasOverlayPointerDown(event, node.id)}
                                style={{ transform: `translate(${screenX}px, ${screenY}px) scale(${rfViewport.zoom})`, transformOrigin: 'top left' }}
                              >
                                {node.data.label}
                                {shiftSelectedNodes.includes(node.id) && (
                                  <div className="canvas-selection-badge">{shiftSelectedNodes.indexOf(node.id) + 1}</div>
                                )}
                                {(["top", "right", "bottom", "left"] as const).map((pos) => (
                                  <div
                                    key={pos}
                                    className={`canvas-connect-handle canvas-connect-handle-${pos}`}
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => handleConnectionHandlePointerDown(e, node.id)}
                                  />
                                ))}
                              </div>
                            );
                          })}
                        </div>
                        {shiftSelectedNodes.length >= 2 && (
                          <div className="canvas-action-bar">
                            <span className="canvas-action-bar-count">{shiftSelectedNodes.length} selected</span>
                            <button
                              type="button"
                              className="canvas-action-bar-btn"
                              onClick={() => { void handleMergeDocuments(); }}
                            >
                              Merge
                            </button>
                          </div>
                        )}
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
                      onClick={() => clearContextPanel()}
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
                          onChange={(value) => updateFormField("body", value)}
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

                      {(selectedDocument.dependsOn ?? []).length > 0 && (
                        <section className="detail-section">
                          <h4>Dependencies</h4>
                          <div className="link-list">
                            {(selectedDocument.dependsOn ?? []).map((dependencyId) => (
                              <Button
                                key={dependencyId}
                                variant="outline"
                                size="sm"
                                onClick={() => handleInspectDocument(dependencyId, documentGraphById.get(dependencyId) ?? selectedDocument.graph)}
                                className="rounded-full h-7 px-3 text-xs"
                                type="button"
                              >
                                {dependencyId}
                              </Button>
                            ))}
                          </div>
                        </section>
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
                      aria-label="Search"
                      autoFocus
                      className="shell-search-input shell-search-input-with-icon"
                      placeholder="Search documents…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {searchError !== "" && <p className="status-line status-line-error">{searchError}</p>}
                  {deferredSearchQuery !== "" && (
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
      <Dialog open={editingEdge !== null} onOpenChange={(open) => { if (!open) setEditingEdge(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit link context</DialogTitle>
            <DialogDescription>
              Add a short annotation describing why this link exists.
            </DialogDescription>
          </DialogHeader>
          <div className="shell-dialog-actions" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
            <Label htmlFor="edge-context-input">Context</Label>
            <Input
              id="edge-context-input"
              value={editingEdge?.context ?? ""}
              onChange={(e) => setEditingEdge((prev) => prev ? { ...prev, context: e.target.value } : prev)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editingEdge !== null) {
                  void handleUpdateEdgeContext(editingEdge.sourceId, editingEdge.targetId, editingEdge.context);
                  setEditingEdge(null);
                }
              }}
              placeholder="e.g. depends on, relates to…"
              autoFocus
            />
            <div className="shell-dialog-actions">
              <Button onClick={() => setEditingEdge(null)} type="button" variant="secondary">Cancel</Button>
              <Button
                onClick={() => {
                  if (editingEdge !== null) {
                    void handleUpdateEdgeContext(editingEdge.sourceId, editingEdge.targetId, editingEdge.context);
                    setEditingEdge(null);
                  }
                }}
                type="button"
              >
                Save
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
