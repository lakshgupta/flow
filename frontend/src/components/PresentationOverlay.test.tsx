import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PresentationOverlay } from "./PresentationOverlay";
import { initialPresentationState } from "../lib/presentationNavigation";

const nodesById = new Map([
  ["a", { id: "a", type: "note", title: "Root node", description: "" }],
  ["b", { id: "b", type: "task", title: "Branch one", description: "", status: "Ready" }],
  ["c", { id: "c", type: "note", title: "Branch two", description: "" }],
]);

function activeState() {
  return {
    ...initialPresentationState(),
    active: true,
    currentId: "a",
    candidates: [
      { id: "b", context: "first branch" },
      { id: "c" },
    ],
    highlightIndex: 1,
  };
}

describe("PresentationOverlay", () => {
  it("renders nothing while inactive", () => {
    const { container } = render(
      <PresentationOverlay
        state={initialPresentationState()}
        nodesById={nodesById}
        bodies={{}}
        onClose={() => {}}
        onBack={() => {}}
        onFollow={() => {}}
        onRotate={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the current slide with badges, body fallback, counter and candidate chips", () => {
    const bodies = vi.fn() as never;
    void bodies;
    render(
      <PresentationOverlay
        state={activeState()}
        nodesById={nodesById}
        bodies={{}}
        onClose={() => {}}
        onBack={() => {}}
        onFollow={() => {}}
        onRotate={() => {}}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Presentation mode" })).toBeInTheDocument();
    expect(screen.getByText("Root node")).toBeInTheDocument();
    expect(screen.getByText("note")).toBeInTheDocument();
    expect(screen.getByText(/slide 1/)).toBeInTheDocument();

    const chips = screen.getAllByRole("listitem");
    expect(chips).toHaveLength(2);
    expect(chips[1]).toHaveAttribute("aria-current", "true");
    expect(chips[0]).not.toHaveAttribute("aria-current");
  });

  it("renders a command slide run string as the body", () => {
    const commandNodes = new Map([
      ["cmd", { id: "cmd", type: "command", title: "Run tests", description: "", run: "go test ./..." }],
    ]);
    render(
      <PresentationOverlay
        state={{ ...activeState(), currentId: "cmd", candidates: [] }}
        nodesById={commandNodes}
        bodies={{}}
        onClose={() => {}}
        onBack={() => {}}
        onFollow={() => {}}
        onRotate={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText("go test ./...")).toBeInTheDocument();
  });

  it("wires the keyboard contract through the control buttons", () => {
    const onClose = vi.fn();
    const onBack = vi.fn();
    const onFollow = vi.fn();
    const onRotate = vi.fn((direction: 1 | -1) => direction);
    const onOpen = vi.fn();

    render(
      <PresentationOverlay
        state={activeState()}
        nodesById={nodesById}
        bodies={{}}
        onClose={onClose}
        onBack={onBack}
        onFollow={onFollow}
        onRotate={onRotate}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByTestId("presentation-back"));
    fireEvent.click(screen.getByTestId("presentation-follow"));
    fireEvent.click(screen.getByTestId("presentation-rotate-up"));
    fireEvent.click(screen.getByTestId("presentation-exit"));
    fireEvent.click(screen.getByTestId("presentation-open"));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onFollow).toHaveBeenCalledTimes(1);
    expect(onRotate).toHaveBeenCalledWith(-1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("a");
  });
});
