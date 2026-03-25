import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges conditional class values while resolving Tailwind utility conflicts.
 *
 * Use this for all shared component class composition so variant helpers, caller-supplied
 * overrides, and conditional utilities collapse into a deterministic class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
