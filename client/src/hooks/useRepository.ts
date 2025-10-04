import { useState, useCallback } from 'react';
import { createRepositoryService, RepoResponse, ApiResponse } from '@/services/repositoryService';

interface UseRepositoryState {
  isLoading: boolean;
  error: string | null;
  currentRepo: string | null;
  repoData: RepoResponse | null;
}

interface UseRepositoryReturn extends UseRepositoryState {
  cloneAndIngest: (githubUrl: string) => Promise<ApiResponse<RepoResponse>>;
  generateCodeTree: (githubUrl: string) => Promise<ApiResponse<any>>;
  clearError: () => void;
  reset: () => void;
}

/**
 * Custom hook for repository management
 * Following KISS principle - simple interface for repository operations
 */
export function useRepository(): UseRepositoryReturn {
  const [state, setState] = useState<UseRepositoryState>({
    isLoading: false,
    error: null,
    currentRepo: null,
    repoData: null,
  });

  const repositoryService = createRepositoryService();

  const cloneAndIngest = useCallback(async (githubUrl: string): Promise<ApiResponse<RepoResponse>> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await repositoryService.cloneAndIngest(githubUrl);
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          currentRepo: githubUrl,
          repoData: result.data,
          error: null,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Failed to clone and ingest repository',
        }));
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return {
        data: {} as RepoResponse,
        success: false,
        error: errorMessage,
      };
    }
  }, [repositoryService]);

  const generateCodeTree = useCallback(async (githubUrl: string): Promise<ApiResponse<any>> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await repositoryService.generateCodeTree(githubUrl);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: result.success ? null : (result.error || 'Failed to generate code tree'),
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return {
        data: { repo_id: '', tree: null },
        success: false,
        error: errorMessage,
      };
    }
  }, [repositoryService]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      currentRepo: null,
      repoData: null,
    });
  }, []);

  return {
    ...state,
    cloneAndIngest,
    generateCodeTree,
    clearError,
    reset,
  };
}
