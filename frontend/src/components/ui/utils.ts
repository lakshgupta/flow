/**
 * Joins class names, filtering out falsy values. Equivalent to the shadcn
 * `cn` helper but without the tailwind-merge dependency (we keep it simple
 * for editor-internal UI).
 */
export function joinClassNames(...classes: Array<string | false | null | undefined>): string {
  return classes.filter((value): value is string => typeof value === "string" && value.length > 0).join(" ");
}
