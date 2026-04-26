'use client'

import { useState, useEffect, useRef } from 'react'
import { useMobile } from '@/app/(mobile)/MobileContext'
import { useCommHub, type ConversationSummary } from '../CommHubContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DirectMessage {
  id: string
  team_id: string
  sender_type: string
  sender_id: string
  recipient_type: string
  recipient_id: string
  body: string
  image_url?: string | null
  read_at: string | null
  created_at: string
}

interface ThreadViewProps {
  conversation: ConversationSummary
  onBack: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatGroupTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) return `Today ${formatMessageTime(dateStr)}`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  if (isYesterday) return `Yesterday ${formatMessageTime(dateStr)}`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Returns true if two messages are more than 5 minutes apart */
function shouldShowTimestamp(prev: DirectMessage, current: DirectMessage): boolean {
  const prevMs = new Date(prev.created_at).getTime()
  const currMs = new Date(current.created_at).getTime()
  return Math.abs(currMs - prevMs) > 5 * 60 * 1000
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ message, isCoach }: { message: DirectMessage; isCoach: boolean }) {
  return (
    <div className={`flex ${isCoach ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[75%]">
        {message.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.image_url}
            alt="Attached image"
            className={`rounded-xl mb-1 max-w-full object-cover ${
              isCoach ? 'ml-auto' : ''
            }`}
            style={{ maxHeight: 200 }}
          />
        )}
        {message.body && (
          <div
            className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
              isCoach
                ? 'bg-gray-900 text-white rounded-br-sm'
                : 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm rounded-bl-sm'
            }`}
          >
            {message.body}
          </div>
        )}
        <p
          className={`text-[10px] text-[var(--text-tertiary)] mt-1 ${
            isCoach ? 'text-right' : 'text-left'
          }`}
        >
          {formatMessageTime(message.created_at)}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ThreadView
// ---------------------------------------------------------------------------

export default function ThreadView({ conversation, onBack }: ThreadViewProps) {
  const { teamId } = useMobile()
  const { markConversationRead, refreshConversations } = useCommHub()

  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Fetch thread + mark read on mount
  useEffect(() => {
    if (!teamId) return

    // Optimistic mark-as-read
    markConversationRead(conversation.participantId)

    fetch(
      `/api/communication/messages?teamId=${teamId}&participantId=${conversation.participantId}`
    )
      .then(r => r.json())
      .then(data => {
        if (data.messages) setMessages(data.messages)
        setLoading(false)
      })
      .catch(() => setLoading(false))
    // participantId is stable for the lifetime of this view; intentionally omit
    // markConversationRead from deps to avoid re-fetching on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, conversation.participantId])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  // ---------------------------------------------------------------------------
  // Send reply
  // ---------------------------------------------------------------------------

  async function handleSend() {
    if (!reply.trim() || !teamId || sending) return
    setSending(true)
    setSendError(null)

    try {
      const res = await fetch('/api/communication/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          recipientId: conversation.participantId,
          message: reply.trim(),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.message) {
          setMessages(prev => [...prev, data.message])
        }
        setReply('')
        refreshConversations()
      } else {
        const data = await res.json()
        setSendError(data.error || 'Failed to send')
      }
    } catch {
      setSendError('Failed to send. Check your connection.')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Submit on Enter (not Shift+Enter) on non-mobile
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="bg-[var(--bg-card)] border-b border-[var(--border-primary)] px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-[var(--text-secondary)] active:text-[var(--text-primary)] transition-colors -ml-1"
          aria-label="Back"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Avatar + name */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[var(--bg-card-alt)] flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {conversation.participantName
                .split(' ')
                .map(w => w[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {conversation.participantName}
            </p>
            <p className="text-[10px] text-[var(--text-tertiary)]">Parent</p>
          </div>
        </div>
      </div>

      {/* Messages scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          // Loading skeletons
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className="h-10 bg-[var(--bg-pill-inactive)] rounded-2xl animate-pulse"
                  style={{ width: `${40 + (i * 17) % 40}%` }}
                />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-[var(--text-tertiary)]"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p className="text-sm text-[var(--text-tertiary)]">No messages yet. Send the first one.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isCoach = msg.sender_type !== 'parent'
            const prev = idx > 0 ? messages[idx - 1] : null
            const showTimestamp = !prev || shouldShowTimestamp(prev, msg)

            return (
              <div key={msg.id}>
                {showTimestamp && (
                  <p className="text-[10px] text-[var(--text-tertiary)] text-center my-2">
                    {formatGroupTimestamp(msg.created_at)}
                  </p>
                )}
                <MessageBubble message={msg} isCoach={isCoach} />
              </div>
            )
          })
        )}
      </div>

      {/* Reply input */}
      <div className="bg-[var(--bg-card)] border-t border-[var(--border-primary)] px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        {sendError && (
          <p className="text-[11px] text-red-500 mb-2">{sendError}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Message..."
            className="flex-1 bg-[var(--bg-card-alt)] rounded-2xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-400 focus:outline-none resize-none max-h-28 leading-relaxed"
            style={{ overflowY: reply.includes('\n') ? 'auto' : 'hidden' }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!reply.trim() || sending}
            className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center shrink-0 disabled:bg-[var(--bg-pill-inactive)] active:bg-gray-700 transition-colors"
            aria-label="Send message"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
            >
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
