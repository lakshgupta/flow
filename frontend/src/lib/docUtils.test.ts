import { describe, expect, it } from "vitest";

import { fileNameFromPath, generateTOC, headingIdFromText } from "./docUtils";

describe("docUtils", () => {
  it("normalizes heading text into stable ids", () => {
    expect(headingIdFromText("  Hello, Flow World!  ")).toBe("hello-flow-world");
    expect(headingIdFromText("***")).toBe("item");
  });

  it("uses the shared heading id helper when generating a table of contents", () => {
    expect(generateTOC("# Hello, Flow World!\n## Next Step\n")).toEqual([
      { level: 1, text: "Hello, Flow World!", id: "hello-flow-world" },
      { level: 2, text: "Next Step", id: "next-step" },
    ]);
  });

  it("extracts the file name from slash-separated paths", () => {
    expect(fileNameFromPath("graphs/execution/task.md")).toBe("task.md");
    expect(fileNameFromPath("note.md")).toBe("note.md");
  });
});