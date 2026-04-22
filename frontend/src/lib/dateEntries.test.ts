import { describe, expect, it } from "vitest";

import { findAllDateMentions, parseDateEntries, toISODateString } from "./dateEntries";

describe("dateEntries", () => {
  it("formats dates as YYYY-MM-DD", () => {
    expect(toISODateString(new Date(2026, 3, 19))).toBe("2026-04-19");
  });

  it("parses dated markdown sections into entries", () => {
    expect(parseDateEntries("# Notes\n\n## 2026-04-19\nFirst\n\n## 2026-04-20\nSecond\n")).toEqual([
      { date: "2026-04-19", content: "First" },
      { date: "2026-04-20", content: "Second" },
    ]);
  });

  it("finds distinct non-empty blocks that mention a date", () => {
    expect(findAllDateMentions("## 2026-04-19\nPlanned work\n\nAnother 2026-04-19 mention\n", "2026-04-19")).toEqual([
      "## 2026-04-19\nPlanned work",
      "Another 2026-04-19 mention",
    ]);
  });
});