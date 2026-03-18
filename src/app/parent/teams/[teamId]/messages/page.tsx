'use client';

import React, { use, useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, ChevronLeft, Send } from 'lucide-react';
import Link from 'next/link';
import type { DirectMessage } from '@/types/communication';

export default function ParentMessagesPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [parentProfileId, setParentProfileId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Refs — never stale in concurrent mode
  const coachIdRef = useRef('');
  const sendingRef = useRef(false);
  const newMessageRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        const [convRes, meRes] = await Promise.all([
          fetch(`/api/communication/messages?teamId=${teamId}`),
          fetch('/api/auth/me'),
        ]);

        if (cancelled) return;

        if (!convRes.ok) {
          const errData = await convRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to load messages');
        }

        const convData = await convRes.json();
        setMessages(convData.messages ?? []);

        if (convData.coachId) {
          coachIdRef.current = convData.coachId;
        }

        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.parentProfileId) setParentProfileId(meData.parentProfileId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(
    async () => {
      console.log('[SEND] handleSend called. newMessageRef:', newMessageRef.current, 'sendingRef:', sendingRef.current);
      // Read from ref, not state, to avoid stale-closure issues
      const body = newMessageRef.current.trim();
      if (!body || sendingRef.current) {
        console.log('[SEND] Early return. body empty?', !body, 'sending?', sendingRef.current);
        return;
      }

      const coachId = coachIdRef.current;
      if (!coachId) {
        setSendError('Coach information not available. Please refresh the page.');
        return;
      }

      // Mark as sending synchronously via both ref and state.
      sendingRef.current = true;
      setSending(true);
      setSendError(null);

      // Optimistically clear the input so the UX feels instant.
      setNewMessage('');

      try {
        console.log('[SEND] About to fetch. body:', body, 'coachId:', coachId, 'teamId:', teamId);
        const res = await fetch('/api/communication/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId, recipientId: coachId, message: body }),
        });
        console.log('[SEND] Fetch returned:', res.status);

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Server error ${res.status}`);
        }

        // Reload the thread so the new message appears.
        const convRes = await fetch(
          `/api/communication/messages?teamId=${teamId}`
        );
        if (convRes.ok) {
          const convData = await convRes.json();
          setMessages(convData.messages ?? []);
        }
      } catch (err) {
        // Restore the user's text so they don't lose it.
        setNewMessage(body);
        setSendError(err instanceof Error ? err.message : 'Failed to send. Please try again.');
        console.error('[ParentMessagesPage] Send failed:', err);
      } finally {
        sendingRef.current = false;
        setSending(false);
        // Return focus to the input after send.
        inputRef.current?.focus();
      }
    },
    [teamId]
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/parent"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
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

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">
                  No messages yet. Start the conversation!
                </p>
              </div>
            ) : (
              messages.map(msg => {
                const isMine = msg.sender_id === parentProfileId;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="max-w-[75%]">
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm break-words ${
                          isMine
                            ? 'bg-gray-900 text-white rounded-br-md'
                            : 'bg-gray-100 text-gray-900 rounded-bl-md'
                        }`}
                      >
                        {msg.body}
                      </div>
                      <div
                        className={`flex items-center gap-1 mt-1 ${
                          isMine ? 'justify-end' : ''
                        }`}
                      >
                        <span className="text-xs text-gray-400">
                          {new Date(msg.created_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </span>
                        {isMine && msg.read_at && (
                          <span className="text-xs text-blue-500">Read</span>
                        )}
                      </div>
                    </div>
                  </div>
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
          <div className="border-t border-gray-200 px-4 py-3 flex gap-2 items-center flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={e => { setNewMessage(e.target.value); newMessageRef.current = e.target.value; }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Message Coach..."
              className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-colors"
              disabled={sending}
              maxLength={2000}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="flex-shrink-0 p-2.5 bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
    </div>
  );
}
