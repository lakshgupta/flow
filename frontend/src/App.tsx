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
import { MiddleContent } from "./components/MiddleContent";
import { RightRailControls } from "./components/RightRailControls";
import { RightSidebarPanel } from "./components/RightSidebarPanel";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { SettingsDialog } from "./components/SettingsDialog";
import { GraphTreePanel, WorkspaceSelectorPanel, type SidebarView } from "./components/WorkspaceSidebarPanels";
import { CreateNodeDialog, DeleteDocumentDialog, RenameDialog } from "./components/WorkflowDialogs";
import type { EdgeToolbarState, GraphCanvasOverlayController } from "./components/graphCanvasOverlayController";
import { GraphCanvasOverlayInteraction } from "./components/GraphCanvasOverlayInteraction";
import { GraphCanvasOverlayNodes } from "./components/GraphCanvasOverlayNodes";
import { GraphCanvasOverlayEdges } from "./components/GraphCanvasOverlayEdges";
import { RightRailCalendarPanel, RightRailSearchPanel } from "./components/RightRailPanels";
import { ThreadPanelStack } from "./components/ThreadPanels";
import { LocalSearchBar } from "./components/LocalSearchBar";
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
import { buildSearchRequestPath, requestJSON, deregisterLocalWorkspace, loadCalendarDocuments, loadGraphValidation, loadWorkspaceSnapshot, selectWorkspace, uploadGraphFiles } from "./lib/api";
import type { SearchFilters } from "./lib/api";
import { getWailsCreate, getWailsCreateGraph, getWailsDelete, getWailsDeleteGraph, getWailsMerge, getWailsRenameGraph, getWailsUpdate, getWailsUpdateGraphCanvasDisabled, getWailsUpdateGraphColor, getWailsUpdateHome, type WailsUpdateDocumentPatch } from "./lib/imageUploader";
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
  normalizeHomeBodyForSave,
  parseEnv,
  splitList,
} from "./lib/docUtils";
import {
  applyEdgeTypeFixTags,
  applyEdgeTypeFixTagsAll,
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
import type { GraphCanvasFlowEdgeData } from "./lib/graphCanvasUtils";

const EDGE_TYPES: EdgeTypes = { contextEdge: ContextEdge };

import { RichTextEditor, type RichTextEditorHandle } from "./components/editor/RichTextEditor";
import type {
  CalendarDocumentResponse,
  DeleteDocumentResponse,
  DocumentFormState,
  DocumentResponse,
  EdgeTypeViolation,
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

type RightPanelTab = "calendar" | "search" | "home" | "violations";
type DocumentOpenMode = "center" | "right-rail";
type CenterDocumentSidePanelMode = "hidden" | "properties";
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
const MIN_THREAD_PANEL_WIDTH_PX = 420;
const THREAD_PANEL_VIEWPORT_MARGIN_PX = 112;
const DOCUMENT_FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

// Autosave pacing: edits are persisted after a short idle debounce, and a
// maximum-gap guard forces a save even during continuous typing so a crash can
// only lose a bounded window of work.
const AUTO_SAVE_DEBOUNCE_MS = 400;
const AUTO_SAVE_MAX_GAP_MS = 4000;
const MUTATION_FEEDBACK_TIMEOUT_MS = 2000;
// fetch keepalive bodies are limited to 64KB; stay safely under it.
const KEEPALIVE_MAX_BODY_BYTES = 60_000;

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

function buildGraphTreeFile(document: DocumentResponse): GraphTreeFileData {
  return {
    id: document.id,
    type: document.type,
    title: document.title,
    path: document.path,
    fileName: fileNameFromPath(document.path),
    color: document.color,
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
      nodeColor: nextDocument.color,
      status: nextDocument.status,
      createdAt: nextDocument.createdAt,
      updatedAt: nextDocument.updatedAt,
    };
  });

  return changed ? { ...graphCanvas, nodes: nextNodes } : graphCanvas;
}

/** True when two link sets describe the same edges (order-insensitive). Used to
 *  decide whether a document save changed the canvas graph (edges), which the
 *  in-place node update cannot represent. */
function nodeLinksEqual(left: DocumentResponse["links"] | undefined, right: DocumentResponse["links"] | undefined): boolean {
  const leftLinks = left ?? [];
  const rightLinks = right ?? [];
  if (leftLinks.length !== rightLinks.length) {
    return false;
  }

  const linkKey = (link: NodeLink): string => `${link.node}\u0001${link.context ?? ""}\u0001${(link.relationships ?? []).join(",")}`;
  const leftKeys = leftLinks.map(linkKey).sort();
  const rightKeys = rightLinks.map(linkKey).sort();
  return leftKeys.every((value, index) => value === rightKeys[index]);
}

