import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RenderedMarkdown } from "./RenderedMarkdown";

describe("RenderedMarkdown", () => {
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
