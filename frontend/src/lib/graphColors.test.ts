import { describe, expect, it } from "vitest";

import { resolveGraphDirectoryColor, resolveParentGraphDirectoryColor } from "./graphColors";

describe("resolveGraphDirectoryColor", () => {
  it("returns the longest matching graph path color", () => {
    const colors = {
      graph1: "rose",
      "graph1/graph11": "lemon",
    };

    expect(resolveGraphDirectoryColor("graph1/graph11", colors)).toBe("lemon");
    expect(resolveGraphDirectoryColor("graph1/graph11/sub", colors)).toBe("lemon");
  });

  it("ignores empty values and trims path keys", () => {
    const colors = {
      " graph1 ": " mint ",
      graph2: "",
    };

    expect(resolveGraphDirectoryColor("graph1/child", colors)).toBe("mint");
    expect(resolveGraphDirectoryColor("graph2", colors)).toBeUndefined();
  });
});

describe("resolveParentGraphDirectoryColor", () => {
  it("prefers parent graph color for nested graphs", () => {
    const colors = {
      graph1: "rose",
      "graph1/graph11": "lemon",
    };

    expect(resolveParentGraphDirectoryColor("graph1/graph11", colors)).toBe("rose");
    expect(resolveParentGraphDirectoryColor("graph1/graph11/sub", colors)).toBe("lemon");
  });

  it("falls back to self color when no parent color exists", () => {
    const colors = {
      graph2: "sage",
    };

    expect(resolveParentGraphDirectoryColor("graph2", colors)).toBe("sage");
    expect(resolveParentGraphDirectoryColor("graph2/sub", colors)).toBe("sage");
  });
});
