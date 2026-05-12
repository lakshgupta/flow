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
  { id: "rose", label: "Rose", hex: "#d8879d" },
  { id: "peach", label: "Peach", hex: "#df9d78" },
  { id: "amber", label: "Amber", hex: "#d7af63" },
  { id: "lemon", label: "Lemon", hex: "#c0b75d" },
  { id: "mint", label: "Mint", hex: "#78b592" },
  { id: "sage", label: "Sage", hex: "#91ac78" },
  { id: "sky", label: "Sky", hex: "#7baed1" },
  { id: "lilac", label: "Lilac", hex: "#a48fd7" },
  { id: "blush", label: "Blush", hex: "#d392aa" },
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
