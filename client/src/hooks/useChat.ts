import { useState, useCallback } from 'react'
import { ChatMessage } from '@/types'

/**
 * Custom hook for chat functionality following DRY principle
 * Single responsibility: Handle chat state and message operations
 */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setCurrentMessage('')
    setIsLoading(true)

    // Simulate API call
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'This is a mock response. In the real application, this would connect to your backend API to get AI-generated responses about the codebase.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1500)
  }, [isLoading])

  const startNewChat = useCallback(() => {
    setMessages([])
    setCurrentMessage('')
  }, [])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(currentMessage)
    }
  }, [currentMessage, sendMessage])

  return {
    messages,
    currentMessage,
    setCurrentMessage,
    isLoading,
    sendMessage,
    startNewChat,
    handleKeyPress
  }
}
