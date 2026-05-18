import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderExcalidrawDiagramSource } from "../lib/excalidraw";
import { renderMermaidDiagramSource } from "../lib/mermaid";

import { RenderedMarkdown } from "./RenderedMarkdown";

vi.mock("../lib/excalidraw", () => ({
  renderExcalidrawDiagramSource: vi.fn(),
}));

vi.mock("../lib/mermaid", () => ({
  renderMermaidDiagramSource: vi.fn(),
}));

describe("RenderedMarkdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Mermaid previews for fenced Mermaid code blocks", async () => {
    vi.mocked(renderMermaidDiagramSource).mockResolvedValue({
      svg: '<svg data-testid="mermaid-preview"></svg>',
    });

    render(<RenderedMarkdown ariaLabel="Rendered markdown" value={"```mermaid\nflowchart TD\nA-->B\n```\n"} />);

    await waitFor(() => {
      expect(screen.getByTestId("mermaid-preview")).toBeInTheDocument();
    });

    expect(renderMermaidDiagramSource).toHaveBeenCalledWith(
      expect.stringContaining("flowchart TD"),
      expect.stringContaining("flow-rendered-diagram-"),
    );
  });

  it("skips Mermaid rendering for non-Mermaid code blocks", () => {
    render(<RenderedMarkdown ariaLabel="Rendered markdown" value={"```ts\nconst value = 1\n```\n"} />);

    expect(renderMermaidDiagramSource).not.toHaveBeenCalled();
  });

  it("renders Excalidraw previews for fenced Excalidraw code blocks", async () => {
    vi.mocked(renderExcalidrawDiagramSource).mockResolvedValue('<svg data-testid="excalidraw-preview"></svg>');

    render(<RenderedMarkdown ariaLabel="Rendered markdown" value={"```excalidraw\n{\"type\":\"excalidraw\"}\n```\n"} />);

    await waitFor(() => {
      expect(screen.getByTestId("excalidraw-preview")).toBeInTheDocument();
    });

    expect(renderExcalidrawDiagramSource).toHaveBeenCalledWith(expect.stringContaining('"type":"excalidraw"'));
  });

  it("adds fold and unfold controls for nested lists", () => {
    render(<RenderedMarkdown ariaLabel="Rendered markdown" value={"- Parent\n  - Child\n"} />);

    const container = screen.getByLabelText("Rendered markdown");
    const toggleButton = within(container).getByRole("button", { name: "Collapse nested list" });
    const nestedList = container.querySelector("li > ul");
    if (!(nestedList instanceof HTMLElement)) {
      throw new Error("expected nested list to be rendered");
    }

    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(nestedList.hidden).toBe(false);

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    expect(nestedList.hidden).toBe(true);

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(nestedList.hidden).toBe(false);
  });
});