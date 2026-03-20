import {
  applyNodeChanges,
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import MarkdownIt from "markdown-it";
import { type ReactNode, startTransition, useDeferredValue, useEffect, useRef, useState } from "react";

import { WysiwygEditor } from "./WysiwygEditor";
import "./styles.css";

type PanelWidths = {
  leftRatio: number;
  rightRatio: number;
};

type WorkspaceResponse = {
  scope: string;
  workspacePath: string;
  flowPath: string;
  configPath: string;
  indexPath: string;
  homePath: string;
  guiPort: number;
  panelWidths: PanelWidths;
};

type HomeResponse = {
  id: string;
  type: string;
  title: string;
  description: string;
  path: string;
  body: string;
};

type GraphTreeNodeData = {
  graphPath: string;
  displayName: string;
  directCount: number;
  totalCount: number;
  hasChildren: boolean;
  countLabel: string;
};

type GraphTreeResponse = {
  home: HomeResponse;
  graphs: GraphTreeNodeData[];
};

type GraphItem = {
  id: string;
  title: string;
  path: string;
};

type GraphListResponse = {
  type: string;
  availableGraphs: string[];
  graphItems: Record<string, GraphItem[]>;
};

type DocumentResponse = {
  id: string;
  type: string;
  featureSlug: string;
  graph: string;
  title: string;
  description: string;
  path: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  body: string;
  status?: string;
  dependsOn?: string[];
  references?: string[];
  name?: string;
  env?: Record<string, string>;
  run?: string;
  relatedNoteIds?: string[];
};

type SearchResult = {
  id: string;
  type: string;
  description: string;
  featureSlug: string;
  graph: string;
  title: string;
  path: string;
  snippet: string;
};

type DocumentFormState = {
  title: string;
  graph: string;
  tags: string;
  description: string;
  body: string;
  status: string;
  dependsOn: string;
  references: string;
  name: string;
  env: string;
  run: string;
};

type HomeFormState = {
  title: string;
  description: string;
  body: string;
};

type DeleteDocumentResponse = {
  deleted: boolean;
  id: string;
  path: string;
};

type GraphCollections = {
  notes: GraphListResponse;
  tasks: GraphListResponse;
  commands: GraphListResponse;
};

type WorkspaceSnapshot = {
  workspaceData: WorkspaceResponse;
  graphTreeData: GraphTreeResponse;
  graphCollections: GraphCollections;
};

type SurfaceState =
  | { kind: "home" }
  | { kind: "graph"; graphPath: string };

type GraphCanvasPosition = {
  x: number;
  y: number;
};

type GraphCanvasLayerGuide = {
  layer: number;
  x: number;
};

type GraphCanvasLayerGuidance = {
  magneticThresholdPx: number;
  guides: GraphCanvasLayerGuide[];
};

type GraphCanvasNodePayload = {
  id: string;
  type: string;
  graph: string;
  title: string;
  description: string;
  path: string;
  featureSlug: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  position: GraphCanvasPosition;
  positionPersisted: boolean;
};

type GraphCanvasEdgePayload = {
  id: string;
  source: string;
  target: string;
  kind: string;
};

type GraphCanvasResponse = {
  selectedGraph: string;
  availableGraphs: string[];
  layerGuidance: GraphCanvasLayerGuidance;
  nodes: GraphCanvasNodePayload[];
  edges: GraphCanvasEdgePayload[];
};

type GraphCanvasResponseWire = {
  selectedGraph?: string;
  availableGraphs?: string[] | null;
  layerGuidance?: {
    magneticThresholdPx?: number;
    guides?: GraphCanvasLayerGuide[] | null;
  } | null;
  nodes?: GraphCanvasNodePayload[] | null;
  edges?: GraphCanvasEdgePayload[] | null;
};

type GraphLayoutPositionPayload = {
  documentId: string;
  x: number;
  y: number;
};

type GraphLayoutResponse = {
  graph: string;
  positions: GraphLayoutPositionPayload[];
};

type CreateDocumentPayload = {
  type: string;
  featureSlug: string;
  fileName: string;
  id: string;
  graph: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  body: string;
  status?: string;
  dependsOn?: string[];
  references?: string[];
  name?: string;
  env?: Record<string, string>;
  run?: string;
};

type GraphCreateType = "note" | "task" | "command";

type GraphCanvasFlowNodeData = {
  label: ReactNode;
  id: string;
  type: string;
  title: string;
  description: string;
  graph: string;
  featureSlug: string;
  fileName: string;
  positionPersisted: boolean;
  isCanvasSelected: boolean;
  isPanelDocument: boolean;
};

type DividerKind = "left" | "right";

const markdown = new MarkdownIt({ html: true, linkify: true, breaks: true });

const emptyDocumentFormState: DocumentFormState = {
  title: "",
  graph: "",
  tags: "",
  description: "",
  body: "",
  status: "",
  dependsOn: "",
  references: "",
  name: "",
  env: "",
  run: "",
};

const emptyHomeFormState: HomeFormState = {
  title: "Home",
  description: "",
  body: "",
};

const defaultPanelWidths: PanelWidths = {
  leftRatio: 0.25,
  rightRatio: 0.24,
};

const minLeftRatio = 0.18;
const minRightRatio = 0.18;
const minMiddleRatio = 0.28;

async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
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

  return (await response.json()) as T;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeStoredPanelWidths(widths: PanelWidths): PanelWidths {
  const leftRatio = clamp(widths.leftRatio, minLeftRatio, 1 - minMiddleRatio - minRightRatio);
  const rightRatio = clamp(widths.rightRatio, minRightRatio, 1 - minMiddleRatio - leftRatio);
  return { leftRatio, rightRatio };
}

function clampLeftRatio(leftRatio: number, rightRatio: number, rightOpen: boolean): number {
  const maximum = rightOpen ? 1 - minMiddleRatio - rightRatio : 1 - minMiddleRatio;
  return clamp(leftRatio, minLeftRatio, maximum);
}

function clampRightRatio(leftRatio: number, rightRatio: number): number {
  return clamp(rightRatio, minRightRatio, 1 - minMiddleRatio - leftRatio);
}

function formatDocumentType(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function fileNameFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function graphDepth(graphPath: string): number {
  return Math.max(graphPath.split("/").length - 1, 0);
}

function featureSlugFromGraphPath(graphPath: string): string {
  return graphPath.split("/")[0] ?? graphPath;
}

function slugifyValue(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized === "" ? "item" : normalized;
}

function createGraphDocumentPayload(type: GraphCreateType, graphPath: string): CreateDocumentPayload {
  const suffix = Date.now().toString(36);
  const title = type === "note" ? "New Note" : type === "task" ? "New Task" : "New Command";
  const titleSlug = slugifyValue(title);
  const isoTimestamp = new Date().toISOString();
  const basePayload: CreateDocumentPayload = {
    type,
    featureSlug: featureSlugFromGraphPath(graphPath),
    fileName: `${titleSlug}-${suffix}`,
    id: `${type}-${suffix}`,
    graph: graphPath,
    title,
    description: "",
    tags: [],
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    body: "",
    references: [],
  };

  if (type === "task") {
    return {
      ...basePayload,
      status: "todo",
      dependsOn: [],
    };
  }

  if (type === "command") {
    return {
      ...basePayload,
      name: `command-${suffix}`,
      dependsOn: [],
      env: {},
      run: `echo \"Describe ${title.toLowerCase()}\"`,
    };
  }

  return basePayload;
}

function joinList(values?: string[]): string {
  return (values ?? []).join("\n");
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function serializeEnv(env?: Record<string, string>): string {
  return Object.entries(env ?? {})
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function parseEnv(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of value.split("\n")) {
    const line = rawLine.trim();
    if (line === "") {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      throw new Error(`Environment entries must use KEY=VALUE format: ${line}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const envValue = line.slice(separatorIndex + 1);
    if (key === "") {
      throw new Error(`Environment entries must use KEY=VALUE format: ${line}`);
    }

    result[key] = envValue;
  }

  return result;
}

function createDocumentFormState(document: DocumentResponse | null): DocumentFormState {
  if (document === null) {
    return emptyDocumentFormState;
  }

  return {
    title: document.title,
    graph: document.graph,
    tags: joinList(document.tags),
    description: document.description,
    body: document.body,
    status: document.status ?? "",
    dependsOn: joinList(document.dependsOn),
    references: joinList(document.references),
    name: document.name ?? "",
    env: serializeEnv(document.env),
    run: document.run ?? "",
  };
}

function createHomeFormState(home: HomeResponse | null): HomeFormState {
  if (home === null) {
    return emptyHomeFormState;
  }

  return {
    title: home.title,
    description: home.description,
    body: home.body,
  };
}

async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const [workspaceData, graphTreeData, noteGraphs, taskGraphs, commandGraphs] = await Promise.all([
    requestJSON<WorkspaceResponse>("/api/workspace"),
    requestJSON<GraphTreeResponse>("/api/graphs"),
    requestJSON<GraphListResponse>("/api/graphs/note"),
    requestJSON<GraphListResponse>("/api/graphs/task"),
    requestJSON<GraphListResponse>("/api/graphs/command"),
  ]);

  return {
    workspaceData,
    graphTreeData,
    graphCollections: {
      notes: noteGraphs,
      tasks: taskGraphs,
      commands: commandGraphs,
    },
  };
}

function graphCanvasTypeLabel(value: string): string {
  return value === "command" ? "Cmd" : formatDocumentType(value);
}

function graphCanvasTypeClassName(value: string): string {
  if (value === "task" || value === "command") {
    return value;
  }

  return "note";
}

function renderGraphCanvasNodeLabel(data: GraphCanvasFlowNodeData): ReactNode {
  return (
    <article
      className={[
        "graph-canvas-node",
        `graph-canvas-node-${graphCanvasTypeClassName(data.type)}`,
        data.isCanvasSelected ? "graph-canvas-node-selected" : "",
        data.isPanelDocument ? "graph-canvas-node-panel" : "",
      ]
        .filter((value) => value !== "")
        .join(" ")}
    >
      <div className="graph-canvas-node-topline">
        <span className="graph-canvas-node-badge">{graphCanvasTypeLabel(data.type)}</span>
        <span className="graph-canvas-node-file">{data.fileName}</span>
      </div>
      <strong className="graph-canvas-node-title">{data.title}</strong>
      <div className="graph-canvas-node-meta-row">
        <span>{data.graph}</span>
        <span>{data.positionPersisted ? "Saved" : "Seeded"}</span>
      </div>
      {data.description !== "" ? <p className="graph-canvas-node-description">{data.description}</p> : null}
    </article>
  );
}

function buildGraphCanvasFlowNodes(
  graphCanvasData: GraphCanvasResponse | null,
  graphCanvasPositions: Record<string, GraphCanvasPosition>,
  selectedCanvasNodeId: string,
  selectedDocumentId: string,
): Node<GraphCanvasFlowNodeData>[] {
  if (graphCanvasData === null) {
    return [];
  }

  return graphCanvasData.nodes.map((item) => ({
    id: item.id,
    position: graphCanvasPositions[item.id] ?? item.position,
    data: {
      label: renderGraphCanvasNodeLabel({
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        graph: item.graph,
        featureSlug: item.featureSlug,
        fileName: fileNameFromPath(item.path),
        positionPersisted: item.positionPersisted,
        isCanvasSelected: item.id === selectedCanvasNodeId,
        isPanelDocument: item.id === selectedDocumentId,
      }),
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description,
      graph: item.graph,
      featureSlug: item.featureSlug,
      fileName: fileNameFromPath(item.path),
      positionPersisted: item.positionPersisted,
      isCanvasSelected: item.id === selectedCanvasNodeId,
      isPanelDocument: item.id === selectedDocumentId,
    },
    className: "graph-canvas-ghost-node",
    style: {
      width: "18rem",
      padding: 0,
      border: "none",
      borderRadius: 0,
      background: "transparent",
      boxShadow: "none",
      opacity: 0,
      pointerEvents: "none",
    },
    draggable: true,
    connectable: false,
    selectable: true,
  }));
}

function buildGraphCanvasFlowEdges(graphCanvasData: GraphCanvasResponse | null, selectedCanvasNodeId: string): Edge[] {
  if (graphCanvasData === null) {
    return [];
  }

  const hasSelection = selectedCanvasNodeId !== "";
  return graphCanvasData.edges.map((edge) => {
    const isConnected = selectedCanvasNodeId !== "" && (edge.source === selectedCanvasNodeId || edge.target === selectedCanvasNodeId);
    const isReference = edge.kind === "reference";

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      selectable: false,
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: hasSelection ? (isConnected ? "#a7392b" : "rgba(82, 101, 97, 0.32)") : isReference ? "#7d5a3d" : "#244b47",
      },
      style: {
        stroke: hasSelection ? (isConnected ? "#a7392b" : "rgba(82, 101, 97, 0.32)") : isReference ? "#7d5a3d" : "#244b47",
        strokeWidth: hasSelection ? (isConnected ? 2.6 : 1.25) : isReference ? 1.8 : 2.1,
        strokeDasharray: isReference ? "7 6" : undefined,
        opacity: hasSelection ? (isConnected ? 1 : 0.22) : 0.72,
      },
    };
  });
}

function selectedGraphCanvasNode(graphCanvasData: GraphCanvasResponse | null, selectedCanvasNodeId: string): GraphCanvasNodePayload | null {
  if (graphCanvasData === null || selectedCanvasNodeId === "") {
    return null;
  }

  return graphCanvasData.nodes.find((node) => node.id === selectedCanvasNodeId) ?? null;
}

function countConnectedGraphCanvasEdges(graphCanvasData: GraphCanvasResponse | null, selectedCanvasNodeId: string): number {
  if (graphCanvasData === null || selectedCanvasNodeId === "") {
    return 0;
  }

  return graphCanvasData.edges.filter((edge) => edge.source === selectedCanvasNodeId || edge.target === selectedCanvasNodeId).length;
}

function graphCanvasPositionMap(graphCanvasData: GraphCanvasResponse | null): Record<string, GraphCanvasPosition> {
  if (graphCanvasData === null) {
    return {};
  }

  return Object.fromEntries(graphCanvasData.nodes.map((node) => [node.id, node.position]));
}

function applyGraphCanvasLayerGuidance(position: GraphCanvasPosition, layerGuidance: GraphCanvasLayerGuidance | null): GraphCanvasPosition {
  if (layerGuidance === null || layerGuidance.guides.length === 0) {
    return position;
  }

  let snappedX = position.x;
  let shortestDistance = Number.POSITIVE_INFINITY;
  for (const guide of layerGuidance.guides) {
    const distance = Math.abs(position.x - guide.x);
    if (distance <= layerGuidance.magneticThresholdPx && distance < shortestDistance) {
      shortestDistance = distance;
      snappedX = guide.x;
    }
  }

  return shortestDistance === Number.POSITIVE_INFINITY ? position : { x: snappedX, y: position.y };
}

function normalizeGraphCanvasResponse(response: GraphCanvasResponseWire): GraphCanvasResponse {
  return {
    selectedGraph: response.selectedGraph ?? "",
    availableGraphs: response.availableGraphs ?? [],
    layerGuidance: {
      magneticThresholdPx: response.layerGuidance?.magneticThresholdPx ?? 18,
      guides: response.layerGuidance?.guides ?? [],
    },
    nodes: response.nodes ?? [],
    edges: response.edges ?? [],
  };
}

function graphCanvasOverlayPosition(node: Node<GraphCanvasFlowNodeData>): GraphCanvasPosition {
  return { x: node.position.x, y: node.position.y };
}

function FlowApp() {
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [graphTree, setGraphTree] = useState<GraphTreeResponse | null>(null);
  const [graphCollections, setGraphCollections] = useState<GraphCollections | null>(null);
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
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [formState, setFormState] = useState<DocumentFormState>(emptyDocumentFormState);
  const [isEditingHome, setIsEditingHome] = useState<boolean>(false);
  const [homeFormState, setHomeFormState] = useState<HomeFormState>(emptyHomeFormState);
  const [mutationError, setMutationError] = useState<string>("");
  const [mutationSuccess, setMutationSuccess] = useState<string>("");
  const [homeMutationError, setHomeMutationError] = useState<string>("");
  const [homeMutationSuccess, setHomeMutationSuccess] = useState<string>("");
  const [savingDocument, setSavingDocument] = useState<boolean>(false);
  const [deletingDocument, setDeletingDocument] = useState<boolean>(false);
  const [savingHome, setSavingHome] = useState<boolean>(false);
  const [panelWidths, setPanelWidths] = useState<PanelWidths>(defaultPanelWidths);
  const [draggingDivider, setDraggingDivider] = useState<DividerKind | null>(null);

  const layoutRef = useRef<HTMLDivElement | null>(null);
  const graphCanvasShellRef = useRef<HTMLDivElement | null>(null);
  const panelWidthsRef = useRef<PanelWidths>(defaultPanelWidths);
  const graphCanvasDragRef = useRef<{
    documentId: string;
    offsetX: number;
    offsetY: number;
    shellLeft: number;
    shellTop: number;
    moved: boolean;
  } | null>(null);
  const selectedGraphPath = activeSurface.kind === "graph" ? activeSurface.graphPath : "";
  const isContextPanelOpen = selectedDocumentId !== "" || selectedDocument !== null || panelError !== "" || isEditing;

  const graphCanvasNodes = buildGraphCanvasFlowNodes(graphCanvasData, graphCanvasPositions, selectedCanvasNodeId, selectedDocumentId);
  const graphCanvasEdges = buildGraphCanvasFlowEdges(graphCanvasData, selectedCanvasNodeId);
  const selectedGraphNode = graphTree?.graphs.find((graphNode) => graphNode.graphPath === selectedGraphPath) ?? null;
  const selectedCanvasNode = selectedGraphCanvasNode(graphCanvasData, selectedCanvasNodeId);
  const selectedCanvasNodeEdgeCount = countConnectedGraphCanvasEdges(graphCanvasData, selectedCanvasNodeId);

  useEffect(() => {
    panelWidthsRef.current = panelWidths;
  }, [panelWidths]);

  useEffect(() => {
    if (!isEditingHome) {
      setHomeFormState(createHomeFormState(graphTree?.home ?? null));
    }
  }, [graphTree, isEditingHome]);

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

        const nextPanelWidths = normalizeStoredPanelWidths(snapshot.workspaceData.panelWidths);
        setWorkspace(snapshot.workspaceData);
        setGraphTree(snapshot.graphTreeData);
        setGraphCollections(snapshot.graphCollections);
        setPanelWidths(nextPanelWidths);
        panelWidthsRef.current = nextPanelWidths;
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
  }, [selectedDocumentId, autoEditDocumentId]);

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
    const nextPanelWidths = normalizeStoredPanelWidths(snapshot.workspaceData.panelWidths);
    setWorkspace(snapshot.workspaceData);
    setGraphTree(snapshot.graphTreeData);
    setGraphCollections(snapshot.graphCollections);
    setPanelWidths(nextPanelWidths);
    panelWidthsRef.current = nextPanelWidths;

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
    setHomeFormState((current) => ({ ...current, [field]: value }));
  }

  async function persistPanelWidths(nextPanelWidths: PanelWidths): Promise<void> {
    try {
      const response = await requestJSON<WorkspaceResponse>("/api/workspace", {
        method: "PUT",
        body: JSON.stringify({ panelWidths: nextPanelWidths }),
      });
      const normalized = normalizeStoredPanelWidths(response.panelWidths);
      setWorkspace(response);
      setPanelWidths(normalized);
      panelWidthsRef.current = normalized;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  }

  function clearContextPanel(): void {
    setSelectedDocumentId("");
    setSelectedDocument(null);
    setFormState(emptyDocumentFormState);
    setIsEditing(false);
    setPanelError("");
    setMutationError("");
    setMutationSuccess("");
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

  function handleDividerPointerDown(kind: DividerKind): void {
    setDraggingDivider(kind);

    const handlePointerMove = (event: PointerEvent) => {
      const layout = layoutRef.current;
      if (layout === null) {
        return;
      }

      const bounds = layout.getBoundingClientRect();
      const current = panelWidthsRef.current;
      if (kind === "left") {
        const nextLeftRatio = clampLeftRatio((event.clientX - bounds.left) / bounds.width, current.rightRatio, isContextPanelOpen);
        const nextPanelWidths = { leftRatio: nextLeftRatio, rightRatio: current.rightRatio };
        panelWidthsRef.current = nextPanelWidths;
        setPanelWidths(nextPanelWidths);
        return;
      }

      const nextRightRatio = clampRightRatio(current.leftRatio, (bounds.right - event.clientX) / bounds.width);
      const nextPanelWidths = { leftRatio: current.leftRatio, rightRatio: nextRightRatio };
      panelWidthsRef.current = nextPanelWidths;
      setPanelWidths(nextPanelWidths);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      setDraggingDivider(null);
      void persistPanelWidths(panelWidthsRef.current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
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

  async function handleSaveDocument(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
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

  async function handleSaveHome(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    try {
      setSavingHome(true);
      setHomeMutationError("");
      setHomeMutationSuccess("");

      await requestJSON<HomeResponse>("/api/home", {
        method: "PUT",
        body: JSON.stringify({
          title: homeFormState.title,
          description: homeFormState.description,
          body: homeFormState.body,
        }),
      });

      await refreshShellViews();
      setIsEditingHome(false);
      setHomeMutationSuccess("Home updated.");
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

    const confirmed = window.confirm(`Delete ${selectedDocument.title || selectedDocument.id}? This removes the Markdown file and refreshes workspace state.`);
    if (!confirmed) {
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
        <section className="loading-card">
          <p className="eyebrow">Flow GUI</p>
          <h1>Loading workspace state</h1>
          <p>Fetching the Home surface, graph tree, split-pane ratios, and contextual document state.</p>
        </section>
      </main>
    );
  }

  if (error !== "" && workspace === null) {
    return (
      <main className="app-shell app-shell-loading">
        <section className="loading-card loading-card-error">
          <p className="eyebrow">Flow GUI</p>
          <h1>Workspace load failed</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell app-shell-desktop">
      <div className="shell-status-row">
        <div className="brand-block shell-top-brand">
          <h1>Flow</h1>
          <button className="danger-button-inline shell-stop-button" onClick={() => void handleStopGUI()} disabled={stoppingGUI}>
            {stoppingGUI ? "Stopping GUI..." : "Stop"}
          </button>
        </div>
      </div>

      {error !== "" ? <p className="status-line status-line-error">{error}</p> : null}

      <div ref={layoutRef} className="desktop-shell">
        <aside className="panel-rail panel-rail-left" style={{ width: `${panelWidths.leftRatio * 100}%` }}>
          <section className="sidebar-card">
            <header className="sidebar-header">
              <h2>Workspace</h2>
            </header>
            <dl className="workspace-meta">
              <div>
                <dt>Root</dt>
                <dd>{workspace?.workspacePath}</dd>
              </div>
              <div>
                <dt>Server</dt>
                <dd>127.0.0.1:{workspace?.guiPort}</dd>
              </div>
            </dl>
          </section>

          <section className="sidebar-card">
            <header className="sidebar-header">
              <h2>Search</h2>
            </header>
            <label className="search-field">
              <span>Search indexed content</span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search Home, notes, tasks, commands"
              />
            </label>
            {searchError !== "" ? <p className="status-line status-line-error">{searchError}</p> : null}
            <div className="search-results">
              {searchResults.length === 0 && deferredSearchQuery !== "" ? <p className="empty-state-inline">No indexed matches.</p> : null}
              {searchResults.map((result) => (
                <button key={result.id} className="search-result" onClick={() => handleSearchSelection(result)}>
                  <span className="search-result-type">{formatDocumentType(result.type)}</span>
                  <strong>{result.title}</strong>
                  {result.type === "home" ? <span className="item-file-name">Workspace Home</span> : <span className="item-file-name">{fileNameFromPath(result.path)}</span>}
                  <span className="item-path">{result.path}</span>
                  {result.type !== "home" ? <span>{result.graph}</span> : null}
                  {result.description !== "" ? <p className="search-result-description">{result.description}</p> : null}
                  <p>{result.snippet}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="sidebar-card sidebar-card-grow">
            <header className="sidebar-header">
              <h2>Home And Graphs</h2>
            </header>
            <GraphTree
              graphTree={graphTree}
              activeSurface={activeSurface}
              onSelectHome={handleSelectHome}
              onSelectGraph={handleSelectGraph}
            />
          </section>
        </aside>

        <button
          className={draggingDivider === "left" ? "shell-divider shell-divider-active" : "shell-divider"}
          aria-label="Resize left panel"
          onPointerDown={() => handleDividerPointerDown("left")}
          type="button"
        />

        <section className="middle-shell">
          {activeSurface.kind === "home" ? (
            <section className="panel-card surface-card surface-card-home">
              <header className="surface-header">
                <div>
                  <p className="eyebrow">Home</p>
                  <h2>{graphTree?.home.title ?? "Home"}</h2>
                  {graphTree?.home.description ? <p className="surface-description">{graphTree.home.description}</p> : null}
                </div>
                <div className="hero-pill-row">
                  <span>{graphTree?.home.path ?? "data/home.md"}</span>
                  <span>Dedicated top-level surface</span>
                </div>
              </header>

              {homeMutationError !== "" ? <p className="status-line status-line-error">{homeMutationError}</p> : null}
              {homeMutationSuccess !== "" ? <p className="status-line status-line-success">{homeMutationSuccess}</p> : null}

              {isEditingHome ? (
                <form className="editor-form" onSubmit={(event) => void handleSaveHome(event)}>
                  <label className="editor-field">
                    <span>Title</span>
                    <input value={homeFormState.title} onChange={(event) => updateHomeFormField("title", event.target.value)} />
                  </label>

                  <label className="editor-field">
                    <span>Description</span>
                    <textarea
                      rows={3}
                      value={homeFormState.description}
                      onChange={(event) => updateHomeFormField("description", event.target.value)}
                      placeholder="Workspace overview shown in search and the Home surface"
                    />
                  </label>

                  <label className="editor-field">
                    <span>Body</span>
                    <WysiwygEditor
                      ariaLabel="Home body editor"
                      onChange={(value) => updateHomeFormField("body", value)}
                      placeholder="Type / for headings, lists, quotes, links, and highlight"
                      value={homeFormState.body}
                    />
                  </label>

                  <div className="editor-actions">
                    <button className="primary-button" type="submit" disabled={savingHome}>
                      {savingHome ? "Saving..." : "Save Home"}
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setHomeFormState(createHomeFormState(graphTree?.home ?? null));
                        setHomeMutationError("");
                        setHomeMutationSuccess("");
                        setIsEditingHome(false);
                      }}
                      disabled={savingHome}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="detail-toolbar">
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setHomeMutationError("");
                        setHomeMutationSuccess("");
                        setHomeFormState(createHomeFormState(graphTree?.home ?? null));
                        setIsEditingHome(true);
                      }}
                      type="button"
                    >
                      Edit Home
                    </button>
                  </div>

                  {graphTree?.home.description ? (
                    <section className="home-description-card">
                      <p className="section-kicker">Description</p>
                      <p>{graphTree.home.description}</p>
                    </section>
                  ) : (
                    <div className="detail-empty">
                      <p>Add a Home description so it appears in the middle panel and search results.</p>
                    </div>
                  )}

                  <article
                    className="markdown-body home-markdown-body"
                    dangerouslySetInnerHTML={{ __html: markdown.render(graphTree?.home.body ?? "# Home\n") }}
                  />
                </>
              )}
            </section>
          ) : (
            <section className="panel-card surface-card surface-card-graph">
              <header className="surface-header">
                <div>
                  <p className="eyebrow">Graph Workspace</p>
                  <h2>{selectedGraphPath}</h2>
                </div>
                <div className="hero-pill-row">
                  <span>{selectedGraphNode?.countLabel ?? "0 direct / 0 total"}</span>
                  <span>{graphCanvasData?.nodes.length ?? 0} visible documents</span>
                  <span>{graphCanvasData?.edges.length ?? 0} projected edges</span>
                </div>
              </header>

              {graphCanvasError !== "" ? <p className="status-line status-line-error">{graphCanvasError}</p> : null}

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
                <div className="detail-empty">
                  <p>Graph canvas data could not be loaded for this graph.</p>
                </div>
              ) : graphCanvasLoading ? (
                <div className="detail-empty">
                  <p>Loading graph canvas nodes and projected edges.</p>
                </div>
              ) : graphCanvasData !== null && graphCanvasData.nodes.length === 0 ? (
                <section className="graph-empty-state">
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
                <div className="detail-empty">
                  <p>Graph canvas data is not available yet.</p>
                </div>
              ) : (
                <div ref={graphCanvasShellRef} className="graph-canvas-shell">
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
                    <Background gap={28} color="#d7d0bf" />
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
            </section>
          )}
        </section>

        {isContextPanelOpen ? (
          <>
            <button
              className={draggingDivider === "right" ? "shell-divider shell-divider-active" : "shell-divider"}
              aria-label="Resize right panel"
              onPointerDown={() => handleDividerPointerDown("right")}
              type="button"
            />

            <aside className="panel-rail panel-rail-right" style={{ width: `${panelWidths.rightRatio * 100}%` }}>
              <section className="detail-card detail-card-context">
                <header className="panel-header">
                  <div>
                    <p className="section-kicker">Context Panel</p>
                    <h3>{selectedDocument?.title ?? "Document panel"}</h3>
                  </div>
                  <div className="detail-actions">
                    {selectedDocument !== null ? <span className="meta-chip">{formatDocumentType(selectedDocument.type)}</span> : null}
                    <button className="secondary-button" onClick={() => clearContextPanel()} type="button">
                      Close
                    </button>
                  </div>
                </header>

                {panelError !== "" ? <p className="status-line status-line-error">{panelError}</p> : null}
                {mutationError !== "" ? <p className="status-line status-line-error">{mutationError}</p> : null}
                {mutationSuccess !== "" ? <p className="status-line status-line-success">{mutationSuccess}</p> : null}

                {selectedDocument === null ? (
                  <div className="detail-empty">
                    <p>Select a graph node or search result to load document context here.</p>
                  </div>
                ) : isEditing ? (
                  <form className="editor-form" onSubmit={(event) => void handleSaveDocument(event)}>
                    <label className="editor-field">
                      <span>Title</span>
                      <input value={formState.title} onChange={(event) => updateFormField("title", event.target.value)} />
                    </label>

                    <label className="editor-field">
                      <span>Graph Path</span>
                      <input
                        value={formState.graph}
                        onChange={(event) => updateFormField("graph", event.target.value)}
                        placeholder="execution/parser"
                      />
                    </label>

                    <label className="editor-field">
                      <span>Tags</span>
                      <textarea
                        rows={2}
                        value={formState.tags}
                        onChange={(event) => updateFormField("tags", event.target.value)}
                        placeholder="One tag per line or comma-separated"
                      />
                    </label>

                    <label className="editor-field">
                      <span>Description</span>
                      <textarea
                        rows={3}
                        value={formState.description}
                        onChange={(event) => updateFormField("description", event.target.value)}
                        placeholder="Shown in the contextual panel and search results"
                      />
                    </label>

                    {selectedDocument.type === "task" ? (
                      <label className="editor-field">
                        <span>Status</span>
                        <input value={formState.status} onChange={(event) => updateFormField("status", event.target.value)} />
                      </label>
                    ) : null}

                    {(selectedDocument.type === "task" || selectedDocument.type === "command") ? (
                      <label className="editor-field">
                        <span>Dependencies</span>
                        <textarea
                          rows={3}
                          value={formState.dependsOn}
                          onChange={(event) => updateFormField("dependsOn", event.target.value)}
                          placeholder="One dependency ID per line or comma-separated"
                        />
                      </label>
                    ) : null}

                    <label className="editor-field">
                      <span>References</span>
                      <textarea
                        rows={3}
                        value={formState.references}
                        onChange={(event) => updateFormField("references", event.target.value)}
                        placeholder="One reference ID per line or comma-separated"
                      />
                    </label>

                    {selectedDocument.type === "command" ? (
                      <>
                        <label className="editor-field">
                          <span>Name</span>
                          <input value={formState.name} onChange={(event) => updateFormField("name", event.target.value)} />
                        </label>

                        <label className="editor-field">
                          <span>Environment</span>
                          <textarea
                            rows={4}
                            value={formState.env}
                            onChange={(event) => updateFormField("env", event.target.value)}
                            placeholder="KEY=VALUE"
                          />
                        </label>

                        <label className="editor-field">
                          <span>Run</span>
                          <textarea rows={4} value={formState.run} onChange={(event) => updateFormField("run", event.target.value)} />
                        </label>
                      </>
                    ) : null}

                    <label className="editor-field">
                      <span>Body</span>
                      <WysiwygEditor
                        ariaLabel="Document body editor"
                        onChange={(value) => updateFormField("body", value)}
                        placeholder="Type / for headings, lists, quotes, links, and highlight"
                        value={formState.body}
                      />
                    </label>

                    <div className="editor-actions">
                      <button className="primary-button" type="submit" disabled={savingDocument || deletingDocument}>
                        {savingDocument ? "Saving..." : "Save changes"}
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setFormState(createDocumentFormState(selectedDocument));
                          setMutationError("");
                          setMutationSuccess("");
                          setIsEditing(false);
                        }}
                        disabled={savingDocument || deletingDocument}
                      >
                        Cancel
                      </button>
                      <button
                        className="danger-button-inline"
                        type="button"
                        onClick={() => void handleDeleteDocument()}
                        disabled={savingDocument || deletingDocument}
                      >
                        {deletingDocument ? "Deleting..." : "Delete document"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <dl className="detail-meta">
                      <div>
                        <dt>ID</dt>
                        <dd>{selectedDocument.id}</dd>
                      </div>
                      <div>
                        <dt>Graph Path</dt>
                        <dd>{selectedDocument.graph}</dd>
                      </div>
                      <div>
                        <dt>Feature</dt>
                        <dd>{selectedDocument.featureSlug}</dd>
                      </div>
                      <div>
                        <dt>Path</dt>
                        <dd>{selectedDocument.path}</dd>
                      </div>
                      {selectedDocument.status ? (
                        <div>
                          <dt>Status</dt>
                          <dd>{selectedDocument.status}</dd>
                        </div>
                      ) : null}
                      {selectedDocument.name ? (
                        <div>
                          <dt>Name</dt>
                          <dd>{selectedDocument.name}</dd>
                        </div>
                      ) : null}
                    </dl>

                    {selectedDocument.description ? (
                      <section className="detail-section">
                        <h4>Description</h4>
                        <p className="detail-description">{selectedDocument.description}</p>
                      </section>
                    ) : null}

                    <div className="chip-list">
                      {(selectedDocument.tags ?? []).map((tag) => (
                        <span key={tag} className="meta-chip meta-chip-tag">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="detail-toolbar">
                      <button className="secondary-button" onClick={() => setIsEditing(true)} type="button">
                        Edit document
                      </button>
                      <button className="danger-button-inline" onClick={() => void handleDeleteDocument()} disabled={deletingDocument} type="button">
                        {deletingDocument ? "Deleting..." : "Delete document"}
                      </button>
                    </div>

                    {(selectedDocument.dependsOn ?? []).length > 0 ? (
                      <section className="detail-section">
                        <h4>Dependencies</h4>
                        <div className="link-list">
                          {(selectedDocument.dependsOn ?? []).map((dependencyId) => (
                            <button key={dependencyId} className="link-pill" onClick={() => setSelectedDocumentId(dependencyId)} type="button">
                              {dependencyId}
                            </button>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {(selectedDocument.references ?? []).length > 0 ? (
                      <section className="detail-section">
                        <h4>References</h4>
                        <div className="link-list">
                          {(selectedDocument.references ?? []).map((referenceId) => (
                            <button key={referenceId} className="link-pill" onClick={() => setSelectedDocumentId(referenceId)} type="button">
                              {referenceId}
                            </button>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {(selectedDocument.relatedNoteIds ?? []).length > 0 ? (
                      <section className="detail-section">
                        <h4>Related Notes</h4>
                        <div className="link-list">
                          {(selectedDocument.relatedNoteIds ?? []).map((noteId) => (
                            <button key={noteId} className="link-pill" onClick={() => setSelectedDocumentId(noteId)} type="button">
                              {noteId}
                            </button>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {selectedDocument.env !== undefined && Object.keys(selectedDocument.env).length > 0 ? (
                      <section className="detail-section">
                        <h4>Environment</h4>
                        <div className="env-grid">
                          {Object.entries(selectedDocument.env).map(([key, value]) => (
                            <div key={key} className="env-row">
                              <span>{key}</span>
                              <code>{value}</code>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {selectedDocument.run ? (
                      <section className="detail-section">
                        <h4>Run</h4>
                        <pre className="run-block">{selectedDocument.run}</pre>
                      </section>
                    ) : null}

                    <section className="detail-section">
                      <h4>Body</h4>
                      <article
                        className="markdown-body"
                        dangerouslySetInnerHTML={{ __html: markdown.render(selectedDocument.body) }}
                      />
                    </section>
                  </>
                )}
              </section>
            </aside>
          </>
        ) : null}
      </div>
    </main>
  );
}

type GraphTreeProps = {
  graphTree: GraphTreeResponse | null;
  activeSurface: SurfaceState;
  onSelectHome: () => void;
  onSelectGraph: (graphName: string) => void;
};

function GraphTree({ graphTree, activeSurface, onSelectHome, onSelectGraph }: GraphTreeProps) {
  return (
    <div className="graph-group">
      <button
        className={activeSurface.kind === "home" ? "graph-button graph-button-home graph-button-active" : "graph-button graph-button-home"}
        onClick={onSelectHome}
        type="button"
      >
        <span className="graph-button-labels">
          <strong>{graphTree?.home.title ?? "Home"}</strong>
          <span className="graph-path">{graphTree?.home.path ?? "data/home.md"}</span>
        </span>
        <span className="graph-count">Top level</span>
      </button>

      <h3>Visible Graph Tree</h3>
      <div className="graph-list">
        {(graphTree?.graphs ?? []).map((graphNode) => {
          const isActive = activeSurface.kind === "graph" && activeSurface.graphPath === graphNode.graphPath;
          return (
            <button
              key={graphNode.graphPath}
              className={isActive ? "graph-button graph-button-active" : "graph-button"}
              onClick={() => onSelectGraph(graphNode.graphPath)}
              style={{ paddingLeft: `${0.9 + graphDepth(graphNode.graphPath) * 1.05}rem` }}
              type="button"
            >
              <span className="graph-button-labels">
                <strong>{graphNode.displayName}</strong>
                <span className="graph-path">{graphNode.graphPath}</span>
              </span>
              <span className="graph-count">{graphNode.countLabel}</span>
            </button>
          );
        })}
        {graphTree !== null && graphTree.graphs.length === 0 ? <p className="empty-state-inline">No non-empty graphs yet.</p> : null}
      </div>
    </div>
  );
}

export function App() {
  return (
    <ReactFlowProvider>
      <FlowApp />
    </ReactFlowProvider>
  );
}
