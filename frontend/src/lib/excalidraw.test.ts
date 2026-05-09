import { describe, expect, it, vi } from "vitest";

vi.mock("@excalidraw/excalidraw", () => ({
  exportToSvg: vi.fn(async () => ({ outerHTML: "<svg></svg>" })),
  getNonDeletedElements: vi.fn((elements: unknown) => elements),
  restore: vi.fn((value: unknown) => value),
  serializeAsJSON: vi.fn((elements: unknown, appState: unknown, files: unknown) => {
    return JSON.stringify({
      type: "excalidraw",
      elements,
      appState,
      files,
    });
  }),
}));

import {
  DEFAULT_EXCALIDRAW_HEIGHT,
  parseExcalidrawSource,
  serializeExcalidrawScene,
  setExcalidrawSourceHeight,
} from "./excalidraw";

describe("excalidraw helpers", () => {
  it("uses the default height for empty Excalidraw sources", () => {
    expect(parseExcalidrawSource("")).toMatchObject({
      status: "empty",
      height: DEFAULT_EXCALIDRAW_HEIGHT,
    });
  });

  it("persists a custom Excalidraw height in the serialized source", () => {
    const source = serializeExcalidrawScene([], { viewBackgroundColor: "#fff" }, {}, { height: 520 });

    expect(JSON.parse(source)).toMatchObject({
      flow: { height: 520 },
    });
  });

  it("updates the stored Excalidraw height without changing the scene payload", () => {
    const updatedSource = setExcalidrawSourceHeight(
      JSON.stringify({
        type: "excalidraw",
        elements: [{ id: "shape-1" }],
        appState: { viewBackgroundColor: "#fff" },
        files: {},
      }),
      640,
    );

    expect(parseExcalidrawSource(updatedSource)).toMatchObject({
      status: "ready",
      height: 640,
      initialData: {
        elements: [{ id: "shape-1" }],
      },
    });
  });
});