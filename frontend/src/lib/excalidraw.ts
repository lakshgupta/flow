export const MIN_EXCALIDRAW_HEIGHT = 240;
export const MAX_EXCALIDRAW_HEIGHT = 960;
export const DEFAULT_EXCALIDRAW_HEIGHT = 384;

export type ExcalidrawElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
};

export type ExcalidrawDocument = {
  type: "excalidraw";
  version: number;
  source?: string;
  elements: ExcalidrawElement[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
  flow?: { height?: number };
};

export function clampExcalidrawHeight(height: number): number {
  if (!Number.isFinite(height)) return DEFAULT_EXCALIDRAW_HEIGHT;
  return Math.min(MAX_EXCALIDRAW_HEIGHT, Math.max(MIN_EXCALIDRAW_HEIGHT, Math.round(height)));
}

export function createEmptyExcalidrawSource(height = DEFAULT_EXCALIDRAW_HEIGHT): string {
  const doc: ExcalidrawDocument = {
    type: "excalidraw",
    version: 2,
    elements: [],
    appState: {},
    files: {},
    flow: { height: clampExcalidrawHeight(height) },
  };
  return JSON.stringify(doc);
}

export type ParsedExcalidrawSource = {
  elements: ExcalidrawElement[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
  height: number;
};

export async function parseExcalidrawSource(source: string): Promise<ParsedExcalidrawSource> {
  const trimmed = source.trim();
  if (trimmed === "") {
    return {
      elements: [],
      appState: {},
      files: {},
      height: DEFAULT_EXCALIDRAW_HEIGHT,
    };
  }
  const excalidraw = await import("@excalidraw/excalidraw");
  const parsed = JSON.parse(trimmed) as ExcalidrawDocument;
  const restored = excalidraw.restore({
    elements: parsed.elements ?? [],
    appState: parsed.appState ?? {},
    files: parsed.files ?? {},
  });
  const height = clampExcalidrawHeight(parsed.flow?.height ?? DEFAULT_EXCALIDRAW_HEIGHT);
  return {
    elements: restored.elements as ExcalidrawElement[],
    appState: restored.appState,
    files: restored.files,
    height,
  };
}

export function serializeExcalidrawScene(elements: ExcalidrawElement[], height: number): string {
  const doc: ExcalidrawDocument = {
    type: "excalidraw",
    version: 2,
    elements,
    appState: {},
    files: {},
    flow: { height: clampExcalidrawHeight(height) },
  };
  return JSON.stringify(doc);
}

export function setExcalidrawSourceHeight(source: string, height: number): string {
  const trimmed = source.trim();
  if (trimmed === "") {
    return createEmptyExcalidrawSource(height);
  }
  try {
    const parsed = JSON.parse(trimmed) as ExcalidrawDocument;
    parsed.flow = { ...(parsed.flow ?? {}), height: clampExcalidrawHeight(height) };
    return JSON.stringify(parsed);
  } catch {
    return createEmptyExcalidrawSource(height);
  }
}

export type RenderedExcalidrawDiagram = {
  svg: string;
  height: number;
};

export async function renderExcalidrawDiagramSource(source: string): Promise<RenderedExcalidrawDiagram> {
  const excalidraw = await import("@excalidraw/excalidraw");
  const parsed = await parseExcalidrawSource(source);
  const svg = await excalidraw.exportToSvg({
    elements: parsed.elements,
    appState: { ...parsed.appState, exportBackground: false },
    files: parsed.files,
  });
  return { svg: svg.outerHTML, height: parsed.height };
}
