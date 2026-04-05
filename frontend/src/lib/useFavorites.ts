import { useState, useCallback } from "react";

const FAVORITES_KEY = "flow_favorite_graphs";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const item = window.localStorage.getItem(FAVORITES_KEY);
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.warn("Error reading favorites from localStorage", error);
      return [];
    }
  });

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((f) => f !== id)
        : [...prev, id];
      
      try {
        window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch (error) {
        console.warn("Error saving favorites to localStorage", error);
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => {
    return favorites.includes(id);
  }, [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}
