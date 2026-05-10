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
  { id: "rose", label: "Rose", hex: "#e8aebb" },
  { id: "peach", label: "Peach", hex: "#eebf9e" },
  { id: "amber", label: "Amber", hex: "#e7cc96" },
  { id: "lemon", label: "Lemon", hex: "#ddd586" },
  { id: "mint", label: "Mint", hex: "#a9d8b8" },
  { id: "sage", label: "Sage", hex: "#b7cea5" },
  { id: "sky", label: "Sky", hex: "#a7cde5" },
  { id: "lilac", label: "Lilac", hex: "#c4b4e6" },
  { id: "blush", label: "Blush", hex: "#e2b2c5" },
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
