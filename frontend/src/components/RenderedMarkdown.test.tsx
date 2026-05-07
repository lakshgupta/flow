import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderMermaidDiagramSource } from "../lib/mermaid";

import { RenderedMarkdown } from "./RenderedMarkdown";

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
      expect.stringContaining("flow-rendered-mermaid-"),
    );
  });

  it("skips Mermaid rendering for non-Mermaid code blocks", () => {
    render(<RenderedMarkdown ariaLabel="Rendered markdown" value={"```ts\nconst value = 1\n```\n"} />);

    expect(renderMermaidDiagramSource).not.toHaveBeenCalled();
  });
});