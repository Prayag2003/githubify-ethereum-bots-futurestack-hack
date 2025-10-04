import { useState, useCallback, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage } from "@/types";

interface StreamingChatOptions {
  serverUrl?: string;
  repoId?: string;
  mode?: "fast" | "accurate";
}

interface StreamingState {
  isConnected: boolean;
  isStreaming: boolean;
  currentStreamingMessage: string;
  socketId: string | null;
}

/**
 * Custom hook for streaming chat functionality using Socket.IO
 * Handles real-time communication with the AI model via WebSocket
 */
export function useStreamingChat(options: StreamingChatOptions = {}) {
  const {
    serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8000",
    repoId,
    mode = "fast"
  } = options;
  
  console.log("🔧 useStreamingChat initialized with:", { serverUrl, repoId, mode });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isConnected: false,
    isStreaming: false,
    currentStreamingMessage: "",
    socketId: null
  });

  const socketRef = useRef<Socket | null>(null);
  const currentAssistantMessageIdRef = useRef<string | null>(null);
  const streamingContentRef = useRef<string>("");


  useEffect(() => {
    if (!socketRef.current) {
      console.log("🔌 Initializing socket connection to:", serverUrl);
      socketRef.current = io(serverUrl, {
        path: "/socket.io",
        transports: ["websocket", "polling"],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      const socket = socketRef.current;

      // Connection events
      socket.on("connect", () => {
        console.log("✅ Connected to server with socket ID:", socket.id);
        setStreamingState(prev => ({
          ...prev,
          isConnected: true,
          socketId: socket.id || null
        }));
      });

      socket.on("disconnect", () => {
        console.log("❌ Disconnected from server");
        setStreamingState(prev => ({
          ...prev,
          isConnected: false,
          socketId: null
        }));
      });

      // Streaming events - direct approach
      socket.on("query_chunk", (data: { text: string }) => {
        console.log("📝 Received query chunk:", data.text);
        
        // Accumulate streaming content
        streamingContentRef.current += data.text;
        
        // Add or update assistant message with current content
        if (currentAssistantMessageIdRef.current) {
          setMessages(prev => {
            const messageExists = prev.some(msg => msg.id === currentAssistantMessageIdRef.current);
            
            if (!messageExists && currentAssistantMessageIdRef.current) {
              const assistantMessage: ChatMessage = {
                id: currentAssistantMessageIdRef.current,
                role: "assistant",
                content: streamingContentRef.current,
                timestamp: new Date(),
              };
              return [...prev, assistantMessage];
            } else {
              return prev.map(msg => 
                msg.id === currentAssistantMessageIdRef.current 
                  ? { ...msg, content: streamingContentRef.current }
                  : msg
              );
            }
          });
        }
      });

      socket.on("query_complete", (data: { text: string }) => {
        console.log("✅ Query streaming complete:", data.text);
        console.log("✅ currentAssistantMessageIdRef.current:", currentAssistantMessageIdRef.current);
        
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          currentStreamingMessage: ""
        }));
        setIsLoading(false);
        
        // CRITICAL FIX: Add assistant message immediately
        if (currentAssistantMessageIdRef.current) {
          const assistantMessage: ChatMessage = {
            id: currentAssistantMessageIdRef.current,
            role: "assistant",
            content: data.text,
            timestamp: new Date(),
          };
          
          console.log("✅ Adding assistant message:", assistantMessage);
          setMessages(prev => {
            // Check if message already exists
            const messageExists = prev.some(msg => msg.id === currentAssistantMessageIdRef.current);
            if (messageExists) {
              // Update existing message
              return prev.map(msg => 
                msg.id === currentAssistantMessageIdRef.current 
                  ? { ...msg, content: data.text }
                  : msg
              );
            } else {
              // Add new message
              return [...prev, assistantMessage];
            }
          });
        }
        
        // Reset streaming content and refs after finalizing
        streamingContentRef.current = "";
        currentAssistantMessageIdRef.current = null;
      });

      // query_start is now sent by client, not received

      socket.on("query_error", (data: { error: string; repo_id: string }) => {
        console.error("Query error:", data.error);
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false
        }));
        setIsLoading(false);
        
        // Update the assistant message with error
        const errorMessage = "Sorry, there was an error processing your request. Please try again.";
        if (currentAssistantMessageIdRef.current) {
          setMessages(prev => {
            const messageExists = prev.some(msg => msg.id === currentAssistantMessageIdRef.current);
            
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
      socket.on("joined_repo", (data: { repo_id: string; message: string }) => {
        console.log("Joined repository:", data.message);
      });

      socket.on("connect_error", (error) => {
        console.error("❌ Socket connection error:", error);
        setStreamingState(prev => ({
          ...prev,
          isConnected: false
        }));
      });

      socket.on("reconnect", (attemptNumber) => {
        console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
        setStreamingState(prev => ({
          ...prev,
          isConnected: true,
          socketId: socket.id || null
        }));
      });

      socket.on("reconnect_attempt", (attemptNumber) => {
        console.log("🔄 Socket reconnection attempt", attemptNumber);
      });

      socket.on("reconnect_error", (error) => {
        console.error("❌ Socket reconnection error:", error);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Reset all refs on cleanup
      streamingContentRef.current = "";
      currentAssistantMessageIdRef.current = null;
    };
  }, [serverUrl]);

  const sendMessage = useCallback(
    async (content: string) => {
      console.log("🚀 sendMessage called with:", { content, isLoading, isConnected: streamingState.isConnected, repoId, socketId: streamingState.socketId });
      
      if (!content.trim() || isLoading || !streamingState.isConnected || !repoId) {
        console.log("❌ sendMessage blocked:", { hasContent: !!content.trim(), isLoading, isConnected: streamingState.isConnected, hasRepoId: !!repoId });
        return;
      }

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
      console.log("🚀 Generated assistant message ID:", assistantMessageId);

      // Add user message and set up for streaming
      setMessages(prev => [...prev, userMessage]);
      setCurrentMessage("");
      setIsLoading(true);
      currentAssistantMessageIdRef.current = assistantMessageId;
      console.log("🚀 Set currentAssistantMessageIdRef.current to:", currentAssistantMessageIdRef.current);

      setStreamingState(prev => ({
        ...prev,
        isStreaming: true,
        currentStreamingMessage: ""
      }));
      
      // Reset streaming content
      streamingContentRef.current = "";

      try {
        // Send query_start event to server
        if (socketRef.current) {
          socketRef.current.emit("query_start", {
            repo_id: repoId,
            query: content.trim(),
            mode: mode
          });
          console.log("📤 Sent query_start event to server");
        }
        
        const requestBody = {
          repo_id: repoId,
          query: content.trim(),
          mode: mode,
          socket_id: streamingState.socketId
        };
        
        console.log("📤 Sending request to:", `${serverUrl}/query/`);
        console.log("📤 Request body:", requestBody);
        
        const response = await fetch(`${serverUrl}/query/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        console.log("📥 Response status:", response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("✅ Query initiated successfully:", result);

      } catch (error) {
        console.error("Error sending message:", error);
        setIsLoading(false);
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false
        }));

        // Update the assistant message with error
        const errorMessage = "Sorry, there was an error processing your request. Please try again.";
        if (currentAssistantMessageIdRef.current) {
          setMessages(prev => {
            const messageExists = prev.some(msg => msg.id === currentAssistantMessageIdRef.current);
            
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
    [isLoading, streamingState.isConnected, streamingState.socketId, repoId, mode, serverUrl]
  );

  const startNewChat = useCallback(() => {
    setMessages([]);
    setCurrentMessage("");
    setStreamingState(prev => ({
      ...prev,
      currentStreamingMessage: ""
    }));
    
    // Reset all refs
    streamingContentRef.current = "";
    currentAssistantMessageIdRef.current = null;
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

  const joinRepository = useCallback(async (repoId: string) => {
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
          repo_id: repoId
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
  }, [streamingState.isConnected, streamingState.socketId, serverUrl]);

  const leaveRepository = useCallback(async (repoId: string) => {
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
          repo_id: repoId
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
  }, [streamingState.isConnected, streamingState.socketId, serverUrl]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
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
    socketId: streamingState.socketId
  };
}
