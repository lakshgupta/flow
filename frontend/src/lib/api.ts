import type { CalendarDocumentResponse, GraphTreeResponse, WorkspaceResponse, WorkspaceSnapshot } from "../types";

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

  return { workspaceData, graphTreeData };
}

export async function loadCalendarDocuments(): Promise<CalendarDocumentResponse[]> {
  return requestJSON<CalendarDocumentResponse[]>("/api/calendar-documents");
}
