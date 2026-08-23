import { describe, expect, it } from "vitest";

import { buildPrintHtml, sanitizeFilename } from "./exportPdf";

describe("sanitizeFilename", () => {
  it("strips illegal chars, normalizes spaces, caps length", () => {
    expect(sanitizeFilename("  Fix: login/timeout * v2  ")).toBe("Fix login timeout v2");
    expect(sanitizeFilename("")).toBe("Flow-export");
    expect(sanitizeFilename("   ")).toBe("Flow-export");
    expect(sanitizeFilename("a".repeat(200)).length).toBe(120);
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe("a b c d e f g h i j");
  });
});

describe("buildPrintHtml", () => {
  it("renders node title, badges, markdown body and status", () => {
    const html = buildPrintHtml(
      [
        { id: "n1", title: "Fix login", type: "task", status: "Done", body: "# Heading\n\nSome **bold** text." },
        { id: "n2", title: "Run tests", type: "command", body: "", run: "go test ./..." },
      ],
      "My export",
    );

    expect(html).toContain("Fix login");
    expect(html).toContain("Run tests");
    expect(html).toContain("task");
    expect(html).toContain("Done");
    expect(html).toContain("go test ./...");
    expect(html).toContain("<h1");
    expect(html).toContain("My export");
  });

  it("escapes title characters in the shell", () => {
    const html = buildPrintHtml(
      [{ id: "n1", title: "A <b> & C", type: "note", body: "" }],
      "Title <x> & y",
    );
    expect(html).toContain("Title &lt;x&gt; &amp; y");
    expect(html).toContain("A &lt;b&gt; &amp; C");
  });
});
