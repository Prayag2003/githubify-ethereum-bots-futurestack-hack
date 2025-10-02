"use client";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useGitHubUrl } from "@/hooks/useGitHubUrl";
import { useNavigation } from "@/hooks/useNavigation";

/**
 * Home page component for the Codebase AI application
 * Refactored to follow SOLID, DRY, and KISS principles
 */
export default function Home() {
  const { url, setUrl, isValid } = useGitHubUrl();
  const { navigateToChat, navigateToVisualize } = useNavigation();

  const handleOpenChat = () => navigateToChat(url);
  const handleVisualize = () => navigateToVisualize(url);

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
              placeholder="github.com/owner/repository"
            />

            {/* Action Buttons */}
            <div className="flex gap-4 mt-8 justify-center">
              <Button
                onClick={handleOpenChat}
                disabled={!isValid}
                variant={isValid ? "primary" : "ghost"}
                size="lg"
              >
                Open Chat
              </Button>
              <Button
                onClick={handleVisualize}
                disabled={!isValid}
                variant={isValid ? "secondary" : "ghost"}
                size="lg"
              >
                Visualize
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
