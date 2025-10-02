import { ChatHistory, GitHubRepo, FileNode } from "@/types";

/**
 * Mock data service following SOLID principles
 * Single responsibility: Provide mock data for development
 * Open/Closed: Easy to extend with new data types
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

export const mockRepoHistory: GitHubRepo[] = [
  {
    id: "1",
    name: "github.com/owner/project",
    url: "https://github.com/owner/project",
    owner: "owner",
    repo: "project",
    fullName: "owner/project",
    lastAccessed: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: "2",
    name: "github.com/owner/another-repo",
    url: "https://github.com/owner/another-repo",
    owner: "owner",
    repo: "another-repo",
    fullName: "owner/another-repo",
    lastAccessed: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "3",
    name: "github.com/owner/third-repo",
    url: "https://github.com/owner/third-repo",
    owner: "owner",
    repo: "third-repo",
    fullName: "owner/third-repo",
    lastAccessed: new Date(Date.now() - 1000 * 60 * 60 * 4),
  },
];

export const mockFileTree: FileNode[] = [
  {
    id: "src",
    name: "src",
    type: "folder",
    children: [
      {
        id: "src/components",
        name: "components",
        type: "folder",
        children: [
          {
            id: "src/components/button.tsx",
            name: "button.tsx",
            type: "file",
            content: `import React from 'react'

type ButtonProps = { label: string }

export function Button({ label }: ButtonProps) {
  return (
    <button className="btn">{label}</button>
  )
}

// Usage
// <Button label="Click me" />`,
            size: "12 files",
          },
          {
            id: "src/components/modal.tsx",
            name: "modal.tsx",
            type: "file",
            content: `import React from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}`,
            size: "5 files",
          },
        ],
      },
      {
        id: "src/utils",
        name: "utils",
        type: "folder",
        children: [
          {
            id: "src/utils/date.ts",
            name: "date.ts",
            type: "file",
            content: `export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export function getRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return \`\${days} days ago\`
  return formatDate(date)
}`,
            size: "3 files",
          },
        ],
      },
    ],
  },
  {
    id: "config",
    name: "config",
    type: "folder",
    children: [
      {
        id: "config/settings.yaml",
        name: "settings.yaml",
        type: "file",
        content: `database:
  host: localhost
  port: 5432
  name: myapp

server:
  port: 3000
  cors:
    enabled: true
    origins: ["http://localhost:3000"]

features:
  auth: true
  analytics: false`,
        size: "2 files",
      },
    ],
  },
  {
    id: "tests",
    name: "tests",
    type: "folder",
    children: [
      {
        id: "tests/app.spec.ts",
        name: "app.spec.ts",
        type: "file",
        content: `import { describe, it, expect } from 'vitest'
import { add } from '../src/utils/math'

describe('Math Utils', () => {
  it('should add two numbers correctly', () => {
    expect(add(2, 3)).toBe(5)
    expect(add(-1, 1)).toBe(0)
    expect(add(0, 0)).toBe(0)
  })
})`,
        size: "1 file",
      },
    ],
  },
  {
    id: "package.json",
    name: "package.json",
    type: "file",
    content: `{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@types/react": "^18.0.0"
  }
}`,
    size: "1 file",
  },
  {
    id: "pnpm-workspace.yaml",
    name: "pnpm-workspace.yaml",
    type: "file",
    content: `packages:
  - 'packages/*'
  - 'apps/*'

shared-workspace-lockfile: true`,
    size: "1 file",
  },
];
