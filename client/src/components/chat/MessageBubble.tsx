import { User, Bot } from "lucide-react";
import { ChatMessage } from "@/types";

interface MessageBubbleProps {
  message: ChatMessage;
}

/**
 * MessageBubble component following SRP
 * Single responsibility: Render individual chat messages
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Bot className="h-5 w-5 text-white" />
        </div>
      )}

      <div
        className={`max-w-2xl px-6 py-4 rounded-2xl backdrop-blur-sm ${
          isUser
            ? "bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg"
            : "bg-white/5 border border-white/10 text-gray-100"
        }`}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </div>
        <div className="text-xs opacity-60 mt-3 font-light">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>

      {isUser && (
        <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
          <User className="h-5 w-5 text-white" />
        </div>
      )}
    </div>
  );
}
