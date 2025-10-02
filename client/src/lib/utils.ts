import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function extractGitHubInfo(url: string) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/)
  if (match) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''),
      fullName: `${match[1]}/${match[2].replace(/\.git$/, '')}`
    }
  }
  return null
}
