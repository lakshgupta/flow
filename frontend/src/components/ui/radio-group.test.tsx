import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RadioGroup, RadioGroupItem } from "./radio-group";

describe("RadioGroupItem", () => {
  it("uses Radix checked-state class selectors for selected styling", () => {
    render(
      <RadioGroup defaultValue="dark">
        <RadioGroupItem value="dark" aria-label="Dark" />
      </RadioGroup>,
    );

    const radio = screen.getByRole("radio", { name: "Dark" });
    expect(radio.className).toContain("data-[state=checked]:border-primary");
    expect(radio.className).toContain("data-[state=checked]:bg-primary");
    expect(radio.className).toContain("dark:data-[state=checked]:bg-primary");
  });
});
