import { describe, expect, it } from "vitest";

import {
  buildOrderedPresentationGraph,
  firstPresentationNodeId,
  initialPresentationState,
  presentationReducer,
  successorCandidates,
  type PresentationGraph,
} from "./presentationNavigation";
import type { GraphCanvasEdgePayload, GraphCanvasNodePayload } from "../types";

const node = (id: string, title = `Node ${id}`, y?: number): GraphCanvasNodePayload => ({
  id,
  type: "note",
  title,
  description: "",
  path: `${id}.md`,
  featureSlug: "",
  graph: "",
  positionPersisted: false,
  position: { x: 0, y: y ?? 0 },
});

const edge = (source: string, target: string, kind: "link" | "reference" = "link", context?: string): GraphCanvasEdgePayload => ({
  id: `${source}-${target}`,
  source,
  target,
  kind,
  context,
});

describe("successorCandidates", () => {
  it("preserves caller-supplied edge order and dedupes targets", () => {
    const g: PresentationGraph = {
      nodes: [node("a"), node("b"), node("c")],
      edges: [
        { source: "a", target: "c" },
        { source: "a", target: "b", context: "ctx" },
        { source: "a", target: "b" },
      ],
    };
    const candidates = successorCandidates(g, "a");
    expect(candidates.map((candidate) => candidate.id)).toEqual(["c", "b"]);
    // First-seen edge context per target is kept.
    expect(candidates[1].context).toBe("ctx");
  });

  it("skips edges to missing nodes", () => {
    const g: PresentationGraph = {
      nodes: [node("a")],
      edges: [{ source: "a", target: "ghost" }],
    };
    expect(successorCandidates(g, "a")).toEqual([]);
  });
});

describe("buildOrderedPresentationGraph", () => {
  it("orders link children topmost-first by canvas position", () => {
    const ordered = buildOrderedPresentationGraph(
      {
        nodes: [node("parent"), node("low", "Low child", 500), node("high", "High child", 100)],
        edges: [edge("parent", "low"), edge("parent", "high")],
      },
      {},
    );
    expect(successorCandidates(ordered, "parent").map((candidate) => candidate.id)).toEqual([
      "high",
      "low",
    ]);
  });

  it("orders referenced children by mention offset in the source body", () => {
    const ordered = buildOrderedPresentationGraph(
      {
        nodes: [
          node("src"),
          node("ref-late", "Late ref"),
          node("ref-early", "Early ref"),
          node("child", "Linked child"),
        ],
        edges: [
          edge("src", "ref-late", "reference"),
          edge("src", "ref-early", "reference"),
          edge("src", "child"),
        ],
      },
      { src: "Intro [[ref-early]] middle [[ref-late]] end" },
    );
    expect(successorCandidates(ordered, "src").map((candidate) => candidate.id)).toEqual([
      "child",
      "ref-early",
      "ref-late",
    ]);
  });

  it("falls back to title match for reference mentions", () => {
    const ordered = buildOrderedPresentationGraph(
      {
        nodes: [node("src"), node("r2", "Second topic"), node("r1", "First topic")],
        edges: [edge("src", "r2", "reference"), edge("src", "r1", "reference")],
      },
      { src: "See [[Second topic]] before [[First topic]]" },
    );
    expect(successorCandidates(ordered, "src").map((candidate) => candidate.id)).toEqual([
      "r2",
      "r1",
    ]);
  });

  it("keeps payload order for references until the source body is loaded", () => {
    const ordered = buildOrderedPresentationGraph(
      {
        nodes: [node("src"), node("r1"), node("r2")],
        edges: [edge("src", "r1", "reference"), edge("src", "r2", "reference")],
      },
      {},
    );
    expect(successorCandidates(ordered, "src").map((candidate) => candidate.id)).toEqual(["r1", "r2"]);
  });
});

function enter(g: PresentationGraph) {
  return presentationReducer(initialPresentationState(), { type: "enter" }, g);
}

