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
  links: "",
  name: "",
  env: "",
  run: "",
  color: "",
};

export const emptyHomeFormState: HomeFormState = {
  title: "Home",
  description: "",
  body: "",
};

const HOME_EMPTY_PARAGRAPH_PATTERN = /^(?:\s*<p><br><\/p>\s*)+$/;

export function normalizeHomeBodyForSave(body: string): string {
  const normalized = body.trim();
  if (normalized.length === 0 || HOME_EMPTY_PARAGRAPH_PATTERN.test(normalized)) {
    return "";
  }
  return body;
}

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

export function headingDisplayText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\[\]\n]+)\]\]/g, "$1")
    .replace(/(\*\*\*|\*\*|___|__)(?=\S)(.*?)\1/g, "$2")
    .replace(/(?<![\w\\])([*_])(?=\S)(.*?)\1(?!\w)/g, "$2")
    .replace(/~~(?=\S)(.*?)~~/g, "$1")
    .replace(/(`+)([^`]*?)\1/g, "$2")
    .replace(/\\([\\`*_{}[\]()#+.!~-])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
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
    return { ...basePayload, status: "Ready" };
  }

  if (type === "command") {
    return {
      ...basePayload,
      name: userFileName,
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
    links: joinList((document.links ?? []).map((link) => link.node)),
    name: document.name ?? "",
    env: serializeEnv(document.env),
    run: document.run ?? "",
    color: document.color ?? "",
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
      const rawText = match[2].trim();
      const text = headingDisplayText(rawText);
      if (text === "") {
        continue;
      }
      toc.push({ level, text, id: headingIdFromText(rawText) });
    }
  }
  return toc;
}

export function isBodyLeadingHeadingDuplicated(body: string, title: string): boolean {
  if (typeof body !== "string" || typeof title !== "string") return false;
  const trimmedTitle = title.trim();
  if (trimmedTitle === "") return false;
  const lines = body.trimStart().split("\n");
  const first = lines[0]?.trim() ?? "";
  const match = first.match(/^#{1,6}\s+(.+)$/);
  if (!match) return false;
  const rawHeading = (match[2] ?? "").trim();
  if (rawHeading === "") return false;
  const headingText = headingDisplayText(rawHeading);
  return headingText.toLowerCase() === headingDisplayText(trimmedTitle).toLowerCase();
}

export function stripLeadingTitleHeading(body: string, title: string): string {
  if (typeof body !== "string" || typeof title !== "string") return body ?? "";
  if (!isBodyLeadingHeadingDuplicated(body, title)) return body;
  const lines = body.split("\n");
  // Find first non-empty line index
  let firstIdx = 0;
  while (firstIdx < lines.length && lines[firstIdx].trim() === "") firstIdx++;
  if (firstIdx >= lines.length) return body;
  lines.splice(firstIdx, 1);
  // Also remove a single following empty line to avoid double gap
  if (lines[firstIdx]?.trim() === "") lines.splice(firstIdx, 1);
  return lines.join("\n");
}
