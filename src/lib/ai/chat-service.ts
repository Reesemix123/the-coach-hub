/**
 * Chat Service
 *
 * Orchestrates the AI chat flow:
 * 1. Gets context from the context provider
 * 2. Calls the AI provider to generate a response
 * 3. Handles streaming responses
 */

import type { AIProvider, Message } from './types';
import type { ContextProvider } from './context/types';
import { defaultProvider } from './providers';
import { defaultContextProvider } from './context';

export interface ChatServiceOptions {
  provider?: AIProvider;
  contextProvider?: ContextProvider;
}

export class ChatService {
  private provider: AIProvider;
  private contextProvider: ContextProvider;

  constructor(options: ChatServiceOptions = {}) {
    this.provider = options.provider || defaultProvider;
    this.contextProvider = options.contextProvider || defaultContextProvider;
  }

  /**
   * Generate a streaming response for the given messages
   */
  async generateResponse(
    messages: Message[],
    userId: string
  ): Promise<ReadableStream<string>> {
    // Get the latest user message for context relevance
    const latestUserMessage =
      messages.filter((m) => m.role === 'user').pop()?.content || '';

    // Get context from the context provider
    const systemContext = await this.contextProvider.getContext(
      userId,
      latestUserMessage
    );

    // Generate streaming response from AI provider
    return this.provider.generateResponse(messages, systemContext);
  }

  /**
   * Get the provider ID (for logging/analytics)
   */
  getProviderId(): string {
    return this.provider.id;
  }

  /**
   * Get the context provider ID (for logging/analytics)
   */
  getContextProviderId(): string {
    return this.contextProvider.id;
  }
}

// Export singleton instance with default configuration
export const chatService = new ChatService();
