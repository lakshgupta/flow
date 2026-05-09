import {
  exportToSvg,
  getNonDeletedElements,
  restore,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";

type ParsedExcalidrawSource =
  | {
    status: "empty" | "ready";
    initialData: ExcalidrawInitialDataState;
    normalizedSource: string;
  }
  | {
    status: "error";
    error: string;
  };

type StoredAppState = Pick<Partial<AppState>, "viewBackgroundColor">;

function getStoredAppState(appState?: Partial<AppState> | null): StoredAppState {
  return {
    viewBackgroundColor: appState?.viewBackgroundColor ?? "transparent",
  };
}

function normalizeExcalidrawScene(
  elements: readonly ExcalidrawElement[],
  appState?: Partial<AppState> | null,
  files?: BinaryFiles | null,
): string {
  return serializeAsJSON(elements, getStoredAppState(appState), files ?? {}, "local");
}

export function createEmptyExcalidrawSource(): string {
  return normalizeExcalidrawScene([], getStoredAppState(), {});
}

export function serializeExcalidrawScene(
  elements: readonly ExcalidrawElement[],
  appState?: Partial<AppState> | null,
  files?: BinaryFiles | null,
): string {
  return normalizeExcalidrawScene(elements, appState, files);
}

export function parseExcalidrawSource(source: string): ParsedExcalidrawSource {
  if (source.trim() === "") {
    const initialData: ExcalidrawInitialDataState = {
      elements: [],
      appState: getStoredAppState(),
      files: {},
    };

    return {
      status: "empty",
      initialData,
      normalizedSource: createEmptyExcalidrawSource(),
    };
  }

  try {
    const parsed = JSON.parse(source) as {
      appState?: Partial<AppState>;
      elements?: readonly ExcalidrawElement[];
      files?: BinaryFiles;
    };

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
      initialData: {
        elements,
        appState,
        files,
      },
      normalizedSource: normalizeExcalidrawScene(elements, appState, files),
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function renderExcalidrawDiagramSource(source: string): Promise<string> {
  const parsed = parseExcalidrawSource(source);
  if (parsed.status === "error") {
    throw new Error(parsed.error);
  }

  const svg = await exportToSvg({
    elements: parsed.initialData.elements ?? [],
    appState: parsed.initialData.appState,
    files: parsed.initialData.files ?? null,
  });

  return svg.outerHTML;
}