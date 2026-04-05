import {
  applyNodeChanges,
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { CalendarDays, FileText, Info, List, PaintbrushVertical, PanelRight, PencilLine, Search, Settings, Trash2, TriangleAlert, X } from "lucide-react";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";

import { AppSidebar } from "./components/AppSidebar";
import { GraphTree } from "./components/GraphTree";
import { HomeCalendarPanel } from "./components/HomeCalendarPanel";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { requestJSON, loadWorkspaceSnapshot } from "./lib/api";
import {
  createDocumentFormState,
  createGraphDocumentPayload,
  createHomeFormState,
  emptyDocumentFormState,
  emptyHomeFormState,
  formatDocumentType,
  generateTOC,
  parseEnv,
  splitList,
} from "./lib/docUtils";
import {
  applyGraphCanvasLayerGuidance,
  buildGraphCanvasFlowEdges,
  buildGraphCanvasFlowNodes,
  countConnectedGraphCanvasEdges,
  graphCanvasOverlayPosition,
  graphCanvasPositionMap,
  graphCanvasTypeLabel,
  normalizeGraphCanvasResponse,
  selectedGraphCanvasNode,
} from "./lib/graphCanvasUtils";
import { useTheme } from "./lib/theme";
import { todayString } from "./lib/dateEntries";
import { markdownToHTML } from "./richText";
import { RichTextEditor } from "./components/editor/RichTextEditor";
import type {
  DeleteDocumentResponse,
  DocumentFormState,
  DocumentResponse,
  GraphCanvasFlowNodeData,
  GraphCanvasPosition,
  GraphCanvasResponse,
  GraphCanvasResponseWire,
  GraphCreateType,
  GraphLayoutResponse,
  GraphTreeResponse,
  HomeFormState,
  HomeResponse,
  SearchResult,
  SurfaceState,
  WorkspaceResponse,
} from "./types";
import "./styles.css";



function FlowApp() {
  const { theme, setTheme } = useTheme();
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
  const [autoEditDocumentId, setAutoEditDocumentId] = useState<string>("");
  const [activeSurface, setActiveSurface] = useState<SurfaceState>({ kind: "home" });
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
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
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [formState, setFormState] = useState<DocumentFormState>(emptyDocumentFormState);
  const [graphSurfaceTab, setGraphSurfaceTab] = useState<"canvas" | "overview">("canvas");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [homeFormState, setHomeFormState] = useState<HomeFormState>(emptyHomeFormState);
  const [mutationError, setMutationError] = useState<string>("");
  const [mutationSuccess, setMutationSuccess] = useState<string>("");
  const [homeMutationError, setHomeMutationError] = useState<string>("");
  const [savingDocument, setSavingDocument] = useState<boolean>(false);
  const [deletingDocument, setDeletingDocument] = useState<boolean>(false);
  const [savingHome, setSavingHome] = useState<boolean>(false);
  const [calendarFocusDate, setCalendarFocusDate] = useState<string>(() => todayString());
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(256);
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(320);
  const [isResizingLeft, setIsResizingLeft] = useState<boolean>(false);
  const [isResizingRight, setIsResizingRight] = useState<boolean>(false);

  const graphCanvasShellRef = useRef<HTMLDivElement | null>(null);
  const homeFormStateRef = useRef<HomeFormState>(emptyHomeFormState);
  const homeAutoSaveTimerRef = useRef<number | null>(null);
  const graphCanvasDragRef = useRef<{
    documentId: string;
    offsetX: number;
    offsetY: number;
    shellLeft: number;
    shellTop: number;
    moved: boolean;
  } | null>(null);
  const selectedGraphPath = activeSurface.kind === "graph" ? activeSurface.graphPath : "";
  const [rightRailCollapsed, setRightRailCollapsed] = useState<boolean>(false);

  const [rightPanelTab, setRightPanelTab] = useState<"calendar" | "toc" | "document" | "search">("document");
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  const [editorScrollTarget, setEditorScrollTarget] = useState<string | null>(null);

  const graphCanvasNodes = buildGraphCanvasFlowNodes(graphCanvasData, graphCanvasPositions, selectedCanvasNodeId, selectedDocumentId);
  const graphCanvasEdges = buildGraphCanvasFlowEdges(graphCanvasData, selectedCanvasNodeId);
  const selectedGraphNode = graphTree?.graphs.find((graphNode) => graphNode.graphPath === selectedGraphPath) ?? null;
  const selectedCanvasNode = selectedGraphCanvasNode(graphCanvasData, selectedCanvasNodeId);
  const selectedCanvasNodeEdgeCount = countConnectedGraphCanvasEdges(graphCanvasData, selectedCanvasNodeId);
  const workspaceSurfaceSection = activeSurface.kind === "graph" ? "Graphs" : "Home";
  const workspaceSurfaceTitle = activeSurface.kind === "graph" ? selectedGraphNode?.displayName ?? selectedGraphPath : null;

  useEffect(() => {
    if (activeSurface.kind === "home") {
      setRightPanelTab("toc");
      setRightRailCollapsed(false);
    } else if (selectedDocumentId !== "") {
      setRightPanelTab("document");
      setRightRailCollapsed(false);
    }
  }, [selectedDocumentId, activeSurface.kind]);

  useEffect(() => {
    if (rightPanelTab === "document" && scrollTargetId) {
      const element = document.getElementById(scrollTargetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      setScrollTargetId(null);
    }
  }, [rightPanelTab, scrollTargetId]);

  useEffect(() => {
    const next = createHomeFormState(graphTree?.home ?? null);
    homeFormStateRef.current = next;
    setHomeFormState(next);
  }, [graphTree]);

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
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
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
  }, []);

  useEffect(() => {
    if (selectedDocumentId === "") {
      setSelectedDocument(null);
      setFormState(emptyDocumentFormState);
      setIsEditing(false);
      setAutoEditDocumentId("");
      setPanelError("");
      return;
    }

    let cancelled = false;

    async function loadDocument(): Promise<void> {
      try {
        setPanelError("");
        const response = await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(selectedDocumentId)}`);
        if (!cancelled) {
          setSelectedDocument(response);
          setFormState(createDocumentFormState(response));
          setIsEditing(autoEditDocumentId === response.id);
          if (autoEditDocumentId === response.id) {
            setAutoEditDocumentId("");
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setSelectedDocument(null);
          setFormState(emptyDocumentFormState);
          setIsEditing(false);
          setAutoEditDocumentId("");
          setPanelError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [selectedDocumentId]);

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
          setSearchError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    }

    void loadSearch();

    return () => {
      cancelled = true;
    };
  }, [deferredSearchQuery]);

  useEffect(() => {
    setGraphCanvasPositions(graphCanvasPositionMap(graphCanvasData));
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

        const response = normalizeGraphCanvasResponse(
          await requestJSON<GraphCanvasResponseWire>(`/api/graph-canvas?graph=${encodeURIComponent(selectedGraphPath)}`),
        );
        if (cancelled) {
          return;
        }

        setGraphCanvasData(response);
        setSelectedCanvasNodeId((current) => (response.nodes.some((node) => node.id === current) ? current : ""));
      } catch (loadError) {
        if (!cancelled) {
          setGraphCanvasData(null);
          setGraphCanvasError(loadError instanceof Error ? loadError.message : String(loadError));
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

    if (options && "nextDocument" in options) {
      setSelectedDocument(options.nextDocument ?? null);
      setFormState(createDocumentFormState(options.nextDocument ?? null));
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

  function updateFormField(field: keyof DocumentFormState, value: string): void {
    setFormState((current) => ({ ...current, [field]: value }));
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
    setSelectedDocumentId("");
    setSelectedDocument(null);
    setFormState(emptyDocumentFormState);
    setIsEditing(false);
    setDeleteDialogOpen(false);
    setPanelError("");
    setMutationError("");
    setMutationSuccess("");
  }

  function handleSelectHome(): void {
    clearContextPanel();
    setGraphCanvasError("");
    setGraphCreateError("");
    setSelectedCanvasNodeId("");
    setGraphSurfaceTab("canvas");
    startTransition(() => {
      setActiveSurface({ kind: "home" });
    });
  }

  function handleSelectGraph(graphPath: string): void {
    clearContextPanel();
    setGraphCanvasError("");
    setGraphCreateError("");
    setSelectedCanvasNodeId("");
    setGraphSurfaceTab("canvas");
    startTransition(() => {
      setActiveSurface({ kind: "graph", graphPath });
    });
  }

  function startEditingDocument(): void {
    if (selectedDocument === null) {
      return;
    }

    setFormState(createDocumentFormState(selectedDocument));
    setMutationError("");
    setMutationSuccess("");
    setIsEditing(true);
  }

  function handleOpenCanvasDocument(documentId: string): void {
    setMutationError("");
    setMutationSuccess("");
    setPanelError("");
    setSelectedCanvasNodeId(documentId);
    setSelectedDocumentId(documentId);
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
      setGraphCanvasError(saveError instanceof Error ? saveError.message : String(saveError));
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
    setMutationError("");
    setMutationSuccess("");
    setPanelError("");
    startTransition(() => {
      setActiveSurface({ kind: "graph", graphPath });
    });
    setSelectedCanvasNodeId(documentId);
    setSelectedDocumentId(documentId);
  }

  function handleSearchSelection(result: SearchResult): void {
    if (result.type === "home") {
      handleSelectHome();
      return;
    }

    handleSelectDocument(result.id, result.graph);
  }

  function handleSearchResultNavigate(result: SearchResult): void {
    if (result.type === "home") {
      startTransition(() => setActiveSurface({ kind: "home" }));
      return;
    }
    setMutationError("");
    setMutationSuccess("");
    setPanelError("");
    startTransition(() => setActiveSurface({ kind: "graph", graphPath: result.graph }));
    setSelectedCanvasNodeId(result.id);
    // Intentionally do NOT set selectedDocumentId — keeps right panel on search view
  }

  async function handleCreateGraphDocument(type: GraphCreateType): Promise<void> {
    if (selectedGraphPath === "") {
      return;
    }

    try {
      setGraphCreatePendingType(type);
      setGraphCreateError("");
      const createdDocument = await requestJSON<DocumentResponse>("/api/documents", {
        method: "POST",
        body: JSON.stringify(createGraphDocumentPayload(type, selectedGraphPath)),
      });

      setAutoEditDocumentId(createdDocument.id);
      await refreshShellViews({ nextDocument: createdDocument, nextDocumentId: createdDocument.id });
      setSelectedDocument(createdDocument);
      setFormState(createDocumentFormState(createdDocument));
      setIsEditing(true);
      setSelectedCanvasNodeId(createdDocument.id);
      setMutationError("");
      setMutationSuccess(`${formatDocumentType(createdDocument.type)} created.`);
    } catch (createError) {
      setGraphCreateError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setGraphCreatePendingType("");
    }
  }

  function handleGraphCanvasOverlayPointerDown(event: React.PointerEvent<HTMLDivElement>, documentId: string): void {
    if (event.button !== 0) {
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
    graphCanvasDragRef.current = {
      documentId,
      offsetX: event.clientX - shellBounds.left - position.x,
      offsetY: event.clientY - shellBounds.top - position.y,
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

      const nextX = pointerEvent.clientX - dragState.shellLeft - dragState.offsetX;
      const nextY = pointerEvent.clientY - dragState.shellTop - dragState.offsetY;
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
          x: pointerEvent.clientX - dragState.shellLeft - dragState.offsetX,
          y: pointerEvent.clientY - dragState.shellTop - dragState.offsetY,
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
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startWidth = leftSidebarWidth;
    setIsResizingLeft(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const handleMouseMove = (e: MouseEvent) => {
      setLeftSidebarWidth(Math.min(Math.max(startWidth + e.clientX - startX, 160), 520));
    };
    const handleMouseUp = () => {
      setIsResizingLeft(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    event.preventDefault();
  }

  function handleRightSidebarMouseDown(event: React.MouseEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startWidth = rightSidebarWidth;
    setIsResizingRight(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const handleMouseMove = (e: MouseEvent) => {
      setRightSidebarWidth(Math.min(Math.max(startWidth + startX - e.clientX, 224), 640));
    };
    const handleMouseUp = () => {
      setIsResizingRight(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    event.preventDefault();
  }

  async function handleStopGUI(): Promise<void> {
    try {
      setStoppingGUI(true);
      await requestJSON<{ stopping: boolean }>("/api/gui/stop", { method: "POST" });
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : String(stopError));
    } finally {
      setStoppingGUI(false);
    }
  }

  async function handleSaveDocument(): Promise<void> {
    if (selectedDocument === null) {
      return;
    }

    try {
      setSavingDocument(true);
      setMutationError("");
      setMutationSuccess("");

      const payload: Record<string, unknown> = {
        title: formState.title,
        graph: formState.graph,
        tags: splitList(formState.tags),
        body: formState.body,
        references: splitList(formState.references),
      };

      if (selectedDocument.type === "task") {
        payload.status = formState.status;
        payload.dependsOn = splitList(formState.dependsOn);
      }

      if (selectedDocument.type === "command") {
        payload.name = formState.name;
        payload.run = formState.run;
        payload.dependsOn = splitList(formState.dependsOn);
        payload.env = parseEnv(formState.env);
      }

      const updatedDocument = await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(selectedDocument.id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      await refreshShellViews({ nextDocument: updatedDocument, nextDocumentId: updatedDocument.id });
      setSelectedDocument(updatedDocument);
      setFormState(createDocumentFormState(updatedDocument));
      setIsEditing(false);
      setMutationSuccess(`${formatDocumentType(updatedDocument.type)} updated.`);
    } catch (mutationFailure) {
      setMutationError(mutationFailure instanceof Error ? mutationFailure.message : String(mutationFailure));
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
      setHomeMutationError(mutationFailure instanceof Error ? mutationFailure.message : String(mutationFailure));
    } finally {
      setSavingHome(false);
    }
  }

  async function handleDeleteDocument(): Promise<void> {
    if (selectedDocument === null) {
      return;
    }

    try {
      setDeletingDocument(true);
      setMutationError("");
      setMutationSuccess("");

      const response = await requestJSON<DeleteDocumentResponse>(`/api/documents/${encodeURIComponent(selectedDocument.id)}`, {
        method: "DELETE",
      });

      await refreshShellViews({ nextDocument: null, nextDocumentId: "" });
      setIsEditing(false);
      setMutationSuccess(`${formatDocumentType(selectedDocument.type)} deleted from ${response.path}.`);
    } catch (mutationFailure) {
      setMutationError(mutationFailure instanceof Error ? mutationFailure.message : String(mutationFailure));
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
            onSelectHome={handleSelectHome}
            onSelectGraph={handleSelectGraph}
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

          <div className="workspace-shell-body">
        <section className="middle-shell">
          {activeSurface.kind === "home" ? (
            <div className="home-surface">
              {homeMutationError !== "" && <p className="status-line status-line-error home-status-message">{homeMutationError}</p>}
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
          ) : (
            <Card className="surface-card surface-card-graph shell-surface-card">
              <CardHeader className="surface-header shell-surface-header">
                <Breadcrumb className="shell-surface-breadcrumb">
                  <BreadcrumbList>
                    <BreadcrumbItem>Workspace</BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Graphs</BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{selectedGraphPath}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <div className="shell-surface-topline">
                  <div>
                    <p className="eyebrow">Graph Canvas</p>
                    <h2 className="shell-surface-title">{selectedGraphPath}</h2>
                  </div>
                  <div className="hero-pill-row">
                    <span>{selectedGraphNode?.countLabel ?? "0 direct / 0 total"}</span>
                    <span>{graphCanvasData?.nodes.length ?? 0} visible documents</span>
                    <span>{graphCanvasData?.edges.length ?? 0} projected edges</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="shell-surface-content">
                {graphCanvasError !== "" ? <p className="status-line status-line-error">{graphCanvasError}</p> : null}

                <Tabs className="shell-surface-tabs" onValueChange={(value) => setGraphSurfaceTab(value as "canvas" | "overview")} value={graphSurfaceTab}>
                  <div className="shell-tab-header-row">
                    <TabsList>
                      <TabsTrigger value="canvas">Canvas</TabsTrigger>
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="overview">
                    <div className="shell-overview-grid">
                      <section className="shell-overview-panel shell-inner-card">
                        <p className="section-kicker">Graph Summary</p>
                        <div className="hero-pill-row">
                          <span>{selectedGraphNode?.countLabel ?? "0 direct / 0 total"}</span>
                          <span>{graphCanvasData?.nodes.length ?? 0} visible documents</span>
                          <span>{graphCanvasData?.edges.length ?? 0} projected edges</span>
                        </div>
                      </section>
                      <section className="shell-overview-panel shell-inner-card">
                        <p className="section-kicker">Selection</p>
                        {selectedCanvasNode !== null ? (
                          <>
                            <strong>{selectedCanvasNode.title}</strong>
                            <p>{graphCanvasTypeLabel(selectedCanvasNode.type)} with {selectedCanvasNodeEdgeCount} connected edges highlighted.</p>
                          </>
                        ) : (
                          <p>No canvas node is selected yet.</p>
                        )}
                      </section>
                    </div>
                  </TabsContent>
                  <TabsContent value="canvas">
                    {selectedCanvasNode !== null ? (
                      <section className="graph-canvas-selection-bar">
                        <div>
                          <p className="section-kicker">Selected Node</p>
                          <strong>{selectedCanvasNode.title}</strong>
                        </div>
                        <div className="hero-pill-row">
                          <span>{graphCanvasTypeLabel(selectedCanvasNode.type)}</span>
                          <span>{selectedCanvasNodeEdgeCount} connected edges highlighted</span>
                        </div>
                      </section>
                    ) : null}

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
                            right-side editor immediately.
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
                            <span>Start a knowledge card for design details, references, or working notes.</span>
                          </button>
                          <button
                            className="graph-create-action graph-create-action-task"
                            onClick={() => void handleCreateGraphDocument("task")}
                            disabled={graphCreatePendingType !== ""}
                            type="button"
                          >
                            <span className="graph-create-action-type">Task</span>
                            <strong>Define work</strong>
                            <span>Drop in a dependency-ready task and refine status, references, and body in the editor.</span>
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
                      <div ref={graphCanvasShellRef} className="graph-canvas-shell shell-inner-card">
                        <ReactFlow
                          key={selectedGraphPath}
                          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                          minZoom={0.5}
                          maxZoom={1.6}
                          nodes={graphCanvasNodes}
                          edges={graphCanvasEdges}
                          onNodesChange={handleGraphCanvasNodesChange}
                          onNodeClick={(_, node) => {
                            setSelectedCanvasNodeId(node.id);
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
                          onPaneClick={() => setSelectedCanvasNodeId("")}
                          nodesDraggable={false}
                          panOnDrag={false}
                          zoomOnScroll
                          zoomOnPinch
                          zoomOnDoubleClick={false}
                          nodesConnectable={false}
                          elementsSelectable
                          proOptions={{ hideAttribution: true }}
                        >
                          <Controls showInteractive={false} />
                          <Background gap={32} color="var(--muted-foreground)" />
                        </ReactFlow>
                        <div className="graph-canvas-overlay" onClick={() => setSelectedCanvasNodeId("")}
                        >
                          {graphCanvasNodes.map((node) => {
                            const position = graphCanvasOverlayPosition(node);
                            return (
                              <div
                                key={node.id}
                                className="graph-canvas-overlay-node"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedCanvasNodeId(node.id);
                                }}
                                onDoubleClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenCanvasDocument(node.id);
                                }}
                                onPointerDown={(event) => handleGraphCanvasOverlayPointerDown(event, node.id)}
                                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                              >
                                {node.data.label}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </section>
        <aside
          className="app-right-sidebar"
          data-open={rightRailCollapsed ? "false" : "true"}
          style={!rightRailCollapsed ? { width: `${rightSidebarWidth}px`, ...(isResizingRight ? { transition: "none" } : {}) } : undefined}
        >
          {!rightRailCollapsed && (
            <div className="right-sidebar-resize-handle" onMouseDown={handleRightSidebarMouseDown} />
          )}
          <div className="right-sidebar-panel">
            {rightPanelTab === "search" ? (
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
                            <span className="item-file-name">{result.type === "home" ? "Workspace Home" : result.path.split("/").pop()}</span>
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
                      body={homeFormState.body}
                      selectedDate={calendarFocusDate}
                      onDateChange={setCalendarFocusDate}
                    />
                  </CardContent>
                </Card>
              ) : rightPanelTab === "toc" ? (
                <Card className="detail-card-context shell-context-card">
                  <CardHeader className="panel-header shell-context-header">
                    <div>
                      <h3>Table of Contents</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="shell-context-content">
                    {activeSurface.kind === "home" || selectedDocument !== null ? (
                      <nav className="toc-nav">
                        <ul className="toc-list">
                          {generateTOC(activeSurface.kind === "home" ? homeFormState.body : selectedDocument!.body).map((item, index) => (
                            <li key={index} className={`toc-item toc-level-${item.level}`} style={{ marginLeft: `${(item.level - 1) * 1}rem` }}>
                              <button
                                type="button"
                                className="toc-link"
                                onClick={() => {
                                  if (activeSurface.kind === "home" || isEditing) {
                                    setEditorScrollTarget(item.id);
                                  } else {
                                    const element = document.getElementById(item.id);
                                    if (element) {
                                      element.scrollIntoView({ behavior: 'smooth' });
                                    }
                                  }
                                }}
                              >
                                {item.text}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </nav>
                    ) : (
                      <div className="detail-empty">
                        <p>Select a document or view Home to see the table of contents.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : rightPanelTab === "document" ? (
              <Card className="detail-card-context shell-context-card">
                <CardHeader className="panel-header shell-context-header">
                  <div>
                    <h3>{selectedDocument?.title ?? "Document"}</h3>
                  </div>
                  <div className="detail-actions">
                    {selectedDocument !== null && (
                      <Badge variant="outline">{formatDocumentType(selectedDocument.type)}</Badge>
                    )}
                    <Button onClick={() => clearContextPanel()} type="button" variant="ghost" size="sm">
                      <X size={16} /> Close
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="shell-context-content">
                  {panelError !== "" ? <p className="status-line status-line-error">{panelError}</p> : null}
                  {mutationError !== "" ? <p className="status-line status-line-error">{mutationError}</p> : null}
                  {mutationSuccess !== "" ? <p className="status-line status-line-success">{mutationSuccess}</p> : null}

                  <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete document?</DialogTitle>
                        <DialogDescription>
                          This removes the current document from the workspace and clears it from the context panel.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="shell-dialog-actions">
                        <Button onClick={() => setDeleteDialogOpen(false)} type="button" variant="secondary">
                          Cancel
                        </Button>
                        <Button
                          disabled={savingDocument || deletingDocument || selectedDocument === null}
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

                  {selectedDocument === null ? (
                    <div className="detail-empty">
                      <p>Select a graph node or search result to view document content here.</p>
                    </div>
                  ) : isEditing ? (
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
                      <div className="home-document-body">
                        <RichTextEditor
                          ariaLabel="Document body editor"
                          onChange={(value) => updateFormField("body", value)}
                          onScrollCompleted={() => setEditorScrollTarget(null)}
                          placeholder="Type / for headings, lists, quotes, links, and highlights"
                          scrollToHeadingSlug={editorScrollTarget}
                          value={formState.body}
                        />
                      </div>
                      <div className="home-document-footer">
                        {savingDocument && <span className="home-save-success">Saving…</span>}
                        <div className="editor-actions">
                          <Button onClick={() => void handleSaveDocument()} disabled={savingDocument || deletingDocument}>
                            {savingDocument ? "Saving..." : "Save changes"}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              setFormState(createDocumentFormState(selectedDocument));
                              setIsEditing(false);
                            }}
                            disabled={savingDocument || deletingDocument}
                            variant="secondary"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {selectedDocument.description && (
                        <section className="detail-section">
                          <h4>Description</h4>
                          <p className="detail-description">{selectedDocument.description}</p>
                        </section>
                      )}

                      <section className="detail-section">
                        <h4>Content</h4>
                        <article
                          className="markdown-body"
                          dangerouslySetInnerHTML={{ __html: markdownToHTML(selectedDocument.body) }}
                        />
                      </section>

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
                              <Button key={dependencyId} variant="outline" size="sm" onClick={() => setSelectedDocumentId(dependencyId)} className="rounded-full h-7 px-3 text-xs" type="button">
                                {dependencyId}
                              </Button>
                            ))}
                          </div>
                        </section>
                      )}

                      {(selectedDocument.references ?? []).length > 0 && (
                        <section className="detail-section">
                          <h4>References</h4>
                          <div className="link-list">
                            {(selectedDocument.references ?? []).map((referenceId) => (
                              <Button key={referenceId} variant="outline" size="sm" onClick={() => setSelectedDocumentId(referenceId)} className="rounded-full h-7 px-3 text-xs" type="button">
                                {referenceId}
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

                      <div className="detail-toolbar">
                        <Button onClick={startEditingDocument} type="button" variant="secondary">
                          <PencilLine size={16} className="mr-2" /> Edit document
                        </Button>
                        <Button onClick={() => setDeleteDialogOpen(true)} disabled={deletingDocument} type="button" variant="destructive">
                          <Trash2 size={16} className="mr-2" /> {deletingDocument ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              ) : null}
          </div>
        </aside>
        </div>
        <div className="right-sidebar-icons">
            <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="right-rail-icon-btn"
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
                        <RadioGroup value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
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
                    className="right-rail-icon-btn"
                    onClick={() => setRightRailCollapsed(c => !c)}
                  >
                    <PanelRight size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {rightRailCollapsed ? "Expand panel" : "Collapse panel"}
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`right-rail-icon-btn${rightPanelTab === "search" && !rightRailCollapsed ? " right-rail-icon-btn-active" : ""}`}
                    onClick={() => {
                      if (rightPanelTab === "search" && !rightRailCollapsed) {
                        setRightRailCollapsed(true);
                      } else {
                        setRightPanelTab("search");
                        setRightRailCollapsed(false);
                        setSelectedDocumentId("");
                      }
                    }}
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
                    onClick={() => {
                      if (rightPanelTab === "calendar" && !rightRailCollapsed) {
                        setRightRailCollapsed(true);
                      } else {
                        setRightPanelTab("calendar");
                        setRightRailCollapsed(false);
                      }
                    }}
                  >
                    <CalendarDays size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Calendar</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`right-rail-icon-btn${rightPanelTab === "toc" && !rightRailCollapsed ? " right-rail-icon-btn-active" : ""}`}
                    onClick={() => {
                      if (rightPanelTab === "toc" && !rightRailCollapsed) {
                        setRightRailCollapsed(true);
                      } else {
                        setRightPanelTab("toc");
                        setRightRailCollapsed(false);
                      }
                    }}
                  >
                    <List size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Table of Contents</TooltipContent>
            </Tooltip>
            {activeSurface.kind === "graph" && (
            <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`right-rail-icon-btn${rightPanelTab === "document" && !rightRailCollapsed ? " right-rail-icon-btn-active" : ""}`}
                    onClick={() => {
                      if (rightPanelTab === "document" && !rightRailCollapsed) {
                        setRightRailCollapsed(true);
                      } else {
                        setRightPanelTab("document");
                        setRightRailCollapsed(false);
                      }
                    }}
                  >
                    <FileText size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Document</TooltipContent>
            </Tooltip>
            )}
          </div>
      </SidebarInset>
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
