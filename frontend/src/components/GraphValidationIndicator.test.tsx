import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadGraphValidation } from "../lib/api";
import { GraphValidationIndicator } from "./GraphValidationIndicator";
import { TooltipProvider } from "./ui/tooltip";
import type { GraphValidationResponse } from "../types";

vi.mock("../lib/api", () => ({
  loadGraphValidation: vi.fn(),
}));

const mockedLoadGraphValidation = vi.mocked(loadGraphValidation);

function validationResponse(overrides: Partial<GraphValidationResponse> = {}): GraphValidationResponse {
  return {
    graph: "execution",
    violations: [],
    errorCount: 0,
    warningCount: 0,
    ...overrides,
  };
}

function renderIndicator(props: { graphPath: string; reloadToken: number }) {
  return render(
    <TooltipProvider>
      <GraphValidationIndicator {...props} />
    </TooltipProvider>,
  );
}

describe("GraphValidationIndicator", () => {
  beforeEach(() => {
    mockedLoadGraphValidation.mockReset();
  });

  it("renders nothing when there are no violations", async () => {
    mockedLoadGraphValidation.mockResolvedValue(validationResponse());

    renderIndicator({ graphPath: "execution", reloadToken: 0 });

    await waitFor(() => expect(mockedLoadGraphValidation).toHaveBeenCalledWith("execution"));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("hides the badge when the fetch fails", async () => {
    mockedLoadGraphValidation.mockRejectedValue(new Error("network"));

    renderIndicator({ graphPath: "execution", reloadToken: 0 });

    await waitFor(() => expect(mockedLoadGraphValidation).toHaveBeenCalled());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a warning badge with the warning count", async () => {
    mockedLoadGraphValidation.mockResolvedValue(validationResponse({
      violations: [
        {
          path: "data/content/execution/note.md",
          graph: "execution",
          fromID: "note-a",
          fromType: "task",
          toID: "note-b",
          toType: "note",
          relationship: "depends-on",
          severity: "warning",
          message: "depends-on targets a note",
        },
      ],
      warningCount: 1,
    }));

    renderIndicator({ graphPath: "execution", reloadToken: 0 });

    const badge = await screen.findByRole("button", { name: /0 edge-type errors, 1 warnings/ });
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("1");
    expect(badge.classList.contains("graph-validation-indicator-error")).toBe(false);
  });

  it("renders an error badge with error styling when errors exist", async () => {
    mockedLoadGraphValidation.mockResolvedValue(validationResponse({
      violations: [
        {
          path: "data/content/execution/note.md",
          graph: "execution",
          fromID: "note-a",
          fromType: "note",
          toID: "note-b",
          toType: "note",
          relationship: "depends-on",
          severity: "error",
          message: "a note cannot declare execution dependencies",
        },
      ],
      errorCount: 1,
    }));

    renderIndicator({ graphPath: "execution", reloadToken: 0 });

    const badge = await screen.findByRole("button", { name: /1 edge-type errors, 0 warnings/ });
    expect(badge.classList.contains("graph-validation-indicator-error")).toBe(true);
    expect(badge.textContent).toContain("1");
  });

  it("refetches when the reload token changes", async () => {
    mockedLoadGraphValidation.mockResolvedValue(validationResponse());
    const { rerender } = renderIndicator({ graphPath: "execution", reloadToken: 0 });

    await waitFor(() => expect(mockedLoadGraphValidation).toHaveBeenCalledTimes(1));

    rerender(
      <TooltipProvider>
        <GraphValidationIndicator graphPath="execution" reloadToken={1} />
      </TooltipProvider>,
    );
    await waitFor(() => expect(mockedLoadGraphValidation).toHaveBeenCalledTimes(2));
  });

  it("calls onOpen when the badge is clicked", async () => {
    mockedLoadGraphValidation.mockResolvedValue(validationResponse({
      violations: [
        {
          path: "data/content/execution/note.md",
          graph: "execution",
          fromID: "note-a",
          fromType: "note",
          toID: "note-b",
          toType: "note",
          relationship: "depends-on",
          severity: "error",
          message: "a note cannot declare execution dependencies",
        },
      ],
      errorCount: 1,
    }));
    const onOpen = vi.fn();

    render(
      <TooltipProvider>
        <GraphValidationIndicator graphPath="execution" reloadToken={0} onOpen={onOpen} />
      </TooltipProvider>,
    );

    const badge = await screen.findByRole("button", { name: /1 edge-type errors, 0 warnings/ });
    fireEvent.click(badge);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
