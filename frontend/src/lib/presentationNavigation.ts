// Presentation-mode navigation state machine.
//
// Pure logic only — no React, no DOM — so traversal rules are unit-testable:
// successor candidates preserve caller-supplied order (the hook orders them
// by canvas position / page mention order), up/down move between connected
// siblings directly, right drills into the highlighted candidate, left pops
// a history stack, and deleted nodes fall back gracefully.

import type { GraphCanvasEdgePayload, GraphCanvasNodePayload } from "../types";

export type PresentationNode = Pick<
  GraphCanvasNodePayload,
  "id" | "type" | "title" | "description" | "status"
> & {
  /** Command nodes render their run string as the slide body. */
  run?: string;
  /** Canvas vertical position; lower values render higher ("topmost"). */
  y?: number;
};

export type PresentationEdge = Pick<GraphCanvasEdgePayload, "source" | "target"> & {
  context?: string;
  /** "link" for hard links, "reference" for inline [[…]] mentions. */
  kind?: string;
};

export type PresentationGraph = {
  nodes: PresentationNode[];
  /** Per-source adjacency already in display order. */
  edges: PresentationEdge[];
};

export type PresentationCandidate = {
  id: string;
  context?: string;
};

export type PresentationState = {
  active: boolean;
  currentId: string;
  /** Ordered candidate successors (children) of the current node. */
  candidates: PresentationCandidate[];
  /** Index into candidates of the highlighted successor (-1 when none). */
  highlightIndex: number;
  /**
   * Steps taken while presenting — drives the slide counter only; arrow
   * navigation is derived purely from the graph.
   */
  history: string[];
};

export type PresentationEvent =
  | { type: "enter"; startId?: string }
  | { type: "exit" }
  | { type: "followHighlighted" }
  | { type: "goBack" }
  | { type: "rotateHighlight"; direction: 1 | -1 }
  | { type: "nextSibling" }
  | { type: "previousSibling" }
  | { type: "graphUpdated" };

/**
 * Ordered successor candidates for a node: outbound edges deduplicated by
 * target (first-seen context kept), preserving the caller-supplied order —
 * the graph builder is responsible for canvas/mention ordering.
 */
export function successorCandidates(
  graph: PresentationGraph,
  nodeId: string,
): PresentationCandidate[] {
  const byTarget = new Map<string, PresentationCandidate>();
  const ordered: PresentationCandidate[] = [];
  for (const edge of graph.edges) {
    if (edge.source !== nodeId) {
      continue;
    }
    if (!graph.nodes.some((node) => node.id === edge.target)) {
      continue;
    }
    if (byTarget.has(edge.target)) {
      continue;
    }
    const candidate: PresentationCandidate = { id: edge.target, context: edge.context };
    byTarget.set(edge.target, candidate);
    ordered.push(candidate);
  }
  return ordered;
}

/** First node in given graph order — the default entry slide. */
export function firstPresentationNodeId(
  graph: PresentationGraph,
): string | null {
  return graph.nodes.length > 0 ? graph.nodes[0].id : null;
}

/**
 * Inbound source ids (parents) of a node, ordered topmost on the canvas
 * first (ascending y, ties by title). Multiple parents resolve to the first
 * entry when navigating back.
 */
export function inboundParentsOrdered(
  graph: PresentationGraph,
  nodeId: string,
): string[] {
  const sources = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.target === nodeId && graph.nodes.some((node) => node.id === edge.source)) {
      sources.add(edge.source);
    }
  }
  return Array.from(sources).sort((left, right) => {
    const leftNode = graph.nodes.find((node) => node.id === left)!;
    const rightNode = graph.nodes.find((node) => node.id === right)!;
    const yDelta = (leftNode.y ?? Number.MAX_SAFE_INTEGER) - (rightNode.y ?? Number.MAX_SAFE_INTEGER);
    if (yDelta !== 0) {
      return yDelta;
    }
    return leftNode.title.localeCompare(rightNode.title);
  });
}

