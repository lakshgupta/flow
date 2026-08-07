import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GraphTree } from "./GraphTree";
import { SidebarProvider } from "./ui/sidebar";

const graphTree = {
  home: {
    id: "home",
    type: "home",
    title: "Home",
    description: "",
    path: "data/home.md",
    body: "# Home\n",
  },
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
          path: "data/content/execution/overview.md",
          fileName: "overview.md",
        },
      ],
    },
    {
      graphPath: "release",
      displayName: "Release",
      directCount: 1,
      totalCount: 1,
      hasChildren: false,
      countLabel: "1 direct / 1 total",
      files: [
        {
          id: "note-2",
          type: "note",
          title: "Ship",
          path: "data/content/release/ship.md",
          fileName: "ship.md",
        },
      ],
    },
  ],
};

function createDataTransfer(): DataTransfer {
  return {
    dropEffect: "none",
    effectAllowed: "all",
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [],
    clearData: vi.fn(),
    getData: vi.fn(() => ""),
    setData: vi.fn(),
    setDragImage: vi.fn(),
  } as unknown as DataTransfer;
}

describe("GraphTree", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("moves a dragged file onto another graph row", async () => {
    const onMoveNode = vi.fn();
    const dataTransfer = createDataTransfer();
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <GraphTree
          graphTree={graphTree}
          activeSurface={{ kind: "graph", graphPath: "execution" }}
          selectedDocumentId=""
          onSelectHome={() => undefined}
          onSelectGraph={() => undefined}
          onOpenGraphViolations={() => undefined}
          onOpenDocument={() => undefined}
          onCreateGraph={() => undefined}
          onCreateNode={() => undefined}
          onRenameGraph={() => undefined}
          onRenameNode={() => undefined}
          onMoveNode={onMoveNode}
          onMoveGraph={() => undefined}
          onDeleteNode={() => undefined}
          onDeleteGraph={() => undefined}
          onDownloadGraph={() => undefined}
          onSetGraphColor={() => undefined}
          onSetNodeColor={() => undefined}
          onSetGraphCanvasDisabled={() => undefined}
          onRebuildIndex={() => undefined}
        />
      </SidebarProvider>,
    );
    
    // Graphs start collapsed — expand Execution to see its files.
    const executionRow = screen.getByText("Execution").closest("li");
    await user.click(within(executionRow!).getByRole("button", { name: "Expand" }));

    const fileButton = screen.getByRole("button", { name: /overview\.md/i });
    const fileRow = fileButton.closest("li");
    const targetGraphRow = screen.getByText("Release").closest("li");
    expect(fileRow).not.toBeNull();
    expect(targetGraphRow).not.toBeNull();

    fireEvent.dragStart(fileRow!, { dataTransfer });
    fireEvent.dragEnter(targetGraphRow!, { dataTransfer });
    fireEvent.dragOver(targetGraphRow!, { dataTransfer });
    fireEvent.drop(targetGraphRow!, { dataTransfer });

    expect(onMoveNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: "note-1", fileName: "overview.md" }),
      "execution",
      "release",
    );
  });

  it("expands a collapsed target graph after drop", async () => {
    const onMoveNode = vi.fn();
    const dataTransfer = createDataTransfer();
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <GraphTree
          graphTree={graphTree}
          activeSurface={{ kind: "graph", graphPath: "execution" }}
          selectedDocumentId=""
          onSelectHome={() => undefined}
          onSelectGraph={() => undefined}
          onOpenGraphViolations={() => undefined}
          onOpenDocument={() => undefined}
          onCreateGraph={() => undefined}
          onCreateNode={() => undefined}
          onRenameGraph={() => undefined}
          onRenameNode={() => undefined}
          onMoveNode={onMoveNode}
          onMoveGraph={() => undefined}
          onDeleteNode={() => undefined}
          onDeleteGraph={() => undefined}
          onDownloadGraph={() => undefined}
          onSetGraphColor={() => undefined}
          onSetNodeColor={() => undefined}
          onSetGraphCanvasDisabled={() => undefined}
          onRebuildIndex={() => undefined}
        />
      </SidebarProvider>,
    );
    
    // Graphs start collapsed — expand both graphs to see their files.
    const execRow = screen.getByText("Execution").closest("li");
    await user.click(within(execRow!).getByRole("button", { name: "Expand" }));
    const relRow = screen.getByText("Release").closest("li");
    await user.click(within(relRow!).getByRole("button", { name: "Expand" }));
    expect(screen.getByRole("button", { name: /ship\.md/i })).toBeInTheDocument();

    const releaseRow = screen.getByText("Release").closest("li");
    expect(releaseRow).not.toBeNull();
    const collapseReleaseButton = within(releaseRow!).getByRole("button", { name: "Collapse" });
    fireEvent.click(collapseReleaseButton);
    expect(screen.queryByRole("button", { name: /ship\.md/i })).toBeNull();

    const fileButton = screen.getByRole("button", { name: /overview\.md/i });
    const fileRow = fileButton.closest("li");
    const targetGraphRow = screen.getByText("Release").closest("li");
    expect(fileRow).not.toBeNull();
    expect(targetGraphRow).not.toBeNull();

    fireEvent.dragStart(fileRow!, { dataTransfer });
    fireEvent.dragEnter(targetGraphRow!, { dataTransfer });
    fireEvent.dragOver(targetGraphRow!, { dataTransfer });
    fireEvent.drop(targetGraphRow!, { dataTransfer });

    expect(screen.getByRole("button", { name: /ship\.md/i })).toBeInTheDocument();
  });

  it("triggers graph zip download from graph row actions", async () => {
    const onDownloadGraph = vi.fn();
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <GraphTree
          graphTree={graphTree}
          activeSurface={{ kind: "graph", graphPath: "execution" }}
          selectedDocumentId=""
          onSelectHome={() => undefined}
          onSelectGraph={() => undefined}
          onOpenGraphViolations={() => undefined}
          onOpenDocument={() => undefined}
          onCreateGraph={() => undefined}
          onCreateNode={() => undefined}
          onRenameGraph={() => undefined}
          onRenameNode={() => undefined}
          onMoveNode={() => undefined}
          onMoveGraph={() => undefined}
          onDeleteNode={() => undefined}
          onDeleteGraph={() => undefined}
          onDownloadGraph={onDownloadGraph}
          onSetGraphColor={() => undefined}
          onSetNodeColor={() => undefined}
          onSetGraphCanvasDisabled={() => undefined}
          onRebuildIndex={() => undefined}
        />
      </SidebarProvider>,
    );
    
    await user.click(screen.getByRole("button", { name: "More actions for Execution" }));
    await user.click(await screen.findByRole("menuitem", { name: "Download as zip" }));

    expect(onDownloadGraph).toHaveBeenCalledWith("execution");
  });

  it("shows a violation badge on graph rows and hides it for clean graphs", () => {
    const treeWithViolations = {
      ...graphTree,
      graphs: [
        {
          ...graphTree.graphs[0]!,
          errorCount: 2,
          warningCount: 1,
        },
        {
          ...graphTree.graphs[1]!,
        },
      ],
    };

    render(
      <SidebarProvider>
        <GraphTree
          graphTree={treeWithViolations}
          activeSurface={{ kind: "graph", graphPath: "execution" }}
          selectedDocumentId=""
          onSelectHome={() => undefined}
          onSelectGraph={() => undefined}
          onOpenGraphViolations={() => undefined}
          onOpenDocument={() => undefined}
          onCreateGraph={() => undefined}
          onCreateNode={() => undefined}
          onRenameGraph={() => undefined}
          onRenameNode={() => undefined}
          onMoveNode={() => undefined}
          onMoveGraph={() => undefined}
          onDeleteNode={() => undefined}
          onDeleteGraph={() => undefined}
          onDownloadGraph={() => undefined}
          onSetGraphColor={() => undefined}
          onSetNodeColor={() => undefined}
          onSetGraphCanvasDisabled={() => undefined}
          onRebuildIndex={() => undefined}
        />
      </SidebarProvider>,
    );

    // Errors take precedence: the Execution row shows the error count as a red pill.
    const executionRow = screen.getByText("Execution").closest("li");
    expect(executionRow).not.toBeNull();
    const badge = within(executionRow!).getByRole("button", {
      name: /Open edge violations for Execution: 2 edge-type errors, 1 warning/,
    });
    expect(badge).toBeInTheDocument();
    expect(badge.classList.contains("graph-tree-violation-badge-error")).toBe(true);
    expect(badge.textContent).toContain("2");

    // The clean Release row renders no badge.
    const releaseRow = screen.getByText("Release").closest("li");
    expect(releaseRow).not.toBeNull();
    expect(within(releaseRow!).queryByRole("button", { name: /edge violations/i })).toBeNull();
  });

  it("jumps to the violations sidebar when the badge is clicked, without selecting the graph row", async () => {
    const onOpenGraphViolations = vi.fn();
    const onSelectGraph = vi.fn();
    const treeWithViolations = {
      ...graphTree,
      graphs: [
        {
          ...graphTree.graphs[0]!,
          errorCount: 2,
          warningCount: 1,
        },
        {
          ...graphTree.graphs[1]!,
        },
      ],
    };
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <GraphTree
          graphTree={treeWithViolations}
          activeSurface={{ kind: "graph", graphPath: "release" }}
          selectedDocumentId=""
          onSelectHome={() => undefined}
          onSelectGraph={onSelectGraph}
          onOpenGraphViolations={onOpenGraphViolations}
          onOpenDocument={() => undefined}
          onCreateGraph={() => undefined}
          onCreateNode={() => undefined}
          onRenameGraph={() => undefined}
          onRenameNode={() => undefined}
          onMoveNode={() => undefined}
          onMoveGraph={() => undefined}
          onDeleteNode={() => undefined}
          onDeleteGraph={() => undefined}
          onDownloadGraph={() => undefined}
          onSetGraphColor={() => undefined}
          onSetNodeColor={() => undefined}
          onSetGraphCanvasDisabled={() => undefined}
          onRebuildIndex={() => undefined}
        />
      </SidebarProvider>,
    );

    const executionRow = screen.getByText("Execution").closest("li");
    expect(executionRow).not.toBeNull();
    await user.click(within(executionRow!).getByRole("button", { name: /Open edge violations for Execution/ }));

    expect(onOpenGraphViolations).toHaveBeenCalledTimes(1);
    expect(onOpenGraphViolations).toHaveBeenCalledWith("execution");
    // The badge is a sibling of the row button: clicking it must not also select the graph.
    expect(onSelectGraph).not.toHaveBeenCalled();
  });
});