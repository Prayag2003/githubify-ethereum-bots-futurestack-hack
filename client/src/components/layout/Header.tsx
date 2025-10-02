import { Github } from 'lucide-react'
import { HeaderProps } from '@/types'

/**
 * Reusable Header component following DRY principle
 * Single responsibility: Handle header rendering and branding
 */
export function Header({ title, showBeta = false, className = '' }: HeaderProps) {
  return (
    <header className={`absolute top-0 left-0 z-10 p-8 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
          <Github className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-light tracking-wide">{title}</span>
        {showBeta && (
          <div className="bg-purple-500/10 border border-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm ml-4">
            Beta
          </div>
        )}
      </div>
    </header>
  )
}
