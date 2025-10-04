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
    mode = "accurate"
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
  const currentAssistantMessageRef = useRef<ChatMessage | null>(null);
  const streamingContentRef = useRef<string>("");

  // Initialize Socket.IO connection
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

      // Streaming events - updated for new architecture
      socket.on("query_chunk", (data: { text: string }) => {
        console.log("📝 Received query chunk:", data.text);
        
        // Update streaming content ref immediately
        streamingContentRef.current += data.text;
        
        // Update the current assistant message in real-time
        if (currentAssistantMessageRef.current) {
          currentAssistantMessageRef.current.content = streamingContentRef.current;
          
          setMessages(prev => 
            prev.map(msg => 
              msg.id === currentAssistantMessageRef.current?.id 
                ? { ...msg, content: streamingContentRef.current }
                : msg
            )
          );
        }
      });

      socket.on("query_complete", (data: { text: string }) => {
        console.log("✅ Query streaming complete:", data.text);
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          currentStreamingMessage: ""
        }));
        setIsLoading(false);
        
        // Finalize the assistant message with the complete response
        if (currentAssistantMessageRef.current) {
          currentAssistantMessageRef.current.content = data.text;
          
          setMessages(prev => 
            prev.map(msg => 
              msg.id === currentAssistantMessageRef.current?.id 
                ? { ...msg, content: data.text }
                : msg
            )
          );
        }
        
        // Reset streaming content and refs after finalizing
        streamingContentRef.current = "";
        currentAssistantMessageRef.current = null;
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
        if (currentAssistantMessageRef.current) {
          const errorMessage = "Sorry, there was an error processing your request. Please try again.";
          currentAssistantMessageRef.current.content = errorMessage;
          
          setMessages(prev => 
            prev.map(msg => 
              msg.id === currentAssistantMessageRef.current?.id 
                ? { ...msg, content: errorMessage }
                : msg
            )
          );
        }
        
        // Reset streaming content and refs
        streamingContentRef.current = "";
        currentAssistantMessageRef.current = null;
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
      currentAssistantMessageRef.current = null;
    };
  }, [serverUrl]);

  const sendMessage = useCallback(
    async (content: string) => {
      console.log("🚀 sendMessage called with:", { content, isLoading, isConnected: streamingState.isConnected, repoId, socketId: streamingState.socketId });
      
      if (!content.trim() || isLoading || !streamingState.isConnected || !repoId) {
        console.log("❌ sendMessage blocked:", { hasContent: !!content.trim(), isLoading, isConnected: streamingState.isConnected, hasRepoId: !!repoId });
        return;
      }

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      // Create placeholder assistant message for streaming
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setCurrentMessage("");
      setIsLoading(true);
      currentAssistantMessageRef.current = assistantMessage;

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
        if (currentAssistantMessageRef.current) {
          const errorMessage = "Sorry, there was an error processing your request. Please try again.";
          currentAssistantMessageRef.current.content = errorMessage;
          
          setMessages(prev => 
            prev.map(msg => 
              msg.id === currentAssistantMessageRef.current?.id 
                ? { ...msg, content: errorMessage }
                : msg
            )
          );
        }
        
        // Reset streaming content and refs
        streamingContentRef.current = "";
        currentAssistantMessageRef.current = null;
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
    currentAssistantMessageRef.current = null;
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
