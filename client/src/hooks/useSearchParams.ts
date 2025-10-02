import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Custom hook for search params following DRY principle
 * Single responsibility: Handle search params extraction and parsing
 */
export function useSearchParamsData() {
  const searchParams = useSearchParams()
  const [currentRepo, setCurrentRepo] = useState('')

  useEffect(() => {
    const repo = searchParams.get('repo')
    if (repo) {
      setCurrentRepo(decodeURIComponent(repo))
    }
  }, [searchParams])

  return {
    currentRepo,
    searchParams
  }
}
