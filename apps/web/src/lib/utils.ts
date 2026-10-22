/**
 * @file utils.ts
 * @description shadcn-convention class-name utility for the shared/ui
 * primitives layer (spec 129 PR-F3). This file did not exist before PR-F3;
 * it is created here because every shadcn-based primitive imports `cn`.
 * clsx composes conditional classes; tailwind-merge resolves conflicting
 * Tailwind utilities so a consumer's className override wins predictably.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
