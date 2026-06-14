import { ThemeProvider } from "./lib/theme";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { DocumentResponse } from "./types";

vi.mock("./WysiwygEditor", () => ({
  WysiwygEditor: ({ ariaLabel, value, onChange }: { ariaLabel: string; value: string; onChange: (value: string) => void }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock("@xyflow/react", async () => {
  const React = await import("react");

  function rectanglesIntersect(
    left: { x: number; y: number; width: number; height: number },
    right: { x: number; y: number; width: number; height: number },
  ): boolean {
    return left.x < right.x + right.width
      && left.x + left.width > right.x
      && left.y < right.y + right.height
      && left.y + left.height > right.y;
  }

  return {
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    ReactFlow: ({ nodes, onInit, onNodeClick, onNodeDoubleClick, onNodeDragStop, onPaneClick, onMoveEnd }: any) => {
      const nodesRef = React.useRef(nodes);

      React.useEffect(() => {
        nodesRef.current = nodes;
      }, [nodes]);

      React.useEffect(() => {
        onInit?.({
          toObject: () => ({ nodes: nodesRef.current }),
          getNode: (id: string) => nodesRef.current.find((node: any) => node.id === id),
          getIntersectingNodes: (candidate: any) => {
            const width = candidate.width ?? 0;
            const height = candidate.height ?? 0;
            const position = candidate.position ?? { x: 0, y: 0 };

            return nodesRef.current.filter((node: any) => {
              if (node.id === candidate.id) {
                return false;
              }

              return rectanglesIntersect(
                { x: position.x, y: position.y, width, height },
                {
                  x: node.position.x,
                  y: node.position.y,
                  width: node.width ?? 0,
                  height: node.height ?? 0,
                },
              );
            });
          },
        });
      }, [onInit]);

      return (
        <div data-testid="react-flow-mock">
          {nodes.map((node: any) => (
            <div key={node.id} data-testid={`flow-node-${node.id}`}>
              <span>{node.data.title}</span>
              <button type="button" onClick={() => onNodeClick?.({}, node)}>
                Select {node.id}
              </button>
              <button type="button" onDoubleClick={() => onNodeDoubleClick?.({}, node)}>
                Open {node.id}
              </button>
              <button
                type="button"
                onClick={() =>
                  onNodeDragStop?.({}, {
                    ...node,
                    position: { x: 446, y: 200 },
                  })
                }
              >
                Drag stop {node.id}
              </button>
            </div>
          ))}
          <button type="button" onClick={() => onPaneClick?.()}>
            Clear selection
          </button>
          <button type="button" onClick={() => onMoveEnd?.()}>
            Move end
          </button>
        </div>
      );
    },
    Background: () => <div data-testid="flow-background" />,
    Controls: () => <div data-testid="flow-controls" />,
    useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    applyNodeChanges: (_changes: unknown, nodes: unknown) => nodes,
    getSmoothStepPath: () => ["M0 0", 0, 0],
    MarkerType: { ArrowClosed: "arrowclosed" },
    Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
  };
});

import { App } from "./App";

export type MockResponseOptions = {
  status?: number;
};

export type MockFetchHandler = (url: string, init?: RequestInit) => unknown | Promise<unknown>;

export const workspaceResponse = {
  scope: "local",
  workspacePath: "/tmp/flow-workspace",
  flowPath: "/tmp/flow-workspace/.flow",
  configPath: "/tmp/flow-workspace/.flow/config/config.toml",
  indexPath: "/tmp/flow-workspace/.flow/config/flow.index",
  homePath: "data/home.md",
  guiPort: 4812,
  appearance: "system" as const,
  panelWidths: { leftRatio: 0.31, rightRatio: 0.22, documentTOCRatio: 0.18 },
  appVersion: "0.4.0-dev",
  licenseText: "Apache License 2.0",
  copyrightText: "Copyright (c) Flow contributors",
};

export const homeResponse = {
  id: "home",
  type: "home",
  title: "Home",
  description: "",
  path: "data/home.md",
  body: "# Home\n",
};

export const emptyGraphLists = {
  notes: { type: "note", availableGraphs: [], graphItems: {} },
  tasks: { type: "task", availableGraphs: [], graphItems: {} },
  commands: { type: "command", availableGraphs: [], graphItems: {} },
};

export const graphTreeResponse = {
  home: homeResponse,
  graphs: [
    {
      graphPath: "execution",
      displayName: "Execution",
      directCount: 1,
      totalCount: 1,
      hasChildren: false,
      countLabel: "1 direct / 1 total",
      files: [
        {
          id: "note-1",
          type: "note",
          title: "Overview",
          path: "data/graphs/execution/overview.md",
          fileName: "overview.md",
        },
      ],
    },
  ],
};

export function noteGraphs(...paths: string[]) {
  return {
    type: "note",
    availableGraphs: paths,
    graphItems: Object.fromEntries(paths.map((p) => [p, []])),
  };
}

export function jsonResponse(body: unknown, options?: MockResponseOptions): Response {
  return new Response(JSON.stringify(body), {
    status: options?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

export function installFetchMock(handler: MockFetchHandler) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url === "/api/calendar-documents") {
      return jsonResponse([]);
    }

    const result = await handler(url, init);

    if (result instanceof Response) {
      return result;
    }

    return jsonResponse(result);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function createDeferredValue<T>() {
  let resolve: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });

  return {
    promise,
    resolve(value: T) {
      resolve?.(value);
    },
  };
}

export function getRequestBody(fetchMock: ReturnType<typeof vi.fn>, path: string, method: string): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(([url, init]) => {
    const requestURL = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    return requestURL === path && (init?.method ?? "GET") === method;
  });

  if (call === undefined) {
    throw new Error(`missing ${method} ${path} request`);
  }

  const body = call[1]?.body;
  if (typeof body !== "string") {
    throw new Error(`expected string body for ${method} ${path}`);
  }

  return JSON.parse(body) as Record<string, unknown>;
}

export async function findSidebarTreeButton(label: string, kind: "graph" | "file" = "graph"): Promise<HTMLElement> {
  const button = (await screen.findByText(label)).closest('[data-sidebar="menu-sub-button"]');
  if (!(button instanceof HTMLElement)) {
    throw new Error(`missing ${label} ${kind} button`);
  }

  return button;
}

export function getSidebarTreeButton(label: string, kind: "graph" | "file" = "graph"): HTMLElement {
  const button = screen.getByText(label).closest('[data-sidebar="menu-sub-button"]');
  if (!(button instanceof HTMLElement)) {
    throw new Error(`missing ${label} ${kind} button`);
  }

  return button;
}

export async function expandSidebarGraph(graphLabel: string): Promise<void> {
  const sidebar = document.querySelector('[data-sidebar="sidebar"]');
  if (!(sidebar instanceof HTMLElement)) return;
  const row = within(sidebar).getByText(graphLabel).closest("li");
  if (!row) return;
  const expandBtn = row.querySelector('button[aria-label="Expand"]');
  if (expandBtn instanceof HTMLElement) {
    await userEvent.click(expandBtn);
  }
}

export function renderApp() {
  return render(<ThemeProvider><App /></ThemeProvider>);
}
