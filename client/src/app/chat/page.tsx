"use client";

import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useChat } from "@/hooks/useChat";
import { useNavigation } from "@/hooks/useNavigation";
import { useSearchParamsData } from "@/hooks/useSearchParams";
import { LocalStorageService } from "@/services/localStorageService";
import { mockChatHistory } from "@/services/mockData";
import { ChatHistory } from "@/types";
import { Send, GitBranch } from "lucide-react";
import { Suspense, useState, useEffect } from "react";

function ChatContent() {
  const { currentRepo } = useSearchParamsData();
  const { navigateToVisualize, navigateToHome } = useNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatHistory] = useState<ChatHistory[]>(mockChatHistory);
  const [repoData, setRepoData] = useState<{
    repo_id: string;
    github_url: string;
  } | null>(null);

  // Get repository data from localStorage or URL params
  useEffect(() => {
    const storedRepoData = LocalStorageService.getRepositoryData();
    if (storedRepoData) {
      setRepoData({
        repo_id: storedRepoData.repo_id,
        github_url: storedRepoData.github_url,
      });
    } else if (currentRepo) {
      // Fallback to URL param if no localStorage data
      setRepoData({
        repo_id: currentRepo,
        github_url: "Unknown",
      });
    }
  }, [currentRepo]);

  const {
    messages,
    currentMessage,
    setCurrentMessage,
    isLoading,
    currentChatId,
    sendMessage,
    startNewChat,
    loadChat,
    handleKeyPress,
    isConnected,
    isStreaming,
    repoId,
    mode,
  } = useChat({
    repoId: repoData?.repo_id || currentRepo || undefined,
    mode: "fast",
  });

  const handleHistoryItemClick = (chatId: string) => {
    const chatToLoad = chatHistory.find(chat => chat.id === chatId);
    if (chatToLoad) {
      loadChat(chatToLoad);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar */}
      <ChatSidebar
        isOpen={sidebarOpen}
        currentRepo={currentRepo}
        chatHistory={chatHistory}
        currentChatId={currentChatId}
        onNewChat={startNewChat}
        onNavigateToVisualize={() =>
          navigateToVisualize(repoData?.repo_id || currentRepo || "github.com/owner/project")
        }
        onNavigateToVisualize={() =>
          navigateToVisualize(
            repoData?.repo_id || currentRepo || "github.com/owner/project"
          )
        }
        onNavigateToHome={navigateToHome}
        onHistoryItemClick={handleHistoryItemClick}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Minimalistic Header - Fixed */}
        <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 p-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-xl font-light tracking-wide">
              Githubify AI
            </span>
            {repoData && (
              <div className="flex items-center gap-2 text-sm text-white/70">
                <GitBranch className="h-4 w-4" />
                <span>Repository: {repoData.github_url}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                <span className="text-white/70">
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
              {isStreaming && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-blue-400">Streaming</span>
                </div>
              )}
              {repoId && (
                <span className="text-white/50 text-xs">{mode} mode</span>
              )}
            </div>
          </div>
        </header>

        {/* Chat Messages - Scrollable */}
        <div className="flex-1 overflow-y-auto p-8 min-h-0">
          <ChatMessages messages={messages} isLoading={isLoading} />
        </div>

        {/* Chat Input - Fixed */}
        <div className="border-t border-white/10 py-3 px-2 bg-white/5 backdrop-blur-sm flex-shrink-0">
          <div className="flex gap-2 w-full max-w-none">
            <Input
              value={currentMessage}
              onChange={setCurrentMessage}
              onKeyPress={handleKeyPress}
              placeholder="Ask about the codebase, or generate a function..."
              disabled={isLoading}
              className="flex-1 text-left min-w-0"
              size="sm"
            />
            <Button
              onClick={() => sendMessage(currentMessage)}
              disabled={!currentMessage.trim() || isLoading}
              variant={
                currentMessage.trim() && !isLoading ? "primary" : "ghost"
              }
              size="sm"
              className="flex-shrink-0"
            >
              <Send className="h-4 w-4 mr-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading chat..." />}>
      <ChatContent />
    </Suspense>
  );
}
