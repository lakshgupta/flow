// Zoom bounds for the graph canvas. Kept in sync with the ReactFlow
// `minZoom`/`maxZoom` props so overlay-driven wheel zoom clamps identically
// to React Flow's own zoom.
export const CANVAS_MIN_ZOOM = 0.5;
export const CANVAS_MAX_ZOOM = 1.6;

// Normalize the wheel delta the same way @xyflow/system's wheelDelta helper
// does: deltaMode 1 (Firefox line mode) → 0.05 per line, other modes →
// pixel-based step.
export function canvasWheelZoomStep(deltaMode: number): number {
  return deltaMode === 1 ? 0.05 : deltaMode ? 1 : 0.002;
}

export type CanvasViewport = { x: number; y: number; zoom: number };
export type CanvasPoint = { x: number; y: number };

// Compute the next viewport when the user zooms with the wheel around a fixed
// flow point (the point under the cursor). Returns null when the zoom would
// not change (delta ~ 0 or already at a zoom bound).
export function canvasZoomAroundPoint(
  viewport: CanvasViewport,
  deltaY: number,
  deltaMode: number,
  flowPoint: CanvasPoint,
): CanvasViewport | null {
  const step = canvasWheelZoomStep(deltaMode);
  const nextZoom = viewport.zoom * Math.pow(2, -deltaY * step);
  const clampedZoom = Math.min(CANVAS_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, nextZoom));
  if (clampedZoom === viewport.zoom) {
    return null;
  }
  return {
    x: viewport.x + flowPoint.x * (viewport.zoom - clampedZoom),
    y: viewport.y + flowPoint.y * (viewport.zoom - clampedZoom),
    zoom: clampedZoom,
  };
}
