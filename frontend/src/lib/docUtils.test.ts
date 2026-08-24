import { describe, expect, it } from "vitest";

import { fileNameFromPath, generateTOC, headingDisplayText, headingIdFromText, normalizeHomeBodyForSave } from "./docUtils";

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

  it("strips inline markup from heading display text", () => {
    expect(headingDisplayText("**Bold** and _italic_")).toBe("Bold and italic");
    expect(headingDisplayText("Plan `code` review")).toBe("Plan code review");
    expect(headingDisplayText("[label](https://example.com)")).toBe("label");
    expect(headingDisplayText("![alt](image.png) caption")).toBe("alt caption");
    expect(headingDisplayText("<span data-x=\"1\">Styled</span> heading")).toBe("Styled heading");
    expect(headingDisplayText("See [[target-node]] here")).toBe("See target-node here");
    expect(headingDisplayText("~~done~~ next")).toBe("done next");
    expect(headingDisplayText("my_var stays intact")).toBe("my_var stays intact");
  });

  it("keeps toc ids derived from raw heading text while displaying plain text", () => {
    expect(generateTOC('## <span style="color:red">Status</span> **Update**\n')).toEqual([
      { level: 2, text: "Status Update", id: "span-style-color-red-status-span-update" },
    ]);
  });

  it("extracts the file name from slash-separated paths", () => {
    expect(fileNameFromPath("graphs/execution/task.md")).toBe("task.md");
    expect(fileNameFromPath("note.md")).toBe("note.md");
  });

  it("normalizes Home body saves when content is only empty paragraphs", () => {
    expect(normalizeHomeBodyForSave("<p><br></p>\n")).toBe("");
    expect(normalizeHomeBodyForSave("<p><br></p>\n<p><br></p>\n")).toBe("");
    expect(normalizeHomeBodyForSave("<p>Home</p>\n")).toBe("<p>Home</p>\n");
  });
});