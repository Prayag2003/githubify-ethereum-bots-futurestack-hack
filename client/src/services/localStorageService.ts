/**
 * LocalStorage Service - Handles storing and retrieving repository data
 * Following SOLID principles with single responsibility for localStorage operations
 */

export interface RepositoryData {
  repo_id: string;
  github_url: string;
  timestamp?: number;
  files_processed?: number;
  index_name?: string;
}

const REPO_DATA_KEY = 'codebase_ai_repo_data';

/**
 * LocalStorage Service Class
 * Single Responsibility: Handle repository data persistence
 */
export class LocalStorageService {
  /**
   * Store repository data in localStorage
   * @param repoData - Repository data to store
   */
  static setRepositoryData(repoData: RepositoryData): void {
    try {
      const dataToStore = {
        ...repoData,
        timestamp: Date.now()
      };
      localStorage.setItem(REPO_DATA_KEY, JSON.stringify(dataToStore));
    } catch (error) {
      console.error('Failed to store repository data:', error);
    }
  }

  /**
   * Retrieve repository data from localStorage
   * @returns Repository data or null if not found
   */
  static getRepositoryData(): RepositoryData | null {
    try {
      const stored = localStorage.getItem(REPO_DATA_KEY);
      if (!stored) return null;

      const repoData = JSON.parse(stored) as RepositoryData;
      
      // Check if data is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (repoData.timestamp && Date.now() - repoData.timestamp > maxAge) {
        this.clearRepositoryData();
        return null;
      }

      return repoData;
    } catch (error) {
      console.error('Failed to retrieve repository data:', error);
      return null;
    }
  }

  /**
   * Get only the repository ID
   * @returns Repository ID or null if not found
   */
  static getRepositoryId(): string | null {
    const repoData = this.getRepositoryData();
    return repoData?.repo_id || null;
  }

  /**
   * Get only the GitHub URL
   * @returns GitHub URL or null if not found
   */
  static getGitHubUrl(): string | null {
    const repoData = this.getRepositoryData();
    return repoData?.github_url || null;
  }

  /**
   * Clear repository data from localStorage
   */
  static clearRepositoryData(): void {
    try {
      localStorage.removeItem(REPO_DATA_KEY);
    } catch (error) {
      console.error('Failed to clear repository data:', error);
    }
  }

  /**
   * Check if repository data exists and is valid
   * @returns boolean indicating if valid repository data exists
   */
  static hasValidRepositoryData(): boolean {
    const repoData = this.getRepositoryData();
    return !!(repoData?.repo_id && repoData?.github_url);
  }

  /**
   * Update repository data with additional information
   * @param updates - Partial repository data to update
   */
  static updateRepositoryData(updates: Partial<RepositoryData>): void {
    try {
      const existingData = this.getRepositoryData();
      if (existingData) {
        const updatedData = {
          ...existingData,
          ...updates,
          timestamp: Date.now()
        };
        this.setRepositoryData(updatedData);
      }
    } catch (error) {
      console.error('Failed to update repository data:', error);
    }
  }
}

/**
 * Factory function to create localStorage service instance
 * Following DRY principle - single place to create service instances
 */
export function createLocalStorageService(): LocalStorageService {
  return new LocalStorageService();
}

// Export default instance for convenience
export const localStorageService = createLocalStorageService();
