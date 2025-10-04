/**
 * Application constants and configuration
 * Single source of truth for all configurable values
 * Following DRY principle - no duplication of configuration values
 */

// Streaming configuration
export const STREAMING_CONFIG = {
  DEFAULT_DELAY_MS: 50,
  MAX_QUEUE_SIZE: 1000,
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 1000,
} as const;

// Chat configuration
export const CHAT_CONFIG = {
  DEFAULT_MODE: "fast" as const,
  DUPLICATE_MESSAGE_THRESHOLD_MS: 1000,
} as const;

// Server configuration
export const SERVER_CONFIG = {
  DEFAULT_URL: process.env.NEXT_PUBLIC_SERVER_URL,
  SOCKET_PATH: "/socket.io",
  TRANSPORTS: ["websocket", "polling"],
} as const;

// UI configuration
export const UI_CONFIG = {
  ANIMATION_DURATION_MS: 300,
  SCROLL_BEHAVIOR: "smooth" as const,
} as const;

// Export types for better type safety
export type StreamingMode = "fast" | "accurate";
export type ChatMode = StreamingMode;
