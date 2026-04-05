import type {
  CreateDocumentPayload,
  DocumentFormState,
  DocumentResponse,
  GraphCreateType,
  HomeFormState,
  HomeResponse,
} from "../types";

export const emptyDocumentFormState: DocumentFormState = {
  title: "",
  graph: "",
  tags: "",
  description: "",
  body: "",
  status: "",
  dependsOn: "",
  references: "",
  name: "",
  env: "",
  run: "",
};

export const emptyHomeFormState: HomeFormState = {
  title: "Home",
  description: "",
  body: "",
};

export function formatDocumentType(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function fileNameFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function featureSlugFromGraphPath(graphPath: string): string {
  return graphPath.split("/")[0] ?? graphPath;
}

export function slugifyValue(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized === "" ? "item" : normalized;
}

export function createGraphDocumentPayload(type: GraphCreateType, graphPath: string): CreateDocumentPayload {
  const suffix = Date.now().toString(36);
  const title = type === "note" ? "New Note" : type === "task" ? "New Task" : "New Command";
  const titleSlug = slugifyValue(title);
  const isoTimestamp = new Date().toISOString();
  const basePayload: CreateDocumentPayload = {
    type,
    featureSlug: featureSlugFromGraphPath(graphPath),
    fileName: `${titleSlug}-${suffix}`,
    id: `${type}-${suffix}`,
    graph: graphPath,
    title,
    description: "",
    tags: [],
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    body: "",
    references: [],
  };

  if (type === "task") {
    return { ...basePayload, status: "todo", dependsOn: [] };
  }

  if (type === "command") {
    return {
      ...basePayload,
      name: `command-${suffix}`,
      dependsOn: [],
      env: {},
      run: `echo "Describe ${title.toLowerCase()}"`,
    };
  }

  return basePayload;
}

export function joinList(values?: string[]): string {
  return (values ?? []).join("\n");
}

export function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

export function serializeEnv(env?: Record<string, string>): string {
  return Object.entries(env ?? {})
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function parseEnv(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of value.split("\n")) {
    const line = rawLine.trim();
    if (line === "") {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      throw new Error(`Environment entries must use KEY=VALUE format: ${line}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const envValue = line.slice(separatorIndex + 1);
    if (key === "") {
      throw new Error(`Environment entries must use KEY=VALUE format: ${line}`);
    }

    result[key] = envValue;
  }

  return result;
}

export function createDocumentFormState(document: DocumentResponse | null): DocumentFormState {
  if (document === null) {
    return emptyDocumentFormState;
  }

  return {
    title: document.title,
    graph: document.graph,
    tags: joinList(document.tags),
    description: document.description,
    body: document.body,
    status: document.status ?? "",
    dependsOn: joinList(document.dependsOn),
    references: joinList(document.references),
    name: document.name ?? "",
    env: serializeEnv(document.env),
    run: document.run ?? "",
  };
}

export function createHomeFormState(home: HomeResponse | null): HomeFormState {
  if (home === null) {
    return emptyHomeFormState;
  }

  return {
    title: home.title,
    description: home.description,
    body: home.body,
  };
}

export function generateTOC(markdownText: string): Array<{ level: number; text: string; id: string }> {
  const lines = markdownText.split("\n");
  const toc: Array<{ level: number; text: string; id: string }> = [];
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      toc.push({ level, text, id });
    }
  }
  return toc;
}
