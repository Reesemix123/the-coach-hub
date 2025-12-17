'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ChatMessage, Message } from '@/lib/ai/types';

const STORAGE_KEY = 'ych-chat-history';
const MAX_STORED_MESSAGES = 50; // Store last 50 messages

/**
 * Rate limit info from API
 */
interface RateLimitInfo {
  tier: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  unlimited: boolean;
  resetsAt: string;
}

/**
 * Stored message format (serializable)
 */
interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO string
}

/**
 * Load messages from localStorage
 */
function loadStoredMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed: StoredMessage[] = JSON.parse(stored);
    return parsed.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch (err) {
    console.error('Error loading chat history:', err);
    return [];
  }
}

/**
 * Save messages to localStorage
 */
function saveMessages(messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;

  try {
    // Only keep the last MAX_STORED_MESSAGES
    const toStore = messages.slice(-MAX_STORED_MESSAGES);
    const serializable: StoredMessage[] = toStore.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.toISOString(),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch (err) {
    console.error('Error saving chat history:', err);
  }
}

/**
 * useChat Hook
 *
 * Manages chat state including:
 * - Messages history (persisted to localStorage)
 * - Loading state
 * - Streaming responses
 * - Rate limit tracking
 */
export function useChat(teamId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load messages from localStorage on mount
  useEffect(() => {
    const stored = loadStoredMessages();
    if (stored.length > 0) {
      setMessages(stored);
    }
    setIsInitialized(true);
  }, []);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (isInitialized && messages.length > 0) {
      saveMessages(messages);
    }
  }, [messages, isInitialized]);

  // Fetch initial rate limit info
  useEffect(() => {
    fetchRateLimitInfo();
  }, [teamId]);

  const fetchRateLimitInfo = async () => {
    try {
      const url = teamId
        ? `/api/chat?teamId=${teamId}`
        : '/api/chat';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setRateLimitInfo(data);
      }
    } catch (err) {
      console.error('Error fetching rate limit info:', err);
    }
  };

  /**
   * Send a message and handle streaming response
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // Check rate limit
      if (rateLimitInfo && !rateLimitInfo.unlimited && rateLimitInfo.remaining === 0) {
        setError('Daily message limit reached. Resets at midnight.');
        return;
      }

      setError(null);
      setIsLoading(true);
      setStreamingContent('');

      // Add user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        // Prepare messages for API (send last 10 for context)
        const recentMessages = [...messages, userMessage].slice(-10);
        const apiMessages: Message[] = recentMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Send request
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: apiMessages,
            teamId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();

          if (response.status === 429) {
            setError('Daily message limit reached. Resets at midnight.');
            // Update rate limit info
            if (errorData.used !== undefined) {
              setRateLimitInfo((prev) =>
                prev
                  ? {
                      ...prev,
                      used: errorData.used,
                      remaining: 0,
                    }
                  : null
              );
            }
          } else if (response.status === 401) {
            setError('Please sign in to use the help chat.');
          } else {
            setError(errorData.error || 'Failed to send message');
          }
          setIsLoading(false);
          return;
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          setStreamingContent(fullContent);
        }

        // Add assistant message
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: fullContent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingContent('');

        // Update rate limit info
        if (rateLimitInfo && !rateLimitInfo.unlimited) {
          setRateLimitInfo((prev) =>
            prev
              ? {
                  ...prev,
                  used: prev.used + 1,
                  remaining: prev.remaining !== null ? prev.remaining - 1 : null,
                }
              : null
          );
        }
      } catch (err) {
        console.error('Chat error:', err);
        setError('Failed to send message. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, teamId, rateLimitInfo]
  );

  /**
   * Clear chat history (both state and localStorage)
   */
  const clearChat = useCallback(() => {
    setMessages([]);
    setStreamingContent('');
    setError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  /**
   * Get the total count of messages in history
   */
  const messageCount = messages.length;

  return {
    messages,
    isLoading,
    error,
    streamingContent,
    rateLimitInfo,
    sendMessage,
    clearChat,
    refetchRateLimitInfo: fetchRateLimitInfo,
    messageCount,
    isInitialized,
  };
}
