import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { requestJSON } from "../lib/api";
import {
  buildOrderedPresentationGraph,
  initialPresentationState,
  presentationReducer,
  type PresentationEvent,
  type PresentationGraph,
  type PresentationState,
} from "../lib/presentationNavigation";
import type { DocumentResponse, GraphCanvasResponse } from "../types";

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export type UsePresentationModeParams = {
  /** Live canvas payload; null disables the mode entirely. */
  data: GraphCanvasResponse | null;
  /** Node the presentation should start from (defaults to first in order). */
  startNodeId?: string | null;
  /** Whether pressing "p" may enter the mode (graph surface visible). */
  entryEnabled?: boolean;
  /** Opens the current slide in the normal document view (Enter key). */
  onOpenDocument?: (nodeId: string) => void;
  /** Called on exit with the last-presented node id. */
  onExit?: (lastNodeId: string) => void;
};

export function usePresentationMode({
  data,
  startNodeId,
  entryEnabled = false,
  onOpenDocument,
  onExit,
}: UsePresentationModeParams) {
  const [state, setState] = useState<PresentationState>(initialPresentationState);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const callbacksRef = useRef({ onExit, onOpenDocument });
  callbacksRef.current = { onExit, onOpenDocument };

  // Successor display order depends on loaded source bodies (reference
  // mentions), so the graph is derived here rather than by the caller.
  const graph: PresentationGraph = useMemo(
    () =>
      data === null
        ? { nodes: [], edges: [] }
        : buildOrderedPresentationGraph(data, bodies),
    [data, bodies],
  );

  const graphRef = useRef(graph);
  graphRef.current = graph;

  const run = useCallback((event: PresentationEvent) => {
    setState((previous) =>
      presentationReducer(previous, event, graphRef.current),
    );
  }, []);

  // Keep candidates fresh when the underlying graph changes mid-presentation.
  useEffect(() => {
    if (state.active) {
      run({ type: "graphUpdated" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on graph identity change
  }, [graph]);

  // Lazy-load the current slide's full body (cached per session).
  const requestedBodies = useRef(new Set<string>());
  useEffect(() => {
    if (!state.active || state.currentId === "") {
      return;
    }
    const nodeId = state.currentId;
    if (Object.prototype.hasOwnProperty.call(bodies, nodeId) || requestedBodies.current.has(nodeId)) {
      return;
    }
    requestedBodies.current.add(nodeId);
    requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(nodeId)}`)
      .then((document_) => {
        setBodies((previous) => ({ ...previous, [nodeId]: document_.body }));
      })
      .catch(() => {
        setBodies((previous) => ({ ...previous, [nodeId]: "" }));
      });
  }, [state.active, state.currentId, bodies]);

  const exit = useCallback(() => {
    setState((previous) => {
      if (previous.active) {
        callbacksRef.current.onExit?.(previous.currentId);
      }
      return initialPresentationState();
    });
  }, []);

  // Active-mode keys: escape exits, arrows navigate siblings/branches.
  useEffect(() => {
    if (!state.active) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          event.preventDefault();
          exit();
          break;
        case "ArrowRight":
          event.preventDefault();
          run({ type: "followHighlighted" });
          break;
        case "ArrowLeft":
          event.preventDefault();
          run({ type: "goBack" });
          break;
        case "ArrowUp":
          event.preventDefault();
          run({ type: "previousSibling" });
          break;
        case "ArrowDown":
          event.preventDefault();
          run({ type: "nextSibling" });
          break;
        case "Enter":
          event.preventDefault();
          callbacksRef.current.onOpenDocument?.(state.currentId);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.active, state.currentId, exit, run]);

  // "p" enters when the graph surface owns attention and nothing is typing.
  useEffect(() => {
    if (!entryEnabled || data === null || state.active) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "p" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isTextEntryTarget(event.target)) {
        return;
      }
      event.preventDefault();
      run({ type: "enter", startId: startNodeId ?? undefined });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [entryEnabled, data, state.active, startNodeId, run]);

  const nodesById = useMemo(() => {
    const index = new Map<string, PresentationGraph["nodes"][number]>();
    for (const node of graph.nodes) {
      index.set(node.id, node);
    }
    return index;
  }, [graph]);

  const enterManually = useCallback(() => {
    run({ type: "enter", startId: startNodeId ?? undefined });
  }, [run, startNodeId]);

  return { state, bodies, nodesById, enter: enterManually, exit, run };
}
