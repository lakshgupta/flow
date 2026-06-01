import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  workspaceResponse,
  graphTreeResponse,
  emptyGraphLists,
  noteGraphs,
  installFetchMock,
  getRequestBody,
  findSidebarTreeButton,
  renderApp,
} from "./App.test-utils";

describe("App graph canvas flows", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(1_717_171_717_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens graph documents as thread roots in the center view and persists the full drag-end arrangement", async () => {
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
          positions: [
            { documentId: "note-1", x: 446, y: 200 },
            { documentId: "note-2", x: 12, y: 12 },
          ],
        };
      }

      throw new Error(`Unhandled request: ${(init?.method ?? "GET")} ${url}`);
    });

    const user = userEvent.setup();
    renderApp();

    await screen.findByText("Content");

    const executionButton = await findSidebarTreeButton("Execution");
    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");

    await user.click(screen.getByRole("button", { name: "Drag stop note-1" }));

    await waitFor(() => {
      const requestBody = getRequestBody(fetchMock, "/api/graph-layout", "PUT") as {
        graph: string;
        positions: Array<{ documentId: string; x: number; y: number }>;
      };

      expect(requestBody.graph).toBe("execution");
      const noteOnePosition = requestBody.positions.find((position) => position.documentId === "note-1");
      expect(noteOnePosition).toBeDefined();
      expect(typeof noteOnePosition?.x).toBe("number");
      expect(typeof noteOnePosition?.y).toBe("number");
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
    renderApp();

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
    renderApp();

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
    renderApp();

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
    renderApp();

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
    renderApp();

    const executionButton = await findSidebarTreeButton("Execution");
    await user.click(executionButton);
    await screen.findByTestId("flow-node-note-1");

    expect(document.querySelector('[data-nodeid="note-3"] .graph-canvas-node-circle')).not.toBeNull();
    expect(document.querySelector('.graph-canvas-overlay svg path[stroke-dasharray="6 4"]')).not.toBeNull();
  });
});
