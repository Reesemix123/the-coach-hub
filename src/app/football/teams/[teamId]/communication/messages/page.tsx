'use client';

import React, { use, useState, useEffect, useCallback } from 'react';
import { MessageSquare, Loader2, ChevronLeft } from 'lucide-react';
import { MessageThread } from '@/components/communication/messaging/MessageThread';
import type { DirectMessage } from '@/types/communication';

// ============================================================================
// Types
// ============================================================================

interface ConversationSummary {
  participantId: string;
  participantName: string;
  participantType: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

// ============================================================================
// Page
// ============================================================================

export default function CoachMessagesPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [inboxLoading, setInboxLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch inbox list and current user ID on mount
  const fetchInbox = useCallback(async () => {
    try {
      setInboxLoading(true);
      setError(null);

      const [inboxRes, meRes] = await Promise.all([
        fetch(`/api/communication/messages?teamId=${teamId}&view=inbox`),
        fetch('/api/auth/me'),
      ]);

      if (!inboxRes.ok) throw new Error('Failed to load inbox');
      const inboxData = await inboxRes.json();
      setConversations(inboxData.conversations || []);

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user?.id) setCurrentUserId(meData.user.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setInboxLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // Load a specific conversation thread
  const loadConversation = useCallback(
    async (parentId: string) => {
      setSelectedParentId(parentId);
      setThreadLoading(true);
      try {
        const res = await fetch(
          `/api/communication/messages?teamId=${teamId}&participantId=${parentId}`
        );
        if (!res.ok) throw new Error('Failed to load conversation');
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        console.error('Failed to load conversation:', err);
      } finally {
        setThreadLoading(false);
      }
    },
    [teamId]
  );

  async function handleSendMessage(body: string, imageUrl?: string) {
    if (!selectedParentId) return;

    const res = await fetch('/api/communication/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId,
        recipientId: selectedParentId,
        message: body,
        ...(imageUrl ? { imageUrl } : {}),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to send message');
    }

    // Reload thread and refresh inbox summary counts
    await Promise.all([loadConversation(selectedParentId), fetchInbox()]);
  }

  // Poll for new messages every 5s when a conversation is open
  useEffect(() => {
    if (!selectedParentId) return;
    const interval = setInterval(() => {
      fetch(`/api/communication/messages?teamId=${teamId}&participantId=${selectedParentId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data?.messages) setMessages(data.messages); })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [teamId, selectedParentId]);

  // Poll inbox every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInbox();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchInbox]);

  const selectedConversation = conversations.find(
    c => c.participantId === selectedParentId
  );

  // ============================================================================
  // Render
  // ============================================================================

  if (inboxLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Messages</h1>
        <p className="text-gray-600 mt-1">Direct conversations with parents</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div
        className="bg-white rounded-xl border border-gray-200 overflow-hidden flex"
        style={{ height: '70vh' }}
      >
        {/* Conversation list — hidden on mobile when a thread is open */}
        <div
          className={`w-80 border-r border-gray-200 flex-shrink-0 overflow-y-auto ${
            selectedParentId ? 'hidden md:block' : 'block'
          }`}
        >
          {conversations.length === 0 ? (
            <div className="text-center py-16 px-4">
              <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">No conversations yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Parents can message you here once they join the team.
              </p>
            </div>
          ) : (
            <ul>
              {conversations.map(conv => (
                <li key={conv.participantId}>
                  <button
                    onClick={() => loadConversation(conv.participantId)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      selectedParentId === conv.participantId ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 text-sm">
                        {conv.participantName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTimeShort(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-500 line-clamp-1 flex-1">
                        {conv.lastMessage}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="flex-shrink-0 min-w-[20px] h-5 px-1 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Thread pane */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedParentId ? (
            <>
              {/* Thread header */}
              <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => setSelectedParentId(null)}
                  className="md:hidden text-gray-500 hover:text-gray-700"
                  aria-label="Back to inbox"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="font-medium text-gray-900 truncate">
                  {selectedConversation?.participantName ?? 'Conversation'}
                </h2>
              </div>

              <MessageThread
                messages={messages}
                currentUserId={currentUserId}
                participantName={selectedConversation?.participantName ?? 'Parent'}
                onSendMessage={handleSendMessage}
                teamId={teamId}
                loading={threadLoading}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  Select a conversation to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function formatTimeShort(ts: string): string {
  const d = new Date(ts);
  const now = new Date();

  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
