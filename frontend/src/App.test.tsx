import { ThemeProvider } from "./lib/theme";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./WysiwygEditor", () => ({
  WysiwygEditor: ({ ariaLabel, value, onChange }: { ariaLabel: string; value: string; onChange: (value: string) => void }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock("@xyflow/react", async () => {
  const React = await import("react");

  return {
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    ReactFlow: ({ nodes, onNodeClick, onNodeDoubleClick, onNodeDragStop, onPaneClick, onMoveEnd }: any) => (
      <div data-testid="react-flow-mock">
        {nodes.map((node: any) => (
          <div key={node.id} data-testid={`flow-node-${node.id}`}>
            <span>{node.data.title}</span>
            <button type="button" onClick={() => onNodeClick?.({}, node)}>
              Select {node.id}
            </button>
            <button type="button" onDoubleClick={() => onNodeDoubleClick?.({}, node)}>
              Open {node.id}
            </button>
            <button
              type="button"
              onClick={() =>
                onNodeDragStop?.({}, {
                  ...node,
                  position: { x: 446, y: 200 },
                })
              }
            >
              Drag stop {node.id}
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onPaneClick?.()}>
          Clear selection
        </button>
        <button type="button" onClick={() => onMoveEnd?.()}>
          Move end
        </button>
      </div>
    ),
    Background: () => <div data-testid="flow-background" />,
    Controls: () => <div data-testid="flow-controls" />,
    useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    applyNodeChanges: (_changes: unknown, nodes: unknown) => nodes,
    getSmoothStepPath: () => ["M0 0", 0, 0],
    MarkerType: { ArrowClosed: "arrowclosed" },
    Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
  };
});

import { App } from "./App";

type MockResponseOptions = {
  status?: number;
};

type MockFetchHandler = (url: string, init?: RequestInit) => unknown | Promise<unknown>;

const workspaceResponse = {
  scope: "local",
  workspacePath: "/tmp/flow-workspace",
  flowPath: "/tmp/flow-workspace/.flow",
  configPath: "/tmp/flow-workspace/.flow/config/config.toml",
  indexPath: "/tmp/flow-workspace/.flow/config/flow.index",
  homePath: "data/home.md",
  guiPort: 4812,
  appearance: "system" as const,
  panelWidths: { leftRatio: 0.31, rightRatio: 0.22, documentTOCRatio: 0.18 },
};

const homeResponse = {
  id: "home",
  type: "home",
  title: "Home",
  description: "",
  path: "data/home.md",
  body: "# Home\n",
};

const emptyGraphLists = {
  notes: { type: "note", availableGraphs: [], graphItems: {} },
  tasks: { type: "task", availableGraphs: [], graphItems: {} },
  commands: { type: "command", availableGraphs: [], graphItems: {} },
};

const graphTreeResponse = {
  home: homeResponse,
  graphs: [
    {
      graphPath: "execution",
      displayName: "Execution",
      directCount: 1,
      totalCount: 1,
      hasChildren: false,
      countLabel: "1 direct / 1 total",
      files: [
        {
          id: "note-1",
          type: "note",
          title: "Overview",
          path: "data/graphs/execution/overview.md",
          fileName: "overview.md",
        },
      ],
    },
  ],
};

function noteGraphs(...paths: string[]) {
  return {
    type: "note",
    availableGraphs: paths,
    graphItems: Object.fromEntries(paths.map((p) => [p, []])),
  };
}

function jsonResponse(body: unknown, options?: MockResponseOptions): Response {
  return new Response(JSON.stringify(body), {
    status: options?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetchMock(handler: MockFetchHandler) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url === "/api/calendar-documents") {
      return jsonResponse([]);
    }

    const result = await handler(url, init);

    if (result instanceof Response) {
      return result;
    }

    return jsonResponse(result);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function createDeferredValue<T>() {
  let resolve: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });

  return {
    promise,
    resolve(value: T) {
      resolve?.(value);
    },
  };
}

function getRequestBody(fetchMock: ReturnType<typeof vi.fn>, path: string, method: string): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(([url, init]) => {
    const requestURL = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    return requestURL === path && (init?.method ?? "GET") === method;
  });

  if (call === undefined) {
    throw new Error(`missing ${method} ${path} request`);
  }

  const body = call[1]?.body;
  if (typeof body !== "string") {
    throw new Error(`expected string body for ${method} ${path}`);
  }

  return JSON.parse(body) as Record<string, unknown>;
}

describe("App graph canvas flows", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(1_717_171_717_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens graph documents as thread roots in the center view and persists snapped drag-end positions", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
        {
          id: "note-2",
          type: "note",
          graph: "execution",
          title: "Follow-up",
          description: "Follow-up notes",
          path: "data/graphs/execution/follow-up.md",
          featureSlug: "execution",
          position: { x: 480, y: 220 },
          positionPersisted: false,
        },
      ],
      edges: [
        {
          id: "link:note-2:note-1",
          source: "note-2",
          target: "note-1",
          kind: "link",
          context: "captures follow-up work",
        },
      ],
    };
    const documentResponse = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "Execution overview",
      path: "data/graphs/execution/overview.md",
      tags: [],
      body: "Overview body\n",
      links: [],
      relatedNoteIds: [],
    };

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        if ((init?.method ?? "GET") === "PUT") {
          return workspaceResponse;
        }

        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      if (url === "/api/documents/note-1") {
        return documentResponse;
      }

      if (url === "/api/graph-layout" && init?.method === "PUT") {
        return {
          graph: "execution",
          positions: [{ documentId: "note-1", x: 460, y: 200 }],
        };
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");

    await user.click(screen.getByRole("button", { name: "Drag stop note-1" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/graph-layout",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            graph: "execution",
            positions: [{ documentId: "note-1", x: 460, y: 200 }],
          }),
        }),
      );
    });

    await user.dblClick(screen.getByRole("button", { name: "Open note-1" }));
    const documentLayout = await screen.findByLabelText("Document content layout");
    expect(within(documentLayout).getByText("Overview body")).toBeInTheDocument();
    expect(screen.queryByLabelText("Graph node document")).not.toBeInTheDocument();
  });

  it("toggles between horizontal and user-adjusted canvas layouts", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
        {
          id: "note-2",
          type: "note",
          graph: "execution",
          title: "Follow-up",
          description: "Follow-up notes",
          path: "data/graphs/execution/follow-up.md",
          featureSlug: "execution",
          position: { x: 480, y: 220 },
          positionPersisted: false,
        },
      ],
      edges: [
        {
          id: "link:note-1:note-2",
          source: "note-1",
          target: "note-2",
          kind: "link",
          context: "tracks follow-up",
        },
      ],
    };

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        if ((init?.method ?? "GET") === "PUT") {
          return workspaceResponse;
        }

        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      if (url === "/api/graph-layout" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as { graph: string; positions: Array<{ documentId: string; x: number; y: number }> };
        return {
          graph: body.graph,
          positions: body.positions,
        };
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");

    const horizontalToggle = screen.getByRole("button", { name: "Switch to horizontal layout" });
    expect(horizontalToggle).toHaveAttribute("aria-pressed", "false");

    await user.click(horizontalToggle);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Switch to user-adjusted layout" })).toHaveAttribute("aria-pressed", "true");
    });

    await user.click(screen.getByRole("button", { name: "Switch to user-adjusted layout" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Switch to horizontal layout" })).toHaveAttribute("aria-pressed", "false");
    });

    const layoutWriteCalls = fetchMock.mock.calls.filter(([url, init]) => {
      const requestURL = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      return requestURL === "/api/graph-layout" && (init?.method ?? "GET") === "PUT";
    });
    expect(layoutWriteCalls).toHaveLength(0);
  });

  it("searches graph canvas nodes by title", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
        {
          id: "note-2",
          type: "note",
          graph: "execution",
          title: "Follow-up",
          description: "Follow-up notes",
          path: "data/graphs/execution/follow-up.md",
          featureSlug: "execution",
          position: { x: 480, y: 220 },
          positionPersisted: false,
        },
        {
          id: "note-3",
          type: "note",
          graph: "execution",
          title: "Follow-on",
          description: "Follow-on notes",
          path: "data/graphs/execution/follow-on.md",
          featureSlug: "execution",
          position: { x: 720, y: 260 },
          positionPersisted: false,
        },
      ],
      edges: [],
    };

    installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        if ((init?.method ?? "GET") === "PUT") {
          return workspaceResponse;
        }
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");

    const searchInput = screen.getByRole("searchbox", { name: "Search graph nodes" });
    await user.type(searchInput, "follow");
    await user.click(screen.getByRole("button", { name: "Next matching node" }));

    await waitFor(() => {
      expect(document.querySelector('[data-nodeid="note-2"] .graph-canvas-node-selected')).not.toBeNull();
    });

    await user.click(searchInput);
    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      expect(document.querySelector('[data-nodeid="note-3"] .graph-canvas-node-selected')).not.toBeNull();
    });

    await user.keyboard("{ArrowUp}");

    await waitFor(() => {
      expect(document.querySelector('[data-nodeid="note-2"] .graph-canvas-node-selected')).not.toBeNull();
    });
  });

  it("opens an inline edge toolbar and saves relationship tags/context metadata", async () => {
    let edgeContext = "tracks follow-up";
    let edgeRelationships = ["depends_on"];

    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
        {
          id: "note-2",
          type: "note",
          graph: "execution",
          title: "Follow-up",
          description: "Follow-up notes",
          path: "data/graphs/execution/follow-up.md",
          featureSlug: "execution",
          position: { x: 480, y: 220 },
          positionPersisted: false,
        },
      ],
      edges: [
        {
          id: "link:note-1:note-2",
          source: "note-1",
          target: "note-2",
          kind: "link",
          context: edgeContext,
          relationships: edgeRelationships,
        },
      ],
    };

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        if ((init?.method ?? "GET") === "PUT") {
          return workspaceResponse;
        }

        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return {
          ...graphCanvasResponse,
          edges: [
            {
              ...graphCanvasResponse.edges[0],
              context: edgeContext,
              relationships: edgeRelationships,
            },
          ],
        };
      }

      if (url === "/api/links" && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as { context: string; relationships: string[] };
        edgeContext = body.context;
        edgeRelationships = body.relationships;

        return {
          id: "note-1",
          type: "note",
          featureSlug: "execution",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          body: "Overview body\n",
          links: [{ node: "note-2", context: edgeContext, relationships: edgeRelationships }],
          relatedNoteIds: [],
        };
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");

    const edgeHitArea = document.querySelector('path[pointer-events="stroke"]');
    if (edgeHitArea === null) {
      throw new Error("missing edge hit area");
    }

    fireEvent.click(edgeHitArea);

    await screen.findByLabelText("Add relationship tag");
    const addRelationshipTagInput = screen.getByLabelText("Add relationship tag");
    const contextInput = screen.getByLabelText("Edge context");
    await user.clear(addRelationshipTagInput);
    await user.type(addRelationshipTagInput, "blocks");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.clear(contextInput);
    await user.type(contextInput, "runtime dependency");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/links",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            fromId: "note-1",
            toId: "note-2",
            context: "runtime dependency",
            relationships: ["depends_on", "blocks"],
          }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    await waitFor(() => {
      expect(screen.queryByLabelText("Add relationship tag")).toBeNull();
    });
  });

  it("persists viewport on move end through graph-layout API", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
      ],
      edges: [],
    };

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        if ((init?.method ?? "GET") === "PUT") {
          return workspaceResponse;
        }
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      if (url === "/api/graph-layout" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as { graph: string; viewport?: { x: number; y: number; zoom: number }; positions: Array<unknown> };
        return {
          graph: body.graph,
          positions: body.positions,
          viewport: body.viewport,
        };
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");
    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");

    await user.click(screen.getByRole("button", { name: "Move end" }));

    await waitFor(() => {
      const body = getRequestBody(fetchMock, "/api/graph-layout", "PUT");
      expect(body.graph).toBe("execution");
      expect(body.positions).toEqual([]);
      expect(body.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });
  });

  it("renders dotted reference edges and circular cross-graph reference targets on the canvas", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution", "release"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
        {
          id: "note-3",
          type: "note",
          shape: "circle",
          graph: "release",
          title: "Launch",
          description: "",
          path: "data/graphs/release/launch.md",
          featureSlug: "release",
          position: { x: 460, y: 120 },
          positionPersisted: false,
        },
      ],
      edges: [
        {
          id: "reference:note-1:note-3",
          source: "note-1",
          target: "note-3",
          kind: "reference",
          context: "release > Launch",
        },
      ],
    };
    const documentResponse = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "Execution overview",
      path: "data/graphs/execution/overview.md",
      tags: [],
      body: "Overview body\n",
      links: [],
      relatedNoteIds: [],
    };

    installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        if ((init?.method ?? "GET") === "PUT") {
          return workspaceResponse;
        }

        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution", "release");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      if (url === "/api/documents/note-1") {
        return documentResponse;
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");

    expect(document.querySelector('[data-nodeid="note-3"] .graph-canvas-node-circle')).not.toBeNull();
    expect(document.querySelector('.graph-canvas-overlay svg path[stroke-dasharray="6 4"]')).not.toBeNull();
  });

  it("follows inline references by appending and replacing thread panels", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
        {
          id: "note-2",
          type: "note",
          graph: "execution",
          title: "Follow-up",
          description: "Follow-up notes",
          path: "data/graphs/execution/follow-up.md",
          featureSlug: "execution",
          position: { x: 480, y: 220 },
          positionPersisted: false,
        },
        {
          id: "note-3",
          type: "note",
          graph: "execution",
          title: "Third note",
          description: "Third node",
          path: "data/graphs/execution/third-note.md",
          featureSlug: "execution",
          position: { x: 720, y: 320 },
          positionPersisted: false,
        },
      ],
      edges: [],
    };
    const noteOneResponse = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "Execution overview",
      path: "data/graphs/execution/overview.md",
      tags: [],
      body: "See [[note-2]] and [[note-3]]\n",
      links: [],
      relatedNoteIds: [],
      inlineReferences: [
        {
          token: "[[note-2]]",
          raw: "note-2",
          targetId: "note-2",
          targetType: "note",
          targetGraph: "execution",
          targetTitle: "Follow-up",
          targetPath: "data/graphs/execution/follow-up.md",
          targetBreadcrumb: "execution > Follow-up",
        },
        {
          token: "[[note-3]]",
          raw: "note-3",
          targetId: "note-3",
          targetType: "note",
          targetGraph: "execution",
          targetTitle: "Third note",
          targetPath: "data/graphs/execution/third-note.md",
          targetBreadcrumb: "execution > Third note",
        },
      ],
    };
    const noteTwoResponse = {
      id: "note-2",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Follow-up",
      description: "Follow-up notes",
      path: "data/graphs/execution/follow-up.md",
      tags: [],
      body: "Follow up body\n",
      links: [],
      relatedNoteIds: [],
      inlineReferences: [],
    };
    const noteThreeResponse = {
      id: "note-3",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Third note",
      description: "Third node",
      path: "data/graphs/execution/third-note.md",
      tags: [],
      body: "Third body\n",
      links: [],
      relatedNoteIds: [],
      inlineReferences: [],
    };

    installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        if ((init?.method ?? "GET") === "PUT") {
          return workspaceResponse;
        }

        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      if (url === "/api/documents/note-1") {
        return noteOneResponse;
      }

      if (url === "/api/documents/note-2") {
        return noteTwoResponse;
      }

      if (url === "/api/documents/note-3") {
        return noteThreeResponse;
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");
    await user.dblClick(screen.getByRole("button", { name: "Open note-1" }));

    const thread = await screen.findByLabelText("Document thread");
    await waitFor(() => {
      expect(within(thread).getByLabelText("Document title")).toHaveValue("Overview");
    });
    expect(within(thread).queryByText("[[note-2]]")).not.toBeInTheDocument();

    const referenceLink = within(thread).getByRole("link", { name: "Follow-up" });
    await user.click(referenceLink);

    await waitFor(() => {
      expect(within(thread).getByLabelText("Document title")).toHaveValue("Follow-up");
    });
    expect(await within(thread).findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(await within(thread).findByText("Follow up body")).toBeInTheDocument();

    const replacementLink = within(thread).getByRole("link", { name: "Third note" });
    fireEvent.click(replacementLink);

    await waitFor(() => {
      expect(within(thread).getByRole("button", { name: "Close thread from Third note" })).toBeInTheDocument();
    }, { timeout: 3000 });
    const activeThirdPanel = within(thread).getByLabelText("Active thread document Third note");
    expect(within(activeThirdPanel).getByLabelText("Document title")).toHaveValue("Third note");
    expect(within(thread).queryByText("Follow up body")).not.toBeInTheDocument();
    expect(await within(thread).findByText("Third body")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close thread from Third note" }));

    await waitFor(() => {
      expect(within(thread).getByLabelText("Document title")).toHaveValue("Overview");
    });
    expect(within(thread).queryByText("Third body")).not.toBeInTheDocument();
  });

  it("shows a loading tail instead of stale content while following a delayed thread reference", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 240, y: 140 },
          positionPersisted: false,
        },
      ],
      edges: [],
    };

    const noteOneResponse = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "Execution overview",
      path: "data/graphs/execution/overview.md",
      tags: [],
      body: "See [[note-3]]\n",
      links: [],
      relatedNoteIds: [],
      inlineReferences: [
        {
          token: "[[note-3]]",
          raw: "note-3",
          targetId: "note-3",
          targetType: "note",
          targetGraph: "execution",
          targetTitle: "Third note",
          targetPath: "data/graphs/execution/third-note.md",
          targetBreadcrumb: "execution > Third note",
        },
      ],
    };
    const noteThreeResponse = {
      id: "note-3",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Third note",
      description: "Third node",
      path: "data/graphs/execution/third-note.md",
      tags: [],
      body: "Third body\n",
      links: [],
      relatedNoteIds: [],
      inlineReferences: [],
    };
    const delayedNoteThree = createDeferredValue<typeof noteThreeResponse>();

    installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        if ((init?.method ?? "GET") === "PUT") {
          return workspaceResponse;
        }

        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      if (url === "/api/documents/note-1") {
        return noteOneResponse;
      }

      if (url === "/api/documents/note-3") {
        return delayedNoteThree.promise;
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");
    await user.dblClick(screen.getByRole("button", { name: "Open note-1" }));

    const thread = await screen.findByLabelText("Document thread");
    await waitFor(() => {
      expect(within(thread).getByLabelText("Document title")).toHaveValue("Overview");
    });
    await user.click(await within(thread).findByRole("link", { name: "Third note" }));

    expect(await within(thread).findByText("Loading document content.")).toBeInTheDocument();
    expect(within(thread).queryByDisplayValue("Overview")).not.toBeInTheDocument();

    delayedNoteThree.resolve(noteThreeResponse);

    await waitFor(() => {
      expect(within(thread).getByLabelText("Document title")).toHaveValue("Third note");
    });
    expect(within(thread).queryByText("Loading document content.")).not.toBeInTheDocument();
    expect(await within(thread).findByText("Third body")).toBeInTheDocument();
  });

  it("lets an earlier thread panel become the active editor and save its edits", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 240, y: 140 },
          positionPersisted: false,
        },
      ],
      edges: [],
    };

    const noteOneResponse = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "Execution overview",
      path: "data/graphs/execution/overview.md",
      tags: [],
      body: "See [[note-2]]\n",
      links: [],
      relatedNoteIds: [],
      inlineReferences: [
        {
          token: "[[note-2]]",
          raw: "note-2",
          targetId: "note-2",
          targetType: "note",
          targetGraph: "execution",
          targetTitle: "Follow-up",
          targetPath: "data/graphs/execution/follow-up.md",
          targetBreadcrumb: "execution > Follow-up",
        },
      ],
    };

    const noteTwoResponse = {
      id: "note-2",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Follow-up",
      description: "Follow up thread",
      path: "data/graphs/execution/follow-up.md",
      tags: [],
      body: "Follow up body\n",
      links: [],
      relatedNoteIds: [],
      inlineReferences: [],
    };

    const updatedNoteOneResponse = {
      ...noteOneResponse,
      title: "Overview revised",
    };

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      if (url === "/api/documents/note-1") {
        if ((init?.method ?? "GET") === "PUT") {
          return updatedNoteOneResponse;
        }

        return noteOneResponse;
      }

      if (url === "/api/documents/note-2") {
        return noteTwoResponse;
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");
    await user.dblClick(screen.getByRole("button", { name: "Open note-1" }));

    const thread = await screen.findByLabelText("Document thread");
    await waitFor(() => {
      expect(within(thread).getByLabelText("Document title")).toHaveValue("Overview");
    });

    await user.click(within(thread).getByRole("link", { name: "Follow-up" }));

    await waitFor(() => {
      expect(within(thread).getByLabelText("Document title")).toHaveValue("Follow-up");
    });

    await user.click(screen.getByLabelText("Thread document Overview"));

    await waitFor(() => {
      expect(within(thread).getByLabelText("Document title")).toHaveValue("Overview");
    });

    vi.useFakeTimers();
    await act(async () => {
      fireEvent.change(within(thread).getByLabelText("Document title"), { target: { value: "Overview revised" } });
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(getRequestBody(fetchMock, "/api/documents/note-1", "PUT")).toMatchObject({
      title: "Overview revised",
    });
    expect(within(thread).getByLabelText("Document title")).toHaveValue("Overview revised");
  });

  it("does not reload the shell during document autosave while editing", async () => {
    const documentResponse = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "Execution overview",
      path: "data/content/execution/overview.md",
      tags: [],
      body: "Overview body\n",
      links: [],
      relatedNoteIds: [],
    };

    const updatedDocumentResponse = {
      ...documentResponse,
      title: "Overview updated",
    };

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/documents/note-1") {
        if ((init?.method ?? "GET") === "PUT") {
          return updatedDocumentResponse;
        }

        return documentResponse;
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    const fileButton = (await screen.findByText("overview.md")).closest('[data-sidebar="menu-sub-button"]');
    if (fileButton === null) {
      throw new Error("missing overview file button");
    }

    await user.click(fileButton);

    const titleInput = await screen.findByRole("textbox", { name: "Document title" });
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: "Overview updated" } });
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/note-1",
      expect.objectContaining({
        method: "PUT",
      }),
    );

    const workspaceRequests = fetchMock.mock.calls.filter(([url, init]) => {
      const requestURL = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      return requestURL === "/api/workspace" && (init?.method ?? "GET") === "GET";
    });
    const graphRequests = fetchMock.mock.calls.filter(([url, init]) => {
      const requestURL = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      return requestURL === "/api/graphs" && (init?.method ?? "GET") === "GET";
    });

    expect(workspaceRequests).toHaveLength(1);
    expect(graphRequests).toHaveLength(1);
    expect(titleInput).toHaveValue("Overview updated");
  });

  it("saves pending document edits before switching to another node", async () => {
    const graphTreeWithTwoFiles = {
      ...graphTreeResponse,
      graphs: [
        {
          ...graphTreeResponse.graphs[0],
          files: [
            graphTreeResponse.graphs[0].files[0],
            {
              id: "note-2",
              type: "note",
              title: "Follow Up",
              path: "data/graphs/execution/follow-up.md",
              fileName: "follow-up.md",
            },
          ],
        },
      ],
    };
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
        {
          id: "note-2",
          type: "note",
          graph: "execution",
          title: "Follow Up",
          description: "Execution follow-up",
          path: "data/graphs/execution/follow-up.md",
          featureSlug: "execution",
          position: { x: 460, y: 120 },
          positionPersisted: false,
        },
      ],
      edges: [],
    };

    let noteOne = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "Execution overview",
      path: "data/graphs/execution/overview.md",
      tags: [],
      body: "Overview body\n",
      links: [],
      relatedNoteIds: [],
    };
    const noteTwo = {
      id: "note-2",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Follow Up",
      description: "Execution follow-up",
      path: "data/graphs/execution/follow-up.md",
      tags: [],
      body: "Follow up body\n",
      links: [],
      relatedNoteIds: [],
    };

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeWithTwoFiles;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      if (url === "/api/documents/note-1" && (init?.method ?? "GET") === "PUT") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { title: string };
        noteOne = {
          ...noteOne,
          title: body.title,
        };
        return noteOne;
      }

      if (url === "/api/documents/note-1") {
        return noteOne;
      }

      if (url === "/api/documents/note-2") {
        return noteTwo;
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    const overviewButton = (await screen.findByText("overview.md")).closest('[data-sidebar="menu-sub-button"]');
    if (overviewButton === null) {
      throw new Error("missing overview file button");
    }

    await user.click(overviewButton);

    const titleInput = await screen.findByRole("textbox", { name: "Document title" });
    fireEvent.change(titleInput, { target: { value: "Overview updated" } });

    const followUpButton = (await screen.findByText("follow-up.md")).closest('[data-sidebar="menu-sub-button"]');
    if (followUpButton === null) {
      throw new Error("missing follow-up file button");
    }

    await user.click(followUpButton);

    await waitFor(() => {
      expect(getRequestBody(fetchMock, "/api/documents/note-1", "PUT")).toMatchObject({
        title: "Overview updated",
      });
    });

    await screen.findByText("Follow up body");

    await user.click(overviewButton);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Document title" })).toHaveValue("Overview updated");
    });
  });

  it("shows a document icon after node selection and opens a thread root from it", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
        {
          id: "note-2",
          type: "note",
          graph: "execution",
          title: "Details",
          description: "Execution details",
          path: "data/graphs/execution/details.md",
          featureSlug: "execution",
          position: { x: 460, y: 120 },
          positionPersisted: false,
        },
      ],
      edges: [],
    };
    const note1DocumentResponse = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "Execution overview",
      path: "data/graphs/execution/overview.md",
      tags: [],
      body: "## Overview body\n\n### Details\n",
      links: [],
      relatedNoteIds: [],
    };
    const note2DocumentResponse = {
      id: "note-2",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Details",
      description: "Execution details",
      path: "data/graphs/execution/details.md",
      tags: [],
      body: "Details body\n",
      links: [],
      relatedNoteIds: [],
    };

    let persistedWorkspace = workspaceResponse;
    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        if ((init?.method ?? "GET") === "PUT") {
          const body = JSON.parse(String(init?.body ?? "{}")) as { panelWidths: typeof workspaceResponse.panelWidths };
          persistedWorkspace = { ...workspaceResponse, panelWidths: body.panelWidths };
          return persistedWorkspace;
        }

        return persistedWorkspace;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      if (url === "/api/documents/note-1") {
        return note1DocumentResponse;
      }

      if (url === "/api/documents/note-2") {
        return note2DocumentResponse;
      }

      throw new Error(`Unhandled request: GET ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");

    expect(screen.queryByRole("button", { name: "Document" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select note-1" }));

    const iconStrip = document.querySelector(".right-sidebar-icons");
    if (!(iconStrip instanceof HTMLElement)) {
      throw new Error("missing right sidebar icon strip");
    }

    const iconButtons = within(iconStrip).getAllByRole("button");
    expect(iconButtons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Settings",
      "Search",
      "Calendar",
      "Document",
    ]);

    await user.click(screen.getByRole("button", { name: "Document" }));
    const documentLayout = await screen.findByLabelText("Document content layout");
    expect(documentLayout).toBeInTheDocument();
    expect(within(screen.getByLabelText("Document body editor")).getByRole("heading", { name: "Overview body", level: 2 })).toBeInTheDocument();
    expect(screen.queryByLabelText("Graph node document panel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close thread from Overview" }));
    await screen.findByTestId("flow-node-note-2");

    await user.click(screen.getByRole("button", { name: "Select note-2" }));
    await user.click(screen.getByRole("button", { name: "Document" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Right pane")).toHaveAttribute("data-focus", "false");
    });

    expect(await screen.findByDisplayValue("Details")).toBeInTheDocument();
    expect(screen.getByText("Details body")).toBeInTheDocument();
  });

  it("allows ctrl-click multi-select to enable merge actions", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
        {
          id: "note-2",
          type: "note",
          graph: "execution",
          title: "Follow Up",
          description: "Execution follow-up",
          path: "data/graphs/execution/follow-up.md",
          featureSlug: "execution",
          position: { x: 460, y: 120 },
          positionPersisted: false,
        },
      ],
      edges: [],
    };

    installFetchMock((url) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      throw new Error(`Unhandled request: GET ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");

    const firstNode = document.querySelector('[data-nodeid="note-1"]');
    const secondNode = document.querySelector('[data-nodeid="note-2"]');
    if (!(firstNode instanceof HTMLElement) || !(secondNode instanceof HTMLElement)) {
      throw new Error("missing graph overlay nodes");
    }

    fireEvent.click(firstNode, { ctrlKey: true });
    fireEvent.click(secondNode, { ctrlKey: true });

    expect(await screen.findByText("2 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Merge" })).toBeInTheDocument();
  });

  it("opens a sidebar file in the center pane on single click and keeps it open when calendar is toggled", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
      ],
      edges: [],
    };
    const documentResponse = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "Execution overview",
      path: "data/graphs/execution/overview.md",
      tags: [],
      body: "Overview body\n",
      links: [],
      relatedNoteIds: [],
    };

    installFetchMock((url) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      if (url === "/api/documents/note-1") {
        return documentResponse;
      }

      throw new Error(`Unhandled request: GET ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");

    const fileButton = (await screen.findByText("overview.md")).closest('[data-sidebar="menu-sub-button"]');
    if (fileButton === null) {
      throw new Error("missing overview file button");
    }

    expect(within(fileButton).queryByText("Overview")).not.toBeInTheDocument();

    await user.click(fileButton);
    expect(await screen.findByLabelText("Document content layout")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Document title" })).toHaveValue("Overview");
    expect(screen.queryByLabelText("Graph node document")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Document" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close document" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete document" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Calendar" }));
    expect(await screen.findByText("No entries for this day.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Document" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Calendar" }));
    expect(await screen.findByText("Overview body")).toBeInTheDocument();
    expect(screen.queryByText("No entries for this day.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Document" })).not.toBeInTheDocument();
  });

  it("lets a graph with direct files collapse and expand its file list", async () => {
    installFetchMock((url) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      throw new Error(`Unhandled request: GET ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    const graphRow = (await screen.findByText("Execution")).closest("li");
    if (graphRow === null) {
      throw new Error("missing execution graph row");
    }

    await screen.findByText("overview.md");

    await user.click(within(graphRow).getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("overview.md")).not.toBeInTheDocument();

    await user.click(within(graphRow).getByRole("button", { name: "Expand" }));
    expect(await screen.findByText("overview.md")).toBeInTheDocument();
  });

  it("renames a graph from the content tree", async () => {
    let currentGraphTree = graphTreeResponse;

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return currentGraphTree;
      }

      if (url === "/api/graphs/execution" && (init?.method ?? "GET") === "PATCH") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { name: string };
        currentGraphTree = {
          ...graphTreeResponse,
          graphs: [
            {
              ...graphTreeResponse.graphs[0],
              graphPath: body.name,
              displayName: "Shipping",
            },
          ],
        };
        return { name: body.name };
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Execution");

    await user.click(screen.getByRole("button", { name: "More actions for Execution" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));

    const input = await screen.findByLabelText("Graph path");
    await user.clear(input);
    await user.type(input, "shipping");
    await user.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => {
      expect(getRequestBody(fetchMock, "/api/graphs/execution", "PATCH")).toEqual({ name: "shipping" });
    });

    expect(await screen.findByText("Shipping")).toBeInTheDocument();
  });

  it("renames a node from the content tree", async () => {
    let currentGraphTree = graphTreeResponse;
    const renamedDocumentResponse = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "",
      path: "data/content/execution/summary.md",
      body: "Overview body",
      links: [],
      relatedNoteIds: [],
    };

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return currentGraphTree;
      }

      if (url === "/api/documents/note-1" && (init?.method ?? "GET") === "PUT") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { fileName: string };
        currentGraphTree = {
          ...graphTreeResponse,
          graphs: [
            {
              ...graphTreeResponse.graphs[0],
              files: [
                {
                  ...graphTreeResponse.graphs[0].files[0],
                  fileName: `${body.fileName}.md`,
                  path: `data/content/execution/${body.fileName}.md`,
                },
              ],
            },
          ],
        };
        return {
          ...renamedDocumentResponse,
          path: `data/content/execution/${body.fileName}.md`,
        };
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("overview.md");

    await user.click(screen.getByRole("button", { name: "More actions for overview.md" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));

    const input = await screen.findByLabelText("File name");
    await user.clear(input);
    await user.type(input, "summary");
    await user.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => {
      expect(getRequestBody(fetchMock, "/api/documents/note-1", "PUT")).toEqual({ fileName: "summary" });
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByText("summary.md")).toBeInTheDocument();
  });

  it("deletes a node from the content tree", async () => {
    let currentGraphTree = graphTreeResponse;

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return currentGraphTree;
      }

      if (url === "/api/documents/note-1" && (init?.method ?? "GET") === "DELETE") {
        currentGraphTree = {
          ...graphTreeResponse,
          graphs: [
            {
              ...graphTreeResponse.graphs[0],
              directCount: 0,
              totalCount: 0,
              countLabel: "0 direct / 0 total",
              files: [],
            },
          ],
        };
        return { deleted: true, id: "note-1", path: "data/content/execution/overview.md" };
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("overview.md");

    await user.click(screen.getByRole("button", { name: "More actions for overview.md" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));

    expect(await screen.findByText("This removes Overview from the workspace.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete document" }));

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(([url, requestInit]) => {
        const requestURL = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
        return requestURL === "/api/documents/note-1" && (requestInit?.method ?? "GET") === "DELETE";
      });
      expect(deleteCall).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.queryByText("overview.md")).not.toBeInTheDocument();
    });
  });

  it("persists appearance changes from the settings dialog", async () => {
    let persistedWorkspace = workspaceResponse;

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        if ((init?.method ?? "GET") === "PUT") {
          const body = JSON.parse(String(init?.body ?? "{}")) as { appearance: typeof workspaceResponse.appearance };
          persistedWorkspace = { ...workspaceResponse, appearance: body.appearance };
          return persistedWorkspace;
        }

        return persistedWorkspace;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(await screen.findByRole("button", { name: "Appearance" }));

    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Dark" }));

    await waitFor(() => {
      expect(getRequestBody(fetchMock, "/api/workspace", "PUT")).toEqual({ appearance: "dark" });
    });

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
  });

  it("de-registers a local workspace from settings", async () => {
    const globalPath = "/tmp/flow-global";
    const localPath = "/tmp/flow-local";
    let persistedWorkspace = {
      ...workspaceResponse,
      scope: "global",
      workspacePath: globalPath,
      workspaceSelectionEnabled: true,
      workspaces: [
        { scope: "global", workspacePath: globalPath },
        { scope: "local", workspacePath: localPath },
      ],
    };

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        return persistedWorkspace;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/calendar-documents") {
        return [];
      }

      if (url === "/api/workspace/select" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body ?? "{}")) as { workspacePath?: string };
        if (body.workspacePath === localPath) {
          persistedWorkspace = {
            ...persistedWorkspace,
            scope: "local",
            workspacePath: localPath,
          };
        }
        return persistedWorkspace;
      }

      if (typeof url === "string" && url.startsWith("/api/workspace/local?") && init?.method === "DELETE") {
        persistedWorkspace = {
          ...persistedWorkspace,
          scope: "global",
          workspacePath: globalPath,
          workspaces: [{ scope: "global", workspacePath: globalPath }],
        };
        return persistedWorkspace;
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");
    await user.click(screen.getByRole("button", { name: "Settings" }));

    const deregisterButton = await screen.findByRole("button", { name: `De-register ${localPath}` });
    await user.click(deregisterButton);

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(([requestURL, requestInit]) => {
        const value = String(requestURL);
        return value.startsWith("/api/workspace/local?") && (requestInit?.method ?? "GET") === "DELETE";
      });
      expect(deleteCall).toBeDefined();
    });

    await waitFor(() => {
      expect((screen.getByLabelText("Workspace") as HTMLSelectElement).value).toBe(globalPath);
    });
  });

  it("rebuilds the index from settings and refreshes the open document", async () => {
    let currentGraphTree = graphTreeResponse;
    let currentDocument = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "Execution overview",
      path: "data/content/execution/overview.md",
      tags: [],
      body: "Overview body\n",
      links: [],
      relatedNoteIds: [],
    };
    let currentGraphCanvas = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/content/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
      ],
      edges: [],
    };

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return currentGraphTree;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return currentGraphCanvas;
      }

      if (url === "/api/documents/note-1") {
        return currentDocument;
      }

      if (url === "/api/index/rebuild" && (init?.method ?? "GET") === "POST") {
        currentGraphTree = {
          ...graphTreeResponse,
          graphs: [
            {
              ...graphTreeResponse.graphs[0],
              files: [
                {
                  ...graphTreeResponse.graphs[0].files[0],
                  title: "Refreshed Overview",
                  path: "data/content/execution/refreshed-overview.md",
                  fileName: "refreshed-overview.md",
                },
              ],
            },
          ],
        };
        currentDocument = {
          ...currentDocument,
          title: "Refreshed Overview",
          path: "data/content/execution/refreshed-overview.md",
          body: "Refreshed body\n",
        };
        currentGraphCanvas = {
          ...currentGraphCanvas,
          nodes: currentGraphCanvas.nodes.map((node) => node.id === "note-1"
            ? {
                ...node,
                title: "Refreshed Overview",
                path: "data/content/execution/refreshed-overview.md",
              }
            : node),
        };
        return { rebuilt: true };
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");

    const fileButton = screen.getByText("overview.md").closest('[data-sidebar="menu-sub-button"]');
    if (fileButton === null) {
      throw new Error("missing overview file button");
    }

    await user.click(fileButton);

    expect(await screen.findByLabelText("Document content layout")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Document title" })).toHaveValue("Overview");

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Refresh index" }));

    await waitFor(() => {
      const rebuildCall = fetchMock.mock.calls.find(([url, requestInit]) => {
        const requestURL = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
        return requestURL === "/api/index/rebuild" && (requestInit?.method ?? "GET") === "POST";
      });
      expect(rebuildCall).toBeDefined();
    });

    expect(await screen.findByText("refreshed-overview.md")).toBeInTheDocument();
    expect(await screen.findByText("Refreshed body")).toBeInTheDocument();
    expect(await screen.findByText("Index refreshed.")).toBeInTheDocument();
  });

  it("shows a document table of contents on the Home surface and persists resize", async () => {
    const customHomeResponse = {
      ...homeResponse,
      body: "# Home\n\n## Roadmap\n\n### Details\n",
    };
    let persistedWorkspace = workspaceResponse;

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        if ((init?.method ?? "GET") === "PUT") {
          const body = JSON.parse(String(init?.body ?? "{}")) as { panelWidths: typeof workspaceResponse.panelWidths };
          persistedWorkspace = { ...workspaceResponse, panelWidths: body.panelWidths };
          return persistedWorkspace;
        }

        return persistedWorkspace;
      }

      if (url === "/api/graphs") {
        return {
          ...graphTreeResponse,
          home: customHomeResponse,
        };
      }

      if (url === "/api/graphs/note") return noteGraphs("execution");
      if (url === "/api/graphs/task") return emptyGraphLists.tasks;
      if (url === "/api/graphs/command") return emptyGraphLists.commands;

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    const layout = await screen.findByLabelText("Home content layout");
    await user.click(await screen.findByRole("button", { name: "Show table of contents" }));
    const toc = await screen.findByLabelText("Document table of contents");
    expect(within(toc).getByRole("button", { name: "Roadmap" })).toBeInTheDocument();

    await user.click(within(toc).getByRole("button", { name: "Details" }));

    await waitFor(() => {
      const editorSurface = screen.getByLabelText("Home body editor");
      expect(editorSurface.contains(document.activeElement)).toBe(true);
    });

    Object.defineProperty(layout, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 100,
        y: 40,
        top: 40,
        left: 100,
        right: 900,
        bottom: 640,
        width: 800,
        height: 600,
        toJSON: () => ({}),
      }),
    });

    fireEvent.mouseDown(screen.getByRole("separator", { name: "Resize table of contents" }), { button: 0, clientX: 740 });
    fireEvent.mouseMove(window, { clientX: 680 });
    fireEvent.mouseUp(window);

    await waitFor(() => {
      const body = getRequestBody(fetchMock, "/api/workspace", "PUT");
      expect(body).toEqual({
        panelWidths: {
          leftRatio: 0.31,
          rightRatio: 0.22,
          documentTOCRatio: 0.275,
        },
      });
    });
  });

  it("shows a document table of contents in the center pane and returns focus to the editor on click", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
      ],
      edges: [],
    };
    const documentResponse = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "Execution overview",
      path: "data/graphs/execution/overview.md",
      tags: [],
      body: "# Intro Heading\n\nBody text\n\n## Deep Section\n\nMore detail\n",
      links: [{ node: "note-2", context: "related work" }],
      relatedNoteIds: ["note-2"],
    };

    installFetchMock((url) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      if (url === "/api/documents/note-1") {
        return documentResponse;
      }

      throw new Error(`Unhandled request: GET ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    const fileButton = (await screen.findByText("overview.md")).closest('[data-sidebar="menu-sub-button"]');
    if (fileButton === null) {
      throw new Error("missing overview file button");
    }

    await user.click(fileButton);

    await user.click(await screen.findByRole("button", { name: "Toggle document properties" }));

    await waitFor(() => {
      const propertiesPanel = screen.getByLabelText("Document properties");
      const linkStats = within(propertiesPanel).getByLabelText("Document link stats");
      expect(within(linkStats).getByText("1 outgoing link")).toBeInTheDocument();
      expect(within(linkStats).getByText("1 incoming link")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Toggle table of contents" }));

    const toc = await screen.findByLabelText("Document table of contents");
    const deepSectionLink = within(toc).getByRole("button", { name: "Deep Section" });

    await user.click(deepSectionLink);

    await waitFor(() => {
      const editorSurface = screen.getByLabelText("Document body editor");
      expect(editorSurface.contains(document.activeElement)).toBe(true);
    });
  });

  it("toggles the center side panel between TOC and editable properties", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
      ],
      edges: [],
    };
    let persistedDocument = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "Execution overview",
      path: "data/graphs/execution/overview.md",
      tags: [],
      body: "# Intro Heading\n\nBody text\n\n## Deep Section\n\nMore detail\n",
      links: [],
      relatedNoteIds: [],
    };

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return graphTreeResponse;
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return graphCanvasResponse;
      }

      if (url === "/api/documents/note-1" && (init?.method ?? "GET") === "PUT") {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          title: string;
          description: string;
          graph: string;
          tags: string[];
          body: string;
          links: Array<{ node: string; context?: string; relationships?: string[] }>;
        };
        persistedDocument = {
          ...persistedDocument,
          title: body.title,
          description: body.description,
          graph: body.graph,
          tags: body.tags,
          body: body.body,
          links: body.links,
        };
        return persistedDocument;
      }

      if (url === "/api/documents/note-1") {
        return persistedDocument;
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    const fileButton = (await screen.findByText("overview.md")).closest('[data-sidebar="menu-sub-button"]');
    if (fileButton === null) {
      throw new Error("missing overview file button");
    }

    await user.click(fileButton);

    const tocToggle = await screen.findByRole("button", { name: "Toggle table of contents" });
    const propertiesToggle = await screen.findByRole("button", { name: "Toggle document properties" });

    expect(screen.queryByLabelText("Document table of contents")).not.toBeInTheDocument();
    expect(tocToggle).toHaveAttribute("aria-pressed", "false");

    await user.click(tocToggle);
    expect(await screen.findByLabelText("Document table of contents")).toBeInTheDocument();
    expect(tocToggle).toHaveAttribute("aria-pressed", "true");

    await user.click(tocToggle);
    expect(screen.queryByLabelText("Document table of contents")).not.toBeInTheDocument();
    expect(tocToggle).toHaveAttribute("aria-pressed", "false");

    await user.click(propertiesToggle);

    const propertiesPanel = await screen.findByLabelText("Document properties");
    expect(screen.queryByLabelText("Document table of contents")).not.toBeInTheDocument();
    expect(propertiesToggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(within(propertiesPanel).getByLabelText("Document description"), {
      target: { value: "Updated overview" },
    });

    fireEvent.change(within(propertiesPanel).getByLabelText("Add outgoing link target"), {
      target: { value: "note-2" },
    });
    await user.click(within(propertiesPanel).getByRole("button", { name: "Add outgoing link" }));

    fireEvent.change(within(propertiesPanel).getByLabelText("Link type for note-2"), {
      target: { value: "depends-on" },
    });

    fireEvent.change(within(propertiesPanel).getByLabelText("Link context for note-2"), {
      target: { value: "needed for sequencing" },
    });

    await waitFor(() => {
      expect(getRequestBody(fetchMock, "/api/documents/note-1", "PUT")).toEqual({
        title: "Overview",
        description: "Updated overview",
        graph: "execution",
        tags: [],
        body: "# Intro Heading\n\nBody text\n\n## Deep Section\n\nMore detail\n",
        links: [
          {
            node: "note-2",
            context: "needed for sequencing",
            relationships: ["depends-on"],
          },
        ],
      });
    }, { timeout: 2000 });
  });

  it("resizes the document table of contents and persists its ratio", async () => {
    const graphCanvasResponse = {
      selectedGraph: "execution",
      availableGraphs: ["execution"],
      layerGuidance: {
        magneticThresholdPx: 18,
        guides: [
          { layer: 0, x: 140 },
          { layer: 1, x: 460 },
        ],
      },
      nodes: [
        {
          id: "note-1",
          type: "note",
          graph: "execution",
          title: "Overview",
          description: "Execution overview",
          path: "data/graphs/execution/overview.md",
          featureSlug: "execution",
          position: { x: 140, y: 120 },
          positionPersisted: false,
        },
      ],
      edges: [],
    };
    const documentResponse = {
      id: "note-1",
      type: "note",
      featureSlug: "execution",
      graph: "execution",
      title: "Overview",
      description: "Execution overview",
      path: "data/graphs/execution/overview.md",
      tags: [],
      body: "# Intro\n## Deep Section\n",
      links: [],
      relatedNoteIds: [],
    };
    let persistedWorkspace = workspaceResponse;

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        if ((init?.method ?? "GET") === "PUT") {
          const body = JSON.parse(String(init?.body ?? "{}")) as { panelWidths: typeof workspaceResponse.panelWidths };
          persistedWorkspace = { ...workspaceResponse, panelWidths: body.panelWidths };
          return persistedWorkspace;
        }

        return persistedWorkspace;
      }

      if (url === "/api/graphs") return graphTreeResponse;
      if (url === "/api/graphs/note") return noteGraphs("execution");
      if (url === "/api/graphs/task") return emptyGraphLists.tasks;
      if (url === "/api/graphs/command") return emptyGraphLists.commands;
      if (url === "/api/graph-canvas?graph=execution") return graphCanvasResponse;
      if (url === "/api/documents/note-1") return documentResponse;

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    const fileButton = (await screen.findByText("overview.md")).closest('[data-sidebar="menu-sub-button"]');
    if (fileButton === null) {
      throw new Error("missing overview file button");
    }

    await user.click(fileButton);

    await user.click(await screen.findByRole("button", { name: "Toggle table of contents" }));

    const layout = await screen.findByLabelText("Document content layout");
    Object.defineProperty(layout, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 100,
        y: 40,
        top: 40,
        left: 100,
        right: 900,
        bottom: 640,
        width: 800,
        height: 600,
        toJSON: () => ({}),
      }),
    });

    fireEvent.mouseDown(screen.getByRole("separator", { name: "Resize table of contents" }), { button: 0, clientX: 740 });
    fireEvent.mouseMove(window, { clientX: 680 });
    fireEvent.mouseUp(window);

    await waitFor(() => {
      const body = getRequestBody(fetchMock, "/api/workspace", "PUT");
      expect(body).toEqual({
        panelWidths: {
          leftRatio: 0.31,
          rightRatio: 0.22,
          documentTOCRatio: 0.275,
        },
      });
    });
  });

  it("shows empty-graph create actions and creates a note into the selected graph", async () => {
    let noteCreated = false;
    const createdDocument = {
      id: "note-new",
      type: "note",
      featureSlug: "execution",
      graph: "execution/empty",
      title: "New Note",
      description: "",
      path: "data/graphs/execution/empty/new-note-kf12oi.md",
      tags: [],
      body: "",
      links: [],
      relatedNoteIds: [],
    };

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return {
          home: homeResponse,
          graphs: [
            {
              graphPath: "execution/empty",
              displayName: "Empty",
              directCount: noteCreated ? 1 : 0,
              totalCount: noteCreated ? 1 : 0,
              hasChildren: false,
              countLabel: noteCreated ? "1 direct / 1 total" : "0 direct / 0 total",
              files: noteCreated
                ? [
                    {
                      id: "note-new",
                      type: "note",
                      title: "New Note",
                      path: "data/graphs/execution/empty/new-note-kf12oi.md",
                      fileName: "new-note-kf12oi.md",
                    },
                  ]
                : [],
            },
          ],
        };
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution/empty");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution%2Fempty") {
        return noteCreated
          ? {
              selectedGraph: "execution/empty",
              availableGraphs: ["execution/empty"],
              layerGuidance: { magneticThresholdPx: 18, guides: [{ layer: 0, x: 140 }] },
              nodes: [
                {
                  id: "note-new",
                  type: "note",
                  graph: "execution/empty",
                  title: "New Note",
                  description: "",
                  path: "data/graphs/execution/empty/new-note-kf12oi.md",
                  featureSlug: "execution",
                  position: { x: 140, y: 120 },
                  positionPersisted: false,
                },
              ],
              edges: [],
            }
          : {
              selectedGraph: "execution/empty",
              availableGraphs: ["execution/empty"],
              layerGuidance: { magneticThresholdPx: 18, guides: [] },
              nodes: [],
              edges: [],
            };
      }

      if (url === "/api/documents" && init?.method === "POST") {
        noteCreated = true;
        return createdDocument;
      }

      if (url === "/api/documents/note-new") {
        return createdDocument;
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    const emptyGraphButton = (await screen.findByText("Empty")).closest('[data-sidebar="menu-sub-button"]');
    if (emptyGraphButton === null) {
      throw new Error("missing empty graph button");
    }

    await user.click(emptyGraphButton);

    expect(await screen.findByText("Start this canvas with the first document.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Capture context/i }));
    await user.type(await screen.findByLabelText("File name"), "new-note");
    await user.click(screen.getByRole("button", { name: /^Create$/i }));

    await waitFor(() => {
      const payload = getRequestBody(fetchMock, "/api/documents", "POST");
      expect(payload.type).toBe("note");
      expect(payload.graph).toBe("execution/empty");
      expect(payload.featureSlug).toBe("execution");
      expect(payload.title).toBe("New Note");
    });

    expect(await screen.findByDisplayValue("New Note")).toBeInTheDocument();
  });

  it("refreshes the empty canvas after creating a note from the graph tree menu", async () => {
    let noteCreated = false;
    const createdDocument = {
      id: "note-new",
      type: "note",
      featureSlug: "execution",
      graph: "execution/empty",
      title: "New Note",
      description: "",
      path: "data/graphs/execution/empty/new-note-kf12oi.md",
      tags: [],
      body: "",
      links: [],
      relatedNoteIds: [],
    };

    const fetchMock = installFetchMock((url, init) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return {
          home: homeResponse,
          graphs: [
            {
              graphPath: "execution/empty",
              displayName: "Empty",
              directCount: noteCreated ? 1 : 0,
              totalCount: noteCreated ? 1 : 0,
              hasChildren: false,
              countLabel: noteCreated ? "1 direct / 1 total" : "0 direct / 0 total",
              files: noteCreated
                ? [
                    {
                      id: "note-new",
                      type: "note",
                      title: "New Note",
                      path: "data/graphs/execution/empty/new-note-kf12oi.md",
                      fileName: "new-note-kf12oi.md",
                    },
                  ]
                : [],
            },
          ],
        };
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution/empty");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution%2Fempty") {
        return noteCreated
          ? {
              selectedGraph: "execution/empty",
              availableGraphs: ["execution/empty"],
              layerGuidance: { magneticThresholdPx: 18, guides: [{ layer: 0, x: 140 }] },
              nodes: [
                {
                  id: "note-new",
                  type: "note",
                  graph: "execution/empty",
                  title: "New Note",
                  description: "",
                  path: "data/graphs/execution/empty/new-note-kf12oi.md",
                  featureSlug: "execution",
                  position: { x: 140, y: 120 },
                  positionPersisted: false,
                },
              ],
              edges: [],
            }
          : {
              selectedGraph: "execution/empty",
              availableGraphs: ["execution/empty"],
              layerGuidance: { magneticThresholdPx: 18, guides: [] },
              nodes: [],
              edges: [],
            };
      }

      if (url === "/api/documents" && init?.method === "POST") {
        noteCreated = true;
        return createdDocument;
      }

      if (url === "/api/documents/note-new") {
        return createdDocument;
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    const emptyGraphButton = (await screen.findByText("Empty")).closest('[data-sidebar="menu-sub-button"]');
    if (emptyGraphButton === null) {
      throw new Error("missing empty graph button");
    }

    await user.click(emptyGraphButton);

    expect(await screen.findByText("Start this canvas with the first document.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More actions for Empty" }));
    await user.click(await screen.findByRole("menuitem", { name: /Add note/i }));
    await user.type(await screen.findByLabelText("File name"), "new-note");
    await user.click(screen.getByRole("button", { name: /^Create$/i }));

    await waitFor(() => {
      const payload = getRequestBody(fetchMock, "/api/documents", "POST");
      expect(payload.type).toBe("note");
      expect(payload.graph).toBe("execution/empty");
      expect(payload.featureSlug).toBe("execution");
      expect(payload.title).toBe("New Note");
    });

    await waitFor(() => {
      expect(screen.queryByText("Start this canvas with the first document.")).not.toBeInTheDocument();
    });

    expect(await screen.findByDisplayValue("New Note")).toBeInTheDocument();
  });

  it("tolerates null graph-canvas arrays from the API when selecting a graph", async () => {
    const fetchMock = installFetchMock((url) => {
      if (url === "/api/workspace") {
        return workspaceResponse;
      }

      if (url === "/api/graphs") {
        return {
          home: homeResponse,
          graphs: [
            {
              graphPath: "execution",
              displayName: "Execution",
              directCount: 1,
              totalCount: 1,
              hasChildren: false,
              countLabel: "1 direct / 1 total",
              files: [
                {
                  id: "note-1",
                  type: "note",
                  title: "Overview",
                  path: "data/graphs/execution/overview.md",
                  fileName: "overview.md",
                },
              ],
            },
          ],
        };
      }

      if (url === "/api/graphs/note") {
        return noteGraphs("execution");
      }

      if (url === "/api/graphs/task") {
        return emptyGraphLists.tasks;
      }

      if (url === "/api/graphs/command") {
        return emptyGraphLists.commands;
      }

      if (url === "/api/graph-canvas?graph=execution") {
        return {
          selectedGraph: "execution",
          availableGraphs: ["execution"],
          layerGuidance: { magneticThresholdPx: 18, guides: null },
          nodes: [
            {
              id: "note-1",
              type: "note",
              graph: "execution",
              title: "Overview",
              description: "Execution overview",
              path: "data/graphs/execution/overview.md",
              featureSlug: "execution",
              position: { x: 140, y: 120 },
              positionPersisted: false,
            },
          ],
          edges: null,
        };
      }

      throw new Error(`Unhandled request: GET ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    const executionButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);

    expect(await screen.findByTestId("flow-node-note-1")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/graph-canvas?graph=execution", expect.anything());
  });

  it("switches to the Home workspace from a Graph and renders the HomeRichTextEditor properly", async () => {
    installFetchMock((url) => {
      if (url === "/api/workspace") return workspaceResponse;
      if (url === "/api/graphs") return graphTreeResponse;
      if (url === "/api/graphs/note") return noteGraphs("execution");
      if (url === "/api/graphs/task") return emptyGraphLists.tasks;
      if (url === "/api/graphs/command") return emptyGraphLists.commands;
      if (url === "/api/graph-canvas?graph=execution") {
        return {
          selectedGraph: "execution",
          availableGraphs: ["execution"],
          layerGuidance: { magneticThresholdPx: 18, guides: [] },
          nodes: [
            {
              id: "note-1",
              type: "note",
              graph: "execution",
              title: "Overview",
              description: "",
              path: "data/graphs/execution/overview.md",
              featureSlug: "execution",
              position: { x: 140, y: 120 },
              positionPersisted: false,
            },
          ],
          edges: [],
        };
      }
      throw new Error(`Unhandled request: GET ${url}`);
    });

    const user = userEvent.setup();
    render(<ThemeProvider><App /></ThemeProvider>);

    await screen.findByText("Content");

    // Initial state: home surface is selected
    expect(await screen.findByLabelText("Home body editor")).toBeInTheDocument();
    expect(screen.queryByTestId("react-flow-mock")).not.toBeInTheDocument();

    // Click a graph to switch to the canvas view
    const graphButton = (await screen.findByText("Execution")).closest('[data-sidebar="menu-sub-button"]');
    if (graphButton === null) {
      throw new Error("missing execution graph button");
    }
    await user.click(graphButton);

    expect(await screen.findByTestId("react-flow-mock")).toBeInTheDocument();
    expect(screen.queryByLabelText("Home body editor")).not.toBeInTheDocument();

    // Navigate back to Home
    await user.click(screen.getByRole("button", { name: /^Home$/i }));

    expect(await screen.findByLabelText("Home body editor")).toBeInTheDocument();
    expect(screen.queryByTestId("react-flow-mock")).not.toBeInTheDocument();
  });

  it("shows a fresh-workspace guide instead of looking empty on first load", async () => {
    installFetchMock((url) => {
      if (url === "/api/workspace") return workspaceResponse;
      if (url === "/api/graphs") {
        return {
          home: homeResponse,
          graphs: [],
        };
      }
      throw new Error(`Unhandled request: GET ${url}`);
    });

    render(<ThemeProvider><App /></ThemeProvider>);

    expect(await screen.findByLabelText("Fresh workspace guide")).toBeInTheDocument();
    expect(screen.getByText("Start with Home or create your first graph.")).toBeInTheDocument();
    expect(screen.getByLabelText("Home body editor")).toBeInTheDocument();
  });

  it("handles graph tree payloads where files is null or absent", async () => {
    installFetchMock((url) => {
      if (url === "/api/workspace") return workspaceResponse;
      if (url === "/api/graphs") {
        return {
          home: homeResponse,
          graphs: [
            {
              graphPath: "execution",
              displayName: "Execution",
              directCount: 1,
              totalCount: 1,
              hasChildren: false,
              countLabel: "1 direct / 1 total",
            },
          ],
        };
      }
      throw new Error(`Unhandled request: GET ${url}`);
    });

    render(<ThemeProvider><App /></ThemeProvider>);

    expect(await screen.findByLabelText("Home body editor")).toBeInTheDocument();
    expect(screen.getByText("Execution")).toBeInTheDocument();
  });
});
