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
  links: "",
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

function pathSegments(path: string): string[] {
  return path.split("/").filter((segment) => segment !== "");
}

export function fileNameFromPath(path: string): string {
  const parts = pathSegments(path);
  return parts[parts.length - 1] ?? path;
}

function featureSlugFromGraphPath(graphPath: string): string {
  return pathSegments(graphPath)[0] ?? graphPath;
}

export function slugifyValue(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized === "" ? "item" : normalized;
}

export function headingIdFromText(text: string): string {
  return slugifyValue(text);
}

export function createGraphDocumentPayload(type: GraphCreateType, graphPath: string, userFileName: string): CreateDocumentPayload {
  const baseName = fileNameFromPath(userFileName);
  const title = baseName
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const isoTimestamp = new Date().toISOString();
  const basePayload: CreateDocumentPayload = {
    type,
    featureSlug: featureSlugFromGraphPath(graphPath),
    fileName: userFileName,
    id: `${graphPath}/${userFileName}`,
    graph: graphPath,
    title,
    description: "",
    tags: [],
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    body: "",
    links: [],
  };

  if (type === "task") {
    return { ...basePayload, status: "todo", dependsOn: [] };
  }

  if (type === "command") {
    return {
      ...basePayload,
      name: userFileName,
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
    links: joinList((document.links ?? []).map((link) => link.node)),
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
      const id = headingIdFromText(text);
      toc.push({ level, text, id });
    }
  }
  return toc;
}
