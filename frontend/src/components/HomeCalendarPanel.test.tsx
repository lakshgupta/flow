import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderMermaidDiagramSource } from "../lib/mermaid";
import { HomeCalendarPanel } from "./HomeCalendarPanel";

vi.mock("../lib/mermaid", () => ({
  renderMermaidDiagramSource: vi.fn(),
}));

describe("HomeCalendarPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows matching date entries from home and graph documents", () => {
    render(
      <HomeCalendarPanel
        documents={[
          {
            id: "home",
            type: "home",
            graph: "",
            title: "Home",
            path: "data/home.md",
            body: "## 2026-04-19\nHome entry\n",
          },
          {
            id: "note-1",
            type: "note",
            graph: "execution",
            title: "Overview",
            path: "data/content/execution/overview.md",
            body: "## 2026-04-19\nExecution entry\n",
          },
          {
            id: "task-1",
            type: "task",
            graph: "planning",
            title: "Plan",
            path: "data/content/planning/plan.md",
            body: "## 2026-04-20\nPlanning entry\n",
          },
        ]}
        selectedDate="2026-04-19"
        onDateChange={vi.fn()}
      />
    );

    expect(screen.getByText("Workspace Home")).toBeInTheDocument();
    expect(screen.getByText("execution / Overview")).toBeInTheDocument();
    expect(screen.getByText("Home entry")).toBeInTheDocument();
    expect(screen.getByText("Execution entry")).toBeInTheDocument();
    expect(screen.queryByText("Planning entry")).not.toBeInTheDocument();
  });

  it("renders Mermaid previews for matching date entries", async () => {
    vi.mocked(renderMermaidDiagramSource).mockResolvedValue({
      svg: '<svg data-testid="calendar-mermaid-preview"></svg>',
    });

    render(
      <HomeCalendarPanel
        documents={[
          {
            id: "note-1",
            type: "note",
            graph: "execution",
            title: "Overview",
            path: "data/content/execution/overview.md",
            body: "## 2026-04-19\n```mermaid\nflowchart TD\nA-->B\n```\n",
          },
        ]}
        selectedDate="2026-04-19"
        onDateChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("calendar-mermaid-preview")).toBeInTheDocument();
    });

    expect(renderMermaidDiagramSource).toHaveBeenCalledWith(
      expect.stringContaining("flowchart TD"),
      expect.stringContaining("flow-rendered-mermaid-"),
    );
  });
});