function candidatesFor(graph: PresentationGraph, currentId: string): Pick<PresentationState, "candidates" | "highlightIndex"> {
  const candidates = successorCandidates(graph, currentId);
  return { candidates, highlightIndex: candidates.length > 0 ? 0 : -1 };
}

function indexOfCandidate(candidates: PresentationCandidate[], id: string): number {
  return candidates.findIndex((candidate) => candidate.id === id);
}

export function initialPresentationState(): PresentationState {
  return {
    active: false,
    currentId: "",
    candidates: [],
    highlightIndex: -1,
    history: [],
  };
}

export function presentationReducer(
  state: PresentationState,
  event: PresentationEvent,
  graph: PresentationGraph,
): PresentationState {
  switch (event.type) {
    case "enter": {
      const startId =
        event.startId && graph.nodes.some((node) => node.id === event.startId)
          ? event.startId
          : firstPresentationNodeId(graph);
      if (startId === null) {
        return state;
      }
      return {
        active: true,
        currentId: startId,
        history: [],
        ...candidatesFor(graph, startId),
      };
    }
    case "exit": {
      if (!state.active) {
        return state;
      }
      return initialPresentationState();
    }
    case "rotateHighlight": {
      if (state.candidates.length < 2) {
        return state;
      }
      const count = state.candidates.length;
      return {
        ...state,
        highlightIndex: (state.highlightIndex + event.direction + count) % count,
      };
    }
    case "followHighlighted": {
      // Right drills into the highlighted child; no children → no-op.
      const highlighted = state.candidates[state.highlightIndex];
      if (!highlighted) {
        return state;
      }
      return {
        ...state,
        currentId: highlighted.id,
        history: [...state.history, state.currentId],
        ...candidatesFor(graph, highlighted.id),
      };
    }
    case "nextSibling":
    case "previousSibling": {
      // Up/down walk siblings — the other children of our primary parent.
      // Without a parent or without siblings this is a no-op.
      if (!state.active) {
        return state;
      }
      const parent = inboundParentsOrdered(graph, state.currentId)[0];
      if (parent === undefined) {
        return state;
      }
      const siblingCandidates = successorCandidates(graph, parent);
      const myIndex = indexOfCandidate(siblingCandidates, state.currentId);
      if (myIndex === -1) {
        return state;
      }
      const nextIndex = myIndex + (event.type === "nextSibling" ? 1 : -1);
      if (nextIndex < 0 || nextIndex >= siblingCandidates.length) {
        return state;
      }
      return {
        ...state,
        currentId: siblingCandidates[nextIndex].id,
        history: [...state.history, state.currentId],
        ...candidatesFor(graph, siblingCandidates[nextIndex].id),
      };
    }
    case "goBack": {
      // Left returns to the parent; multiple parents resolve to the topmost
      // one on the canvas. No parent → no-op.
      if (!state.active) {
        return state;
      }
      const parent = inboundParentsOrdered(graph, state.currentId)[0];
      if (parent === undefined) {
        return state;
      }
      const next: PresentationState = {
        ...state,
        currentId: parent,
        history: [...state.history, state.currentId],
        ...candidatesFor(graph, parent),
      };
      // Keep the highlight on the child we came from so pressing right
      // re-enters the same branch.
      const returning = indexOfCandidate(next.candidates, state.currentId);
      if (returning >= 0) {
        next.highlightIndex = returning;
      }
      return next;
    }
    case "graphUpdated": {
      const currentExists = graph.nodes.some(
        (node) => node.id === state.currentId,
      );
      if (currentExists) {
        return { ...state, ...candidatesFor(graph, state.currentId) };
      }
      for (let depth = state.history.length - 1; depth >= 0; depth -= 1) {
        const candidateId = state.history[depth];
        if (graph.nodes.some((node) => node.id === candidateId)) {
          const restored: PresentationState = {
            ...state,
            currentId: candidateId,
            history: state.history.slice(0, depth),
          };
          return { ...restored, ...candidatesFor(graph, candidateId) };
        }
      }
      if (firstPresentationNodeId(graph) === null) {
        return initialPresentationState();
      }
      return presentationReducer(state, { type: "exit" }, graph);
    }
    default:
      return state;
  }
}

