/**
 * Configuration management
 * Following SOLID principles - Interface Segregation and Single Responsibility
 * Following DRY principle - centralized configuration
 */

import { STREAMING_CONFIG, CHAT_CONFIG, SERVER_CONFIG, type StreamingMode } from './constants';

/**
 * Streaming configuration interface
 * Following ISP - only exposes what's needed for streaming
 */
export interface StreamingConfig {
  delayMs: number;
  maxQueueSize: number;
}

/**
 * Chat configuration interface
 * Following ISP - only exposes what's needed for chat
 */
export interface ChatConfig {
  mode: StreamingMode;
  duplicateThresholdMs: number;
}

/**
 * Server configuration interface
 * Following ISP - only exposes what's needed for server connection
 */
export interface ServerConfig {
  url: string;
  socketPath: string;
  transports: string[];
  reconnectionAttempts: number;
  reconnectionDelay: number;
}

/**
 * Configuration factory
 * Following Factory pattern and DRY principle
 */
export class ConfigFactory {
  /**
   * Create streaming configuration with defaults
   */
  static createStreamingConfig(overrides: Partial<StreamingConfig> = {}): StreamingConfig {
    return {
      delayMs: STREAMING_CONFIG.DEFAULT_DELAY_MS,
      maxQueueSize: STREAMING_CONFIG.MAX_QUEUE_SIZE,
      ...overrides,
    };
  }

  /**
   * Create chat configuration with defaults
   */
  static createChatConfig(overrides: Partial<ChatConfig> = {}): ChatConfig {
    return {
      mode: CHAT_CONFIG.DEFAULT_MODE,
      duplicateThresholdMs: CHAT_CONFIG.DUPLICATE_MESSAGE_THRESHOLD_MS,
      ...overrides,
    };
  }

  /**
   * Create server configuration with defaults
   */
  static createServerConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
    return {
      url: SERVER_CONFIG.DEFAULT_URL,
      socketPath: SERVER_CONFIG.SOCKET_PATH,
      transports: [...SERVER_CONFIG.TRANSPORTS],
      reconnectionAttempts: STREAMING_CONFIG.RECONNECTION_ATTEMPTS,
      reconnectionDelay: STREAMING_CONFIG.RECONNECTION_DELAY,
      ...overrides,
    };
  }
}

/**
 * Default configurations
 * Following DRY principle - single source of truth
 */
export const DEFAULT_CONFIGS = {
  streaming: ConfigFactory.createStreamingConfig(),
  chat: ConfigFactory.createChatConfig(),
  server: ConfigFactory.createServerConfig(),
} as const;
