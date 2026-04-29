import type { CalendarDocumentResponse, GraphTreeResponse, ReferenceTargetResponse, WorkspaceResponse, WorkspaceSnapshot } from "../types";

function normalizeGraphTreeResponse(response: GraphTreeResponse): GraphTreeResponse {
  return {
    ...response,
    graphs: response.graphs.map((graphNode) => ({
      ...graphNode,
      color: graphNode.color ?? "",
      files: graphNode.files ?? [],
    })),
  };
}

export async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const [workspaceData, graphTreeData] = await Promise.all([
    requestJSON<WorkspaceResponse>("/api/workspace"),
    requestJSON<GraphTreeResponse>("/api/graphs"),
  ]);

  return { workspaceData, graphTreeData: normalizeGraphTreeResponse(graphTreeData) };
}

export async function loadCalendarDocuments(): Promise<CalendarDocumentResponse[]> {
  return requestJSON<CalendarDocumentResponse[]>("/api/calendar-documents");
}

export async function loadReferenceTargets(query: string, graphPath?: string, limit = 8): Promise<ReferenceTargetResponse[]> {
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("limit", String(limit));
  if ((graphPath ?? "").trim() !== "") {
    params.set("graph", graphPath!.trim());
  }

  return requestJSON<ReferenceTargetResponse[]>(`/api/reference-targets?${params.toString()}`);
}
