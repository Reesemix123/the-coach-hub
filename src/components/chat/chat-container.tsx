'use client';

import { MessageCircle, HelpCircle, BarChart3 } from 'lucide-react';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import type { ChatMessage } from '@/lib/ai/types';

/**
 * ChatContainer
 *
 * Main wrapper for the chat interface with:
 * - Welcome message on empty state
 * - Message list
 * - Input at bottom
 * - Rate limit indicator
 */

interface ChatContainerProps {
  messages: ChatMessage[];
  isLoading: boolean;
  streamingContent?: string;
  onSendMessage: (message: string) => void;
  rateLimitInfo?: {
    limit: number | null;
    used: number;
    remaining: number | null;
    unlimited: boolean;
  };
  /** Compact mode for floating widget */
  compact?: boolean;
}

export function ChatContainer({
  messages,
  isLoading,
  streamingContent,
  onSendMessage,
  rateLimitInfo,
  compact = false,
}: ChatContainerProps) {
  const hasMessages = messages.length > 0 || streamingContent;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages area */}
      {hasMessages ? (
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          streamingContent={streamingContent}
        />
      ) : (
        <WelcomeScreen compact={compact} />
      )}

      {/* Rate limit indicator */}
      {rateLimitInfo && !rateLimitInfo.unlimited && (
        <div className={`px-4 ${compact ? 'py-1.5' : 'py-2'} bg-gray-100 border-t border-gray-200`}>
          <div className={`flex items-center justify-between ${compact ? 'text-xs' : 'text-sm'}`}>
            <span className="text-gray-500">
              Messages today: {rateLimitInfo.used} / {rateLimitInfo.limit}
            </span>
            {rateLimitInfo.remaining !== null && rateLimitInfo.remaining <= 5 && (
              <span className="text-amber-600 font-medium">
                {rateLimitInfo.remaining} remaining
              </span>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        disabled={isLoading}
        placeholder={
          rateLimitInfo?.remaining === 0
            ? 'Daily limit reached. Resets at midnight.'
            : 'Ask about Youth Coach Hub...'
        }
        compact={compact}
      />
    </div>
  );
}

/**
 * WelcomeScreen
 *
 * Shown when chat is empty with helpful prompts.
 */
function WelcomeScreen({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          How can I help?
        </h3>
        <p className="text-gray-500 text-center text-sm mb-4">
          Ask about your team or the app
        </p>

        {/* Compact suggested prompts */}
        <div className="grid gap-2 w-full">
          <SuggestedPrompt
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            text="How is my run game?"
            compact
          />
          <SuggestedPrompt
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            text="Who's my leading tackler?"
            compact
          />
          <SuggestedPrompt
            icon={<HelpCircle className="w-3.5 h-3.5" />}
            text="How do I tag plays?"
            compact
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center mb-6">
        <MessageCircle className="w-8 h-8 text-white" />
      </div>

      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
        How can I help?
      </h2>
      <p className="text-gray-500 text-center max-w-md mb-8">
        Ask about your team's performance or how to use the app. I can analyze
        your stats, answer coaching questions, and help you get started.
      </p>

      {/* Suggested prompts */}
      <div className="grid gap-3 max-w-lg w-full">
        <SuggestedPrompt
          icon={<BarChart3 className="w-4 h-4" />}
          text="How is my run game?"
        />
        <SuggestedPrompt
          icon={<BarChart3 className="w-4 h-4" />}
          text="Who's my leading tackler?"
        />
        <SuggestedPrompt
          icon={<BarChart3 className="w-4 h-4" />}
          text="What's our field goal percentage?"
        />
        <SuggestedPrompt
          icon={<HelpCircle className="w-4 h-4" />}
          text="How do I tag plays?"
        />
      </div>
    </div>
  );
}

/**
 * SuggestedPrompt
 *
 * Clickable suggested question.
 */
function SuggestedPrompt({
  icon,
  text,
  compact = false,
}: {
  icon: React.ReactNode;
  text: string;
  compact?: boolean;
}) {
  return (
    <button
      className={`flex items-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-left transition-colors ${
        compact ? 'px-3 py-2' : 'px-4 py-3 gap-3'
      }`}
      onClick={() => {
        // This will be connected to send via parent
        const event = new CustomEvent('chat-suggest', { detail: text });
        window.dispatchEvent(event);
      }}
    >
      <span className="text-gray-400">{icon}</span>
      <span className={`text-gray-700 ${compact ? 'text-sm' : ''}`}>{text}</span>
    </button>
  );
}
