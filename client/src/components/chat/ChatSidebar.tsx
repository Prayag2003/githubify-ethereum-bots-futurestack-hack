import { Github, MessageCircle, History, Plus, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ChatHistory } from "@/types";
import { formatDateConsistent } from "@/lib/utils";

interface ChatSidebarProps {
  isOpen: boolean;
  currentRepo: string;
  chatHistory: ChatHistory[];
  currentChatId: string | null;
  onNewChat: () => void;
  onNavigateToVisualize: () => void;
  onHistoryItemClick: (chatId: string) => void;
  onToggleSidebar: () => void;
}

/**
 * ChatSidebar component following SRP
 * Single responsibility: Handle chat sidebar rendering and interactions
 */
export function ChatSidebar({
  isOpen,
  currentRepo,
  chatHistory,
  currentChatId,
  onNewChat,
  onNavigateToVisualize,
  onHistoryItemClick,
  onToggleSidebar,
}: ChatSidebarProps) {
  if (!isOpen) {
    return (
      <div className="w-16 sm:w-16 md:w-16 lg:w-16 xl:w-16 bg-white/5 backdrop-blur-sm border-r border-white/10 transition-all duration-300 ease-in-out flex flex-col">
        {/* Collapsed Sidebar - Just Toggle Button */}
        <div className="p-3 sm:p-4">
          <button
            onClick={onToggleSidebar}
            className="w-full p-2 hover:bg-white/10 rounded-lg transition-all duration-300 flex items-center justify-center"
            aria-label="Expand sidebar"
          >
            <Menu className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Collapsed Actions */}
        <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
          <button
            onClick={onNewChat}
            className="w-full p-2 hover:bg-white/10 rounded-lg transition-all duration-300 flex items-center justify-center"
            title="New Chat"
            aria-label="Start new chat"
          >
            <Plus className="h-4 w-4 text-white" />
          </button>
          <button
            onClick={onNavigateToVisualize}
            className="w-full p-2 hover:bg-white/10 rounded-lg transition-all duration-300 flex items-center justify-center"
            title="Visualize Codebase"
            aria-label="Visualize codebase"
          >
            <MessageCircle className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Collapsed History */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="space-y-2">
            {chatHistory.slice(0, 5).map((chat) => (
              <button
                key={chat.id}
                onClick={() => onHistoryItemClick(chat.id)}
                className="w-full p-2 hover:bg-white/10 rounded-lg transition-all duration-300 flex items-center justify-center"
                title={chat.title}
                aria-label={`Open chat: ${chat.title}`}
              >
                <History className="h-4 w-4 text-gray-400 hover:text-white transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 sm:w-72 md:w-80 lg:w-80 xl:w-80 bg-white/5 backdrop-blur-sm border-r border-white/10 transition-all duration-300 ease-in-out flex flex-col">
      {/* Sidebar Header with Toggle Button */}
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Github className="h-5 w-5 text-white" />
            </div>
          </div>
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-white/10 rounded-lg transition-all duration-300 flex-shrink-0"
            aria-label="Collapse sidebar"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
        <div className="mt-4 sm:mt-6">
          <div className="text-xs sm:text-sm text-gray-400 mb-2 sm:mb-3 font-light">
            Repository
          </div>
          <div className="text-xs sm:text-sm font-mono bg-white/5 border border-white/10 px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-gray-300 break-all">
            {currentRepo || "github.com/owner/project"}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 sm:p-6 space-y-2 sm:space-y-3">
        <Button
          onClick={onNewChat}
          variant="primary"
          className="w-full justify-start"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          <span className="text-sm sm:text-base">New Chat</span>
        </Button>
        <Button
          onClick={onNavigateToVisualize}
          variant="secondary"
          className="w-full justify-start"
          size="sm"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          <span className="text-sm sm:text-base">Visualize</span>
        </Button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <History className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-light text-gray-400">
              History ({chatHistory.length})
            </span>
          </div>
          <div className="space-y-1 sm:space-y-2">
            {chatHistory.map((chat) => {
              const isActive = currentChatId === chat.id;
              return (
                <button
                  key={chat.id}
                  onClick={() => onHistoryItemClick(chat.id)}
                  className={`w-full text-left p-3 sm:p-4 rounded-xl transition-all duration-300 group border ${
                    isActive
                      ? "bg-purple-500/20 border-purple-500/30"
                      : "border-transparent hover:border-white/10 hover:bg-white/5"
                  }`}
                  aria-label={`Open chat: ${chat.title}`}
                >
                  <div
                    className={`text-xs sm:text-sm font-medium transition-colors truncate ${
                      isActive
                        ? "text-purple-300"
                        : "text-white group-hover:text-purple-300"
                    }`}
                  >
                    {chat.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 font-light">
                    {formatDateConsistent(chat.lastActivity)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
