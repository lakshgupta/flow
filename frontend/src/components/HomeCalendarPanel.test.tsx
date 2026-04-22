import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HomeCalendarPanel } from "./HomeCalendarPanel";

describe("HomeCalendarPanel", () => {
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
});