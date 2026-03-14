'use client';

import React, { useState, useRef, useEffect, memo } from 'react';
import { Send, Loader2 } from 'lucide-react';
import type { DirectMessage } from '@/types/communication';

// ============================================================================
// Types
// ============================================================================

interface MessageThreadProps {
  messages: DirectMessage[];
  /** The current user's ID — used to determine which messages are "mine" */
  currentUserId: string;
  participantName: string;
  onSendMessage: (body: string) => Promise<void>;
  loading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a scrollable message thread with an inline compose input.
 * Handles its own sending state; error propagation is the parent's responsibility.
 */
export const MessageThread = memo(function MessageThread({
  messages,
  currentUserId,
  participantName,
  onSendMessage,
  loading = false,
}: MessageThreadProps) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const body = newMessage.trim();
    setNewMessage('');
    setSendError(null);

    try {
      setSending(true);
      await onSendMessage(body);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
      setNewMessage(body); // Restore on failure so the user doesn't lose their text
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          messages.map(msg => {
            const isMine = msg.sender_id === currentUserId;
            return (
              <MessageBubble key={msg.id} message={msg} isMine={isMine} />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send error */}
      {sendError && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-xs text-red-600">{sendError}</p>
        </div>
      )}

      {/* Compose input */}
      <form
        onSubmit={handleSend}
        className="border-t border-gray-200 px-4 py-3 flex gap-2 items-center"
      >
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder={`Message ${participantName}...`}
          className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-colors"
          disabled={sending}
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="flex-shrink-0 p-2.5 bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
});

// ============================================================================
// Sub-components
// ============================================================================

interface MessageBubbleProps {
  message: DirectMessage;
  isMine: boolean;
}

const MessageBubble = memo(function MessageBubble({
  message,
  isMine,
}: MessageBubbleProps) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[75%]">
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm break-words ${
            isMine
              ? 'bg-gray-900 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-900 rounded-bl-md'
          }`}
        >
          {message.body}
        </div>
        <div
          className={`flex items-center gap-1 mt-1 ${
            isMine ? 'justify-end' : 'justify-start'
          }`}
        >
          <span className="text-xs text-gray-400">
            {formatMessageTime(message.created_at)}
          </span>
          {isMine && message.read_at && (
            <span className="text-xs text-blue-500">Read</span>
          )}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Utilities
// ============================================================================

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  const isThisYear = date.getFullYear() === now.getFullYear();
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(isThisYear ? {} : { year: 'numeric' }),
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${datePart} ${timePart}`;
}
