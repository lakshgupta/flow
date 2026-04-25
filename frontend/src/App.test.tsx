import { ThemeProvider } from "./lib/theme";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
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

    const documentPanel = await screen.findByLabelText("Graph node document");
    expect(within(documentPanel).getByText("Overview body")).toBeInTheDocument();
    expect(screen.queryByLabelText("Document content layout")).not.toBeInTheDocument();
  });

  it("shows a document icon after node selection and lets the right pane maximize and minimize", async () => {
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
      references: [],
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
      references: [],
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
    const documentPanel = await screen.findByLabelText("Graph node document panel");
    expect(within(documentPanel).getByLabelText("Graph node document")).toBeInTheDocument();

    await user.click(within(documentPanel).getByRole("button", { name: "Maximize right pane" }));
    expect(screen.getByLabelText("Right pane")).toHaveAttribute("data-focus", "true");
    expect(within(documentPanel).getByLabelText("Document table of contents")).toBeInTheDocument();
    expect(within(documentPanel).getByRole("button", { name: "Overview body" })).toBeInTheDocument();

    const rightRailLayout = within(documentPanel).getByLabelText("Graph node document");
    Object.defineProperty(rightRailLayout, "getBoundingClientRect", {
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

    fireEvent.mouseDown(within(documentPanel).getByRole("separator", { name: "Resize table of contents" }), { button: 0, clientX: 740 });
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

    await user.click(screen.getByRole("button", { name: "Select note-2" }));
    await user.click(screen.getByRole("button", { name: "Document" }));
    expect(screen.getByLabelText("Right pane")).toHaveAttribute("data-focus", "false");

    const reopenedDocumentPanel = await screen.findByLabelText("Graph node document panel");
    expect(within(reopenedDocumentPanel).getByText("Details body")).toBeInTheDocument();
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
      references: [],
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

    const fileButton = (await screen.findByText("overview.md")).closest('[data-sidebar="menu-sub-button"]');
    if (fileButton === null) {
      throw new Error("missing overview file button");
    }

    expect(within(fileButton).queryByText("Overview")).not.toBeInTheDocument();

    await user.click(fileButton);
    expect(await screen.findByText("Overview body")).toBeInTheDocument();
    expect(screen.getByLabelText("Document content layout")).toBeInTheDocument();
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
      references: [],
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
      references: [],
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

    const fileButton = (await screen.findByText("overview.md")).closest('[data-sidebar="menu-sub-button"]');
    if (fileButton === null) {
      throw new Error("missing overview file button");
    }

    await user.click(fileButton);

    const toc = await screen.findByLabelText("Document table of contents");
    const deepSectionLink = within(toc).getByRole("button", { name: "Deep Section" });

    await user.click(deepSectionLink);

    await waitFor(() => {
      const editorSurface = screen.getByLabelText("Document body editor");
      expect(editorSurface.contains(document.activeElement)).toBe(true);
    });
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
      references: [],
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

  it("accepts legacy graph tree payloads that omit files", async () => {
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
