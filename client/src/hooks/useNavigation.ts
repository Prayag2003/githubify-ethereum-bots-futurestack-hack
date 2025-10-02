import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

/**
 * Custom hook for navigation following DRY principle
 * Single responsibility: Handle navigation logic
 */
export function useNavigation() {
  const router = useRouter()

  const navigateToChat = useCallback((repoUrl: string) => {
    if (repoUrl.trim()) {
      const encodedUrl = encodeURIComponent(repoUrl.trim())
      router.push(`/chat?repo=${encodedUrl}`)
    }
  }, [router])

  const navigateToVisualize = useCallback((repoUrl: string) => {
    if (repoUrl.trim()) {
      const encodedUrl = encodeURIComponent(repoUrl.trim())
      router.push(`/visualize?repo=${encodedUrl}`)
    }
  }, [router])

  const navigateToHome = useCallback(() => {
    router.push('/')
  }, [router])

  return {
    navigateToChat,
    navigateToVisualize,
    navigateToHome
  }
}