function FlowApp() {
  const { theme, setTheme } = useTheme();
  const rfViewport = useViewport();
  const graphCanvasFlowRef = useRef<ReactFlowInstance<Node<GraphCanvasFlowNodeData>, Edge<GraphCanvasFlowEdgeData>> | null>(null);
  const rfViewportRef = useRef(rfViewport);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [graphTree, setGraphTree] = useState<GraphTreeResponse | null>(null);
  const [graphCanvasData, setGraphCanvasData] = useState<GraphCanvasResponse | null>(null);
  const [graphEdgeViolations, setGraphEdgeViolations] = useState<EdgeTypeViolation[]>([]);
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
  // Per-panel draft form state so every open thread can be edited independently.
  const [threadFormStates, setThreadFormStates] = useState<Record<string, DocumentFormState>>({});
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
  const [settingsTab, setSettingsTab] = useState<"general" | "workspaces" | "about" | "theme" | "keyboard" | "stop">("general");
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
  // Epoch ms of the last successful save — autosave or a manual mutation
  // (rename/move/import/create/merge/edge-fix). The header flashes a brief
  // "Saved" confirmation whenever this advances.
  const [lastSaveAt, setLastSaveAt] = useState<number>(0);
  const [calendarFocusDate, setCalendarFocusDate] = useState<string>(() => todayString());
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(256);
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(500);
  const THREAD_PANEL_WIDTHS_KEY = "flow_thread_panel_widths";
  const [threadPanelWidths, setThreadPanelWidths] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const item = window.localStorage.getItem(THREAD_PANEL_WIDTHS_KEY);
      return item ? JSON.parse(item) : {};
    } catch (error) {
      console.warn("Error reading thread panel widths from localStorage", error);
      return {};
    }
  });

  const persistThreadPanelWidths = useCallback((updater: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
    setThreadPanelWidths((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        window.localStorage.setItem(THREAD_PANEL_WIDTHS_KEY, JSON.stringify(next));
      } catch (error) {
        console.warn("Error saving thread panel widths to localStorage", error);
      }
      return next;
    });
  }, []);

  const [threadExpanded, setThreadExpanded] = useState<boolean>(false);
  const [panelExpandModes, setPanelExpandModes] = useState<Record<string, "thread" | "full">>({});
  const [centerDocumentSidePanelMode, setCenterDocumentSidePanelMode] = useState<CenterDocumentSidePanelMode>("hidden");
  const [isResizingLeft, setIsResizingLeft] = useState<boolean>(false);
  const [isResizingRight, setIsResizingRight] = useState<boolean>(false);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [shiftSelectedNodes, setShiftSelectedNodes] = useState<string[]>([]);
  const [graphCanvasIntersectingNodeIds, setGraphCanvasIntersectingNodeIds] = useState<string[]>([]);
  const [graphCanvasIntersectionSourceId, setGraphCanvasIntersectionSourceId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connectingStartPos, setConnectingStartPos] = useState<{ x: number; y: number } | null>(null);
  const [connectingPointerPos, setConnectingPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [connectingTarget, setConnectingTarget] = useState<string | null>(null);

  const graphCanvasShellRef = useRef<HTMLDivElement | null>(null);
  const centerDocumentEditorRef = useRef<RichTextEditorHandle | null>(null);
  const homeDocumentEditorRef = useRef<RichTextEditorHandle | null>(null);
  const rightRailDocumentEditorRef = useRef<RichTextEditorHandle | null>(null);
  const connectingTargetRef = useRef<string | null>(null);
  const homeFormStateRef = useRef<HomeFormState>(emptyHomeFormState);
  // When set, the next graphTree/home sync takes the server content wholesale
  // instead of preserving the in-editor body. An explicit index refresh is a
  // request to re-sync Home from the workspace files, so the pending-edit
  // preservation guard must be bypassed.
  const forceHomeReloadRef = useRef(false);
  const homeFormWorkspacePathRef = useRef<string>("");
  const homeAutoSaveTimerRef = useRef<number | undefined>(undefined);
  const documentAutoSaveTimerRef = useRef<number | undefined>(undefined);
  const homeSavePromiseRef = useRef<Promise<void> | null>(null);
  const documentSavePromiseRef = useRef<Promise<void> | null>(null);
  const lastDocumentSaveAtRef = useRef<number>(Date.now());
  const lastHomeSaveAtRef = useRef<number>(Date.now());
  const edgeClickTimerRef = useRef<number | null>(null);
  const fixAllEdgeViolationsRef = useRef<() => Promise<void> | void>(() => {});
  const documentThreadRef = useRef<ThreadDocumentEntry[]>([]);
  const threadDocumentsByIdRef = useRef<Record<string, DocumentResponse>>({});
  const threadFormStatesRef = useRef<Record<string, DocumentFormState>>({});
  const threadStackRef = useRef<HTMLDivElement | null>(null);
  const threadPanelEditorsRef = useRef<Map<string, () => string>>(new Map());
  const selectedDocumentOpenModeRef = useRef<DocumentOpenMode>("right-rail");
  const formStateRef = useRef<DocumentFormState>(emptyDocumentFormState);
  const editableLinkDetailsRef = useRef<Record<string, { context: string; linkType: string }>>({});
  const selectedDocumentRef = useRef<DocumentResponse | null>(null);
  const selectedDocumentIdRef = useRef<string>("");
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
  const [localSearchOpen, setLocalSearchOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [localSearchIndex, setLocalSearchIndex] = useState(0);
  const [localSearchCount, setLocalSearchCount] = useState(0);
  const localSearchRootRef = useRef<HTMLDivElement>(null);
  const localSearchMarksRef = useRef<HTMLElement[]>([]);
  const localSearchDomCountRef = useRef(0);
  const countMatches = useCallback((text: string, query: string): number => {
    const trimmed = query.trim();
    if (trimmed === "") return 0;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      const regex = new RegExp(escaped, "gi");
      let c = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        c += 1;
        if (m[0].length === 0) regex.lastIndex += 1;
      }
      return c;
    } catch {
      return 0;
    }
  }, []);
  const clearLocalSearchHighlights = useCallback(() => {
    for (const mark of localSearchMarksRef.current) {
      const parent = mark.parentNode;
      if (parent !== null) {
        parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
        parent.normalize();
      }
    }
    localSearchMarksRef.current = [];
  }, []);
  const highlightLocalSearch = useCallback((container: HTMLElement, query: string): number => {
    clearLocalSearchHighlights();
    const trimmed = query.trim();
    if (trimmed === "" || container == null) {
      return 0;
    }
    // Guard against single-char queries on large docs: limit walk to avoid
    // layout thrash. Single-char matches are noisy and extremely expensive.
    if (trimmed.length === 1) {
      return countMatches(container.textContent ?? "", trimmed);
    }
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let regex: RegExp;
    try {
      regex = new RegExp(escaped, "gi");
    } catch {
      return 0;
    }
    // Cap total highlighted nodes to prevent DOM explosion on huge docs.
    const MAX_HIGHLIGHTS = 1000;
    const MAX_TEXT_NODES = 8000;
    const walker = document.createTreeWalker(container, globalThis.NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = (node as Text).parentElement;
        if (parent === null) return globalThis.NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || parent.closest("input, textarea") !== null) {
          return globalThis.NodeFilter.FILTER_REJECT;
        }
        // Skip the find bar itself so its input text is not highlighted as a match.
        if (parent.closest(".local-search-bar") !== null) {
          return globalThis.NodeFilter.FILTER_REJECT;
        }
        // Skip ProseMirror editor content – it is highlighted via the decoration plugin (search-highlight.ts)
        if (parent.closest(".ProseMirror") !== null) {
          return globalThis.NodeFilter.FILTER_REJECT;
        }
        if ((node.textContent ?? "").trim() === "") return globalThis.NodeFilter.FILTER_REJECT;
        return globalThis.NodeFilter.FILTER_ACCEPT;
      },
    });
    const textNodes: Text[] = [];
    let current: globalThis.Node | null;
    let walked = 0;
    while ((current = walker.nextNode()) !== null) {
      textNodes.push(current as Text);
      walked += 1;
      if (walked > MAX_TEXT_NODES) break;
    }
    let count = 0;
    const marks: HTMLElement[] = [];
    for (const textNode of textNodes) {
      if (count >= MAX_HIGHLIGHTS) break;
      const text = textNode.textContent ?? "";
      // Quick pre-check before regex to skip obvious non-matches
      if (!text.toLowerCase().includes(trimmed.toLowerCase())) continue;
      let match: RegExpExecArray | null;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let hasMatch = false;
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        hasMatch = true;
        const before = text.slice(lastIndex, match.index);
        if (before !== "") frag.appendChild(document.createTextNode(before));
        const mark = document.createElement("mark");
        mark.className = "local-search-match";
        mark.textContent = match[0];
        frag.appendChild(mark);
        marks.push(mark);
        count += 1;
        if (count >= MAX_HIGHLIGHTS) {
          // Truncate: spill remaining text as plain
          const remaining = text.slice(match.index + match[0].length);
          if (remaining !== "") frag.appendChild(document.createTextNode(remaining));
          lastIndex = text.length;
          break;
        }
        lastIndex = match.index + match[0].length;
        if (match[0].length === 0) regex.lastIndex += 1;
      }
      if (!hasMatch) continue;
      if (lastIndex < text.length) {
        const after = text.slice(lastIndex);
        if (after !== "") frag.appendChild(document.createTextNode(after));
      }
      textNode.parentNode?.replaceChild(frag, textNode);
    }
    localSearchMarksRef.current = marks;
    return count;
  }, [clearLocalSearchHighlights, countMatches]);
  const setLocalSearchCurrent = useCallback((index: number) => {
    const marks = localSearchMarksRef.current;
    for (const m of marks) m.classList.remove("local-search-match-current");
    if (marks.length === 0) return;
    const clamped = ((index % marks.length) + marks.length) % marks.length;
    const current = marks[clamped];
    current.classList.add("local-search-match-current");
    current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);
  const [sidebarView, setSidebarView] = useState<SidebarView>("content");
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
  const graphCanvasNodes = useMemo(() => buildGraphCanvasFlowNodes(
    graphCanvasData,
    graphCanvasPositions,
    selectedCanvasNodeId,
    selectedDocumentId,
    graphDirectoryColorsByPath,
  ), [
    graphCanvasData,
    graphCanvasPositions,
    selectedCanvasNodeId,
    selectedDocumentId,
    graphDirectoryColorsByPath,
  ]);
  graphCanvasNodesRef.current = graphCanvasNodes;
  const graphCanvasEdges = useMemo(() => {
    const raw = buildGraphCanvasFlowEdges(graphCanvasData, selectedCanvasNodeId, graphEdgeViolations);
    return selectedEdgeId === ""
      ? raw
      : raw.map((e) => e.id === selectedEdgeId ? { ...e, selected: true } : e);
  }, [graphCanvasData, graphEdgeViolations, selectedCanvasNodeId, selectedEdgeId]);
  // Editable link edges that a sidebar quick fix can patch ("fromID\u0000toID").
  const fixableViolationEdgeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const edge of graphCanvasData?.edges ?? []) {
      if (edge.kind !== "link") {
        continue;
      }
      keys.add(`${edge.source}\u0000${edge.target}`);
    }
    return keys;
  }, [graphCanvasData?.edges]);
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
  const graphCanvasNodeSearchSelectedIndex = useMemo(() => {
    return graphCanvasNodeSearchMatches.findIndex((node) => node.id === selectedCanvasNodeId);
  }, [graphCanvasNodeSearchMatches, selectedCanvasNodeId]);
  const selectedCanvasNode = useMemo(() => {
    return selectedGraphCanvasNode(graphCanvasData, selectedCanvasNodeId);
  }, [graphCanvasData, selectedCanvasNodeId]);
  const selectedDocumentGraphColor = useMemo(() => {
    return selectedDocument !== null
      ? graphDirectoryColorHex(resolveGraphDirectoryColor(selectedDocument.graph, graphDirectoryColorsByPath))
      : undefined;
  }, [selectedDocument, graphDirectoryColorsByPath]);
  const selectedDocumentTintStyle = useMemo(() => {
    return selectedDocumentGraphColor
      ? ({ "--document-graph-color": selectedDocumentGraphColor } as React.CSSProperties)
      : undefined;
  }, [selectedDocumentGraphColor]);
  const selectedCanvasNodeEdgeCount = useMemo(() => {
    return countConnectedGraphCanvasEdges(graphCanvasData, selectedCanvasNodeId);
  }, [graphCanvasData, selectedCanvasNodeId]);
  const workspaceSurfaceSection = activeSurface.kind === "graph" ? "Content" : "Home";
  const trackedLocalWorkspaces = useMemo(() => {
    return (workspace?.workspaces ?? []).filter((entry) => entry.scope === "local");
  }, [workspace?.workspaces]);
  const isHomeThreadRoot = useMemo(() => documentThread.length > 0 && documentThread[0]?.documentId === HOME_THREAD_DOCUMENT_ID, [documentThread]);
  const activeThreadTailId = useMemo(() => documentThread.length > 0 ? documentThread[documentThread.length - 1]?.documentId ?? "" : "", [documentThread]);
  const hasAssetThreadTail = useMemo(() => activeThreadTailId !== "" && threadAssetsById[activeThreadTailId] !== undefined, [activeThreadTailId, threadAssetsById]);
  const isCenterDocumentOpen = selectedDocumentId !== "" && selectedDocumentOpenMode === "center";
  const isThreadStackOpen = useMemo(() => selectedDocumentOpenMode === "center"
    && (selectedDocumentId !== "" || hasAssetThreadTail || (isHomeThreadRoot && activeSurface.kind === "home")),
    [selectedDocumentOpenMode, selectedDocumentId, hasAssetThreadTail, isHomeThreadRoot, activeSurface.kind]);
  const isSelectedDocumentLoading = useMemo(() => selectedDocumentId !== "" && (selectedDocument === null || selectedDocument.id !== selectedDocumentId), [selectedDocumentId, selectedDocument]);
  const isHomeVisible = activeSurface.kind === "home";
  // Global shortcuts: Cmd/Ctrl+F for local find, Cmd/Ctrl+Shift+F for workspace search.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const cmd = isMac ? event.metaKey : event.ctrlKey;
      if (!cmd || event.altKey) return;
      if (event.key.toLowerCase() === "f" && !event.shiftKey) {
        if (isCenterDocumentOpen || isThreadStackOpen || isHomeVisible) {
          event.preventDefault();
          setLocalSearchOpen(true);
        }
      } else if (event.key.toLowerCase() === "f" && event.shiftKey) {
        event.preventDefault();
        setRightPanelTab("search");
        setRightRailCollapsed(false);
        window.setTimeout(() => {
          document.querySelector<HTMLInputElement>('[aria-label="Search all fields"]')?.focus();
        }, 0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isCenterDocumentOpen, isThreadStackOpen, isHomeVisible]);
  const activeThreadDocumentId = useMemo(() => selectedDocumentOpenMode === "center"
    ? (selectedDocumentId !== "" ? selectedDocumentId : activeSurface.kind === "home" ? HOME_THREAD_DOCUMENT_ID : activeThreadTailId)
    : activeThreadTailId,
    [selectedDocumentOpenMode, selectedDocumentId, activeSurface.kind, activeThreadTailId]);
  // Highlight matches for the local find bar.
  // Re-run when the visible document/thread body changes so highlights stay in sync
  // after switching nodes or streaming in new markdown.
  const localSearchDocumentKey = `${activeSurface.kind}:${activeThreadDocumentId}:${selectedDocumentId}:${selectedDocument?.updatedAt ?? ""}`;
  useEffect(() => {
    const container = localSearchRootRef.current;
    if (container == null) return;
    if (!localSearchOpen || localSearchQuery.trim() === "") {
      clearLocalSearchHighlights();
      localSearchDomCountRef.current = 0;
      setLocalSearchCount(0);
      setLocalSearchIndex(0);
      return;
    }
    // Debounce heavy DOM walk: typing fires formState.body on every keystroke.
    // A short debounce prevents layout thrash while still feeling instant.
    let debounceTimer: number | undefined;
    let second: number | undefined;
    let frame: number | undefined;
    const isBodyOnlyChange = localSearchDocumentKey !== "";
    const debounceMs = isBodyOnlyChange && localSearchQuery.trim().length >= 2 ? 120 : 0;
    const run = () => {
      frame = requestAnimationFrame(() => {
        // Scope DOM highlights: for thread search use the whole thread stack (all panels),
        // for single node/Home use the active panel/home body only. ProseMirror bodies
        // are skipped in the walker (decorations handle them).
        let domContainer: HTMLElement | null = container;
        if (isThreadStackOpen) {
          domContainer = threadStackRef.current ?? container.querySelector<HTMLElement>('[data-active="true"] .thread-panel-scroll') ?? container;
        } else if (isCenterDocumentOpen) {
          const activeScroll = container.querySelector<HTMLElement>('[data-active="true"] .thread-panel-scroll');
          if (activeScroll) domContainer = activeScroll;
        } else if (isHomeVisible) {
          const homeScroll = container.querySelector<HTMLElement>('.home-document-body');
          if (homeScroll) domContainer = homeScroll;
        }
        const domCount = domContainer ? highlightLocalSearch(domContainer, localSearchQuery) : 0;
        localSearchDomCountRef.current = domCount;
        // Editor body matches are created by the decoration plugin; read the
        // authoritative count from the active editor after it has applied the
        // query in its own effect (next frame).
        const readEditorCount = (): number => {
          try {
            if (activeThreadDocumentId === HOME_THREAD_DOCUMENT_ID) {
              const c = (homeDocumentEditorRef.current as any)?.getSearchCount?.();
              if (typeof c === "number") return c;
            } else if (isCenterDocumentOpen || isThreadStackOpen) {
              const c = (centerDocumentEditorRef.current as any)?.getSearchCount?.();
              if (typeof c === "number") return c;
            } else if (isHomeVisible) {
              const c = (homeDocumentEditorRef.current as any)?.getSearchCount?.();
              if (typeof c === "number") return c;
            }
          } catch {}
          // Fallback while editor view is mounting
          let fallback = "";
          if (activeThreadDocumentId === HOME_THREAD_DOCUMENT_ID) fallback = homeFormState.body;
          else if (isCenterDocumentOpen || isThreadStackOpen) fallback = formState.body;
          else if (isHomeVisible) fallback = homeFormState.body;
          return countMatches(fallback, localSearchQuery);
        };
        second = requestAnimationFrame(() => {
          // Use the authoritative decoration count when available; otherwise fallback.
          let editorCount = readEditorCount();
          // If the walker incorrectly counted ProseMirror text, visibleCount will be the truth.
          // Reconcile by querying the actual rendered matches in the active container.
          let visibleCount: number | null = null;
          try {
            if (domContainer) visibleCount = domContainer.querySelectorAll(".local-search-match").length;
          } catch {}
          const total = visibleCount !== null && visibleCount > 0 ? visibleCount : domCount + editorCount;
          // Fallback: if visibleCount is 0 but we expect matches (e.g. editor not yet painted), use sum.
          const finalTotal = total === 0 ? domCount + editorCount : total;
          setLocalSearchCount(finalTotal);
          setLocalSearchIndex(0);
          setLocalSearchCurrent(0);
        });
      });
    };
    if (debounceMs > 0) {
      debounceTimer = window.setTimeout(run, debounceMs);
    } else {
      run();
    }
    return () => {
      if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (second !== undefined) cancelAnimationFrame(second);
    };
  }, [localSearchOpen, localSearchQuery, localSearchDocumentKey, formState.body, homeFormState.body, highlightLocalSearch, clearLocalSearchHighlights, setLocalSearchCurrent, countMatches, activeThreadDocumentId, isCenterDocumentOpen, isThreadStackOpen, isHomeVisible]);
  useEffect(() => {
    if (!localSearchOpen) {
      clearLocalSearchHighlights();
      setLocalSearchCount(0);
    }
  }, [localSearchOpen, clearLocalSearchHighlights]);
  useEffect(() => {
    if (localSearchCount === 0) return;
    const domCount = localSearchDomCountRef.current;
    if (localSearchIndex < domCount) {
      setLocalSearchCurrent(localSearchIndex);
    } else {
      // Focus is in editor; clear DOM current highlight
      for (const m of localSearchMarksRef.current) m.classList.remove("local-search-match-current");
    }
  }, [localSearchIndex, localSearchCount, setLocalSearchCurrent]);
  const editorLocalSearchIndex = useMemo(() => {
    const domCount = localSearchDomCountRef.current;
    if (localSearchIndex < domCount) return -1;
    return localSearchIndex - domCount;
  }, [localSearchIndex, localSearchCount]);
  const editorSearchQuery = localSearchOpen ? localSearchQuery : "";
  const showCenterDocumentSidePanel = centerDocumentSidePanelMode !== "hidden";
  const centerDocumentSidePanelLabel = "Document properties";
  const centerDocumentSidePanelTitle = "Properties";
  const centerDocumentSidePanelDescription = "Edit the markdown frontmatter fields for this document.";
  const hasRightRailDocument = selectedDocumentId !== "" && selectedDocumentOpenMode === "right-rail";
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

      return {
        ...entry,
        isActive,
        isTail,
      };
    });
  }, [activeThreadDocumentId, documentThread, selectedDocumentOpenMode]);
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

    for (const link of selectedDocument.incomingLinks ?? []) {
      if (incomingByNodeId.has(link.node)) {
        continue;
      }

      incomingByNodeId.set(link.node, {
        nodeId: link.node,
        context: link.context ?? "",
        linkType: (link.relationships ?? []).join(", "),
        graphPath: documentGraphById.get(link.node) ?? selectedDocument.graph,
      });
    }

    const incoming = Array.from(incomingByNodeId.values());

    return { outgoing, incoming };
  }, [documentGraphById, selectedDocument]);

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

    // Do not show the previous document's headings while the newly selected
    // document is loading. The sidebar should always describe its current
    // document context, not whichever response happened to arrive first.
    if (selectedDocument === null || selectedDocument.id !== selectedDocumentId) {
      return [];
    }

    return generateTOC(formState.body);
  }, [activeSurface.kind, formState.body, homeFormState.body, selectedDocument, selectedDocumentId]);
  const sidebarTOCTitle = activeSurface.kind === "home"
    ? homeFormState.title || "Home"
    : selectedDocument?.id === selectedDocumentId
      ? selectedDocument.title
      : threadDocumentsById[selectedDocumentId]?.title ?? "Current document";

  useEffect(() => {
    documentThreadRef.current = documentThread;
  }, [documentThread]);

  useEffect(() => {
    threadDocumentsByIdRef.current = threadDocumentsById;
    threadFormStatesRef.current = threadFormStates;
  }, [threadDocumentsById, threadFormStates]);

  // Seed per-panel draft state whenever a document enters the open thread so
  // each panel can be edited independently of which one is focused.
  useEffect(() => {
    setThreadFormStates((current) => {
      let changed = false;
      const next = { ...current };
      for (const [documentId, doc] of Object.entries(threadDocumentsById)) {
        if (next[documentId] === undefined) {
          next[documentId] = createDocumentFormState(doc);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [threadDocumentsById]);

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

  const moveThreadFocus = useCallback((delta: number): void => {
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
    selectedDocumentIdRef.current = document?.id ?? "";
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

    const nextBody = normalizeHomeBodyForSave(homeDocumentEditorRef.current.getMarkdown());
    if (nextBody === homeFormStateRef.current.body) {
      return false;
    }

    const nextState = { ...homeFormStateRef.current, body: nextBody };
    homeFormStateRef.current = nextState;
    setHomeFormState(nextState);
    return true;
  }

  useEffect(() => {
    if (mutationSuccess === "") {
      return;
    }

    const timeoutID = window.setTimeout(() => {
      setMutationSuccess("");
    }, MUTATION_FEEDBACK_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutID);
    };
  }, [mutationSuccess]);

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
    setPanelExpandModes((current) => {
      const allowedIds = new Set(nextThread.map((entry) => entry.documentId));
      const next: Record<string, "thread" | "full"> = {};
      for (const [documentId, mode] of Object.entries(current)) {
        if (allowedIds.has(documentId)) {
          next[documentId] = mode;
        }
      }
      return next;
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

  async function toggleThreadExpanded(): Promise<void> {
    await flushAllPendingSaves();
    setThreadExpanded((current) => {
      const next = !current;
      if (next) {
        setRightRailCollapsed(true);
        setRightRailMaximized(false);
      }
      return next;
    });
  }

  async function togglePanelExpandMode(documentId: string): Promise<void> {
    await flushAllPendingSaves();
    setPanelExpandModes((prev) => {
      const current = prev[documentId];
      const next = { ...prev };
      if (current === undefined) {
        next[documentId] = "thread";
      } else if (current === "thread") {
        next[documentId] = "full";
      } else {
        delete next[documentId];
      }
      return next;
    });
  }

  async function toggleCenterDocumentSidePanel(panel: "properties"): Promise<void> {
    await flushAllPendingSaves();
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
    const hadPendingTimer = documentAutoSaveTimerRef.current !== undefined;

    if (hadPendingTimer) {
      window.clearTimeout(documentAutoSaveTimerRef.current);
      documentAutoSaveTimerRef.current = undefined;
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
    const hadPendingTimer = homeAutoSaveTimerRef.current !== undefined;

    if (hadPendingTimer) {
      window.clearTimeout(homeAutoSaveTimerRef.current);
      homeAutoSaveTimerRef.current = undefined;
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
    setSidebarView("toc");
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
    // The thread is replaced wholesale; flush every panel it tears down first.
    const replacedIds = documentThreadRef.current
      .filter((entry) => entry.documentId !== documentId)
      .map((entry) => entry.documentId);
    if (replacedIds.length > 0) {
      await Promise.all(replacedIds.map((id) => saveThreadDocument(id)));
    }
    clearSurfaceFeedback();
    setSidebarView("toc");
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
    setSidebarView("toc");
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
    clearSurfaceFeedback();
    setSidebarView("toc");

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
    await flushAllPendingSaves();
    setSidebarView("toc");
    const threadAsset = threadAssetsById[documentId];
    if (threadAsset !== undefined) {
      // Panels own their editors and autosave, so focus swaps never wait on I/O.
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

    clearSurfaceFeedback();

    if (documentId === HOME_THREAD_DOCUMENT_ID) {
      syncCenterThreadSelection("", "", null);
      startTransition(() => {
        setActiveSurface({ kind: "home" });
      });
      collapseDocumentRightRailIfOpen();
      return;
    }

    syncCenterThreadSelection(documentId, documentId, threadDocumentsByIdRef.current[documentId] ?? null);
    // Restore the panel's live draft (unsaved edits included) into the legacy
    // form state so TOC/properties/header reflect it immediately.
    const panelDraft = threadFormStatesRef.current[documentId];
    if (panelDraft !== undefined) {
      formStateRef.current = panelDraft;
      setFormState(panelDraft);
    }
    openGraphSurface(graphPath);
    collapseDocumentRightRailIfOpen();
  }

  async function closeDocumentThreadFrom(index: number): Promise<void> {
    await flushAllPendingSaves();
    // Panels own their editors; persist every panel being torn down before the
    // thread state prunes their documents (flushAllPendingSaves already did, but keep for safety).
    const closingIds = documentThreadRef.current.slice(index).map((entry) => entry.documentId);
    if (closingIds.length > 0) {
      await Promise.all(closingIds.map((id) => saveThreadDocument(id)));
    }

    const nextThread = documentThreadRef.current.slice(0, index);
    clearSurfaceFeedback();
    applyDocumentThread(nextThread);
    setThreadExpanded(nextThread.length === 1);

    if (nextThread.length === 0) {
      setSidebarView("content");
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
    setSidebarView("toc");
    setSelectedDocumentOpenMode("center");
    setSelectedDocumentId(nextActive.documentId);
    setSelectedCanvasNodeId(nextActive.documentId);
    syncSelectedDocumentState(threadDocumentsByIdRef.current[nextActive.documentId] ?? null);
    startTransition(() => {
      setActiveSurface({ kind: "graph", graphPath: nextActive.graphPath });
    });
  }

  async function toggleRightRailMaximized(): Promise<void> {
    await flushAllPendingSaves();
    if (rightRailCollapsed) {
      return;
    }

    // When document is in right-rail mode, expand it to the full center thread view.
    if (selectedDocumentOpenMode === "right-rail" && rightPanelTab === "document" && selectedDocumentId !== "") {
      const graphPath = resolveDocumentGraphPath(selectedDocumentId, selectedGraphPath);
      if (graphPath !== "") {
        void openDocumentInCenter(selectedDocumentId, graphPath);
      }
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
      clearGraphCanvasIntersections();
      setShiftSelectedNodes((prev) => {
        const baseline = prev.length > 0
          ? prev
          : selectedCanvasNodeId !== ""
            ? [selectedCanvasNodeId]
            : [];

        if (baseline.length > 0) {
          const firstType = graphCanvasNodes.find((n) => n.id === baseline[0])?.data.type;
          if (firstType !== graphCanvasNodes.find((n) => n.id === nodeId)?.data.type) {
            return baseline;
          }
        }

        if (baseline.includes(nodeId)) {
          return baseline;
        }

        return [...baseline, nodeId];
      });
      if (selectedCanvasNodeId === "") {
        setSelectedCanvasNodeId(nodeId);
      }
      return;
    }

    const selectedPosition = graphCanvasPositionsRef.current[nodeId]
      ?? graphCanvasData?.nodes.find((node) => node.id === nodeId)?.position;
    if (selectedPosition !== undefined) {
      updateGraphCanvasIntersections(nodeId, selectedPosition);
    } else {
      clearGraphCanvasIntersections();
    }

    setSelectedCanvasNodeId(nodeId);
    setShiftSelectedNodes([]);
  }

  function handleGraphCanvasOverlayNodeDoubleClick(event: React.MouseEvent<HTMLDivElement>, nodeId: string): void {
    event.stopPropagation();
    const graphPath = resolveDocumentGraphPath(nodeId, selectedGraphPath);
    if (graphPath === "") {
      return;
    }
    void openDocumentInRightRail(nodeId, graphPath);
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
      // In the desktop app, document updates bypass the HTTP layer and call the
      // Wails binding directly (same shape as the HTTP response).
      const wailsUpdate = getWailsUpdate();
      const updatedDocument = wailsUpdate !== null
        ? await wailsUpdate({ documentID: nodeId, patch: { description: nextDescription } })
        : await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(nodeId)}`, {
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

  async function handleGraphCanvasNodeTitleSave(nodeId: string, title: string): Promise<void> {
    const currentNode = graphCanvasData?.nodes.find((node) => node.id === nodeId) ?? null;
    if (currentNode === null) {
      return;
    }

    const nextTitle = title.trim();
    if (nextTitle === "" || (currentNode.title ?? "").trim() === nextTitle) {
      return;
    }

    try {
      const wailsUpdate = getWailsUpdate();
      const updatedDocument = wailsUpdate !== null
        ? await wailsUpdate({ documentID: nodeId, patch: { title: nextTitle } })
        : await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(nodeId)}`, {
            method: "PUT",
            body: JSON.stringify({ title: nextTitle }),
          });

      setGraphCanvasData((current) => {
        if (current === null) return current;
        return {
          ...current,
          nodes: current.nodes.map((node) => node.id !== updatedDocument.id ? node : { ...node, title: updatedDocument.title, updatedAt: updatedDocument.updatedAt }),
        };
      });
      if (selectedDocumentRef.current?.id === updatedDocument.id) {
        syncSelectedDocumentState(updatedDocument, { preserveFormState: false });
      }
      if (documentThreadRef.current.some((entry) => entry.documentId === updatedDocument.id)) {
        setThreadDocumentsById((current) => ({ ...current, [updatedDocument.id]: updatedDocument }));
      }
      setGraphTree((current) => updateGraphTreeDocumentEntry(current, updatedDocument, updatedDocument));
    } catch (mutationFailure) {
      setMutationError(toErrorMessage(mutationFailure));
    }
  }

  async function handleGraphCanvasNodeStatusChange(nodeId: string, status: string): Promise<void> {
    const currentNode = graphCanvasData?.nodes.find((node) => node.id === nodeId) ?? null;
    if (currentNode === null) {
      return;
    }

    const nextStatus = status.trim();
    if ((currentNode.status ?? "") === nextStatus) {
      return;
    }

    try {
      // In the desktop app, document updates bypass the HTTP layer and call the
      // Wails binding directly (same shape as the HTTP response).
      const wailsUpdate = getWailsUpdate();
      const updatedDocument = wailsUpdate !== null
        ? await wailsUpdate({ documentID: nodeId, patch: { status: nextStatus } })
        : await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(nodeId)}`, {
            method: "PUT",
            body: JSON.stringify({ status: nextStatus }),
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
              status: updatedDocument.status,
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

    const providerEl = document.getElementById("flow-sidebar-provider");
    let currentWidth = startWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = direction === "left" ? startWidth + deltaX : startWidth - deltaX;
      const boundedWidth = Math.min(Math.max(nextWidth, minWidth), maxWidth);
      currentWidth = boundedWidth;

      if (providerEl !== null) {
        if (direction === "left") {
          providerEl.style.setProperty("--sidebar-width", `${boundedWidth}px`);
        } else {
          providerEl.style.setProperty("--right-sidebar-width", `${boundedWidth}px`);
        }
      }
    };

    const cleanup = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup as any);
      setWidth(currentWidth);
    };
    const handleMouseUp = () => cleanup();

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("pointercancel", cleanup);
    window.addEventListener("blur", cleanup as any);
    event.preventDefault();
  }

  async function mutateEdge(
    method: "POST" | "DELETE" | "PATCH",
    payload: { fromId: string; toId: string; context?: string; relationships?: string[] },
    options: { reload?: boolean } = {},
  ): Promise<string | null> {
    try {
      setMutationError("");
      await requestJSON<DocumentResponse>("/api/links", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (options.reload !== false) {
        setGraphCanvasReloadToken((current) => current + 1);
      }
      return null;
    } catch (err) {
      const message = toErrorMessage(err);
      setMutationError(message);
      return message;
    }
  }

  useEffect(() => {
    const next = createHomeFormState(graphTree?.home ?? null);
    const currentWorkspacePath = workspace?.workspacePath ?? "";
    const workspaceChanged = homeFormWorkspacePathRef.current !== currentWorkspacePath;
    homeFormWorkspacePathRef.current = currentWorkspacePath;

    // An explicit index refresh requests re-syncing from disk; consume the flag
    // and skip the preservation guard so freshly indexed home content is pushed
    // into the editor instead of being discarded as "pending edits".
    const forceReload = forceHomeReloadRef.current;
    forceHomeReloadRef.current = false;

    if (
      !workspaceChanged &&
      !forceReload &&
      homeDocumentEditorRef.current !== null &&
      homeFormStateRef.current.body !== "" &&
      homeFormStateRef.current.body !== next.body
    ) {
      // The home editor is mounted with non-empty content that differs from the
      // server state. A document save (or other mutation) may have updated
      // graphTree while the home save is still pending. Preserve the editor body
      // so that the pending local edits are not overwritten. Title and
      // description are still updated from the server response.
      const merged = { ...next, body: homeFormStateRef.current.body };
      homeFormStateRef.current = merged;
      setHomeFormState(merged);
    } else {
      homeFormStateRef.current = next;
      setHomeFormState(next);
    }
  }, [graphTree, workspace?.workspacePath]);

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
    if (documentAutoSaveTimerRef.current !== undefined) {
      window.clearTimeout(documentAutoSaveTimerRef.current);
      documentAutoSaveTimerRef.current = undefined;
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
    setGraphCanvasPositions({});
    setGraphCanvasUserPositions({});
    setGraphCanvasHorizontalPositions({});

    if (selectedGraphPath === "") {
      setGraphCanvasData(null);
      setGraphCanvasLoading(false);
      setGraphCanvasError("");
      setGraphCanvasLayoutMode("user");
      setGraphCreateError("");
      setGraphCreatePendingType("");
      setSelectedCanvasNodeId("");
      return;
    }

    let cancelled = false;

    // Clear violations from the previously viewed graph immediately so stale
    // highlights cannot linger while the new graph's validation is in flight.
    setGraphEdgeViolations([]);

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

    async function loadGraphValidationForCanvas(): Promise<void> {
      try {
        const response = await loadGraphValidation(selectedGraphPath);
        if (!cancelled) {
          setGraphEdgeViolations(response.violations);
        }
      } catch {
        // Validation is best-effort: clear highlights rather than failing the canvas.
        if (!cancelled) {
          setGraphEdgeViolations([]);
        }
      }
    }

    void loadGraphCanvas();
    void loadGraphValidationForCanvas();

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
    // Parallelize independent fetches: workspace snapshot, current document reload,
    // and search. Snapshot is required for graph visibility, but document and
    // search are independent of it and of each other, so they run concurrently
    // to cut tail latency by one RTT when both are needed.
    const shouldReloadDocument = options?.reloadCurrentDocument === true && selectedDocumentId !== "" && (options === undefined || options.nextDocument === undefined);
    const shouldSearch = hasDeferredSearchFilter;

    const snapshotPromise = loadWorkspaceSnapshot();
    const documentPromise = shouldReloadDocument
      ? requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(selectedDocumentId)}`).then(
          (value) => ({ ok: true as const, value }),
          (error) => ({ ok: false as const, error }),
        )
      : null;
    const searchPromise = shouldSearch
      ? requestJSON<SearchResult[]>(buildSearchRequestPath({
          q: deferredSearchQuery,
          tag: deferredSearchTagQuery,
          title: deferredSearchTitleQuery,
          description: deferredSearchDescriptionQuery,
          content: deferredSearchContentQuery,
        }, 8)).then(
          (value) => ({ ok: true as const, value }),
          (error) => ({ ok: false as const, error }),
        )
      : null;

    const snapshot = await snapshotPromise;
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
    } else if (documentPromise) {
      const result = await documentPromise;
      if (result.ok) {
        syncSelectedDocumentState(result.value);
        setPanelError("");
      } else {
        syncSelectedDocumentState(null);
        setPanelError(toErrorMessage(result.error));
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

    if (searchPromise) {
      const result = await searchPromise;
      if (result.ok) {
        setSearchResults(result.value);
        setSearchError("");
      } else {
        setSearchResults([]);
        setSearchError(toErrorMessage((result as { error: unknown }).error));
      }
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

  function scheduleDocumentAutoSave(): void {
    const now = Date.now();
    if (documentAutoSaveTimerRef.current !== undefined) {
      window.clearTimeout(documentAutoSaveTimerRef.current);
      documentAutoSaveTimerRef.current = undefined;
    }

    const fire = (): void => {
      documentAutoSaveTimerRef.current = undefined;
      if (selectedDocumentRef.current !== null) {
        // The editor emits markdown changes on a trailing timer. Read the
        // editor synchronously before taking the snapshot so rich-text edits
        // (especially diagram/code-block changes) cannot be replaced by the
        // previous form ref value.
        syncDocumentBodyFromActiveEditor();
        lastDocumentSaveAtRef.current = Date.now();
        void handleSaveDocument(selectedDocumentRef.current, formStateRef.current);
      }
    };

    if (now - lastDocumentSaveAtRef.current >= AUTO_SAVE_MAX_GAP_MS) {
      // Continuous-typing guard: persist now instead of waiting for a pause, so
      // the unsaved window stays bounded even when the user never stops typing.
      lastDocumentSaveAtRef.current = now;
      fire();
      return;
    }

    documentAutoSaveTimerRef.current = window.setTimeout(fire, AUTO_SAVE_DEBOUNCE_MS);
  }

  function scheduleHomeAutoSave(): void {
    const now = Date.now();
    if (homeAutoSaveTimerRef.current !== undefined) {
      window.clearTimeout(homeAutoSaveTimerRef.current);
      homeAutoSaveTimerRef.current = undefined;
    }

    const fire = (): void => {
      homeAutoSaveTimerRef.current = undefined;
      // Rich-text changes are emitted by the editor on a trailing callback.
      // Read the live editor before snapshotting so Home autosave cannot send
      // the previous body to the desktop binding.
      syncHomeBodyFromEditor();
      lastHomeSaveAtRef.current = Date.now();
      void handleSaveHomeContent(homeFormStateRef.current);
    };

    if (now - lastHomeSaveAtRef.current >= AUTO_SAVE_MAX_GAP_MS) {
      lastHomeSaveAtRef.current = now;
      fire();
      return;
    }

    homeAutoSaveTimerRef.current = window.setTimeout(fire, AUTO_SAVE_DEBOUNCE_MS);
  }

  function updateFormField(field: keyof DocumentFormState, value: string): void {
    // Write the ref synchronously (not via the functional setState updater) so
    // an immediate max-gap save can never capture stale content: the updater
    // only runs after the event handler returns.
    const next = { ...formStateRef.current, [field]: value };
    formStateRef.current = next;
    setFormState(next);

    // Keep the active panel's per-thread draft in sync so a later focus swap
    // restores exactly what was typed via the properties panel or right rail.
    const activeId = selectedDocumentIdRef.current;
    if (activeId !== "" && threadFormStatesRef.current[activeId] !== undefined) {
      const threadNext = { ...threadFormStatesRef.current[activeId], [field]: value };
      threadFormStatesRef.current = { ...threadFormStatesRef.current, [activeId]: threadNext };
      setThreadFormStates(threadFormStatesRef.current);
    }

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

    scheduleDocumentAutoSave();
  }

  /** Per-panel field edit: updates that panel's draft only (no autosave here —
   * the panel schedules its own). The active document mirrors into the legacy
   * form state so TOC/properties/header stay live. */
  function updateThreadFormField(documentId: string, field: keyof DocumentFormState, value: string): void {
    const current = threadFormStatesRef.current[documentId];
    if (current === undefined) return;
    const next = { ...current, [field]: value };
    threadFormStatesRef.current = { ...threadFormStatesRef.current, [documentId]: next };
    setThreadFormStates(threadFormStatesRef.current);

    if (selectedDocumentIdRef.current === documentId) {
      formStateRef.current = next;
      setFormState(next);
    }
  }

  /** Persist one open thread panel's document from its own draft. */
  async function saveThreadDocument(documentId: string): Promise<void> {
    const doc = threadDocumentsByIdRef.current[documentId];
    const state = threadFormStatesRef.current[documentId];
    if (doc === undefined || state === undefined) return;
    await handleSaveDocument(doc, state);
  }

  // Panels with a debounced save still queued — flushed with keepalive on hide.
  const pendingPanelSavesRef = useRef<Set<string>>(new Set());

  function setThreadPanelSavePending(documentId: string, pending: boolean): void {
    if (pending) {
      pendingPanelSavesRef.current.add(documentId);
    } else {
      pendingPanelSavesRef.current.delete(documentId);
    }
  }

  function registerThreadPanelEditor(documentId: string, getMarkdown: () => string): void {
    threadPanelEditorsRef.current.set(documentId, getMarkdown);
  }

  function unregisterThreadPanelEditor(documentId: string): void {
    threadPanelEditorsRef.current.delete(documentId);
  }

  /** Mirror a legacy form-state write into the active panel's per-thread draft
   * so both save paths always send identical payloads. */
  function mirrorLegacyFormStateToThread(): void {
    const activeId = selectedDocumentIdRef.current;
    if (activeId !== "" && threadFormStatesRef.current[activeId] !== undefined) {
      const threadNext = { ...threadFormStatesRef.current[activeId], ...formStateRef.current };
      threadFormStatesRef.current = { ...threadFormStatesRef.current, [activeId]: threadNext };
      setThreadFormStates(threadFormStatesRef.current);
    }
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

    mirrorLegacyFormStateToThread();
    scheduleDocumentAutoSave();
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
    mirrorLegacyFormStateToThread();

    setEditableLinkDetails((current) => {
      const next = {
        ...current,
        [nextNodeID]: current[nextNodeID] ?? { context: "", linkType: "" },
      };
      editableLinkDetailsRef.current = next;
      return next;
    });

    scheduleDocumentAutoSave();
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
    mirrorLegacyFormStateToThread();

    setEditableLinkDetails((current) => {
      const next = { ...current };
      delete next[nodeId];
      editableLinkDetailsRef.current = next;
      return next;
    });

    scheduleDocumentAutoSave();
  }

  function updateHomeFormField(field: keyof HomeFormState, value: string): void {
    const normalizedValue = field === "body" ? normalizeHomeBodyForSave(value) : value;
    const next = { ...homeFormStateRef.current, [field]: normalizedValue };
    // Keep the ref in sync before scheduling. Home editor changes can arrive
    // immediately before the debounce callback runs, and a functional state
    // updater is not applied until after the event handler returns.
    homeFormStateRef.current = next;
    setHomeFormState(next);
    scheduleHomeAutoSave();
  }

  function clearContextPanel(): void {
    if (documentAutoSaveTimerRef.current !== undefined) {
      window.clearTimeout(documentAutoSaveTimerRef.current);
      documentAutoSaveTimerRef.current = undefined;
    }
    setSelectedDocumentId("");
    setSelectedDocumentOpenMode("right-rail");
    setSidebarView("content");
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
    if (sidebarView === "content" && activeSurface.kind === "home") {
      setSidebarView("toc");
      return;
    }

    // Sync editor state synchronously so the form state is fresh.
    syncDocumentBodyFromActiveEditor();
    syncHomeBodyFromEditor();

    // Cancel pending auto-save timers so they don't fire after we leave.
    if (documentAutoSaveTimerRef.current !== undefined) {
      window.clearTimeout(documentAutoSaveTimerRef.current);
      documentAutoSaveTimerRef.current = undefined;
    }
    if (homeAutoSaveTimerRef.current !== undefined) {
      window.clearTimeout(homeAutoSaveTimerRef.current);
      homeAutoSaveTimerRef.current = undefined;
    }

    // Wait for any in-progress save to finish before starting a new one,
    // but don't block the transition on it.
    const pendingDocSave = documentSavePromiseRef.current;
    const pendingHomeSave = homeSavePromiseRef.current;

    startTransition(() => {
      clearContextPanel();
      setGraphCanvasError("");
      setGraphCreateError("");
      setSelectedCanvasNodeId("");
      setSidebarView("toc");
      setActiveSurface({ kind: "home" });
    });

    // Fire saves in the background — don't block navigation.
    if (pendingDocSave !== null) {
      void pendingDocSave;
    }
    if (selectedDocumentRef.current !== null) {
      void handleSaveDocument(selectedDocumentRef.current, formStateRef.current);
    }
    if (pendingHomeSave !== null) {
      void pendingHomeSave;
    }
  }

  async function handleSelectGraph(graphPath: string): Promise<void> {
    syncDocumentBodyFromActiveEditor();
    syncHomeBodyFromEditor();

    if (documentAutoSaveTimerRef.current !== undefined) {
      window.clearTimeout(documentAutoSaveTimerRef.current);
      documentAutoSaveTimerRef.current = undefined;
    }
    if (homeAutoSaveTimerRef.current !== undefined) {
      window.clearTimeout(homeAutoSaveTimerRef.current);
      homeAutoSaveTimerRef.current = undefined;
    }

    const pendingDocSave = documentSavePromiseRef.current;
    const pendingHomeSave = homeSavePromiseRef.current;

    startTransition(() => {
      clearContextPanel();
      setGraphCanvasError("");
      setGraphCreateError("");
      setSelectedCanvasNodeId("");
      setSidebarView("content");
      setActiveSurface({ kind: "graph", graphPath });
    });

    if (pendingDocSave !== null) {
      void pendingDocSave;
    }
    if (selectedDocumentRef.current !== null) {
      void handleSaveDocument(selectedDocumentRef.current, formStateRef.current);
    }
    if (pendingHomeSave !== null) {
      void pendingHomeSave;
    }
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

  function updateGraphCanvasNodeLayout(documentId: string, layout: { width?: number; height?: number; zIndex?: number }): void {
    setGraphCanvasData((current) => {
      if (current === null) {
        return current;
      }

      let changed = false;
      const nextNodes = current.nodes.map((node) => {
        if (node.id !== documentId) {
          return node;
        }

        const width = layout.width ?? node.width;
        const height = layout.height ?? node.height;
        const zIndex = layout.zIndex ?? node.zIndex;
        if (width === node.width && height === node.height && zIndex === node.zIndex) {
          return node;
        }

        changed = true;
        return {
          ...node,
          width,
          height,
          zIndex,
        };
      });

      return changed ? { ...current, nodes: nextNodes } : current;
    });
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

    const flow = graphCanvasFlowRef.current as (ReactFlowInstance<Node<GraphCanvasFlowNodeData>, Edge<GraphCanvasFlowEdgeData>> & {
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

      const layoutByID = new Map(response.positions.map((item) => [item.documentId, {
        width: item.width,
        height: item.height,
        zIndex: item.zIndex,
      }]));

      return {
        ...current,
        nodes: current.nodes.map((node) => {
          const persisted = persistedById.get(node.id);
          if (persisted === undefined) {
            return node;
          }

          const persistedLayout = layoutByID.get(node.id);

          return {
            ...node,
            position: persisted,
            positionPersisted: true,
            width: persistedLayout?.width ?? node.width,
            height: persistedLayout?.height ?? node.height,
            zIndex: persistedLayout?.zIndex ?? node.zIndex,
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
      const flowNodes = graphCanvasNodesRef.current;
      const layoutByID = new Map(flowNodes.map((node) => [node.id, {
        width: node.data.width,
        height: node.data.height,
        zIndex: node.data.zIndex,
      }]));

      const snapshotPositions = Object.entries({
        ...graphCanvasPositionsRef.current,
        [documentId]: position,
      }).map(([currentDocumentId, currentPosition]) => {
        const layout = layoutByID.get(currentDocumentId);
        return {
          documentId: currentDocumentId,
          x: currentPosition.x,
          y: currentPosition.y,
          width: layout?.width,
          height: layout?.height,
          zIndex: layout?.zIndex,
        };
      });
      const next = snapshotPositions.length > 0 ? snapshotPositions : [{ documentId, x: position.x, y: position.y }];
      await persistGraphCanvasPositions(next);
    } catch (saveError) {
      setGraphCanvasError(toErrorMessage(saveError));
    }
  }

  async function persistGraphCanvasNodeLayout(documentId: string, layout: { width?: number; height?: number; zIndex?: number }): Promise<void> {
    const currentNodes = graphCanvasData?.nodes ?? [];
    const zValues = currentNodes
      .map((node) => node.zIndex ?? 0)
      .filter((value) => Number.isFinite(value));
    const maxZIndex = zValues.length > 0 ? Math.max(...zValues) : 0;
    const minZIndex = zValues.length > 0 ? Math.min(...zValues) : 0;

    const resolvedLayout = {
      width: layout.width,
      height: layout.height,
      zIndex: layout.zIndex === Number.MAX_SAFE_INTEGER
        ? maxZIndex + 1
        : layout.zIndex === Number.MIN_SAFE_INTEGER
          ? minZIndex - 1
          : layout.zIndex,
    };

    const basePosition = graphCanvasPositionsRef.current[documentId]
      ?? graphCanvasData?.nodes.find((node) => node.id === documentId)?.position;
    if (basePosition === undefined) {
      return;
    }

    updateGraphCanvasNodeLayout(documentId, resolvedLayout);

    try {
      setGraphCanvasError("");
      const flowNodes = graphCanvasNodesRef.current;
      const layoutByID = new Map(flowNodes.map((node) => [node.id, {
        width: node.id === documentId ? (resolvedLayout.width ?? node.data.width) : node.data.width,
        height: node.id === documentId ? (resolvedLayout.height ?? node.data.height) : node.data.height,
        zIndex: node.id === documentId ? (resolvedLayout.zIndex ?? node.data.zIndex) : node.data.zIndex,
      }]));

      const snapshotPositions = Object.entries(graphCanvasPositionsRef.current).map(([currentDocumentId, currentPosition]) => {
        const currentLayout = layoutByID.get(currentDocumentId);
        return {
          documentId: currentDocumentId,
          x: currentPosition.x,
          y: currentPosition.y,
          width: currentLayout?.width,
          height: currentLayout?.height,
          zIndex: currentLayout?.zIndex,
        };
      });

      const targetLayout = layoutByID.get(documentId);
      const targetPayload = {
        documentId,
        x: basePosition.x,
        y: basePosition.y,
        width: targetLayout?.width,
        height: targetLayout?.height,
        zIndex: targetLayout?.zIndex,
      };

      const next = snapshotPositions.length > 0
        ? snapshotPositions.some((item) => item.documentId === documentId)
          ? snapshotPositions
          : [...snapshotPositions, targetPayload]
        : [targetPayload];
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
    const flow = graphCanvasFlowRef.current as (ReactFlowInstance<Node<GraphCanvasFlowNodeData>, Edge<GraphCanvasFlowEdgeData>> & {
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
    if (sidebarView === "content" && selectedDocumentId === documentId) {
      setSidebarView("toc");
      return;
    }

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
    };
  }): Promise<WorkspaceResponse> {
    return requestJSON<WorkspaceResponse>("/api/workspace", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
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
      // Persist any in-editor home edits first so the refresh cannot discard
      // unsaved work when it reloads the home body from disk below.
      await flushPendingHomeSave();
      await requestJSON<{ rebuilt: boolean }>("/api/index/rebuild", {
        method: "POST",
      });
      // An index refresh is an explicit request to re-sync the Home page from
      // the workspace files. Bypass the pending-edit preservation guard so the
      // freshly indexed home body is pushed into the editor.
      forceHomeReloadRef.current = true;
      await refreshShellViews({ reloadCurrentDocument: true });
      setMutationSuccess("Index refreshed.");
    } catch (rebuildError) {
      setMutationError(toErrorMessage(rebuildError));
    } finally {
      setRebuildingIndex(false);
    }
  }

  async function handleDownloadWorkspaceData(): Promise<void> {
    try {
      clearMutationFeedback();
      const response = await fetch("/api/workspace/download", {
        method: "GET",
        headers: { Accept: "application/zip" },
      });

      if (!response.ok) {
        let message = `${response.status} ${response.statusText}`;
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) {
            message = payload.error;
          }
        } catch {
          // Ignore non-JSON error bodies.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const objectURL = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectURL;
      anchor.download = "workspace.zip";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectURL);
      setMutationSuccess("Workspace zip downloaded.");
    } catch (downloadError) {
      setMutationError(toErrorMessage(downloadError));
    }
  }

  async function handleWorkspaceSelection(nextWorkspacePath: string): Promise<void> {
    const currentWorkspacePath = workspace?.workspacePath ?? "";
    const normalizedNextPath = nextWorkspacePath.trim();
    if (normalizedNextPath === "" || normalizedNextPath === currentWorkspacePath) {
      return;
    }

    try {
      setHomeMutationError("");
      setSwitchingWorkspace(true);
      await selectWorkspace(normalizedNextPath);
      const snapshot = await loadWorkspaceSnapshot();
      setWorkspace(snapshot.workspaceData);
      setGraphTree(snapshot.graphTreeData);
      clearContextPanel();
      setSidebarView("content");
      setActiveSurface({ kind: "home" });
      setGraphCanvasData(null);
      setGraphCanvasReloadToken((current) => current + 1);
      void refreshCalendarDocumentList();
    } catch (err) {
      setHomeMutationError(toErrorMessage(err));
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
      clearContextPanel();
      setSidebarView("content");
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

  function beginThreadPanelResize(event: React.MouseEvent<HTMLDivElement>, panel: HTMLElement | null, panelKey: string): void {
    if (!isPrimaryMouseButton(event.button) || panel === null) {
      return;
    }

    const bounds = panel.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }

    const threadStack = panel.closest<HTMLElement>(".thread-stack");

    const startX = event.clientX;
    const startWidth = bounds.width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    panel.classList.add("is-resizing");

    const tooltip = document.createElement("div");
    tooltip.className = "thread-panel-resize-tooltip";
    tooltip.textContent = `${Math.round(startWidth)}px`;
    tooltip.style.left = `${event.clientX}px`;
    tooltip.style.top = `${bounds.top - 6}px`;
    document.body.appendChild(tooltip);

    let lastWidth = startWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = clampThreadPanelWidth(startWidth + deltaX);
      if (nextWidth === lastWidth) return;
      lastWidth = nextWidth;

      panel.style.setProperty("--thread-panel-width", `${nextWidth}px`);
      const widthKey = panelKey.includes(":") ? panelKey.split(":")[0] : panelKey;
      persistThreadPanelWidths((prev) => ({ ...prev, [widthKey]: nextWidth }));
      tooltip.textContent = `${Math.round(nextWidth)}px`;
      tooltip.style.left = `${moveEvent.clientX}px`;

      if (threadStack) {
        const stackRect = threadStack.getBoundingClientRect();
        const overshoot = moveEvent.clientX - stackRect.right + 16;
        if (overshoot > 0) {
          threadStack.scrollLeft += overshoot;
        }
      }
    };

    const cleanup = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      panel.classList.remove("is-resizing");
      tooltip.remove();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup as any);
    };
    const handleMouseUp = () => cleanup();

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("pointercancel", cleanup);
    window.addEventListener("blur", cleanup as any);
    event.preventDefault();
    event.stopPropagation();
  }

  function resetThreadPanelWidth(panelKey: string): void {
    const widthKey = panelKey.includes(":") ? panelKey.split(":")[0] : panelKey;
    persistThreadPanelWidths((prev) => {
      const next = { ...prev };
      delete next[widthKey];
      return next;
    });
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
          setLastSaveAt(Date.now());
        } else {
          setMutationSuccess(`Imported ${result.created.length} files into ${selectedGraphPath}.`);
          setLastSaveAt(Date.now());
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
      // In the desktop app, graph creation bypasses the HTTP layer and calls
      // the Wails binding directly.
      const wailsCreateGraph = getWailsCreateGraph();
      if (wailsCreateGraph !== null) {
        await wailsCreateGraph({ name });
      } else {
        await requestJSON<{ name: string }>("/api/graphs", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
      }
      const snapshot = await loadWorkspaceSnapshot();
      setGraphTree(snapshot.graphTreeData);
    } catch (err) {
      setMutationError(toErrorMessage(err));
    }
  }

  async function handleSidebarSetGraphColor(graphPath: string, color: string | null): Promise<void> {
    try {
      clearMutationFeedback();
      // In the desktop app, graph color updates bypass the HTTP layer and call
      // the Wails binding directly.
      const wailsSetGraphColor = getWailsUpdateGraphColor();
      if (wailsSetGraphColor !== null) {
        await wailsSetGraphColor({ graphPath, color: color ?? "" });
      } else {
        await requestJSON<{ name: string; color?: string }>(`/api/graphs/${encodeURIComponent(graphPath)}/color`, {
          method: "PUT",
          body: JSON.stringify({ color: color ?? "" }),
        });
      }

      const snapshot = await loadWorkspaceSnapshot();
      setGraphTree(snapshot.graphTreeData);
    } catch (err) {
      setMutationError(toErrorMessage(err));
    }
  }

  /** Sets or clears the per-node color override for a document. Null or empty string removes the override. */
  async function handleSetNodeColor(nodeId: string, colorId: string | null): Promise<void> {
    try {
      clearMutationFeedback();
      const colorValue = colorId ?? "";
      // In the desktop app, node color updates bypass the HTTP layer and call
      // the Wails binding directly.
      const wailsUpdate = getWailsUpdate();
      const updatedDocument = wailsUpdate !== null
        ? await wailsUpdate({ documentID: nodeId, patch: { color: colorValue } })
        : await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(nodeId)}`, {
            method: "PUT",
            body: JSON.stringify({ color: colorValue }),
          });

      if (selectedDocumentRef.current?.id === updatedDocument.id) {
        syncSelectedDocumentState(updatedDocument, { preserveFormState: false });
      }
      setGraphTree((current) => updateGraphTreeDocumentEntry(current, updatedDocument, updatedDocument));
      setGraphCanvasData((current) => updateGraphCanvasDocumentEntry(current, updatedDocument, updatedDocument));
    } catch (err) {
      setMutationError(toErrorMessage(err));
    }
  }

  async function handleSidebarSetGraphCanvasDisabled(graphPath: string, disabled: boolean): Promise<void> {
    try {
      clearMutationFeedback();
      // In the desktop app, the canvas toggle bypasses the HTTP layer and calls
      // the Wails binding directly.
      const wailsSetGraphCanvasDisabled = getWailsUpdateGraphCanvasDisabled();
      if (wailsSetGraphCanvasDisabled !== null) {
        await wailsSetGraphCanvasDisabled({ graphPath, disabled });
      } else {
        await requestJSON<{ name: string; canvasDisabled: boolean }>(`/api/graphs/${encodeURIComponent(graphPath)}/canvas-disabled`, {
          method: "PUT",
          body: JSON.stringify({ disabled }),
        });
      }

      const snapshot = await loadWorkspaceSnapshot();
      setGraphTree(snapshot.graphTreeData);

      if (!disabled) {
        await handleSelectGraph(graphPath);
      }
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

  function handleCanvasDeleteNode(nodeId: string): void {
    const node = graphCanvasNodes.find((candidate) => candidate.id === nodeId);
    if (node === undefined) {
      return;
    }
    openDeleteDialog({
      id: node.data.id,
      type: node.data.type,
      title: node.data.title,
      path: node.data.fileName,
      graphPath: node.data.graph,
    });
  }

  async function handleSidebarMoveNode(file: GraphTreeFileData, sourceGraphPath: string, targetGraphPath: string): Promise<void> {
    if (sourceGraphPath === targetGraphPath) {
      return;
    }

    try {
      clearMutationFeedback();
      await flushPendingActiveEditorSave();

      // In the desktop app, node moves bypass the HTTP layer and call the
      // Wails binding directly.
      const wailsUpdate = getWailsUpdate();
      const updatedDocument = wailsUpdate !== null
        ? await wailsUpdate({ documentID: file.id, patch: { graph: targetGraphPath } })
        : await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(file.id)}`, {
            method: "PUT",
            body: JSON.stringify({ graph: targetGraphPath }),
          });

      if (selectedDocumentId === updatedDocument.id) {
        await refreshShellViews({ nextDocument: updatedDocument, nextDocumentId: updatedDocument.id });
      } else {
        await refreshShellViews();
      }

      setMutationSuccess(`${formatDocumentType(updatedDocument.type)} moved to ${targetGraphPath}.`);
      setLastSaveAt(Date.now());
    } catch (moveFailure) {
      setMutationError(toErrorMessage(moveFailure));
    }
  }

  async function handleSidebarMoveGraph(sourceGraphPath: string, targetGraphPath: string): Promise<void> {
    const sourceSegments = sourceGraphPath.split("/");
    const sourceDisplayName = sourceSegments[sourceSegments.length - 1];
    const nextPath = targetGraphPath !== "" ? `${targetGraphPath}/${sourceDisplayName}` : sourceDisplayName;

    if (nextPath === sourceGraphPath) {
      return;
    }

    try {
      clearMutationFeedback();
      await flushPendingActiveEditorSave();

      // Graph moves reuse the rename binding — the endpoint is the same PATCH.
      const wailsRenameGraph = getWailsRenameGraph();
      if (wailsRenameGraph !== null) {
        await wailsRenameGraph({ currentName: sourceGraphPath, nextName: nextPath });
      } else {
        await requestJSON<{ name: string }>(`/api/graphs/${encodeURIComponent(sourceGraphPath)}`, {
          method: "PATCH",
          body: JSON.stringify({ name: nextPath }),
        });
      }

      const selectedDocumentGraphPath = selectedDocument?.graph ?? documentGraphById.get(selectedDocumentId) ?? "";
      const selectedDocumentAffected =
        selectedDocumentId !== "" &&
        (selectedDocumentGraphPath === sourceGraphPath || selectedDocumentGraphPath.startsWith(sourceGraphPath + "/"));
      const refreshedSelectedDocument = selectedDocumentAffected
        ? await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(selectedDocumentId)}`)
        : undefined;

      await refreshShellViews(refreshedSelectedDocument !== undefined
        ? { nextDocument: refreshedSelectedDocument, nextDocumentId: refreshedSelectedDocument.id }
        : undefined);

      if (activeSurface.kind === "graph") {
        const nextGraphPath = remapGraphPath(activeSurface.graphPath, sourceGraphPath, nextPath);
        if (nextGraphPath !== activeSurface.graphPath) {
          startTransition(() => setActiveSurface({ kind: "graph", graphPath: nextGraphPath }));
        }
      }

      setMutationSuccess(`Graph moved to ${nextPath}.`);
      setLastSaveAt(Date.now());
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
      // In the desktop app, node creation bypasses the HTTP layer and calls the
      // Wails binding directly, which returns the same DocumentResponse shape.
      const wailsCreate = getWailsCreate();
      const createdDocument = wailsCreate !== null
        ? await wailsCreate(createGraphDocumentPayload(type, graphPath, trimmed))
        : await requestJSON<DocumentResponse>("/api/documents", {
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
        setLastSaveAt(Date.now());
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
        // In the desktop app, graph renames bypass the HTTP layer and call the
        // Wails binding directly.
        const wailsRenameGraph = getWailsRenameGraph();
        if (wailsRenameGraph !== null) {
          await wailsRenameGraph({ currentName: renameDialog.graphPath, nextName: trimmed });
        } else {
          await requestJSON<{ name: string }>(`/api/graphs/${encodeURIComponent(renameDialog.graphPath)}`, {
            method: "PATCH",
            body: JSON.stringify({ name: trimmed }),
          });
        }

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
        setLastSaveAt(Date.now());
      } else {
        // In the desktop app, file renames go through the Wails UpdateDocument
        // binding (a fileName patch) instead of the HTTP layer.
        const wailsUpdate = getWailsUpdate();
        const updatedDocument = wailsUpdate !== null
          ? await wailsUpdate({ documentID: renameDialog.documentId, patch: { fileName: trimmed } })
          : await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(renameDialog.documentId)}`, {
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
        setLastSaveAt(Date.now());
      }
    } catch (renameFailure) {
      setRenameError(toErrorMessage(renameFailure));
    } finally {
      setRenamePending(false);
    }
  }

  async function handleSidebarDeleteGraph(graphPath: string): Promise<void> {
    try {
      // In the desktop app, graph deletion bypasses the HTTP layer and calls
      // the Wails binding directly.
      const wailsDeleteGraph = getWailsDeleteGraph();
      if (wailsDeleteGraph !== null) {
        await wailsDeleteGraph({ name: graphPath });
      } else {
        await requestJSON<{ deleted: boolean }>(`/api/graphs/${encodeURIComponent(graphPath)}`, {
          method: "DELETE",
        });
      }
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

  async function handleSidebarDownloadGraph(graphPath: string): Promise<void> {
    try {
      clearMutationFeedback();
      const response = await fetch(`/api/graphs/${encodeURIComponent(graphPath)}/download`, {
        method: "GET",
        headers: { Accept: "application/zip" },
      });

      if (!response.ok) {
        let message = `${response.status} ${response.statusText}`;
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) {
            message = payload.error;
          }
        } catch {
          // Ignore non-JSON error bodies.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const objectURL = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectURL;
      anchor.download = `${graphPath.replaceAll("/", "-") || "graph"}.zip`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectURL);
      setMutationSuccess(`Downloaded ${graphPath} as zip.`);
    } catch (downloadError) {
      setMutationError(toErrorMessage(downloadError));
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

    const cleanupDrag = (pointerEvent?: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", cleanupDrag as any);
      const dragState = graphCanvasDragRef.current;
      graphCanvasDragRef.current = null;
      if (dragState === null || !dragState.moved) {
        if (dragState !== null) clearGraphCanvasIntersections();
        return;
      }
      const srcEvent = pointerEvent ?? ({ clientX: 0, clientY: 0 } as PointerEvent);
      const nextPosition = {
        x: (srcEvent.clientX - dragState.shellLeft - dragState.offsetX - vpX) / zoom,
        y: (srcEvent.clientY - dragState.shellTop - dragState.offsetY - vpY) / zoom,
      };
      updateGraphCanvasNodePosition(dragState.documentId, nextPosition);
      clearGraphCanvasIntersections();
      void persistGraphCanvasPosition(dragState.documentId, nextPosition);
    };
    const handlePointerUp = (pointerEvent: PointerEvent) => cleanupDrag(pointerEvent);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", cleanupDrag as any);
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

  async function handleSaveDocument(doc: DocumentResponse, state: DocumentFormState, options?: { keepalive?: boolean }): Promise<void> {
    const keepalive = options?.keepalive === true;
    const previousSave = documentSavePromiseRef.current;
    const savePromise = (async () => {
      // Serialize saves so an older PUT can never land after a newer one. The
      // unload flush (keepalive) intentionally skips this so the final content
      // is dispatched immediately before the page goes away.
      if (previousSave !== null && !keepalive) {
        await previousSave;
      }

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

        // Always include color so clearing the override (empty string) is persisted.
        payload.color = state.color;

        const payloadJSON = JSON.stringify(payload);
        // In the desktop app, autosaves bypass the HTTP layer and call the
        // Wails UpdateDocument binding directly. The unload flush (keepalive)
        // intentionally stays on HTTP: keepalive fetches are designed to
        // survive page teardown, which a Go-JS binding call cannot guarantee.
        const wailsUpdate = getWailsUpdate();
        const updatedDocument = wailsUpdate !== null && !keepalive
          ? await wailsUpdate({ documentID: doc.id, patch: payload as WailsUpdateDocumentPatch })
          : await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(doc.id)}`, {
              method: "PUT",
              ...(keepalive && new Blob([payloadJSON]).size <= KEEPALIVE_MAX_BODY_BYTES ? { keepalive: true } : {}),
              body: payloadJSON,
            });

        if (selectedDocumentRef.current?.id === updatedDocument.id) {
          syncSelectedDocumentState(updatedDocument, { preserveFormState: true });
        }
        if (documentThreadRef.current.some((entry) => entry.documentId === updatedDocument.id)) {
          setThreadDocumentsById((current) => ({ ...current, [updatedDocument.id]: updatedDocument }));
        }
        setGraphTree((current) => updateGraphTreeDocumentEntry(current, doc, updatedDocument));
        setGraphCanvasData((current) => updateGraphCanvasDocumentEntry(current, doc, updatedDocument));
        // The in-place canvas update above covers node content (title, body
        // preview, tags, status, color), so a routine text save must not reload
        // the whole canvas — that swaps the visible graph for a loading
        // skeleton and re-applies node positions on every autosave, which reads
        // as a screen flicker while typing. Only reload when the save changed
        // something the in-place update cannot represent: the node's graph
        // (moved) or its link set (edges).
        const canvasNeedsReload = doc.graph !== updatedDocument.graph || !nodeLinksEqual(doc.links, updatedDocument.links);
        if (canvasNeedsReload) {
          setGraphCanvasReloadToken((current) => current + 1);
        }
        setLastSaveAt(Date.now());
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

  async function handleSaveHomeContent(state: HomeFormState, options?: { keepalive?: boolean }): Promise<void> {
    const keepalive = options?.keepalive === true;
    const previousSave = homeSavePromiseRef.current;
    const savePromise = (async () => {
      if (previousSave !== null && !keepalive) {
        await previousSave;
      }

      setSavingHome(true);
      setHomeMutationError("");

      try {
        const homePayload = {
          title: state.title,
          description: state.description,
          body: normalizeHomeBodyForSave(state.body),
        };
        const payloadJSON = JSON.stringify(homePayload);
        // In the desktop app, home saves bypass the HTTP layer and call the
        // Wails UpdateHome binding directly. The unload flush (keepalive)
        // intentionally stays on HTTP for the same reason as document saves.
        const wailsUpdateHome = getWailsUpdateHome();
        const updatedHome = wailsUpdateHome !== null && !keepalive
          ? await wailsUpdateHome(homePayload)
          : await requestJSON<HomeResponse>("/api/home", {
              method: "PUT",
              ...(keepalive && new Blob([payloadJSON]).size <= KEEPALIVE_MAX_BODY_BYTES ? { keepalive: true } : {}),
              body: payloadJSON,
            });

        setGraphTree((current) => (current === null ? current : { ...current, home: updatedHome }));
        setLastSaveAt(Date.now());
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

    const cleanupConnect = (): void => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", cleanupConnect as any);
      const target = connectingTargetRef.current;
      connectingTargetRef.current = null;
      setConnectingFrom(null);
      setConnectingStartPos(null);
      setConnectingPointerPos(null);
      setConnectingTarget(null);
      if (target !== null) void handleCreateEdge(sourceId, target);
    };
    function onPointerUp(): void { cleanupConnect(); }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", cleanupConnect as any);
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

  async function handleEdgeTypeQuickFix(
    edge: { sourceId: string; targetId: string; context: string; relationships: string[] },
    violation: EdgeTypeViolation,
  ): Promise<void> {
    await mutateEdge("PATCH", {
      fromId: edge.sourceId,
      toId: edge.targetId,
      context: edge.context,
      relationships: applyEdgeTypeFixTags(edge.relationships, violation),
    });
    // The fixed edge's tags changed; close a stale toolbar for the same edge.
    setEdgeToolbar((current) =>
      current !== null && current.sourceId === edge.sourceId && current.targetId === edge.targetId ? null : current,
    );
  }

  async function handleFixAllEdgeViolations(): Promise<void> {
    if (graphEdgeViolations.length === 0 || graphCanvasData === null) {
      return;
    }

    // Group violations by the edge they target so each distinct edge is patched
    // once (multiple violations can match the same edge).
    const violationsByEdge = new Map<string, EdgeTypeViolation[]>();
    for (const violation of graphEdgeViolations) {
      const key = `${violation.fromID}\u0000${violation.toID}`;
      const bucket = violationsByEdge.get(key);
      if (bucket === undefined) {
        violationsByEdge.set(key, [violation]);
      } else {
        bucket.push(violation);
      }
    }

    let fixed = 0;
    let failed = 0;
    let firstFailure: string | null = null;
    for (const [key, violations] of violationsByEdge) {
      const separatorIndex = key.indexOf("\u0000");
      const fromId = key.slice(0, separatorIndex);
      const toId = key.slice(separatorIndex + 1);
      const edge = graphCanvasData.edges.find(
        (candidate) => candidate.source === fromId && candidate.target === toId,
      );
      if (edge === undefined) {
        failed += 1;
        if (firstFailure === null) {
          firstFailure = "Edge not found on the canvas.";
        }
        continue;
      }

      const relationships = applyEdgeTypeFixTagsAll(edge.relationships ?? [], violations);
      const errorMessage = await mutateEdge("PATCH", {
        fromId,
        toId,
        context: edge.context ?? "",
        relationships,
      }, { reload: false });
      if (errorMessage === null) {
        fixed += 1;
      } else {
        failed += 1;
        if (firstFailure === null) {
          firstFailure = errorMessage;
        }
      }
    }

    if (failed === 0) {
      setMutationError("");
      setMutationSuccess(`Fixed ${fixed} edge${fixed === 1 ? "" : "s"}.`);
      setLastSaveAt(Date.now());
    } else if (fixed === 0) {
      setMutationSuccess("");
      setMutationError(firstFailure ?? `Could not fix ${failed} edge${failed === 1 ? "" : "s"}.`);
    } else {
      setMutationError("");
      setMutationSuccess(`Fixed ${fixed} edge${fixed === 1 ? "" : "s"}, ${failed} failed.`);
      setLastSaveAt(Date.now());
    }
    setEdgeToolbar(null);
    // A single reload refreshes the canvas and the validation results together.
    setGraphCanvasReloadToken((current) => current + 1);
  }

  function handleSidebarSelectViolation(violation: EdgeTypeViolation): void {
    const edge = (graphCanvasData?.edges ?? []).find(
      (candidate) => candidate.source === violation.fromID && candidate.target === violation.toID,
    );
    if (edge === undefined) {
      return;
    }
    setHoveredEdgeTooltip(null);
    setEdgeToolbar(null);
    setSelectedEdgeId(edge.id);
  }

  function handleOpenViolationsPanel(): void {
    toggleRightPanel("violations");
  }

  /**
   * Jump straight to the violations sidebar for a graph: navigate to the graph
   * surface (when not already there) and open the violations panel without
   * toggling it closed.
   */
  async function handleOpenGraphViolations(graphPath: string): Promise<void> {
    const alreadyOnGraph = activeSurface.kind === "graph" && activeSurface.graphPath === graphPath;
    if (!alreadyOnGraph) {
      await handleSelectGraph(graphPath);
    }

    setRightSidebarWidth((current) => Math.max(current, 300));
    setThreadExpanded(false);
    setRightRailMaximized(false);
    setRightPanelTab("violations");
    setRightRailCollapsed(false);
  }

  function handleSidebarFixViolation(violation: EdgeTypeViolation): void {
    const edge = (graphCanvasData?.edges ?? []).find(
      (candidate) => candidate.kind === "link" && candidate.source === violation.fromID && candidate.target === violation.toID,
    );
    if (edge === undefined) {
      return;
    }
    void handleEdgeTypeQuickFix(
      {
        sourceId: edge.source,
        targetId: edge.target,
        context: edge.context ?? "",
        relationships: edge.relationships ?? [],
      },
      violation,
    );
  }

  fixAllEdgeViolationsRef.current = handleFixAllEdgeViolations;

  // Alt+Shift+F: apply every edge-type violation quick fix in the current graph.
  useEffect(() => {
    if (activeSurface.kind !== "graph") {
      return;
    }

    function handleFixAllViolationsKeyDown(event: KeyboardEvent): void {
      if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key.toLowerCase() !== "f") {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }

      event.preventDefault();
      void fixAllEdgeViolationsRef.current();
    }

    window.addEventListener("keydown", handleFixAllViolationsKeyDown);
    return () => {
      window.removeEventListener("keydown", handleFixAllViolationsKeyDown);
    };
  }, [activeSurface.kind]);

  function clearEdgeClickTimer(): void {
    if (edgeClickTimerRef.current !== null) {
      window.window.clearTimeout(edgeClickTimerRef.current);
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
      // In the desktop app, merges bypass the HTTP layer and call the Wails
      // binding directly, which returns the same DocumentResponse shape.
      const wailsMerge = getWailsMerge();
      const mergedDocument = wailsMerge !== null
        ? await wailsMerge({ documentIds: shiftSelectedNodes })
        : await requestJSON<DocumentResponse>("/api/documents/merge", {
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
      setLastSaveAt(Date.now());
    } catch (mergeFailure) {
      setMutationError(toErrorMessage(mergeFailure));
    }
  }

  async function handleDeleteDocument(force = false): Promise<void> {
    if (deleteDialogTarget === null) {
      return;
    }

    try {
      setDeletingDocument(true);
      clearMutationFeedback();

      // In the desktop app, deletes bypass the HTTP layer and call the Wails
      // binding directly (mirroring how image uploads work). The binding
      // returns the stripped-referencer paths in the same shape as the HTTP
      // response, so normalize it into DeleteDocumentResponse.
      const wailsDelete = getWailsDelete();
      let response: DeleteDocumentResponse;
      if (wailsDelete !== null) {
        const wailsResult = await wailsDelete({ documentID: deleteDialogTarget.id, force });
        response = { deleted: true, id: deleteDialogTarget.id, path: wailsResult.path, strippedReferences: wailsResult.strippedReferences };
      } else {
        response = await requestJSON<DeleteDocumentResponse>(`/api/documents/${encodeURIComponent(deleteDialogTarget.id)}`, {
          method: "DELETE",
          ...(force ? { body: JSON.stringify({ force: true }) } : {}),
        });
      }

      const deletedSelectedDocument = selectedDocumentId === deleteDialogTarget.id;
      if (documentThreadRef.current.some((entry) => entry.documentId === deleteDialogTarget.id)) {
        const deleteIndex = documentThreadRef.current.findIndex((entry) => entry.documentId === deleteDialogTarget.id);
        applyDocumentThread(deleteIndex > 0 ? documentThreadRef.current.slice(0, deleteIndex) : []);
      }
      setDeleteDialogTarget(null);
      setDeleteDialogOpen(false);
      if (deletedSelectedDocument) {
        await refreshShellViews({ nextDocument: null, nextDocumentId: "" });
      } else {
        await refreshShellViews();
      }
      const strippedFrom = response.strippedReferences ?? [];
      setMutationSuccess(force && strippedFrom.length > 0
        ? `${formatDocumentType(deleteDialogTarget.type)} deleted; dangling references stripped from ${strippedFrom.map((refPath) => refPath.split("/").pop()).join(", ")}.`
        : force
          ? `${formatDocumentType(deleteDialogTarget.type)} deleted; dangling references stripped from referencers.`
          : `${formatDocumentType(deleteDialogTarget.type)} deleted from ${response.path}.`);
    } catch (mutationFailure) {
      setMutationError(toErrorMessage(mutationFailure));
    } finally {
      setDeletingDocument(false);
    }
  }

  const threadPanelActions = useThreadPanelActions({
    activateThreadDocument,
    toggleThreadExpanded,
    togglePanelExpandMode,
    moveThreadFocus,
    toggleRightRailMaximized,
    closeDocumentThreadFrom,
    updateHomeFormField,
    handleInlineReferenceOpen,
    handleDateOpen,
    openAssetInThreadFromSource,
    setEditorScrollTarget,
    updateFormField,
    updateThreadFormField,
    saveThreadDocument,
    setThreadPanelSavePending,
    toggleCenterDocumentSidePanel,
    addOutgoingLink,
    removeOutgoingLink,
    updateEditableLinkDetail,
    beginThreadPanelResize,
    resetThreadPanelWidth,
    registerThreadPanelEditor,
    unregisterThreadPanelEditor,
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
    selectedDocumentRef,
  });

  const sidebarNavigationActions = useSidebarNavigationActions({
    handleWorkspaceSelection,
    handleSelectHome,
    handleSelectGraph,
    handleOpenGraphViolations,
    handleSelectDocument,
    handleSidebarCreateGraph,
    handleSidebarCreateNode,
    handleSidebarRenameGraph,
    handleSidebarRenameNode,
    handleSidebarMoveNode,
    handleSidebarMoveGraph,
    handleSidebarDeleteNode,
    handleSidebarDeleteGraph,
    handleSidebarDownloadGraph,
    handleSidebarSetGraphColor,
    handleSidebarSetGraphCanvasDisabled,
    handleSidebarSetNodeColor: handleSetNodeColor,
    handleSidebarRebuildIndex: handleRebuildIndex,
  });

  const { graphCanvasOverlayActions, graphCanvasSurfaceActions } = useGraphCanvasSurfaceActions({
    clearEdgeClickTimer,
    updateIntersectingNodes: updateGraphCanvasIntersections,
    clearIntersectingNodes: clearGraphCanvasIntersections,
    handleGraphCanvasEdgeClick,
    handleGraphCanvasEdgeHover,
    handleGraphCanvasEdgeDoubleClick,
    handlePersistEdgeToolbar,
    handleEdgeTypeQuickFix,
    handleFixAllEdgeViolations,
    handleDeleteEdge,
    handleGraphCanvasOverlayNodeClick,
    handleGraphCanvasOverlayNodeDoubleClick,
    handleGraphCanvasOverlayPointerDown,
    handleConnectionHandlePointerDown,
    handleGraphCanvasNodeDescriptionSave,
    handleGraphCanvasNodeTitleSave,
    handleGraphCanvasNodeStatusChange,
    previewGraphCanvasNodeLayout: updateGraphCanvasNodeLayout,
    persistGraphCanvasNodeLayout,
    handleMergeDocuments,
    handleCreateGraphDocument,
    handleGraphCanvasFilesDrop,
    handleRefreshGraphTree: async () => {
      const snapshot = await loadWorkspaceSnapshot();
      setGraphTree(snapshot.graphTreeData);
    },
    reloadCanvas: () => {
      setGraphCanvasReloadToken((t) => t + 1);
    },
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
  });

  const graphCanvasOverlayController = useMemo<GraphCanvasOverlayController>(() => ({
    state: {
      edges: graphCanvasData?.edges ?? [],
      edgeViolations: graphEdgeViolations,
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
      nodeContextMenu,
      connectingFrom,
      connectingPointerPos,
      connectingStartPos,
    },
    actions: graphCanvasOverlayActions,
  }), [
    canvasContextMenu,
    nodeContextMenu,
    connectingFrom,
    connectingPointerPos,
    connectingStartPos,
    connectingTarget,
    edgeToolbar,
    graphCanvasData?.edges,
    graphEdgeViolations,
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
    updateHomeFormField,
    handleInlineReferenceOpen,
    handleDateOpen,
    openAssetInThreadFromSource,
    setEditorScrollTarget,
    homeThreadDocumentId: HOME_THREAD_DOCUMENT_ID,
  });

  const graphEmptyStateActions = useMemo(() => ({
    setDragActive: graphCanvasSurfaceActions.setDragActive,
    handleFilesDrop: graphCanvasSurfaceActions.handleFilesDrop,
    handleFilesDropFromURIs: graphCanvasSurfaceActions.handleFilesDropFromURIs,
    createGraphDocument: graphCanvasOverlayActions.createGraphDocument,
  }), [
    graphCanvasOverlayActions,
    graphCanvasSurfaceActions,
  ]);

  const settingsDialogActionRefs = useRef({
    setSettingsDialogOpen,
    setSettingsTab,
    handleRebuildIndex,
    handleDownloadWorkspaceData,
    handleWorkspaceDeregister,
    handleAppearanceChange,
    handleStopGUI,
  });

  settingsDialogActionRefs.current.setSettingsDialogOpen = setSettingsDialogOpen;
  settingsDialogActionRefs.current.setSettingsTab = setSettingsTab;
  settingsDialogActionRefs.current.handleRebuildIndex = handleRebuildIndex;
  settingsDialogActionRefs.current.handleDownloadWorkspaceData = handleDownloadWorkspaceData;
  settingsDialogActionRefs.current.handleWorkspaceDeregister = handleWorkspaceDeregister;
  settingsDialogActionRefs.current.handleAppearanceChange = handleAppearanceChange;
  settingsDialogActionRefs.current.handleStopGUI = handleStopGUI;

  const handleSettingsDialogOpenChange = useCallback((open: boolean) => {
    settingsDialogActionRefs.current.setSettingsDialogOpen(open);
  }, []);

  const handleSettingsDialogTabChange = useCallback((tab: "general" | "workspaces" | "about" | "theme" | "keyboard" | "stop") => {
    settingsDialogActionRefs.current.setSettingsTab(tab);
  }, []);

  const handleSettingsDialogRebuildIndex = useCallback(() => {
    void settingsDialogActionRefs.current.handleRebuildIndex();
  }, []);

  const handleSettingsDialogDownloadWorkspaceData = useCallback(() => {
    void settingsDialogActionRefs.current.handleDownloadWorkspaceData();
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
    downloadWorkspaceData: handleSettingsDialogDownloadWorkspaceData,
    deregisterWorkspace: handleSettingsDialogDeregisterWorkspace,
    changeAppearance: handleSettingsDialogAppearanceChange,
    stopGUI: handleSettingsDialogStopGUI,
  }), [
    handleSettingsDialogAppearanceChange,
    handleSettingsDialogDownloadWorkspaceData,
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
    handleNavigateHome: () => {
      if (rightPanelTab === "home" && !rightRailCollapsed) {
        setRightRailCollapsed(true);
      } else {
        setRightPanelTab("home");
        setRightRailCollapsed(false);
      }
    },
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
    setMutationError,
    handleDeleteDocument,
  });

  deleteDocumentDialogActionRefs.current.setDeleteDialogOpen = setDeleteDialogOpen;
  deleteDocumentDialogActionRefs.current.setDeleteDialogTarget = setDeleteDialogTarget;
  deleteDocumentDialogActionRefs.current.setMutationError = setMutationError;
  deleteDocumentDialogActionRefs.current.handleDeleteDocument = handleDeleteDocument;

  const handleDeleteDocumentDialogOpenChange = useCallback((open: boolean) => {
    deleteDocumentDialogActionRefs.current.setDeleteDialogOpen(open);
    if (!open) {
      deleteDocumentDialogActionRefs.current.setDeleteDialogTarget(null);
    } else {
      deleteDocumentDialogActionRefs.current.setMutationError("");
    }
  }, []);

  const handleDeleteDocumentDialogCancel = useCallback(() => {
    deleteDocumentDialogActionRefs.current.setDeleteDialogTarget(null);
    deleteDocumentDialogActionRefs.current.setDeleteDialogOpen(false);
  }, []);

  const handleDeleteDocumentDialogConfirm = useCallback(() => {
    // Keep the dialog open while the delete runs: on failure the error is
    // shown inside the dialog so the user knows why the delete was blocked.
    void deleteDocumentDialogActionRefs.current.handleDeleteDocument();
  }, []);

  const handleDeleteDocumentDialogConfirmForce = useCallback(() => {
    void deleteDocumentDialogActionRefs.current.handleDeleteDocument(true);
  }, []);

  const deleteDocumentDialogActions = useMemo(() => ({
    setOpen: handleDeleteDocumentDialogOpenChange,
    cancel: handleDeleteDocumentDialogCancel,
    confirm: handleDeleteDocumentDialogConfirm,
    confirmForce: handleDeleteDocumentDialogConfirmForce,
  }), [
    handleDeleteDocumentDialogCancel,
    handleDeleteDocumentDialogConfirm,
    handleDeleteDocumentDialogConfirmForce,
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

  // Flush any pending debounced saves immediately without waiting for an
  // animation frame — used by the page-hide / visibility-change handlers.
  const flushOnHideRef = useRef<() => void>(() => {});
  // Update every render so the callback always closes over current state/refs.
  flushOnHideRef.current = () => {
    const hasDocTimer = documentAutoSaveTimerRef.current !== undefined;
    const hasHomeTimer = homeAutoSaveTimerRef.current !== undefined;
    const pendingPanels = Array.from(pendingPanelSavesRef.current);
    // Collect live bodies from all thread editors that haven't yet propagated
    // via the debounced onChange (100ms). This catches the case where the user
    // typed and immediately hid/closed the tab before onChange fired.
    const dirtyPanelIds: string[] = [];
    for (const [panelId, getMarkdown] of threadPanelEditorsRef.current.entries()) {
      try {
        const liveBody = getMarkdown();
        const state = threadFormStatesRef.current[panelId];
        if (state !== undefined && typeof liveBody === "string" && liveBody !== state.body) {
          const next = { ...state, body: liveBody };
          threadFormStatesRef.current = { ...threadFormStatesRef.current, [panelId]: next };
          setThreadFormStates(threadFormStatesRef.current);
          if (selectedDocumentIdRef.current === panelId) {
            formStateRef.current = next;
            setFormState(next);
          }
          dirtyPanelIds.push(panelId);
        }
      } catch {}
    }
    const allPanelIdsToSave = new Set<string>([...pendingPanels, ...dirtyPanelIds]);
    if (!hasDocTimer && !hasHomeTimer && allPanelIdsToSave.size === 0) {
      return;
    }
    if (hasDocTimer) {
      window.clearTimeout(documentAutoSaveTimerRef.current);
      documentAutoSaveTimerRef.current = undefined;
    }
    if (hasHomeTimer) {
      window.clearTimeout(homeAutoSaveTimerRef.current);
      homeAutoSaveTimerRef.current = undefined;
    }
    // Sync latest editor state into the form refs synchronously.
    syncDocumentBodyFromActiveEditor();
    syncHomeBodyFromEditor();
    // Fire saves with keepalive so the requests survive unload. These skip the
    // save serialization on purpose so the newest content is dispatched first;
    // write ordering against a still-in-flight older save is strictly
    // best-effort at this point (loopback saves finish in ms, so the window is
    // tiny).
    if (hasDocTimer && selectedDocumentRef.current !== null) {
      void handleSaveDocument(selectedDocumentRef.current, formStateRef.current, { keepalive: true });
    }
    for (const panelId of allPanelIdsToSave) {
      pendingPanelSavesRef.current.delete(panelId);
      const doc = threadDocumentsByIdRef.current[panelId];
      const state = threadFormStatesRef.current[panelId];
      if (doc !== undefined && state !== undefined) {
        void handleSaveDocument(doc, state, { keepalive: true });
      }
    }
    if (hasHomeTimer) {
      void handleSaveHomeContent(homeFormStateRef.current, { keepalive: true });
    }
  };

  // Explicit flush for UI actions (expand, close, minimize, threads, etc.)
  // — ensures content is pushed to disk before the UI state changes,
  // and Saved only flashes after the file is actually written.
  async function flushAllPendingSaves(): Promise<void> {
    // Sync live bodies from all thread editors first (debounced onChange may not have fired)
    for (const [panelId, getMarkdown] of threadPanelEditorsRef.current.entries()) {
      try {
        const liveBody = getMarkdown();
        const state = threadFormStatesRef.current[panelId];
        if (state !== undefined && typeof liveBody === "string" && liveBody !== state.body) {
          const next = { ...state, body: liveBody };
          threadFormStatesRef.current = { ...threadFormStatesRef.current, [panelId]: next };
          setThreadFormStates(threadFormStatesRef.current);
          if (selectedDocumentIdRef.current === panelId) {
            formStateRef.current = next;
            setFormState(next);
          }
        }
      } catch {}
    }
    syncDocumentBodyFromActiveEditor();
    syncHomeBodyFromEditor();

    const promises: Promise<void>[] = [];
    if (documentAutoSaveTimerRef.current !== undefined) {
      window.clearTimeout(documentAutoSaveTimerRef.current);
      documentAutoSaveTimerRef.current = undefined;
      if (selectedDocumentRef.current !== null) {
        promises.push(handleSaveDocument(selectedDocumentRef.current, formStateRef.current));
      }
    }
    if (homeAutoSaveTimerRef.current !== undefined) {
      window.clearTimeout(homeAutoSaveTimerRef.current);
      homeAutoSaveTimerRef.current = undefined;
      promises.push(handleSaveHomeContent(homeFormStateRef.current));
    }
    const pendingPanels = Array.from(pendingPanelSavesRef.current);
    // Also include any thread panels whose state.body differs from doc.body (dirty)
    const dirtyExtra: string[] = [];
    for (const [panelId, doc] of Object.entries(threadDocumentsByIdRef.current)) {
      const state = threadFormStatesRef.current[panelId];
      if (state && doc && state.body !== doc.body && !pendingPanels.includes(panelId)) {
        dirtyExtra.push(panelId);
      }
      // Also if title/description/tags differ
      if (state && doc && (state.title !== doc.title || state.description !== doc.description || state.tags !== doc.tags?.join("\n"))) {
        if (!pendingPanels.includes(panelId) && !dirtyExtra.includes(panelId)) dirtyExtra.push(panelId);
      }
    }
    const allPanelIds = [...new Set([...pendingPanels, ...dirtyExtra])];
    for (const panelId of allPanelIds) {
      pendingPanelSavesRef.current.delete(panelId);
      const doc = threadDocumentsByIdRef.current[panelId];
      const state = threadFormStatesRef.current[panelId];
      if (doc !== undefined && state !== undefined) {
        promises.push(handleSaveDocument(doc, state));
      }
    }
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushOnHideRef.current();
      }
    }
    function handlePageHide() {
      flushOnHideRef.current();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

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
      isRightRailDocked={!isMaximizedRightRail && !rightRailCollapsed}
      threadExpanded={threadExpanded}
      panelExpandModes={panelExpandModes}
      threadPanels={threadPanels}
      threadDocumentsById={threadDocumentsById}
      activeThreadPanelIndex={activeThreadPanelIndex}
      threadStackRef={threadStackRef}
      threadPanelWidths={threadPanelWidths}
      graphDirectoryColorsByPath={graphDirectoryColorsByPath}
      threadAssetsById={threadAssetsById}
      homeThreadDocumentId={HOME_THREAD_DOCUMENT_ID}
      homeDocumentEditorRef={homeDocumentEditorRef}
      homeFormState={homeFormState}
      homeInlineReferences={graphTree?.home.inlineReferences}
      formState={formState}
      selectedDocument={selectedDocument}
      selectedDocumentId={selectedDocumentId}
      selectedDocumentInlineReferences={selectedDocument?.inlineReferences}
      isSelectedDocumentLoading={isSelectedDocumentLoading}
      savingHome={savingHome}
      savingDocument={savingDocument}
      centerDocumentEditorRef={centerDocumentEditorRef}
      centerDocumentSidePanelMode={centerDocumentSidePanelMode}
      showCenterDocumentSidePanel={showCenterDocumentSidePanel}
      centerDocumentSidePanelLabel={centerDocumentSidePanelLabel}
      centerDocumentSidePanelTitle={centerDocumentSidePanelTitle}
      centerDocumentSidePanelDescription={centerDocumentSidePanelDescription}
      selectedDocumentLinks={selectedDocumentLinks}
      editableOutgoingLinks={editableOutgoingLinks}
      availableLinkTargets={availableLinkTargets}
      editorScrollTarget={editorScrollTarget}
      actions={threadPanelActions}
      searchQuery={editorSearchQuery}
      searchIndex={editorLocalSearchIndex}
      threadFormStates={threadFormStates}
    />
  );

  return (
    <SidebarProvider
      id="flow-sidebar-provider"
      className={isResizingLeft ? "is-resizing-sidebar" : undefined}
      style={{
        "--sidebar-width": `${leftSidebarWidth}px`,
        "--right-sidebar-width": `${rightSidebarWidth}px`,
      } as React.CSSProperties}
    >
      {error !== "" ? <p className="status-line status-line-error">{error}</p> : null}
      <AppSidebar
        onResizeMouseDown={handleLeftSidebarMouseDown}
        topContent={<WorkspaceSelectorPanel workspace={workspace} switchingWorkspace={switchingWorkspace} actions={sidebarNavigationActions} />}
        navigationContent={
          <GraphTreePanel
            graphTree={graphTree}
            activeSurface={activeSurface}
            selectedDocumentId={selectedDocumentId}
            actions={sidebarNavigationActions}
            onReorderGraph={(sourceGraphPath, targetGraphPath) => {
              setGraphTree((prev) => {
                if (prev === null) return prev;
                const graphs = [...prev.graphs];
                const fromIdx = graphs.findIndex((g) => g.graphPath === sourceGraphPath);
                const toIdx = graphs.findIndex((g) => g.graphPath === targetGraphPath);
                if (fromIdx === -1 || toIdx === -1) return prev;
                const parent = (p: string) => {
                  const i = p.lastIndexOf("/");
                  return i === -1 ? "" : p.slice(0, i);
                };
                if (parent(graphs[fromIdx].graphPath) !== parent(graphs[toIdx].graphPath)) return prev;
                const [moved] = graphs.splice(fromIdx, 1);
                graphs.splice(toIdx, 0, moved);
                return { ...prev, graphs };
              });
            }}
            onReorderFile={(graphPath, sourceFileId, targetFileId) => {
              setGraphTree((prev) => {
                if (prev === null) return prev;
                const graphs = prev.graphs.map((g) => {
                  if (g.graphPath !== graphPath) return g;
                  const files = [...(g.files ?? [])];
                  const fromIdx = files.findIndex((f) => f.id === sourceFileId);
                  const toIdx = files.findIndex((f) => f.id === targetFileId);
                  if (fromIdx === -1 || toIdx === -1) return g;
                  const [moved] = files.splice(fromIdx, 1);
                  files.splice(toIdx, 0, moved);
                  return { ...g, files };
                });
                return { ...prev, graphs };
              });
            }}
            sidebarView={sidebarView}
            tocTitle={sidebarTOCTitle}
            tocItems={tocItems}
            onBackToContent={() => setSidebarView("content")}
            onNavigateTOC={handleTOCNavigate}
            showTOCButton={activeSurface.kind === "home" || selectedDocumentId !== ""}
            onShowTOC={() => setSidebarView("toc")}
          />
        }

        footerContent={
          <p className="sidebar-loading-status" role="status" aria-live="polite">
            {/* Keep footer spacing stable to avoid sidebar layout jumps. */}
            {switchingWorkspace ? "Loading workspace..." : "\u00a0"}
          </p>
        }
      />
      <SidebarInset>
        <WorkspaceHeader
          workspaceSurfaceSection={workspaceSurfaceSection}
          selectedGraphPath={selectedGraphPath}
          graphTree={graphTree}
          onNavigateGraph={handleSelectGraph}
          rightPanelTab={rightPanelTab}
          rightRailCollapsed={rightRailCollapsed}
          activeSurface={activeSurface}
          settingsDialogProps={settingsDialogProps}
          rightRailControlsActions={rightRailControlsActions}
          graphValidationReloadToken={graphCanvasReloadToken}
          savingDocument={savingDocument}
          savingHome={savingHome}
          lastSaveAt={lastSaveAt}
          mutationSuccess={mutationSuccess}
          onOpenViolations={handleOpenViolationsPanel}
          showViolationsButton={activeSurface.kind === "graph"}
          violationsActive={rightPanelTab === "violations" && !rightRailCollapsed}
        />
          <DeleteDocumentDialog
            open={deleteDialogOpen}
            target={deleteDialogTarget}
            savingDocument={savingDocument}
            deletingDocument={deletingDocument}
            error={mutationError}
            actions={deleteDocumentDialogActions}
          />

          <div className="workspace-shell-body">
        <section className="middle-shell">
          <LocalSearchBar
            open={localSearchOpen}
            query={localSearchQuery}
            onQueryChange={(value) => {
              setLocalSearchQuery(value);
              setLocalSearchIndex(0);
            }}
            matchCount={localSearchCount}
            currentIndex={localSearchIndex}
            onPrev={() => {
              setLocalSearchIndex((prev) => {
                if (localSearchCount === 0) return prev;
                const next = (prev - 1 + localSearchCount) % localSearchCount;
                setLocalSearchCurrent(next);
                return next;
              });
            }}
            onNext={() => {
              setLocalSearchIndex((prev) => {
                if (localSearchCount === 0) return prev;
                const next = (prev + 1) % localSearchCount;
                setLocalSearchCurrent(next);
                return next;
              });
            }}
            onClose={() => {
              setLocalSearchOpen(false);
              setLocalSearchQuery("");
              clearLocalSearchHighlights();
              setLocalSearchCount(0);
              setLocalSearchIndex(0);
            }}
          />
          <div ref={localSearchRootRef} className="local-search-root">
            <MiddleContent
            activeSurface={activeSurface}
            isThreadStackOpen={isThreadStackOpen}
            renderCenterDocumentShell={renderCenterDocumentShell}
            homeMutationError={homeMutationError}
            showFreshStartGuide={showFreshStartGuide}
            homeDocumentEditorRef={homeDocumentEditorRef}
            homeInlineReferences={graphTree?.home.inlineReferences}
            editorScrollTarget={editorScrollTarget}
            homeFormState={homeFormState}
            homeSurfaceActions={homeSurfaceActions}
            searchQuery={editorSearchQuery}
            searchIndex={editorLocalSearchIndex}
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
            handleEdgeDoubleClickAction={handleEdgeDoubleClickAction}
            graphCanvasSurfaceActions={graphCanvasSurfaceActions}
            shiftSelectedNodes={shiftSelectedNodes}
            graphCanvasError={graphCanvasError}
            graphCanvasLoading={graphCanvasLoading}
            graphCreateError={graphCreateError}
            graphCreatePendingType={graphCreatePendingType}
            graphEmptyStateActions={graphEmptyStateActions}
          />
          </div>
        </section>
        <RightSidebarPanel
          rightRailCollapsed={rightRailCollapsed}
          rightRailMaximized={rightRailMaximized}
          rightPanelTab={rightPanelTab}
          isResizingRight={isResizingRight}
          handleRightSidebarMouseDown={handleRightSidebarMouseDown}
          graphTree={graphTree}
          homeDocumentEditorRef={homeDocumentEditorRef}
          homeFormState={homeFormState}
          homeInlineReferences={graphTree?.home.inlineReferences}
          homeSurfaceActions={homeSurfaceActions}
          hasRightRailDocument={hasRightRailDocument}
          renderCenterDocumentShell={renderCenterDocumentShell}
          selectedDocument={selectedDocument}
          formState={formState}
          panelError={panelError}
          mutationError={mutationError}
          mutationSuccess={mutationSuccess}
          savingDocument={savingDocument}
          deletingDocument={deletingDocument}
          selectedDocumentGraphColor={selectedDocumentGraphColor}
          selectedDocumentTintStyle={selectedDocumentTintStyle}
          selectedDocumentLinks={selectedDocumentLinks}
          rightRailDocumentEditorRef={rightRailDocumentEditorRef}
          editorScrollTarget={editorScrollTarget}
          rightRailDocumentActions={rightRailDocumentActions}
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
          handleRightRailSearchResultNavigate={handleRightRailSearchResultNavigate}
          calendarDocumentsForDisplay={calendarDocumentsForDisplay}
          calendarFocusDate={calendarFocusDate}
          setCalendarFocusDate={setCalendarFocusDate}
          handleRightRailCalendarDocumentOpen={handleRightRailCalendarDocumentOpen}
          calendarError={calendarError}
          selectedGraphPath={selectedGraphPath}
          graphViolations={graphEdgeViolations}
          violationFixableEdgeKeys={fixableViolationEdgeKeys}
          handleViolationSelect={handleSidebarSelectViolation}
          handleViolationFix={handleSidebarFixViolation}
          handleViolationsFixAll={handleFixAllEdgeViolations}
          handleCloseViolations={collapseRightRail}
        />
        </div>
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
