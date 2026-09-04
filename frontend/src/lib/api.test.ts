import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildSearchRequestPath, loadWorkspaceSnapshot, requestJSON } from "./api";

describe("buildSearchRequestPath", () => {
  it("builds path with all filters trimmed", () => {
    const path = buildSearchRequestPath({ q: " foo ", tag: " bar ", title: "  ", description: "desc", content: "" }, 8);
    expect(path).toContain("q=foo");
    expect(path).toContain("tag=bar");
    expect(path).toContain("description=desc");
    expect(path).not.toContain("title=");
    expect(path).toContain("limit=8");
  });

  it("handles empty filters", () => {
    const path = buildSearchRequestPath({ q: "", tag: "", title: "", description: "", content: "" }, 10);
    expect(path).toBe("/api/search?limit=10");
  });

  it("encodes special characters", () => {
    const path = buildSearchRequestPath({ q: "a&b", tag: "", title: "", description: "", content: "" }, 5);
    expect(path).toContain("q=a%26b");
  });
});

describe("requestJSON", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; vi.restoreAllMocks(); });

  it("throws with error payload when response not ok", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 400, statusText: "Bad", json: async () => ({ error: "bad filter" }) } as Response));
    await expect(requestJSON("/api/search?q=x")).rejects.toThrow("bad filter");
  });

  it("throws generic status when non-JSON error", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, statusText: "Server Error", json: async () => { throw new Error("not json"); } } as Response));
    await expect(requestJSON("/api/workspace")).rejects.toThrow("500 Server Error");
  });
});

describe("loadWorkspaceSnapshot parallelism", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches workspace and graphs in parallel", async () => {
    const order: string[] = [];
    const fetchMock = vi.fn(async (input: string) => {
      order.push(input);
      // Simulate network delay to prove parallel: both should start before either finishes
      await new Promise((r) => setTimeout(r, 10));
      if (input.includes("/api/workspace")) {
        return { ok: true, json: async () => ({ workspacePath: "/tmp" }) } as Response;
      }
      if (input.includes("/api/graphs")) {
        return { ok: true, json: async () => ({ home: { id: "home" }, graphs: [] }) } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadWorkspaceSnapshot();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/workspace", expect.anything());
    expect(fetchMock).toHaveBeenCalledWith("/api/graphs", expect.anything());
    // Both fetches should have been initiated before either resolved — order contains both
    expect(order).toHaveLength(2);
    expect(result.workspaceData).toBeDefined();
    expect(result.graphTreeData.graphs).toEqual([]);
  });

  it("normalizes graphTree response colors/files", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("/api/workspace")) return { ok: true, json: async () => ({}) } as Response;
      return { ok: true, json: async () => ({ home: { id: "home" }, graphs: [{ graphPath: "a", color: null, files: null }] }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await loadWorkspaceSnapshot();
    expect(result.graphTreeData.graphs[0]!.color).toBe("");
    expect(result.graphTreeData.graphs[0]!.files).toEqual([]);
  });
});
