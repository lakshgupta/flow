import { graphCanvasOverlayPosition } from "../lib/graphCanvasUtils";
import type { GraphCanvasOverlayController } from "./graphCanvasOverlayController";

export interface GraphCanvasOverlayNodesProps {
  controller: GraphCanvasOverlayController;
}

export function GraphCanvasOverlayNodes({
  controller,
}: GraphCanvasOverlayNodesProps) {
  const { graphCanvasNodes, rfViewport, shiftSelectedNodes, connectingTarget } = controller.state;
  const { onNodeClick, onNodeDoubleClick, onNodePointerDown, onHandlePointerDown, onMerge } = controller.actions;

  return (
    <>
      {graphCanvasNodes.map((node) => {
        const position = graphCanvasOverlayPosition(node);
        const screenX = position.x * rfViewport.zoom + rfViewport.x;
        const screenY = position.y * rfViewport.zoom + rfViewport.y;
        return (
          <div
            key={node.id}
            data-nodeid={node.id}
            className={[
              "graph-canvas-overlay-node",
              shiftSelectedNodes.includes(node.id) ? "canvas-node-shift-selected" : "",
              connectingTarget === node.id ? "canvas-node-connecting-target" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={(event) => onNodeClick(event, node.id)}
            onDoubleClick={(event) => onNodeDoubleClick(event, node.id)}
            style={{ transform: `translate(${screenX}px, ${screenY}px) scale(${rfViewport.zoom})`, transformOrigin: "top left" }}
          >
            <div
              className="canvas-node-drag-zone"
              onPointerDown={(event) => onNodePointerDown(event, node.id)}
            >
              {node.data.label}
            </div>
            {shiftSelectedNodes.includes(node.id) && (
              <div className="canvas-selection-badge">{shiftSelectedNodes.indexOf(node.id) + 1}</div>
            )}
            {(["top", "right", "bottom", "left"] as const).map((pos) => (
              <div
                key={pos}
                className={`canvas-connect-zone canvas-connect-zone-${pos}`}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => onHandlePointerDown(event, node.id)}
              >
                <div className={`canvas-connect-handle canvas-connect-handle-${pos}`} />
              </div>
            ))}
          </div>
        );
      })}
      {shiftSelectedNodes.length >= 2 && (
        <div className="canvas-action-bar">
          <span className="canvas-action-bar-count">{shiftSelectedNodes.length} selected</span>
          <button
            type="button"
            className="canvas-action-bar-btn"
            onClick={onMerge}
          >
            Merge
          </button>
        </div>
      )}
    </>
  );
}