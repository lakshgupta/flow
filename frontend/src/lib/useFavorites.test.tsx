import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useFavorites } from "./useFavorites";

describe("useFavorites", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("should initialize with empty array if nothing in localStorage", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
    expect(result.current.isFavorite("graph1")).toBe(false);
  });

  it("should initialize with values from localStorage", () => {
    window.localStorage.setItem("flow_favorite_graphs", JSON.stringify(["graph1", "graph2"]));
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual(["graph1", "graph2"]);
    expect(result.current.isFavorite("graph1")).toBe(true);
  });

  it("should toggle favorite status and update localStorage", () => {
    const { result } = renderHook(() => useFavorites());
    
    act(() => {
      result.current.toggleFavorite("graph1");
    });
    
    expect(result.current.favorites).toEqual(["graph1"]);
    expect(result.current.isFavorite("graph1")).toBe(true);
    expect(window.localStorage.getItem("flow_favorite_graphs")).toBe(JSON.stringify(["graph1"]));
    
    act(() => {
      result.current.toggleFavorite("graph1");
    });
    
    expect(result.current.favorites).toEqual([]);
    expect(result.current.isFavorite("graph1")).toBe(false);
    expect(window.localStorage.getItem("flow_favorite_graphs")).toBe(JSON.stringify([]));
  });
});
