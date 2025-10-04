import React, { useState, useCallback } from "react";
import { ChatMessage, ChatHistory } from "@/types";
import { useStreamingChat } from "./useStreamingChat";

interface UseChatOptions {
  repoId?: string;
  mode?: "fast" | "accurate";
}

/**
 * Simplified chat hook that uses streaming functionality
 * Following KISS principle - single responsibility for chat management
 */
export function useChat(options: UseChatOptions = {}) {
  const { repoId, mode = "accurate" } = options;

  // Always use streaming chat since repository is always available from home page
  const streamingChat = useStreamingChat({
    repoId,
    mode,
    serverUrl: process.env.NEXT_PUBLIC_SERVER_URL,
  });

  // Auto-join repository when connected and repoId is available
  React.useEffect(() => {
    if (streamingChat.isConnected && repoId && streamingChat.socketId) {
      streamingChat.joinRepository(repoId);
    }
  }, [
    streamingChat.isConnected,
    repoId,
    streamingChat.socketId,
    streamingChat.joinRepository,
  ]);

  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const startNewChat = useCallback(() => {
    streamingChat.startNewChat();
    setCurrentChatId(null);
  }, [streamingChat]);

  const loadChat = useCallback((chatHistory: ChatHistory) => {
    // TODO: Implement proper chat history loading for streaming mode
    // For now, this is a placeholder
    setCurrentChatId(chatHistory.id);
  }, []);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        streamingChat.sendMessage(streamingChat.currentMessage);
      }
    },
    [streamingChat]
  );

  return {
    // Core chat functionality
    messages: streamingChat.messages,
    currentMessage: streamingChat.currentMessage,
    setCurrentMessage: streamingChat.setCurrentMessage,
    isLoading: streamingChat.isLoading,
    currentChatId,
    sendMessage: streamingChat.sendMessage,
    startNewChat,
    loadChat,
    handleKeyPress,

    // Streaming-specific properties
    isConnected: streamingChat.isConnected,
    isStreaming: streamingChat.isStreaming,
    socketId: streamingChat.socketId,
    streamingState: streamingChat.streamingState,

    // Repository management
    joinRepository: streamingChat.joinRepository,
    leaveRepository: streamingChat.leaveRepository,

    // Repository info
    repoId,
    mode,
  };
}
