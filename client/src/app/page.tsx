"use client";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useGitHubUrl } from "@/hooks/useGitHubUrl";
import { useNavigation } from "@/hooks/useNavigation";
import { useRepository } from "@/hooks/useRepository";
import { LocalStorageService } from "@/services/localStorageService";
import { useState } from "react";

/**
 * Home page component for the Codebase AI application
 * Refactored to follow SOLID, DRY, and KISS principles
 */
export default function Home() {
  const { url, setUrl, isValid, getNormalizedUrl } = useGitHubUrl();
  const { navigateToChat, navigateToVisualize } = useNavigation();
  const { cloneAndIngest, isLoading, error, clearError } = useRepository();
  const [actionType, setActionType] = useState<"chat" | "visualize" | null>(
    null
  );

  const handleOpenChat = async () => {
    if (!isValid || isLoading) return;

    setActionType("chat");
    clearError();

    try {
      // Use normalized URL for API call
      const normalizedUrl = getNormalizedUrl();
      const result = await cloneAndIngest(normalizedUrl);

      if (result.success && result.data.repo_id) {
        // Store repository data in localStorage for streaming functionality
        LocalStorageService.setRepositoryData({
          repo_id: result.data.repo_id,
          github_url: normalizedUrl,
          files_processed: result.data.files_processed,
          index_name: result.data.index_name,
        });

        // Navigate to chat with the repository ID
        navigateToChat(result.data.repo_id);
      } else {
        // Handle API error response
        const errorMessage =
          result.error ||
          result.message ||
          "Failed to clone and ingest repository";
        console.error("Repository cloning failed:", errorMessage);
        // The error will be displayed by the useRepository hook
      }
    } catch (error) {
      console.error("Network error during repository cloning:", error);
      // The error will be displayed by the useRepository hook
    } finally {
      setActionType(null);
    }
  };

  const handleVisualize = async () => {
    if (!isValid || isLoading) return;

    setActionType("visualize");
    clearError();

    try {
      // Use normalized URL for API call
      const normalizedUrl = getNormalizedUrl();
      const result = await cloneAndIngest(normalizedUrl);

      if (result.success && result.data.repo_id) {
        // Store repository data in localStorage for streaming functionality
        LocalStorageService.setRepositoryData({
          repo_id: result.data.repo_id,
          github_url: normalizedUrl,
          files_processed: result.data.files_processed,
          index_name: result.data.index_name,
        });

        // Navigate to visualize with the repository ID
        navigateToVisualize(result.data.repo_id);
      } else {
        // Handle API error response
        const errorMessage =
          result.error ||
          result.message ||
          "Failed to clone and ingest repository";
        console.error("Repository cloning failed:", errorMessage);
        // The error will be displayed by the useRepository hook
      }
    } catch (error) {
      console.error("Network error during repository cloning:", error);
      // The error will be displayed by the useRepository hook
    } finally {
      setActionType(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header title="Codebase AI" />

      <main className="min-h-screen flex items-center justify-center px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Hero Section with typewriter animations */}
          <div className="mb-16">
            <h1 className="text-6xl md:text-7xl font-thin mb-8 text-white animate-typewriter-hero">
              Don't just be a Vibe Coder
            </h1>
            <h2 className="text-4xl md:text-5xl font-light mb-12 text-purple-400 animate-typewriter-hero-2">
              Be a better developer
            </h2>
            <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed">
              Paste a repository URL to chat with the code, explore the tree,
              and visualize the architecture.
            </p>
          </div>

          {/* Input Section */}
          <div className="max-w-2xl mx-auto mb-20">
            <Input
              value={url}
              onChange={setUrl}
              placeholder="github.com/owner/repository (or https://github.com/owner/repository)"
              disabled={isLoading}
            />

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-6 bg-red-900/20 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                      <span className="text-red-400 text-xs">!</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-red-400 font-semibold mb-2">
                      Repository Processing Failed
                    </h3>
                    <p className="text-red-300/80 text-sm mb-3">{error}</p>
                    <div className="flex gap-2">
                      <Button
                        onClick={clearError}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 border border-red-500/30"
                      >
                        Dismiss
                      </Button>
                      <Button
                        onClick={() => window.location.reload()}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                      >
                        Try Again
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Status */}
            {isLoading && (
              <div className="mt-4 p-6 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                  </div>
                  <div className="flex-1 text-blue-400">
                    <div className="space-y-2">
                      <p className="font-semibold text-lg">
                        {actionType === "chat"
                          ? "Preparing Chat Interface..."
                          : actionType === "visualize"
                            ? "Preparing Visualization..."
                            : "Processing Repository..."}
                      </p>
                      <div className="space-y-1 text-sm text-blue-300/80">
                        <p>• Cloning repository from GitHub</p>
                        <p>• Parsing code structure and dependencies</p>
                        <p>• Creating vector embeddings for AI search</p>
                        <p>• Building knowledge index</p>
                      </div>
                      <div className="mt-3 text-xs text-blue-400/60">
                        This may take 30-60 seconds depending on repository size
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 mt-8 justify-center">
              <Button
                onClick={handleOpenChat}
                disabled={!isValid || isLoading}
                variant={isValid && !isLoading ? "primary" : "ghost"}
                size="lg"
                className="min-w-[140px]"
              >
                {isLoading && actionType === "chat" ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  "Open Chat"
                )}
              </Button>
              <Button
                onClick={handleVisualize}
                disabled={!isValid || isLoading}
                variant={isValid && !isLoading ? "secondary" : "ghost"}
                size="lg"
                className="min-w-[140px]"
              >
                {isLoading && actionType === "visualize" ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  "Visualize"
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
