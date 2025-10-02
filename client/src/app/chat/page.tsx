"use client";

import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useChat } from "@/hooks/useChat";
import { useNavigation } from "@/hooks/useNavigation";
import { useSearchParamsData } from "@/hooks/useSearchParams";
import { mockChatHistory } from "@/services/mockData";
import { ChatHistory } from "@/types";
import { Send } from "lucide-react";
import { Suspense, useState } from "react";

function ChatContent() {
  const { currentRepo } = useSearchParamsData();
  const { navigateToVisualize } = useNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatHistory] = useState<ChatHistory[]>(mockChatHistory);

  const {
    messages,
    currentMessage,
    setCurrentMessage,
    isLoading,
    sendMessage,
    startNewChat,
    handleKeyPress,
  } = useChat();

  const handleHistoryItemClick = (chatId: string) => {
    // TODO: Implement chat history loading
    console.log("Loading chat:", chatId);
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar */}
      <ChatSidebar
        isOpen={sidebarOpen}
        currentRepo={currentRepo}
        chatHistory={chatHistory}
        onNewChat={startNewChat}
        onNavigateToVisualize={() => navigateToVisualize(currentRepo)}
        onHistoryItemClick={handleHistoryItemClick}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Minimalistic Header */}
        <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 p-6 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-light tracking-wide">
              Codebase AI
            </span>
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-8">
          <ChatMessages messages={messages} isLoading={isLoading} />
        </div>

        {/* Chat Input */}
        <div className="border-t border-white/10 py-3 px-2 bg-white/5 backdrop-blur-sm">
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
