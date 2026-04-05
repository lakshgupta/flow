import { ThemeProvider } from "./lib/theme";
import { render, screen, waitFor } from "@testing-library/react";
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
    ReactFlow: ({ nodes, onNodeClick, onNodeDoubleClick, onNodeDragStop, onPaneClick }: any) => (
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
      </div>
    ),
    Background: () => <div data-testid="flow-background" />,
    Controls: () => <div data-testid="flow-controls" />,
    applyNodeChanges: (_changes: unknown, nodes: unknown) => nodes,
    MarkerType: { ArrowClosed: "arrowclosed" },
  };
});

import { App } from "./App";

type MockResponseOptions = {
  status?: number;
};

type MockFetchHandler = (url: string, init?: RequestInit) => unknown;

const workspaceResponse = {
  scope: "local",
  workspacePath: "/tmp/flow-workspace",
  flowPath: "/tmp/flow-workspace/.flow",
  configPath: "/tmp/flow-workspace/.flow/config/config.toml",
  indexPath: "/tmp/flow-workspace/.flow/config/flow.index",
  homePath: "data/home.md",
  guiPort: 4812,
  panelWidths: { leftRatio: 0.31, rightRatio: 0.22 },
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
    const result = handler(url, init);

    if (result instanceof Response) {
      return result;
    }

    return jsonResponse(result);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens the right panel on node double click and persists snapped drag-end positions", async () => {
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
      references: [],
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

    const executionButton = screen.getByText("Execution").closest("button");
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);
    await screen.findByText("Graph Canvas");
    await screen.findByTestId("flow-node-note-1");

    await user.click(screen.getByRole("button", { name: "Select note-1" }));

    expect(await screen.findByText("Selected Node")).toBeInTheDocument();
    expect(screen.getByText("0 connected edges highlighted")).toBeInTheDocument();

    await user.dblClick(screen.getByRole("button", { name: "Open note-1" }));

    expect(await screen.findByText("Overview body")).toBeInTheDocument();

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
      references: [],
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

    const emptyGraphButton = screen.getByText("Empty").closest("button");
    if (emptyGraphButton === null) {
      throw new Error("missing empty graph button");
    }

    await user.click(emptyGraphButton);

    expect(await screen.findByText("Start this canvas with the first document.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Capture context/i }));

    await waitFor(() => {
      const payload = getRequestBody(fetchMock, "/api/documents", "POST");
      expect(payload.type).toBe("note");
      expect(payload.graph).toBe("execution/empty");
      expect(payload.featureSlug).toBe("execution");
      expect(payload.title).toBe("New Note");
    });

    expect(await screen.findByDisplayValue("New Note")).toBeInTheDocument();
    expect(screen.getByText("Note created.")).toBeInTheDocument();
    expect(screen.getByText("1 visible documents")).toBeInTheDocument();
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

    const executionButton = screen.getByText("Execution").closest("button");
    if (executionButton === null) {
      throw new Error("missing execution graph button");
    }

    await user.click(executionButton);

    expect(await screen.findByText("Graph Canvas")).toBeInTheDocument();
    expect(await screen.findByTestId("flow-node-note-1")).toBeInTheDocument();
    expect(screen.getByText("0 projected edges")).toBeInTheDocument();
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
    expect(await screen.findByLabelText("Document title")).toBeInTheDocument();
    expect(screen.getByLabelText("Home body editor")).toBeInTheDocument();
    expect(screen.queryByTestId("react-flow-mock")).not.toBeInTheDocument();

    // Click a graph to switch to the canvas view
    const graphButton = (await screen.findByText("Execution")).closest("button");
    if (graphButton) await user.click(graphButton);

    expect(await screen.findByTestId("react-flow-mock")).toBeInTheDocument();
    expect(screen.queryByLabelText("Document title")).not.toBeInTheDocument();

    // Navigate back to Home
    const homeBtn = screen.getByText("Home").closest("button");
    if (homeBtn) await user.click(homeBtn);

    expect(await screen.findByLabelText("Document title")).toBeInTheDocument();
    expect(screen.queryByTestId("react-flow-mock")).not.toBeInTheDocument();
  });
});
