import type { CalendarDocumentResponse, GraphFileUploadResponse, GraphTreeResponse, GraphValidationResponse, ReferenceTargetResponse, WorkspaceResponse, WorkspaceSnapshot } from "../types";

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
    cache: "no-store",
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

export async function selectWorkspace(workspacePath: string): Promise<WorkspaceResponse> {
  return requestJSON<WorkspaceResponse>("/api/workspace/select", {
    method: "PUT",
    body: JSON.stringify({ workspacePath }),
  });
}

export async function deregisterLocalWorkspace(workspacePath: string): Promise<WorkspaceResponse> {
  const params = new URLSearchParams({ workspacePath });
  return requestJSON<WorkspaceResponse>(`/api/workspace/local?${params.toString()}`, {
    method: "DELETE",
  });
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

export async function loadGraphValidation(graphPath?: string): Promise<GraphValidationResponse> {
  const params = new URLSearchParams();
  if ((graphPath ?? "").trim() !== "") {
    params.set("graph", graphPath!.trim());
  }

  const query = params.toString();
  return requestJSON<GraphValidationResponse>(`/api/graph-validation${query ? `?${query}` : ""}`);
}

export type SearchFilters = {
  q: string;
  tag: string;
  title: string;
  description: string;
  content: string;
};

export function buildSearchRequestPath(filters: SearchFilters, limit: number): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  const tag = filters.tag.trim();
  const title = filters.title.trim();
  const description = filters.description.trim();
  const content = filters.content.trim();

  if (q !== "") {
    params.set("q", q);
  }
  if (tag !== "") {
    params.set("tag", tag);
  }
  if (title !== "") {
    params.set("title", title);
  }
  if (description !== "") {
    params.set("description", description);
  }
  if (content !== "") {
    params.set("content", content);
  }

  params.set("limit", String(limit));
  return `/api/search?${params.toString()}`;
}

export async function uploadGraphFiles(graphPath: string, files: FileList | File[]): Promise<GraphFileUploadResponse> {
  const form = new FormData();
  for (const file of Array.from(files)) {
    form.append("files", file);
  }

  const response = await fetch(`/api/graphs/${encodeURIComponent(graphPath)}/files`, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  });

  const payload = (await response.json()) as GraphFileUploadResponse & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }

  return payload;
}
