import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";

let excalidrawModule: Promise<typeof import("@excalidraw/excalidraw")> | null = null;

function loadExcalidraw(): Promise<typeof import("@excalidraw/excalidraw")> {
  if (excalidrawModule === null) {
    excalidrawModule = import("@excalidraw/excalidraw");
  }
  return excalidrawModule;
}

export const DEFAULT_EXCALIDRAW_HEIGHT = 384;
export const MIN_EXCALIDRAW_HEIGHT = 240;
export const MAX_EXCALIDRAW_HEIGHT = 960;

type ParsedExcalidrawSource =
  | {
    status: "empty" | "ready";
    height: number;
    initialData: ExcalidrawInitialDataState;
    normalizedSource: string;
  }
  | {
    status: "error";
    error: string;
  };

type StoredAppState = Pick<Partial<AppState>, "viewBackgroundColor">;

type StoredExcalidrawDocument = {
  appState?: Partial<AppState>;
  elements?: readonly ExcalidrawElement[];
  files?: BinaryFiles;
  flow?: {
    height?: number;
  };
};

function getStoredAppState(appState?: Partial<AppState> | null): StoredAppState {
  return {
    viewBackgroundColor: appState?.viewBackgroundColor ?? "transparent",
  };
}

export function clampExcalidrawHeight(height?: number | null): number {
  if (typeof height !== "number" || Number.isFinite(height) === false) {
    return DEFAULT_EXCALIDRAW_HEIGHT;
  }

  return Math.min(MAX_EXCALIDRAW_HEIGHT, Math.max(MIN_EXCALIDRAW_HEIGHT, Math.round(height)));
}

async function normalizeExcalidrawScene(
  elements: readonly ExcalidrawElement[],
  appState?: Partial<AppState> | null,
  files?: BinaryFiles | null,
  height?: number | null,
): Promise<string> {
  const { serializeAsJSON } = await loadExcalidraw();
  const serializedSource = serializeAsJSON(elements, getStoredAppState(appState), files ?? {}, "local");
  const serializedDocument = JSON.parse(serializedSource) as StoredExcalidrawDocument;
  const clampedHeight = clampExcalidrawHeight(height);

  if (clampedHeight === DEFAULT_EXCALIDRAW_HEIGHT) {
    delete serializedDocument.flow;
  } else {
    serializedDocument.flow = { height: clampedHeight };
  }

  return JSON.stringify(serializedDocument);
}

export async function createEmptyExcalidrawSource(): Promise<string> {
  return normalizeExcalidrawScene([], getStoredAppState(), {}, DEFAULT_EXCALIDRAW_HEIGHT);
}

export async function serializeExcalidrawScene(
  elements: readonly ExcalidrawElement[],
  appState?: Partial<AppState> | null,
  files?: BinaryFiles | null,
  options?: {
    height?: number | null;
  },
): Promise<string> {
  return normalizeExcalidrawScene(elements, appState, files, options?.height ?? DEFAULT_EXCALIDRAW_HEIGHT);
}

export async function setExcalidrawSourceHeight(source: string, height: number): Promise<string> {
  const parsed = await parseExcalidrawSource(source);
  if (parsed.status === "error") {
    throw new Error(parsed.error);
  }

  return serializeExcalidrawScene(
    parsed.initialData.elements ?? [],
    parsed.initialData.appState,
    parsed.initialData.files ?? null,
    { height },
  );
}

export async function parseExcalidrawSource(source: string): Promise<ParsedExcalidrawSource> {
  if (source.trim() === "") {
    const initialData: ExcalidrawInitialDataState = {
      elements: [],
      appState: getStoredAppState(),
      files: {},
    };

    return {
      status: "empty",
      height: DEFAULT_EXCALIDRAW_HEIGHT,
      initialData,
      normalizedSource: await createEmptyExcalidrawSource(),
    };
  }

  try {
    const parsed = JSON.parse(source) as StoredExcalidrawDocument;
    const height = clampExcalidrawHeight(parsed.flow?.height);

    const { restore, getNonDeletedElements } = await loadExcalidraw();
    const restored = restore(
      {
        appState: parsed.appState,
        elements: parsed.elements,
        files: parsed.files,
      },
      getStoredAppState(),
      null,
    );
    const elements = getNonDeletedElements(restored.elements);
    const appState = getStoredAppState(restored.appState);
    const files = restored.files ?? {};

    return {
      status: "ready",
      height,
      initialData: {
        elements,
        appState,
        files,
      },
      normalizedSource: await normalizeExcalidrawScene(elements, appState, files, height),
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function renderExcalidrawDiagramSource(source: string): Promise<string> {
  const parsed = await parseExcalidrawSource(source);
  if (parsed.status === "error") {
    throw new Error(parsed.error);
  }

  const { exportToSvg } = await loadExcalidraw();
  const svg = await exportToSvg({
    elements: parsed.initialData.elements ?? [],
    appState: parsed.initialData.appState,
    files: parsed.initialData.files ?? null,
  });

  return svg.outerHTML;
}