// ── Graph building: display order for successors ─────────────────────────

/**
 * Build the presentation graph with per-source successor ordering:
 *
 * - Hard-link children come first, ordered topmost on the canvas
 *   (ascending y, ties broken by title).
 * - Referenced children ([[inline]] mentions) follow, ordered by the
 *   character offset at which they are mentioned in the source page body
 *   (requires the source body to be loaded; unloaded sources keep payload
 *   order and re-sort once the body arrives).
 */
export function buildOrderedPresentationGraph(
  data: { nodes: GraphCanvasNodePayload[]; edges: GraphCanvasEdgePayload[] },
  bodies: Record<string, string>,
): PresentationGraph {
  const nodes: PresentationNode[] = data.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    title: node.title,
    description: node.description,
    status: node.status,
    y: node.position?.y,
  }));

  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const mentionOffset = (sourceId: string, targetId: string): number => {
    const body = bodies[sourceId];
    if (body === undefined) {
      return Number.MAX_SAFE_INTEGER;
    }
    const direct = body.indexOf(`[[${targetId}]]`);
    if (direct >= 0) {
      return direct;
    }
    const target = nodeById.get(targetId);
    if (target !== undefined) {
      const byTitle = body.indexOf(`[[${target.title}]]`);
      if (byTitle >= 0) {
        return byTitle;
      }
    }
    return Number.MAX_SAFE_INTEGER;
  };

  const edges: PresentationEdge[] = [];
  const seenPairs = new Set<string>();
  const addUnique = (edge: PresentationEdge) => {
    const key = `${edge.source}\u0000${edge.target}`;
    if (seenPairs.has(key)) {
      return;
    }
    seenPairs.add(key);
    edges.push(edge);
  };

  // Hard links first: group per source, sorted topmost (y) then title.
  const linkEdges = data.edges.filter((edge) => edge.kind !== "reference");
  const sourcesWithLinks = Array.from(new Set(linkEdges.map((edge) => edge.source)));
  for (const source of sourcesWithLinks) {
    const outgoing = linkEdges
      .filter((edge) => edge.source === source)
      .map((edge) => ({ edge, target: nodeById.get(edge.target) }))
      .filter((item) => item.target !== undefined)
      .sort((left, right) => {
        const yDelta = (left.target!.y ?? Number.MAX_SAFE_INTEGER) - (right.target!.y ?? Number.MAX_SAFE_INTEGER);
        if (yDelta !== 0) {
          return yDelta;
        }
        return left.target!.title.localeCompare(right.target!.title);
      });
    for (const { edge } of outgoing) {
      addUnique({ source: edge.source, target: edge.target, context: edge.context, kind: "link" });
    }
  }

  // References next: grouped per source, ordered by mention offset in body.
  const referenceEdges = data.edges.filter((edge) => edge.kind === "reference");
  const sourcesWithRefs = Array.from(new Set(referenceEdges.map((edge) => edge.source)));
  for (const source of sourcesWithRefs) {
    const outgoing = referenceEdges
      .filter((edge) => edge.source === source && nodeById.has(edge.target))
      .map((edge) => ({ edge, offset: mentionOffset(source, edge.target) }))
      .sort((left, right) =>
        left.offset !== right.offset
          ? left.offset - right.offset
          : left.edge.target.localeCompare(right.edge.target),
      );
    for (const { edge } of outgoing) {
      addUnique({ source: edge.source, target: edge.target, context: edge.context, kind: "reference" });
    }
  }

  return { nodes, edges };
}
