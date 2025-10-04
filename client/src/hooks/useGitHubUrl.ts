import { useState, useCallback } from "react";
import { GitHubUrlValidation } from "@/types";
import { extractGitHubInfo, normalizeGitHubUrl } from "@/lib/utils";

/**
 * Custom hook for GitHub URL management following DRY principle
 * Single responsibility: Handle GitHub URL validation and parsing
 */
export function useGitHubUrl() {
  const [url, setUrl] = useState("");

  const validateUrl = useCallback(
    (urlToValidate: string): GitHubUrlValidation => {
      if (!urlToValidate.trim()) {
        return { isValid: false };
      }

      const githubInfo = extractGitHubInfo(urlToValidate);
      if (!githubInfo) {
        return { isValid: false };
      }

      return {
        isValid: true,
        owner: githubInfo.owner,
        repo: githubInfo.repo,
        fullName: githubInfo.fullName,
      };
    },
    []
  );

  const getNormalizedUrl = useCallback(() => {
    return normalizeGitHubUrl(url);
  }, [url]);

  const isValid = validateUrl(url).isValid;

  return {
    url,
    setUrl, // Allow direct setting without auto-normalization
    validateUrl,
    isValid,
    getNormalizedUrl, // Provide method to get normalized URL when needed
  };
}
