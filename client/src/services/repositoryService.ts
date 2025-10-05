import { normalizeGitHubUrl } from "@/lib/utils";

/**
 * Repository Service - Handles all repository-related operations
 * Following SOLID principles with single responsibility for repository management
 */

export interface RepoRequest {
  github_url: string;
}

export interface RepoResponse {
  repo_id: string;
  status: string;
  files_processed: number;
  index_name: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  message?: string;
}

export interface RepositoryServiceConfig {
  baseUrl: string;
}

/**
 * Repository Service Class
 * Single Responsibility: Handle repository operations (clone, ingest, etc.)
 */
export class RepositoryService {
  private readonly baseUrl: string;

  constructor(config: RepositoryServiceConfig) {
    this.baseUrl = config.baseUrl;
  }

  // Add this to your repositoryService.ts

  /**
   * Generate diagram for a repository
   * @param repoId - Repository ID (can be GitHub URL or repo_id)
   * @returns Promise with diagram data
   */
  async generateDiagram(
    repoId: string
  ): Promise<ApiResponse<{ diagram: string }>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/diagram/diagram?repo_id=${encodeURIComponent(repoId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true"
          },
        }
      );

      const result = await response.json();

      if (response.ok && result.status === "success") {
        return {
          data: result.data,
          success: true,
          message: result.message,
        };
      } else {
        return {
          data: { diagram: "" },
          success: false,
          error: result.message || `Server error: ${response.status}`,
          message: result.message,
        };
      }
    } catch (error) {
      console.error("Diagram generation error:", error);
      return {
        data: { diagram: "" },
        success: false,
        error:
          error instanceof Error ? error.message : "Network error occurred",
      };
    }
  }

  /**
   * Clone and ingest a repository
   * @param githubUrl - GitHub repository URL
   * @returns Promise with repository information
   */
  async cloneAndIngest(githubUrl: string): Promise<ApiResponse<RepoResponse>> {
    try {
      // Normalize the URL to ensure it has https:// protocol
      const normalizedUrl = normalizeGitHubUrl(githubUrl);

      const response = await fetch(`${this.baseUrl}/repos/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ github_url: normalizedUrl }),
      });

      const result = await response.json();

      // Handle server response format
      if (response.ok && result.status === "success") {
        return {
          data: result.data,
          success: true,
          message: result.message,
        };
      } else {
        // Server returned an error response
        return {
          data: {} as RepoResponse,
          success: false,
          error: result.message || `Server error: ${response.status}`,
          message: result.message,
        };
      }
    } catch (error) {
      console.error("Repository clone/ingest error:", error);
      return {
        data: {} as RepoResponse,
        success: false,
        error:
          error instanceof Error ? error.message : "Network error occurred",
      };
    }
  }

  /**
   * Generate code tree for a repository
   * @param githubUrl - GitHub repository URL
   * @returns Promise with code tree information
   */
  async generateCodeTree(
    githubUrl: string
  ): Promise<ApiResponse<{ repo_id: string; tree: any }>> {
    try {
      // Normalize the URL to ensure it has https:// protocol
      const normalizedUrl = normalizeGitHubUrl(githubUrl);

      const response = await fetch(`${this.baseUrl}/tree/code-tree`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ github_url: normalizedUrl }),
      });

      const result = await response.json();

      // Handle server response format
      if (response.ok && result.status === "success") {
        return {
          data: result.data,
          success: true,
          message: result.message,
        };
      } else {
        // Server returned an error response
        return {
          data: { repo_id: "", tree: null },
          success: false,
          error: result.message || `Server error: ${response.status}`,
          message: result.message,
        };
      }
    } catch (error) {
      console.error("Code tree generation error:", error);
      return {
        data: { repo_id: "", tree: null },
        success: false,
        error:
          error instanceof Error ? error.message : "Network error occurred",
      };
    }
  }

  /**
   * Validate GitHub URL format
   * @param url - URL to validate
   * @returns boolean indicating if URL is valid
   */
  static validateGitHubUrl(url: string): boolean {
    const normalizedUrl = normalizeGitHubUrl(url);
    const githubUrlPattern =
      /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\/)?$/;
    return githubUrlPattern.test(normalizedUrl);
  }

  /**
   * Extract repository information from GitHub URL
   * @param url - GitHub URL
   * @returns Object with owner and repo name
   */
  static parseGitHubUrl(
    url: string
  ): { owner: string; repo: string; fullName: string } | null {
    const normalizedUrl = normalizeGitHubUrl(url);
    const match = normalizedUrl.match(
      /^https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/
    );
    if (!match) return null;

    const [, owner, repo] = match;
    return {
      owner,
      repo,
      fullName: `${owner}/${repo}`,
    };
  }
}

/**
 * Factory function to create repository service instance
 * Following DRY principle - single place to create service instances
 */
export function createRepositoryService(baseUrl?: string): RepositoryService {
  const defaultBaseUrl = process.env.NEXT_PUBLIC_SERVER_URL;
  if (!defaultBaseUrl) {
    throw new Error("NEXT_PUBLIC_SERVER_URL is not set");
  }
  return new RepositoryService({ baseUrl: defaultBaseUrl });
}
