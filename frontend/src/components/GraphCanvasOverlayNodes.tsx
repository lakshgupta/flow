import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpToLine, File as FileIcon, Download, ExternalLink } from "lucide-react";

import { graphDirectoryColorHex } from "../lib/graphColors";
import { graphCanvasTypeClassName, graphCanvasTypeLabel } from "../lib/graphCanvasUtils";
import { graphCanvasOverlayPosition } from "../lib/graphCanvasUtils";
import type { GraphCanvasOverlayController } from "./graphCanvasOverlayController";

export interface GraphCanvasOverlayNodesProps {
  controller: GraphCanvasOverlayController;
}

export function GraphCanvasOverlayNodes({
  controller,
}: GraphCanvasOverlayNodesProps) {
  const {
    graphCanvasNodes,
    rfViewport,
    shiftSelectedNodes,
    connectingTarget,
    intersectingNodeIds,
    intersectingSourceNodeId,
  } = controller.state;
  const {
    onNodeClick,
    onNodeDoubleClick,
    onNodePointerDown,
    onHandlePointerDown,
    onNodeDescriptionSave,
    onNodeResizePreview,
    onNodeResizeCommit,
    onBringNodeToFront,
    onSendNodeToBack,
    onMerge,
  } = controller.actions;
  const [draftDescriptions, setDraftDescriptions] = useState<Record<string, string>>({});
  const resizeSessionRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    startWidth: number;
    startHeight: number;
    axis: "horizontal" | "vertical" | "both";
    zoom: number;
    minWidth: number;
    minHeight: number;
    nextWidth: number;
    nextHeight: number;
  } | null>(null);

  useEffect(() => {
    setDraftDescriptions((current) => {
      const next: Record<string, string> = {};
      let changed = false;
      for (const node of graphCanvasNodes) {
        if (Object.prototype.hasOwnProperty.call(current, node.id)) {
          next[node.id] = current[node.id] ?? "";
          continue;
        }
        next[node.id] = node.data.description ?? "";
        changed = true;
      }

      if (!changed && Object.keys(current).length === Object.keys(next).length) {
        return current;
      }
      return next;
    });
  }, [graphCanvasNodes]);

  function handleDescriptionCommit(nodeId: string, fallbackDescription: string): void {
    const draft = draftDescriptions[nodeId] ?? fallbackDescription;
    const nextDescription = draft.trim();
    const currentDescription = (fallbackDescription ?? "").trim();
    if (nextDescription === currentDescription) {
      return;
    }
    setDraftDescriptions((current) => ({ ...current, [nodeId]: nextDescription }));
    onNodeDescriptionSave(nodeId, nextDescription);
  }

  function handleDescriptionKeyDown(event: KeyboardEvent<HTMLInputElement>, nodeId: string, fallbackDescription: string): void {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget as HTMLInputElement).blur();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setDraftDescriptions((current) => ({ ...current, [nodeId]: fallbackDescription ?? "" }));
      (event.currentTarget as HTMLInputElement).blur();
    }
  }

  function beginResize(
    event: ReactPointerEvent<HTMLDivElement>,
    nodeId: string,
    width: number,
    height: number,
    axis: "horizontal" | "vertical" | "both",
    shape?: string,
  ): void {
    event.preventDefault();
    event.stopPropagation();

    const zoom = rfViewport.zoom > 0 ? rfViewport.zoom : 1;
    const isCircle = shape === "circle";
    resizeSessionRef.current = {
      nodeId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: width,
      startHeight: height,
      axis,
      zoom,
      minWidth: isCircle ? 132 : 132,
      minHeight: isCircle ? 132 : 96,
      nextWidth: width,
      nextHeight: height,
    };

    const handlePointerMove = (moveEvent: PointerEvent): void => {
      const session = resizeSessionRef.current;
      if (session === null) {
        return;
      }

      const deltaX = (moveEvent.clientX - session.startClientX) / session.zoom;
      const deltaY = (moveEvent.clientY - session.startClientY) / session.zoom;
      const nextWidth = session.axis === "vertical"
        ? session.startWidth
        : Math.max(session.minWidth, Math.round(session.startWidth + deltaX));
      const nextHeight = session.axis === "horizontal"
        ? session.startHeight
        : Math.max(session.minHeight, Math.round(session.startHeight + deltaY));
      session.nextWidth = nextWidth;
      session.nextHeight = nextHeight;
      onNodeResizePreview(session.nodeId, nextWidth, nextHeight);
    };

    const finishResize = (): void => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);

      const session = resizeSessionRef.current;
      if (session !== null) {
        onNodeResizeCommit(session.nodeId, session.nextWidth, session.nextHeight);
      }
      resizeSessionRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
  }

  return (
    <>
      {graphCanvasNodes.map((node) => {
        const position = graphCanvasOverlayPosition(node);
        const screenX = position.x * rfViewport.zoom + rfViewport.x;
        const screenY = position.y * rfViewport.zoom + rfViewport.y;
        const graphColor = graphDirectoryColorHex(node.data.graphColor);
        const draftDescription = draftDescriptions[node.id] ?? node.data.description ?? "";
        const isIntersecting = intersectingNodeIds.includes(node.id);
        const isIntersectionSource = intersectingSourceNodeId === node.id && intersectingNodeIds.length > 0;
        const nodeWidth = node.data.width ?? 288;
        const nodeHeight = node.data.height ?? 130;
        const splitExpandedNode = node.data.shape !== "circle" && node.data.isExpanded;
        const nodeStyle = {
          ...(graphColor ? ({ "--graph-node-color": graphColor } as CSSProperties) : {}),
          width: `${nodeWidth}px`,
          height: `${nodeHeight}px`,
          minHeight: `${nodeHeight}px`,
          ...(splitExpandedNode ? ({ "--graph-node-core-height": `${node.data.baseHeight}px` } as CSSProperties) : {}),
        } as CSSProperties;
        return (
          <div
            key={node.id}
            data-nodeid={node.id}
            className={[
              "graph-canvas-overlay-node",
              shiftSelectedNodes.includes(node.id) ? "canvas-node-shift-selected" : "",
              connectingTarget === node.id ? "canvas-node-connecting-target" : "",
              isIntersecting ? "canvas-node-intersecting" : "",
              isIntersectionSource ? "canvas-node-intersection-source" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={(event) => onNodeClick(event, node.id)}
            onDoubleClick={(event) => onNodeDoubleClick(event, node.id)}
            style={{ transform: `translate(${screenX}px, ${screenY}px) scale(${rfViewport.zoom})`, transformOrigin: "top left", zIndex: node.data.zIndex ?? 0 }}
          >
            <div
              className="canvas-node-drag-zone"
              onPointerDown={(event) => onNodePointerDown(event, node.id)}
            >
              <article
                className={[
                  "graph-canvas-node",
                  `graph-canvas-node-${graphCanvasTypeClassName(node.data.type)}`,
                  graphColor ? "graph-canvas-node-tinted" : "",
                  node.data.shape === "circle" ? "graph-canvas-node-circle" : "",
                  node.data.isExpanded ? "graph-canvas-node-expanded" : "",
                  splitExpandedNode ? "graph-canvas-node-split" : "",
                  node.data.isCanvasSelected ? "graph-canvas-node-selected" : "",
                  node.data.isPanelDocument ? "graph-canvas-node-panel" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={nodeStyle}
              >
                {node.data.shape === "circle" ? (
                  <>
                    <span className="graph-canvas-node-badge">{graphCanvasTypeLabel(node.data.type)}</span>
                    <strong className="graph-canvas-node-title">{node.data.title}</strong>
                    <span className="graph-canvas-node-graph">{node.data.graph}</span>
                  </>
                ) : splitExpandedNode ? (
                  <>
                    <section className="graph-canvas-node-core">
                      <div className="graph-canvas-node-topline">
                        <span className="graph-canvas-node-badge">{graphCanvasTypeLabel(node.data.type)}</span>
                        <span className="graph-canvas-node-graph">{node.data.graph}</span>
                      </div>
                      <strong className="graph-canvas-node-title">{node.data.title}</strong>
                      {node.data.previewKind === "image" && node.data.previewURL ? (
                        <div className="graph-canvas-node-preview graph-canvas-node-preview-image graph-canvas-node-preview-resizable">
                          <img src={node.data.previewURL} alt={node.data.previewName ?? node.data.title} loading="lazy" />
                        </div>
                      ) : null}
                      {node.data.previewKind === "pdf" && node.data.previewURL ? (
                        <div className="graph-canvas-node-preview graph-canvas-node-preview-pdf">
                          <iframe
                            src={`${node.data.previewURL}#page=1&view=FitH`}
                            title={node.data.previewName ?? node.data.title}
                            loading="lazy"
                          />
                        </div>
                      ) : null}
                      {node.data.previewKind === "file" ? (
                        <div className="graph-canvas-node-preview graph-canvas-node-preview-file">
                          <span className="graph-canvas-node-preview-file-icon" aria-hidden="true">
                            <FileIcon size={14} />
                          </span>
                          <span className="graph-canvas-node-preview-file-name">{node.data.previewName ?? "Attached file"}</span>
                        </div>
                      ) : null}
                      <input
                        type="text"
                        className="graph-canvas-node-description-input"
                        value={draftDescription}
                        placeholder="Add a short description"
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setDraftDescriptions((current) => ({ ...current, [node.id]: nextValue }));
                        }}
                        onBlur={() => handleDescriptionCommit(node.id, node.data.description ?? "")}
                        onKeyDown={(event) => handleDescriptionKeyDown(event, node.id, node.data.description ?? "")}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => event.stopPropagation()}
                        aria-label={`Description for ${node.data.title}`}
                      />
                      {(node.data.previewKind === "image" || node.data.previewKind === "pdf" || node.data.previewKind === "file") && node.data.previewURL ? (
                        <div className="graph-canvas-node-preview-actions" onClick={(e) => e.stopPropagation()}>
                          {node.data.previewKind === "pdf" && (
                            <button
                              type="button"
                              className="graph-canvas-node-preview-open"
                              onClick={(event) => {
                                event.stopPropagation();
                                window.open(node.data.previewURL, "_blank", "noopener,noreferrer");
                              }}
                              aria-label={`Open PDF ${node.data.previewName ?? node.data.title}`}
                            >
                              <ExternalLink size={12} /> Open PDF
                            </button>
                          )}
                          {(node.data.previewAssetCount ?? 1) <= 1 ? (
                            <a
                              className="graph-canvas-node-preview-open"
                              href={node.data.previewURL}
                              download={node.data.previewName ?? true}
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`Download ${node.data.previewName ?? node.data.title}`}
                            >
                              <Download size={12} /> Download
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </section>
                    <section className="graph-canvas-node-expansion" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    <div className="graph-canvas-node-topline">
                      <span className="graph-canvas-node-badge">{graphCanvasTypeLabel(node.data.type)}</span>
                      <span className="graph-canvas-node-graph">{node.data.graph}</span>
                    </div>
                    <strong className="graph-canvas-node-title">{node.data.title}</strong>
                    {node.data.previewKind === "image" && node.data.previewURL ? (
                      <div className="graph-canvas-node-preview graph-canvas-node-preview-image graph-canvas-node-preview-resizable">
                        <img src={node.data.previewURL} alt={node.data.previewName ?? node.data.title} loading="lazy" />
                      </div>
                    ) : null}
                    {node.data.previewKind === "pdf" && node.data.previewURL ? (
                      <div className="graph-canvas-node-preview graph-canvas-node-preview-pdf">
                        <iframe
                          src={`${node.data.previewURL}#page=1&view=FitH`}
                          title={node.data.previewName ?? node.data.title}
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                    {node.data.previewKind === "file" ? (
                      <div className="graph-canvas-node-preview graph-canvas-node-preview-file">
                        <span className="graph-canvas-node-preview-file-icon" aria-hidden="true">
                          <FileIcon size={14} />
                        </span>
                        <span className="graph-canvas-node-preview-file-name">{node.data.previewName ?? "Attached file"}</span>
                      </div>
                    ) : null}
                    <input
                      type="text"
                      className="graph-canvas-node-description-input"
                      value={draftDescription}
                      placeholder="Add a short description"
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setDraftDescriptions((current) => ({ ...current, [node.id]: nextValue }));
                      }}
                      onBlur={() => handleDescriptionCommit(node.id, node.data.description ?? "")}
                      onKeyDown={(event) => handleDescriptionKeyDown(event, node.id, node.data.description ?? "")}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                      aria-label={`Description for ${node.data.title}`}
                    />
                    {(node.data.previewKind === "image" || node.data.previewKind === "pdf" || node.data.previewKind === "file") && node.data.previewURL ? (
                      <div className="graph-canvas-node-preview-actions" onClick={(e) => e.stopPropagation()}>
                        {node.data.previewKind === "pdf" && (
                          <button
                            type="button"
                            className="graph-canvas-node-preview-open"
                            onClick={(event) => {
                              event.stopPropagation();
                              window.open(node.data.previewURL, "_blank", "noopener,noreferrer");
                            }}
                            aria-label={`Open PDF ${node.data.previewName ?? node.data.title}`}
                          >
                            <ExternalLink size={12} /> Open PDF
                          </button>
                        )}
                        {(node.data.previewAssetCount ?? 1) <= 1 ? (
                          <a
                            className="graph-canvas-node-preview-open"
                            href={node.data.previewURL}
                            download={node.data.previewName ?? true}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Download ${node.data.previewName ?? node.data.title}`}
                          >
                            <Download size={12} /> Download
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
                {node.data.isCanvasSelected ? (
                  <>
                    <div
                      className="graph-canvas-node-resize-edge graph-canvas-node-resize-edge-right"
                      onPointerDown={(event) => beginResize(event, node.id, nodeWidth, nodeHeight, "horizontal", node.data.shape)}
                      role="presentation"
                    />
                    <div
                      className="graph-canvas-node-resize-edge graph-canvas-node-resize-edge-bottom"
                      onPointerDown={(event) => beginResize(event, node.id, nodeWidth, nodeHeight, "vertical", node.data.shape)}
                      role="presentation"
                    />
                    <div
                      className="graph-canvas-node-resize-edge graph-canvas-node-resize-edge-corner"
                      onPointerDown={(event) => beginResize(event, node.id, nodeWidth, nodeHeight, "both", node.data.shape)}
                      role="presentation"
                    />
                  </>
                ) : null}
              </article>
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
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onMerge();
            }}
          >
            Merge
          </button>
        </div>
      )}
      {shiftSelectedNodes.length < 2 && controller.state.selectedCanvasNodeId !== "" && intersectingNodeIds.length > 0 && (
        <div className="canvas-action-bar">
          <span className="canvas-action-bar-count">{intersectingNodeIds.length + 1} overlapping</span>
          <button
            type="button"
            className="canvas-action-bar-btn"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onBringNodeToFront(controller.state.selectedCanvasNodeId);
            }}
            aria-label="Bring selected node to front"
          >
            <ArrowUpToLine size={12} /> Bring to front
          </button>
          <button
            type="button"
            className="canvas-action-bar-btn"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onSendNodeToBack(controller.state.selectedCanvasNodeId);
            }}
            aria-label="Send selected node to back"
          >
            <ArrowDownToLine size={12} /> Send to back
          </button>
        </div>
      )}
    </>
  );
}