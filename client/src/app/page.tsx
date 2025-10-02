'use client'

import { cn } from '@/lib/utils'
import { Github } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Home page component for the Codebase AI application
 * Features a landing page with GitHub URL input and navigation to chat/visualize pages
 */
export default function Home() {
  // State for managing the GitHub URL input
  const [githubUrl, setGithubUrl] = useState('')
  const router = useRouter()

  /**
   * Handles navigation to the chat page with the provided GitHub URL
   */
  const handleOpenChat = () => {
    if (githubUrl.trim()) {
      const encodedUrl = encodeURIComponent(githubUrl.trim())
      router.push(`/chat?repo=${encodedUrl}`)
    }
  }

  /**
   * Handles navigation to the visualize page with the provided GitHub URL
   */
  const handleVisualize = () => {
    if (githubUrl.trim()) {
      const encodedUrl = encodeURIComponent(githubUrl.trim())
      router.push(`/visualize?repo=${encodedUrl}`)
    }
  }

  /**
   * Validates if the provided URL is a valid GitHub repository URL
   * @param url - The URL to validate
   * @returns boolean indicating if the URL is valid
   */
  const isValidGitHubUrl = (url: string) => {
    return url.includes('github.com') && url.split('/').length >= 5
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Minimalistic Header */}
        <header className="absolute top-0 left-0 z-10 p-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Github className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-light tracking-wide">Codebase AI</span>
          </div>
        </header>

      {/* Hero Section - Centered and Minimalistic */}
      <main className="min-h-screen flex items-center justify-center px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Hero Section with typewriter animations */}
          <div className="mb-16">
            <h1 className="text-6xl md:text-7xl font-thin mb-8 text-white animate-typewriter-hero">
              Don't just be a Vibe Coder
            </h1>
            <h2 className="text-4xl md:text-5xl font-light mb-12 text-purple-400 animate-typewriter-hero-2">
              Be a better developer
            </h2>
            <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed">
              Paste a repository URL to chat with the code, explore the tree, and visualize the architecture.
            </p>
          </div>

          {/* Minimalistic Input Section */}
          <div className="max-w-2xl mx-auto mb-20">
            <div className="relative">
              <input
                type="text"
                placeholder="github.com/owner/repository"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all duration-500 backdrop-blur-sm text-center text-lg font-light"
              />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-4 mt-8 justify-center">
              <button
                onClick={handleOpenChat}
                disabled={!isValidGitHubUrl(githubUrl)}
                className={cn(
                  "px-8 py-3 rounded-full font-medium transition-all duration-500 transform hover:scale-105 backdrop-blur-sm",
                  isValidGitHubUrl(githubUrl)
                    ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg hover:shadow-purple-500/30"
                    : "bg-white/5 text-gray-500 cursor-not-allowed border border-white/10"
                )}
              >
                Open Chat
              </button>
              <button
                onClick={handleVisualize}
                disabled={!isValidGitHubUrl(githubUrl)}
                className={cn(
                  "px-8 py-3 rounded-full font-medium transition-all duration-500 transform hover:scale-105 backdrop-blur-sm border",
                  isValidGitHubUrl(githubUrl)
                    ? "bg-white/5 hover:bg-white/10 text-white border-white/20 hover:border-white/30"
                    : "bg-white/5 text-gray-500 cursor-not-allowed border-white/10"
                )}
              >
                Visualize
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
