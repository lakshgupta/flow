import { CheckSquare, FileText, Terminal } from "lucide-react";
import type { GraphCanvasOverlayController } from "./graphCanvasOverlayController";

export interface GraphCanvasOverlayInteractionProps {
  controller: GraphCanvasOverlayController;
}

export function GraphCanvasOverlayInteraction({
  controller,
}: GraphCanvasOverlayInteractionProps) {
  const {
    canvasContextMenu,
    connectingFrom,
    connectingPointerPos,
    connectingStartPos,
    connectingTarget,
  } = controller.state;
  const { closeCanvasContextMenu, createGraphDocument } = controller.actions;

  return (
    <>
      {canvasContextMenu && (
        <div
          className="canvas-context-menu"
          style={{ left: canvasContextMenu.x, top: canvasContextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="flow-dropdown-item"
            onClick={() => {
              closeCanvasContextMenu();
              createGraphDocument("note");
            }}
          >
            <FileText size={13} /> Add note
          </button>
          <button
            type="button"
            className="flow-dropdown-item"
            onClick={() => {
              closeCanvasContextMenu();
              createGraphDocument("task");
            }}
          >
            <CheckSquare size={13} /> Add task
          </button>
          <button
            type="button"
            className="flow-dropdown-item"
            onClick={() => {
              closeCanvasContextMenu();
              createGraphDocument("command");
            }}
          >
            <Terminal size={13} /> Add command
          </button>
        </div>
      )}

      {connectingFrom !== null && connectingPointerPos !== null && connectingStartPos !== null && (
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9998 }}
        >
          <line
            x1={connectingStartPos.x}
            y1={connectingStartPos.y}
            x2={connectingPointerPos.x}
            y2={connectingPointerPos.y}
            stroke="var(--graph-edge)"
            strokeWidth={2.5}
            strokeDasharray="6 4"
          />
          <circle
            cx={connectingPointerPos.x}
            cy={connectingPointerPos.y}
            r={5}
            fill={connectingTarget !== null ? "var(--graph-edge)" : "var(--graph-edge-hover)"}
          />
        </svg>
      )}
    </>
  );
}