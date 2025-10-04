import { useState, useCallback, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage } from "@/types";
import { STREAMING_CONFIG, SERVER_CONFIG, CHAT_CONFIG, type StreamingMode } from "@/lib/constants";

interface StreamingChatOptions {
  serverUrl?: string;
  repoId?: string;
  mode?: StreamingMode;
}

interface StreamingState {
  isConnected: boolean;
  isStreaming: boolean;
  currentStreamingMessage: string;
  socketId: string | null;
}

// Global socket instance to prevent multiple connections
let globalSocket: Socket | null = null;
let globalSocketServerUrl: string | null = null;
let globalSocketListeners: Set<string> = new Set();

// Global message tracking to prevent duplicates across hook instances
let globalActiveMessageId: string | null = null;

/**
 * Custom hook for streaming chat functionality using Socket.IO
 * Handles real-time communication with the AI model via WebSocket
 */
export function useStreamingChat(options: StreamingChatOptions = {}) {
  const {
    serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || SERVER_CONFIG.DEFAULT_URL,
    repoId,
    mode = CHAT_CONFIG.DEFAULT_MODE,
  } = options;


  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isConnected: false,
    isStreaming: false,
    currentStreamingMessage: "",
    socketId: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const currentAssistantMessageIdRef = useRef<string | null>(null);
  const streamingContentRef = useRef<string>("");
  const isInitializedRef = useRef<boolean>(false);
  const lastMessageRef = useRef<string>("");
  const lastMessageTimeRef = useRef<number>(0);

  useEffect(() => {
    // Prevent multiple initializations
    if (isInitializedRef.current) {
      return;
    }

    // Use global socket if it exists and matches the server URL
    if (globalSocket && globalSocketServerUrl === serverUrl && globalSocket.connected) {
      console.log("🔌 Reusing existing global socket connection");
      socketRef.current = globalSocket;
      setStreamingState(prev => ({
        ...prev,
        isConnected: true,
        socketId: globalSocket?.id || null,
      }));
      isInitializedRef.current = true;
      return;
    }

    // Clean up existing global socket if server URL changed
    if (globalSocket && globalSocketServerUrl !== serverUrl) {
      console.log("🔌 Server URL changed, cleaning up old socket");
      globalSocket.removeAllListeners();
      globalSocket.disconnect();
      globalSocket = null;
      globalSocketServerUrl = null;
      globalSocketListeners.clear();
    }

    // Create new socket connection
    if (!globalSocket) {
      console.log("🔌 Initializing new global socket connection to:", serverUrl);
      globalSocket = io(serverUrl, {
        path: SERVER_CONFIG.SOCKET_PATH,
        transports: [...SERVER_CONFIG.TRANSPORTS],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: STREAMING_CONFIG.RECONNECTION_ATTEMPTS,
        reconnectionDelay: STREAMING_CONFIG.RECONNECTION_DELAY,
      });
      globalSocketServerUrl = serverUrl;
      socketRef.current = globalSocket;
    }

    const socket = socketRef.current;
    if (!socket) return;

    // Helper function to add event listener only once
    const addListenerOnce = (event: string, handler: (...args: any[]) => void) => {
      if (!globalSocketListeners.has(event)) {
        socket.on(event, handler);
        globalSocketListeners.add(event);
      }
    };

    // Connection events
    addListenerOnce("connect", () => {
      setStreamingState(prev => ({
        ...prev,
        isConnected: true,
        socketId: socket.id || null,
      }));
    });

    addListenerOnce("disconnect", () => {
      setStreamingState(prev => ({
        ...prev,
        isConnected: false,
        socketId: null,
      }));
    });

    // Streaming events - simple direct approach
    addListenerOnce("query_chunk", (data: { text: string }) => {
      console.log("📦 Received chunk:", data.text);
      
      // Accumulate streaming content directly
      streamingContentRef.current += data.text;

      // Update the assistant message with current content
      if (currentAssistantMessageIdRef.current) {
        setMessages(prev => {
          const messageExists = prev.some(
            msg => msg.id === currentAssistantMessageIdRef.current
          );

          if (messageExists) {
            return prev.map(msg =>
              msg.id === currentAssistantMessageIdRef.current
                ? { ...msg, content: streamingContentRef.current }
                : msg
            );
          } else if (currentAssistantMessageIdRef.current) {
            const assistantMessage: ChatMessage = {
              id: currentAssistantMessageIdRef.current,
              role: "assistant",
              content: streamingContentRef.current,
              timestamp: new Date(),
            };
            return [...prev, assistantMessage];
          }
          return prev;
        });
      }
    });

    addListenerOnce("query_complete", (data: { text: string }) => {
      console.log("✅ Query complete");
      
      // Set streaming state to complete
      setStreamingState(prev => ({
        ...prev,
        isStreaming: false,
        currentStreamingMessage: "",
      }));
      setIsLoading(false);

      // Reset global active message if this was the active one
      if (globalActiveMessageId === currentAssistantMessageIdRef.current) {
        globalActiveMessageId = null;
      }

      // Reset streaming content and refs after finalizing
      streamingContentRef.current = "";
      currentAssistantMessageIdRef.current = null;
    });

    addListenerOnce("query_error", (data: { error: string; repo_id: string }) => {
      console.error("Query error:", data.error);
      setStreamingState(prev => ({
        ...prev,
        isStreaming: false,
      }));
      setIsLoading(false);

      // Update the assistant message with error
      const errorMessage =
        "Sorry, there was an error processing your request. Please try again.";
      if (currentAssistantMessageIdRef.current) {
        setMessages(prev => {
          const messageExists = prev.some(
            msg => msg.id === currentAssistantMessageIdRef.current
          );

          if (!messageExists && currentAssistantMessageIdRef.current) {
            const assistantMessage: ChatMessage = {
              id: currentAssistantMessageIdRef.current,
              role: "assistant",
              content: errorMessage,
              timestamp: new Date(),
            };
            return [...prev, assistantMessage];
          } else {
            return prev.map(msg =>
              msg.id === currentAssistantMessageIdRef.current
                ? { ...msg, content: errorMessage }
                : msg
            );
          }
        });
      }

      // Reset streaming content and refs
      streamingContentRef.current = "";
      currentAssistantMessageIdRef.current = null;
    });

    // Repository room events (simplified)
    addListenerOnce("joined_repo", (data: { repo_id: string; message: string }) => {
      // Repository joined successfully
    });

    addListenerOnce("connect_error", error => {
      console.error("❌ Socket connection error:", error);
      setStreamingState(prev => ({
        ...prev,
        isConnected: false,
      }));
    });

    addListenerOnce("reconnect", attemptNumber => {
      setStreamingState(prev => ({
        ...prev,
        isConnected: true,
        socketId: socket.id || null,
      }));
    });

    addListenerOnce("reconnect_attempt", attemptNumber => {
      // Reconnection attempt in progress
    });

    addListenerOnce("reconnect_error", error => {
      console.error("❌ Socket reconnection error:", error);
    });

    // Simple streaming - no complex queue needed
    console.log("🚀 Simple streaming initialized");

    isInitializedRef.current = true;

    return () => {
      // Don't clean up global socket here, only reset local refs
      streamingContentRef.current = "";
      currentAssistantMessageIdRef.current = null;
      isInitializedRef.current = false;
      lastMessageRef.current = "";
      lastMessageTimeRef.current = 0;
    };
  }, [serverUrl]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (
        !content.trim() ||
        isLoading ||
        !streamingState.isConnected ||
        !repoId
      ) {
        return;
      }

      // Prevent duplicate messages within threshold
      const now = Date.now();
      const timeSinceLastMessage = now - lastMessageTimeRef.current;
      if (
        lastMessageRef.current === content.trim() &&
        timeSinceLastMessage < CHAT_CONFIG.DUPLICATE_MESSAGE_THRESHOLD_MS
      ) {
        return;
      }

      // Update last message tracking
      lastMessageRef.current = content.trim();
      lastMessageTimeRef.current = now;

      // Generate unique IDs using timestamp + random component
      const baseId = Date.now();
      const userMessage: ChatMessage = {
        id: `${baseId}-user-${Math.random().toString(36).substr(2, 9)}`,
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      // Generate assistant message ID for streaming
      const assistantMessageId = `${baseId}-assistant-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`🆔 Generated assistant message ID: ${assistantMessageId}`);

      // Reset global active message for new message
      globalActiveMessageId = null;

      // Add user message and set up for streaming
      setMessages(prev => [...prev, userMessage]);
      setCurrentMessage("");
      setIsLoading(true);
      currentAssistantMessageIdRef.current = assistantMessageId;
      console.log(`📌 Set current assistant message ID: ${currentAssistantMessageIdRef.current}`);

      setStreamingState(prev => ({
        ...prev,
        isStreaming: true,
        currentStreamingMessage: "",
      }));

      // Reset streaming content
      streamingContentRef.current = "";

      try {
        // Send query_start event to server
        if (socketRef.current) {
          socketRef.current.emit("query_start", {
            repo_id: repoId,
            query: content.trim(),
            mode: mode,
          });
        }

        const requestBody = {
          repo_id: repoId,
          query: content.trim(),
          mode: mode,
          socket_id: streamingState.socketId,
        };

        const response = await fetch(`${serverUrl}/query/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
      } catch (error) {
        console.error("Error sending message:", error);
        setIsLoading(false);
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
        }));

        // Update the assistant message with error
        const errorMessage =
          "Sorry, there was an error processing your request. Please try again.";
        if (currentAssistantMessageIdRef.current) {
          setMessages(prev => {
            const messageExists = prev.some(
              msg => msg.id === currentAssistantMessageIdRef.current
            );

            if (!messageExists && currentAssistantMessageIdRef.current) {
              const assistantMessage: ChatMessage = {
                id: currentAssistantMessageIdRef.current,
                role: "assistant",
                content: errorMessage,
                timestamp: new Date(),
              };
              return [...prev, assistantMessage];
            } else {
              return prev.map(msg =>
                msg.id === currentAssistantMessageIdRef.current
                  ? { ...msg, content: errorMessage }
                  : msg
              );
            }
          });
        }

        // Reset streaming content and refs
        streamingContentRef.current = "";
        currentAssistantMessageIdRef.current = null;
      }
    },
    [
      isLoading,
      streamingState.isConnected,
      streamingState.socketId,
      repoId,
      mode,
      serverUrl,
    ]
  );

  const startNewChat = useCallback(() => {
    setMessages([]);
    setCurrentMessage("");
    setStreamingState(prev => ({
      ...prev,
      currentStreamingMessage: "",
    }));

    // Reset all refs
    streamingContentRef.current = "";
    currentAssistantMessageIdRef.current = null;
    lastMessageRef.current = "";
    lastMessageTimeRef.current = 0;
  }, []);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(currentMessage);
      }
    },
    [currentMessage, sendMessage]
  );

  const joinRepository = useCallback(
    async (repoId: string) => {
      if (!socketRef.current || !streamingState.isConnected) {
        console.warn("Cannot join repository: socket not connected");
        return false;
      }

      try {
        const response = await fetch(`${serverUrl}/query/join-repo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            socket_id: streamingState.socketId,
            repo_id: repoId,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("Joined repository:", result);
        return true;
      } catch (error) {
        console.error("Error joining repository:", error);
        return false;
      }
    },
    [streamingState.isConnected, streamingState.socketId, serverUrl]
  );

  const leaveRepository = useCallback(
    async (repoId: string) => {
      if (!socketRef.current || !streamingState.isConnected) {
        console.warn("Cannot leave repository: socket not connected");
        return false;
      }

      try {
        const response = await fetch(`${serverUrl}/query/leave-repo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            socket_id: streamingState.socketId,
            repo_id: repoId,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("Left repository:", result);
        return true;
      } catch (error) {
        console.error("Error leaving repository:", error);
        return false;
      }
    },
    [streamingState.isConnected, streamingState.socketId, serverUrl]
  );

  const disconnect = useCallback(() => {
    if (globalSocket) {
      globalSocket.removeAllListeners();
      globalSocket.disconnect();
      globalSocket = null;
      globalSocketServerUrl = null;
      globalSocketListeners.clear();
    }
    socketRef.current = null;
    isInitializedRef.current = false;
  }, []);

  // Add cleanup effect for when component unmounts
  useEffect(() => {
    return () => {
      // Only clean up if this is the last instance using the global socket
      if (globalSocket && isInitializedRef.current) {
        globalSocket.removeAllListeners();
        globalSocket.disconnect();
        globalSocket = null;
        globalSocketServerUrl = null;
        globalSocketListeners.clear();
      }
    };
  }, []);

  return {
    messages,
    currentMessage,
    setCurrentMessage,
    isLoading,
    streamingState,
    sendMessage,
    startNewChat,
    handleKeyPress,
    joinRepository,
    leaveRepository,
    disconnect,
    // Connection status helpers
    isConnected: streamingState.isConnected,
    isStreaming: streamingState.isStreaming,
    socketId: streamingState.socketId,
  };
}
