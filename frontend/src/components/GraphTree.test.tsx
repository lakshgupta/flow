import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("moves a dragged file onto another graph row", () => {
    const onMoveNode = vi.fn();
    const dataTransfer = createDataTransfer();

    render(
      <SidebarProvider>
        <GraphTree
          graphTree={graphTree}
          activeSurface={{ kind: "graph", graphPath: "execution" }}
          selectedDocumentId=""
          onSelectHome={() => undefined}
          onSelectGraph={() => undefined}
          onOpenDocument={() => undefined}
          onCreateGraph={() => undefined}
          onCreateNode={() => undefined}
          onRenameGraph={() => undefined}
          onRenameNode={() => undefined}
          onMoveNode={onMoveNode}
          onDeleteNode={() => undefined}
          onDeleteGraph={() => undefined}
          onSetGraphColor={() => undefined}
        />
      </SidebarProvider>,
    );

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

  it("expands a collapsed target graph after drop", () => {
    const onMoveNode = vi.fn();
    const dataTransfer = createDataTransfer();

    render(
      <SidebarProvider>
        <GraphTree
          graphTree={graphTree}
          activeSurface={{ kind: "graph", graphPath: "execution" }}
          selectedDocumentId=""
          onSelectHome={() => undefined}
          onSelectGraph={() => undefined}
          onOpenDocument={() => undefined}
          onCreateGraph={() => undefined}
          onCreateNode={() => undefined}
          onRenameGraph={() => undefined}
          onRenameNode={() => undefined}
          onMoveNode={onMoveNode}
          onDeleteNode={() => undefined}
          onDeleteGraph={() => undefined}
          onSetGraphColor={() => undefined}
        />
      </SidebarProvider>,
    );

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
});