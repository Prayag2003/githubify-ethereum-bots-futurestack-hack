import { MessageCircle, Bot } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { ChatMessage } from "@/types";
import { useEffect, useRef } from "react";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

/**
 * ChatMessages component following SRP
 * Single responsibility: Handle chat messages display and empty state
 */
export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);
  if (messages.length === 0) {
    return (
      <div className="text-center text-gray-400 mt-32">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <MessageCircle className="h-8 w-8 text-purple-400" />
        </div>
        <h3 className="text-2xl font-light mb-3 text-white">
          Start a conversation
        </h3>
        <p className="text-lg font-light text-gray-400 max-w-md mx-auto">
          Ask about the codebase, or generate a function...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isLoading && (
        <div className="flex gap-4 justify-start">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="bg-white/5 border border-white/10 text-gray-100 px-6 py-4 rounded-2xl backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
              <span className="text-sm font-light">Thinking...</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Invisible element to scroll to */}
      <div ref={messagesEndRef} />
    </div>
  );
}
