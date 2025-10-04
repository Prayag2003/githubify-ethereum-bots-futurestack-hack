import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Custom hook for navigation following DRY principle
 * Single responsibility: Handle navigation logic
 */
export function useNavigation() {
  const router = useRouter();

  const navigateToChat = useCallback(
    (repoId: string) => {
      if (repoId.trim()) {
        const encodedRepoId = encodeURIComponent(repoId.trim());
        router.push(`/chat?repo=${encodedRepoId}`);
      }
    },
    [router]
  );

  const navigateToVisualize = useCallback(
    (repoId: string) => {
      if (repoId.trim()) {
        const encodedRepoId = encodeURIComponent(repoId.trim());
        router.push(`/visualize?repo=${encodedRepoId}`);
      }
    },
    [router]
  );

  const navigateToHome = useCallback(() => {
    router.push("/");
  }, [router]);

  return {
    navigateToChat,
    navigateToVisualize,
    navigateToHome,
  };
}
