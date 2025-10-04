import { ChatHistory } from "@/types";

/**
 * Mock data service following SOLID principles
 * Single responsibility: Provide mock data for development
 * Following KISS principle - only what's needed
 */
export const mockChatHistory: ChatHistory[] = [
  {
    id: "1",
    title: "Setup & testing",
    repo: "github.com/owner/project",
    messages: [
      {
        id: "1",
        role: "user",
        content: "How is the project structured? Any testing setup?",
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
      },
      {
        id: "2",
        role: "assistant",
        content:
          "The repository follows a standard monorepo layout with app and packages folders. Testing uses Vitest and Playwright.",
        timestamp: new Date(Date.now() - 1000 * 60 * 25),
      },
    ],
    lastActivity: new Date(Date.now() - 1000 * 60 * 25),
  },
  {
    id: "2",
    title: "Add auth middleware",
    repo: "github.com/owner/project",
    messages: [],
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "3",
    title: "Refactor utils",
    repo: "github.com/owner/project",
    messages: [],
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 4),
  },
];
