/**
 * Shared types and interfaces for the Githubify AI application
 * Following SOLID principles with clear separation of concerns
 * Following KISS principle - only essential types
 */

// Core domain types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ChatHistory {
  id: string;
  title: string;
  repo: string;
  messages: ChatMessage[];
  lastActivity: Date;
}

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
  size?: string;
}

// UI component props
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export interface HeaderProps {
  title: string;
  showBeta?: boolean;
  className?: string;
}

// Service types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface GitHubUrlValidation {
  isValid: boolean;
  owner?: string;
  repo?: string;
  fullName?: string;
}
