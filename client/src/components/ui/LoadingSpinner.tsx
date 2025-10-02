interface LoadingSpinnerProps {
  message?: string
  className?: string
}

/**
 * Reusable LoadingSpinner component following KISS principle
 * Single responsibility: Display loading state
 */
export function LoadingSpinner({ 
  message = 'Loading...', 
  className = '' 
}: LoadingSpinnerProps) {
  return (
    <div className={`min-h-screen bg-gray-900 text-white flex items-center justify-center ${className}`}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-gray-400">{message}</p>
      </div>
    </div>
  )
}
