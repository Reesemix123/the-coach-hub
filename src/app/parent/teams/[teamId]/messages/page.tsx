'use client';

import React, { use, useState, useEffect, useCallback } from 'react';
import { Loader2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { MessageThread } from '@/components/communication/messaging/MessageThread';
import type { DirectMessage } from '@/types/communication';

// ============================================================================
// Page
// ============================================================================

export default function ParentMessagesPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [coachId, setCoachId] = useState('');
  const [parentProfileId, setParentProfileId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch the conversation and current identity in parallel
      const [convRes, meRes] = await Promise.all([
        fetch(`/api/communication/messages?teamId=${teamId}`),
        fetch('/api/auth/me'),
      ]);

      if (!convRes.ok) throw new Error('Failed to load messages');

      const convData = await convRes.json();
      setMessages(convData.messages || []);
      if (convData.coachId) setCoachId(convData.coachId);

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.parentProfileId) setParentProfileId(meData.parentProfileId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  async function handleSendMessage(body: string) {
    if (!coachId) throw new Error('Coach information not available yet');

    const res = await fetch('/api/communication/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId,
        recipientId: coachId,
        message: body,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to send message');
    }

    // Reload the thread to show the newly sent message
    await fetchMessages();
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href={`/parent/teams/${teamId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to team
        </Link>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div
          className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col"
          style={{ height: '75vh' }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <h2 className="font-semibold text-gray-900">Message Coach</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Direct conversation with your coaching staff
            </p>
          </div>

          <MessageThread
            messages={messages}
            currentUserId={parentProfileId}
            participantName="Coach"
            onSendMessage={handleSendMessage}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
