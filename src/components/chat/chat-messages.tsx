'use client';

import { useEffect, useRef } from 'react';
import { ChatMessage } from './chat-message';
import { ChatTypingIndicator } from './chat-typing-indicator';
import type { ChatMessage as ChatMessageType } from '@/lib/ai/types';

/**
 * ChatMessages
 *
 * Scrollable message list that auto-scrolls to bottom on new messages.
 */

interface ChatMessagesProps {
  messages: ChatMessageType[];
  isLoading?: boolean;
  streamingContent?: string;
}

export function ChatMessages({
  messages,
  isLoading,
  streamingContent,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div
      className="flex-1 overflow-y-scroll px-4 py-6 space-y-4 scrollbar-thin"
    >
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          role={message.role as 'user' | 'assistant'}
          content={message.content}
        />
      ))}

      {/* Streaming response */}
      {streamingContent && (
        <ChatMessage
          role="assistant"
          content={streamingContent}
          isStreaming={true}
        />
      )}

      {/* Typing indicator when loading but no streaming content yet */}
      {isLoading && !streamingContent && <ChatTypingIndicator />}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
}
