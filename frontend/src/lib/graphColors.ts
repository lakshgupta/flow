export type GraphDirectoryColorId =
  | "rose"
  | "peach"
  | "amber"
  | "lemon"
  | "mint"
  | "sage"
  | "sky"
  | "lilac"
  | "blush";

export type GraphDirectoryColorOption = {
  id: GraphDirectoryColorId;
  label: string;
  hex: string;
};

export const GRAPH_DIRECTORY_COLOR_OPTIONS: GraphDirectoryColorOption[] = [
  { id: "rose", label: "Rose", hex: "#f4c7cf" },
  { id: "peach", label: "Peach", hex: "#f8d6ba" },
  { id: "amber", label: "Amber", hex: "#f5e2b8" },
  { id: "lemon", label: "Lemon", hex: "#f4efbb" },
  { id: "mint", label: "Mint", hex: "#c8edd5" },
  { id: "sage", label: "Sage", hex: "#d0e3c6" },
  { id: "sky", label: "Sky", hex: "#c7e3f6" },
  { id: "lilac", label: "Lilac", hex: "#dacff6" },
  { id: "blush", label: "Blush", hex: "#f2d1df" },
];

export const GRAPH_DIRECTORY_COLOR_BY_ID: Record<GraphDirectoryColorId, GraphDirectoryColorOption> =
  Object.fromEntries(
    GRAPH_DIRECTORY_COLOR_OPTIONS.map((option) => [option.id, option]),
  ) as Record<GraphDirectoryColorId, GraphDirectoryColorOption>;

export function isGraphDirectoryColorId(value: string): value is GraphDirectoryColorId {
  return Object.prototype.hasOwnProperty.call(GRAPH_DIRECTORY_COLOR_BY_ID, value);
}

export function graphDirectoryColorHex(value?: string): string | undefined {
  if (!value || !isGraphDirectoryColorId(value)) {
    return undefined;
  }

  return GRAPH_DIRECTORY_COLOR_BY_ID[value].hex;
}

export function resolveGraphDirectoryColor(graphPath: string, graphColorsByPath: Record<string, string>): string | undefined {
  const trimmedGraphPath = graphPath.trim();
  let bestMatch: string | undefined;
  let bestMatchLength = -1;

  for (const [candidatePath, candidateColor] of Object.entries(graphColorsByPath)) {
    const trimmedCandidatePath = candidatePath.trim();
    const trimmedCandidateColor = candidateColor.trim();
    if (trimmedCandidatePath === "" || trimmedCandidateColor === "") {
      continue;
    }

    if (trimmedGraphPath === trimmedCandidatePath || trimmedGraphPath.startsWith(`${trimmedCandidatePath}/`)) {
      if (trimmedCandidatePath.length > bestMatchLength) {
        bestMatch = trimmedCandidateColor;
        bestMatchLength = trimmedCandidatePath.length;
      }
    }
  }

  return bestMatch;
}

export function resolveParentGraphDirectoryColor(graphPath: string, graphColorsByPath: Record<string, string>): string | undefined {
  let current = graphPath.trim();

  for (;;) {
    const separatorIndex = current.lastIndexOf("/");
    if (separatorIndex < 0) {
      break;
    }

    current = current.slice(0, separatorIndex).trim();
    if (current === "") {
      break;
    }

    const color = resolveGraphDirectoryColor(current, graphColorsByPath);
    if (color !== undefined) {
      return color;
    }
  }

  return resolveGraphDirectoryColor(graphPath, graphColorsByPath);
}
