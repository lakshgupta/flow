import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RightRailViolationsPanel, type RightRailViolationsPanelProps } from "./RightRailPanels";
import type { EdgeTypeViolation } from "../types";

function violation(overrides: Partial<EdgeTypeViolation> = {}): EdgeTypeViolation {
  return {
    path: "data/content/execution/note.md",
    graph: "execution",
    fromID: "note-a",
    fromType: "note",
    toID: "task-a",
    toType: "task",
    relationship: "depends-on",
    severity: "error",
    message: "depends-on requires a task or command source; a note cannot declare execution dependencies",
    ...overrides,
  };
}

function renderPanel(props: Partial<RightRailViolationsPanelProps> = {}) {
  const panelProps: RightRailViolationsPanelProps = {
    graphPath: "execution",
    violations: [],
    fixableEdgeKeys: new Set(),
    onFixViolation: vi.fn(),
    onFixAll: vi.fn(),
    onSelectViolation: vi.fn(),
    ...props,
  };
  render(<RightRailViolationsPanel {...panelProps} />);
  return panelProps;
}

describe("RightRailViolationsPanel", () => {
  it("renders an empty state when the graph has no violations", () => {
    renderPanel({ violations: [] });

    expect(screen.getByText("No edge-type violations in this graph.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fix all/i })).not.toBeInTheDocument();
  });

  it("renders a hint when no graph is open", () => {
    renderPanel({ graphPath: "", violations: [violation()] });

    expect(screen.getByText("Open a graph to inspect its edge-type violations.")).toBeInTheDocument();
  });

  it("lists violations with errors first and highlights the edge on click", () => {
    const onSelectViolation = vi.fn();
    renderPanel({
      violations: [
        violation({ severity: "warning", fromID: "task-b", toID: "note-b", relationship: "relates-to" }),
        violation({ severity: "error", fromID: "note-a", toID: "task-a" }),
      ],
      onSelectViolation,
    });

    const cards = screen.getAllByRole("button", { name: /^Highlight / });
    expect(cards).toHaveLength(2);
    expect(cards[0]?.textContent).toContain("error");
    expect(cards[1]?.textContent).toContain("warning");

    fireEvent.click(cards[0]!);
    expect(onSelectViolation).toHaveBeenCalledTimes(1);
    expect(onSelectViolation.mock.calls[0]?.[0]).toMatchObject({ fromID: "note-a", toID: "task-a" });
  });

  it("shows a quick-fix button only for fixable edges with the replacement label", () => {
    const onFixViolation = vi.fn();
    renderPanel({
      violations: [
        violation({ fromID: "note-a", toID: "task-a", severity: "error", fixTags: [] }),
        violation({ fromID: "task-b", toID: "note-b", severity: "warning", fixTags: ["relates-to"] }),
      ],
      fixableEdgeKeys: new Set(["note-a\u0000task-a", "task-b\u0000note-b"]),
      onFixViolation,
    });

    const removeButton = screen.getByRole("button", { name: "Remove tag" });
    fireEvent.click(removeButton);
    expect(onFixViolation).toHaveBeenCalledTimes(1);
    expect(onFixViolation.mock.calls[0]?.[0]).toMatchObject({ fromID: "note-a" });

    fireEvent.click(screen.getByRole("button", { name: "relates-to" }));
    expect(onFixViolation).toHaveBeenCalledTimes(2);
  });

  it("hides the quick-fix button for edges that are not editable links", () => {
    renderPanel({
      violations: [violation({ fromID: "note-a", toID: "task-a" })],
      fixableEdgeKeys: new Set(),
    });

    expect(screen.queryByRole("button", { name: "Remove tag" })).not.toBeInTheDocument();
  });

  it("calls onFixAll from the footer button", () => {
    const onFixAll = vi.fn();
    renderPanel({ violations: [violation(), violation({ fromID: "task-b", toID: "note-b" })], onFixAll });

    fireEvent.click(screen.getByRole("button", { name: /fix all \(2\)/i }));
    expect(onFixAll).toHaveBeenCalledTimes(1);
  });
});
