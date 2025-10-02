import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractGitHubInfo(url: string) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ""),
      fullName: `${match[1]}/${match[2].replace(/\.git$/, "")}`,
    };
  }
  return null;
}

/**
 * Format date consistently for SSR/client hydration
 * Prevents hydration mismatches by using a fixed format
 */
export function formatDateConsistent(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${year}`;
}
