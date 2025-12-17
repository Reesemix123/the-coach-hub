/**
 * AI Chat Types
 *
 * Core types for the AI help chat system. Designed to be provider-agnostic
 * to support swapping between different AI models (Gemini, Claude, etc.)
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatMessage extends Message {
  id: string;
  timestamp: Date;
}

export interface AIProvider {
  id: string;
  name: string;
  generateResponse(
    messages: Message[],
    systemContext: string
  ): Promise<ReadableStream<string>>;
}

export interface StreamingOptions {
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export interface ChatUsage {
  id: string;
  user_id: string;
  date: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface RateLimitInfo {
  tier: 'basic' | 'plus' | 'premium';
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
}

export const RATE_LIMITS = {
  basic: 20,
  plus: 50,
  premium: Infinity,
} as const;

export type SubscriptionTier = keyof typeof RATE_LIMITS;
