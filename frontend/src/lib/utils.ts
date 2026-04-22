import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}