import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize GitHub URL by adding https:// if no protocol is present
 * Following KISS principle - simple URL normalization
 * Only adds protocol if completely missing, preserves user's choice
 */
export function normalizeGitHubUrl(url: string): string {
  const trimmedUrl = url.trim();

  // If URL already has a protocol, return as is
  if (trimmedUrl.startsWith("https://")) {
    return trimmedUrl;
  }

  // Only add https:// if no protocol is present at all
  if (!trimmedUrl.includes("://")) {
    return `https://${trimmedUrl}`;
  }

  // Return as is if it has some other protocol or is just a domain
  return trimmedUrl;
}

export function extractGitHubInfo(url: string) {
  // Normalize the URL first
  const normalizedUrl = normalizeGitHubUrl(url);
  const match = normalizedUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
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