describe("presentationReducer", () => {
  it("enters at a requested node or the first given node; empty graphs stay inactive", () => {
    const g: PresentationGraph = { nodes: [node("a"), node("b")], edges: [] };
    expect(enter(g).currentId).toBe("a");
    expect(presentationReducer(initialPresentationState(), { type: "enter", startId: "b" }, g).currentId).toBe("b");
    expect(enter({ nodes: [], edges: [] }).active).toBe(false);
  });

  it("down/up move between siblings; without a parent or siblings they are no-ops", () => {
    // p → x, y, z (canvas order given by edge order).
    const g: PresentationGraph = {
      nodes: [node("p"), node("x"), node("y"), node("z")],
      edges: [
        { source: "p", target: "y" },
        { source: "p", target: "x" },
        { source: "p", target: "z" },
      ],
    };

    let state = enter(g);

    // Root has no parent → up/down do nothing.
    state = presentationReducer(state, { type: "nextSibling" }, g);
    state = presentationReducer(state, { type: "previousSibling" }, g);
    expect(state.currentId).toBe("p");

    // Right into the first child; then down/up walk the siblings.
    state = presentationReducer(state, { type: "followHighlighted" }, g);
    expect(state.currentId).toBe("y");

    state = presentationReducer(state, { type: "nextSibling" }, g);
    expect(state.currentId).toBe("x");
    state = presentationReducer(state, { type: "previousSibling" }, g);
    expect(state.currentId).toBe("y");
    state = presentationReducer(state, { type: "nextSibling" }, g);
    state = presentationReducer(state, { type: "nextSibling" }, g);
    expect(state.currentId).toBe("z");
    // Clamped at the last sibling.
    state = presentationReducer(state, { type: "nextSibling" }, g);
    expect(state.currentId).toBe("z");
  });

  it("left returns to the topmost parent and no left at the root", () => {
    const g: PresentationGraph = {
      nodes: [
        node("low-parent", "Low parent", 500),
        node("high-parent", "High parent", 100),
        node("child"),
      ],
      edges: [
        { source: "low-parent", target: "child" },
        { source: "high-parent", target: "child" },
      ],
    };

    let state = enter(g);
    // Default entry is the first node in graph order; drill to child via
    // explicit start.
    state = presentationReducer(initialPresentationState(), { type: "enter", startId: "child" }, g);

    // Two parents: left goes to the topmost one on canvas.
    state = presentationReducer(state, { type: "goBack" }, g);
    expect(state.currentId).toBe("high-parent");
    expect(state.highlightIndex).toBe(0);

    // From high-parent (no parents): left does nothing.
    state = presentationReducer(state, { type: "goBack" }, g);
    expect(state.currentId).toBe("high-parent");

    // Highlight was restored to the child we came from.
    const fromTop = presentationReducer(
      initialPresentationState(),
      { type: "enter", startId: "high-parent" },
      g,
    );
    expect(fromTop.candidates.map((candidate) => candidate.id)).toEqual(["child"]);
    expect(fromTop.highlightIndex).toBe(0);
  });

  it("right with no children and up/down on a childless leaf are no-ops", () => {
    const g: PresentationGraph = {
      nodes: [node("solo")],
      edges: [],
    };
    let state = enter(g);
    state = presentationReducer(state, { type: "followHighlighted" }, g);
    state = presentationReducer(state, { type: "nextSibling" }, g);
    state = presentationReducer(state, { type: "previousSibling" }, g);
    state = presentationReducer(state, { type: "goBack" }, g);
    expect(state.currentId).toBe("solo");
  });

  it("graphUpdated refreshes candidates and recovers from deletion", () => {
    const g: PresentationGraph = {
      nodes: [node("a"), node("b"), node("c")],
      edges: [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ],
    };
    let state = enter(g);
    state = presentationReducer(state, { type: "followHighlighted" }, g);

    const updated: PresentationGraph = {
      nodes: [node("a"), node("b"), node("c")],
      edges: [{ source: "a", target: "b" }],
    };
    state = presentationReducer(state, { type: "graphUpdated" }, updated);
    expect(state.candidates).toEqual([]);

    const shrunk: PresentationGraph = {
      nodes: [node("a"), node("c")],
      edges: [{ source: "a", target: "c" }],
    };
    state = presentationReducer(state, { type: "graphUpdated" }, shrunk);
    expect(state.currentId).toBe("a");

    state = presentationReducer(state, { type: "graphUpdated" }, { nodes: [], edges: [] });
    expect(state.active).toBe(false);
  });

  it("exit resets to the initial state", () => {
    const g: PresentationGraph = {
      nodes: [node("a"), node("b")],
      edges: [{ source: "a", target: "b" }],
    };
    let state = enter(g);
    state = presentationReducer(state, { type: "followHighlighted" }, g);
    state = presentationReducer(state, { type: "exit" }, g);
    expect(state).toEqual(initialPresentationState());
  });
});
