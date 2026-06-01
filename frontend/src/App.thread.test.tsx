import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  workspaceResponse,
  graphTreeResponse,
  emptyGraphLists,
  noteGraphs,
  installFetchMock,
  getRequestBody,
  findSidebarTreeButton,
  expandSidebarGraph,
  createDeferredValue,
  renderApp,
} from "./App.test-utils";

describe("App thread and reference flows", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(1_717_171_717_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
    renderApp();

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
    renderApp();

    const executionButton = await findSidebarTreeButton("Execution");
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
    renderApp();

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
});
