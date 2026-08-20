import { describe, expect, it } from "vitest";

import {
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  canvasWheelZoomStep,
  canvasZoomAroundPoint,
} from "./canvasZoom";

describe("canvasWheelZoomStep", () => {
  it("uses a line step for Firefox-style deltaMode 1", () => {
    expect(canvasWheelZoomStep(1)).toBe(0.05);
  });

  it("uses a pixel step for Chrome-style deltaMode 0", () => {
    expect(canvasWheelZoomStep(0)).toBe(0.002);
  });

  it("uses a page step for other deltaModes", () => {
    expect(canvasWheelZoomStep(2)).toBe(1);
  });
});

describe("canvasZoomAroundPoint", () => {
  const viewport = { x: 0, y: 0, zoom: 1 };
  const point = { x: 100, y: 80 };

  it("zooms in on a negative deltaY", () => {
    const next = canvasZoomAroundPoint(viewport, -120, 0, point);
    expect(next).not.toBeNull();
    expect(next!.zoom).toBeGreaterThan(1);
  });

  it("zooms out on a positive deltaY", () => {
    const next = canvasZoomAroundPoint(viewport, 120, 0, point);
    expect(next).not.toBeNull();
    expect(next!.zoom).toBeLessThan(1);
  });

  it("keeps the flow point under the cursor fixed", () => {
    // screenX = flowX * zoom + viewport.x; after zoom the same flow point
    // must map back to the same screen coordinate.
    const next = canvasZoomAroundPoint(viewport, -120, 0, point)!;
    const screenBefore = point.x * viewport.zoom + viewport.x;
    const screenAfter = point.x * next.zoom + next.x;
    expect(screenAfter).toBeCloseTo(screenBefore, 6);
  });

  it("clamps to the canvas zoom bounds", () => {
    const zoomedOut = canvasZoomAroundPoint({ x: 0, y: 0, zoom: 1 }, 50000, 0, point);
    expect(zoomedOut).not.toBeNull();
    expect(zoomedOut!.zoom).toBe(CANVAS_MIN_ZOOM);

    const zoomedIn = canvasZoomAroundPoint({ x: 0, y: 0, zoom: 1 }, -50000, 0, point);
    expect(zoomedIn).not.toBeNull();
    expect(zoomedIn!.zoom).toBe(CANVAS_MAX_ZOOM);
  });

  it("returns null when the zoom would not change", () => {
    expect(canvasZoomAroundPoint(viewport, 0, 0, point)).toBeNull();
    expect(canvasZoomAroundPoint({ x: 0, y: 0, zoom: CANVAS_MIN_ZOOM }, 5000, 0, point)).toBeNull();
    expect(canvasZoomAroundPoint({ x: 0, y: 0, zoom: CANVAS_MAX_ZOOM }, -5000, 0, point)).toBeNull();
  });

  it("keeps a non-zero viewport translation anchored correctly", () => {
    const vp = { x: 50, y: 30, zoom: 1 };
    const p = { x: 150, y: 90 };
    const next = canvasZoomAroundPoint(vp, -120, 0, p)!;
    const screenBeforeX = p.x * vp.zoom + vp.x;
    const screenAfterX = p.x * next.zoom + next.x;
    expect(screenAfterX).toBeCloseTo(screenBeforeX, 6);
    const screenBeforeY = p.y * vp.zoom + vp.y;
    const screenAfterY = p.y * next.zoom + next.y;
    expect(screenAfterY).toBeCloseTo(screenBeforeY, 6);
  });
});
