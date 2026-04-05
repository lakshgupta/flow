import type { ReactNode } from "react";

export type WorkspaceResponse = {
  scope: string;
  workspacePath: string;
  flowPath: string;
  configPath: string;
  indexPath: string;
  homePath: string;
  guiPort: number;
};

export type HomeResponse = {
  id: string;
  type: string;
  title: string;
  description: string;
  path: string;
  body: string;
};

export type GraphTreeNodeData = {
  graphPath: string;
  displayName: string;
  directCount: number;
  totalCount: number;
  hasChildren: boolean;
  countLabel: string;
};

export type GraphTreeResponse = {
  home: HomeResponse;
  graphs: GraphTreeNodeData[];
};

export type DocumentResponse = {
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

export type SearchResult = {
  id: string;
  type: string;
  description: string;
  featureSlug: string;
  graph: string;
  title: string;
  path: string;
  snippet: string;
};

export type DocumentFormState = {
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

export type HomeFormState = {
  title: string;
  description: string;
  body: string;
};

export type DeleteDocumentResponse = {
  deleted: boolean;
  id: string;
  path: string;
};

export type WorkspaceSnapshot = {
  workspaceData: WorkspaceResponse;
  graphTreeData: GraphTreeResponse;
};

export type SurfaceState =
  | { kind: "home" }
  | { kind: "graph"; graphPath: string };

export type GraphCanvasPosition = {
  x: number;
  y: number;
};

export type GraphCanvasLayerGuide = {
  layer: number;
  x: number;
};

export type GraphCanvasLayerGuidance = {
  magneticThresholdPx: number;
  guides: GraphCanvasLayerGuide[];
};

export type GraphCanvasNodePayload = {
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

export type GraphCanvasEdgePayload = {
  id: string;
  source: string;
  target: string;
  kind: string;
};

export type GraphCanvasResponse = {
  selectedGraph: string;
  availableGraphs: string[];
  layerGuidance: GraphCanvasLayerGuidance;
  nodes: GraphCanvasNodePayload[];
  edges: GraphCanvasEdgePayload[];
};

export type GraphCanvasResponseWire = {
  selectedGraph?: string;
  availableGraphs?: string[] | null;
  layerGuidance?: {
    magneticThresholdPx?: number;
    guides?: GraphCanvasLayerGuide[] | null;
  } | null;
  nodes?: GraphCanvasNodePayload[] | null;
  edges?: GraphCanvasEdgePayload[] | null;
};

export type GraphLayoutPositionPayload = {
  documentId: string;
  x: number;
  y: number;
};

export type GraphLayoutResponse = {
  graph: string;
  positions: GraphLayoutPositionPayload[];
};

export type CreateDocumentPayload = {
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

export type GraphCreateType = "note" | "task" | "command";

export type GraphCanvasFlowNodeData = {
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

export type GraphCanvasFlowNodeInput = Omit<GraphCanvasFlowNodeData, "label">;
