import { definePlugin } from "prosekit/core";
import { Plugin, PluginKey } from "prosekit/pm/state";
import { Decoration, DecorationSet } from "prosekit/pm/view";

export const searchHighlightPluginKey = new PluginKey("searchHighlight");

type SearchHighlightState = {
  query: string;
  index: number;
  decorations: DecorationSet;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildDecorations(doc: any, query: string, currentIndex: number): DecorationSet {
  const trimmed = query.trim();
  if (trimmed === "") return DecorationSet.empty;
  const escaped = escapeRegExp(trimmed);
  let regex: RegExp;
  try {
    regex = new RegExp(escaped, "gi");
  } catch {
    return DecorationSet.empty;
  }
  const decorations: Decoration[] = [];
  let globalIndex = 0;
  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return true;
    const text: string = node.text as string;
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      const isCurrent = globalIndex === currentIndex;
      const className = isCurrent ? "local-search-match local-search-match-current" : "local-search-match";
      decorations.push(Decoration.inline(from, to, { class: className }));
      globalIndex += 1;
      if (match[0].length === 0) regex.lastIndex += 1;
    }
    return true;
  });
  return DecorationSet.create(doc, decorations);
}

function getSearchState(state: any): SearchHighlightState {
  const pluginState = searchHighlightPluginKey.getState(state) as SearchHighlightState | undefined;
  if (pluginState) return pluginState;
  return { query: "", index: 0, decorations: DecorationSet.empty };
}

export function defineSearchHighlight() {
  return definePlugin(() => {
    return new Plugin({
      key: searchHighlightPluginKey,
      state: {
        init(): SearchHighlightState {
          return { query: "", index: 0, decorations: DecorationSet.empty };
        },
        apply(tr: any, prev: SearchHighlightState, _oldState: any, newState: any): SearchHighlightState {
          const meta = tr.getMeta(searchHighlightPluginKey) as { query?: string; index?: number } | undefined;
          let query = prev.query;
          let index = prev.index;
          let changed = false;
          if (meta !== undefined) {
            if (typeof meta.query === "string") {
              query = meta.query;
              changed = true;
            }
            if (typeof meta.index === "number") {
              index = meta.index;
              changed = true;
            }
          }
          // Rebuild if doc changed and we have a query
          if (tr.docChanged && query.trim() !== "") {
            changed = true;
          }
          if (!changed) {
            // Still need to map decorations if docChanged without query change? but empty
            if (tr.docChanged) {
              return { query, index, decorations: prev.decorations.map(tr.mapping, tr.doc) };
            }
            return prev;
          }
          const decorations = buildDecorations(newState.doc, query, index);
          return { query, index, decorations };
        },
      },
      props: {
        decorations(state: any) {
          const s = getSearchState(state);
          return s.decorations;
        },
      },
    });
  });
}

export function setSearchHighlight(editor: any, query: string, index: number) {
  if (!editor?.view) return;
  const view = editor.view;
  const tr = view.state.tr.setMeta(searchHighlightPluginKey, { query, index });
  view.dispatch(tr);
}

export function getSearchHighlightCount(editor: any): number {
  if (!editor?.view) return 0;
  const state = getSearchState(editor.view.state);
  // Count decorations
  let count = 0;
  // DecorationSet has find but easier to count via internal? we can iterate
  // Use private: state.decorations.find() returns array
  try {
    // decorations is DecorationSet, its find returns all
    const found = (state.decorations as any).find();
    if (Array.isArray(found)) count = found.length;
  } catch {}
  return count;
}
