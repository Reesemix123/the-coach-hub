'use client'

import { useState, useEffect, useMemo } from 'react'
import { useCommHub, type Announcement, type ConversationSummary } from '../CommHubContext'
import { EmptyState } from '@/app/(mobile)/components/EmptyState'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InboxFilter = 'all' | 'announcements' | 'direct'

interface InboxItem {
  type: 'announcement' | 'thread'
  id: string
  sortDate: string
  announcement?: Announcement
  conversation?: ConversationSummary
}

interface MessageInboxProps {
  onSelectAnnouncement: (a: Announcement) => void
  onSelectThread: (c: ConversationSummary) => void
  onCompose: () => void
  isActive: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '…'
}

// ---------------------------------------------------------------------------
// Skeleton cards
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl px-4 py-3.5 animate-pulse shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--bg-card-alt)] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-4 bg-[var(--bg-card-alt)] rounded w-1/2 mb-2" />
          <div className="h-3 bg-[var(--bg-card-alt)] rounded w-4/5 mb-1" />
          <div className="h-3 bg-[var(--bg-card-alt)] rounded w-1/4" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Announcement row
// ---------------------------------------------------------------------------

function AnnouncementRow({
  announcement,
  onTap,
}: {
  announcement: Announcement
  onTap: () => void
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full bg-[var(--bg-card)] rounded-xl px-4 py-3.5 text-left active:opacity-70 transition-opacity shadow-sm"
    >
      <div className="flex items-start gap-3">
        {/* Broadcast icon */}
        <div className="w-8 h-8 rounded-full bg-[var(--bg-card-alt)] flex items-center justify-center shrink-0">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[var(--text-secondary)]"
          >
            <path d="M22 8.5a9.5 9.5 0 01-9.5 9.5M22 8.5A9.5 9.5 0 0012.5 18m9.5-9.5H3m0 0a9.5 9.5 0 019.5-9.5M3 8.5a9.5 9.5 0 009.5 9.5m0-19v19" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{announcement.title}</p>
            <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">
              {relativeTime(announcement.created_at)}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">
            {truncate(announcement.body, 100)}
          </p>
          {/* Priority badge */}
          {announcement.priority !== 'normal' && (
            <span
              className={`inline-block mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${
                announcement.priority === 'urgent'
                  ? 'bg-red-50 text-red-500'
                  : 'bg-amber-50 text-amber-500'
              }`}
            >
              {announcement.priority}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Thread row
// ---------------------------------------------------------------------------

function ThreadRow({
  conversation,
  onTap,
}: {
  conversation: ConversationSummary
  onTap: () => void
}) {
  const hasUnread = conversation.unreadCount > 0
  const initials = conversation.participantName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full bg-[var(--bg-card)] rounded-xl px-4 py-3.5 text-left active:opacity-70 transition-opacity shadow-sm"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-[var(--bg-card-alt)] flex items-center justify-center">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">{initials}</span>
          </div>
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border border-[#f2f2f7]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-sm truncate ${
                hasUnread ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'
              }`}
            >
              {conversation.participantName}
            </p>
            <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">
              {relativeTime(conversation.lastMessageAt)}
            </span>
          </div>
          <p
            className={`text-xs mt-0.5 truncate ${
              hasUnread ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
            }`}
          >
            {truncate(conversation.lastMessage, 80)}
          </p>
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// MessageInbox
// ---------------------------------------------------------------------------

export default function MessageInbox({
  onSelectAnnouncement,
  onSelectThread,
  onCompose,
  isActive,
}: MessageInboxProps) {
  const {
    announcements,
    conversations,
    refreshAnnouncements,
    refreshConversations,
    announcementsLoading,
    conversationsLoading,
  } = useCommHub()

  const [filter, setFilter] = useState<InboxFilter>('all')

  // 30-second polling — only when section is active AND document is visible
  useEffect(() => {
    if (!isActive) return

    function poll() {
      if (document.visibilityState !== 'visible') return
      refreshAnnouncements()
      refreshConversations()
    }

    const interval = setInterval(poll, 30000)

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        refreshAnnouncements()
        refreshConversations()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [isActive, refreshAnnouncements, refreshConversations])

  // Build merged chronological feed
  const items: InboxItem[] = useMemo(() => {
    const result: InboxItem[] = []

    if (filter !== 'direct') {
      for (const a of announcements) {
        result.push({
          type: 'announcement',
          id: `announcement-${a.id}`,
          sortDate: a.created_at,
          announcement: a,
        })
      }
    }

    if (filter !== 'announcements') {
      for (const c of conversations) {
        result.push({
          type: 'thread',
          id: `thread-${c.participantId}`,
          sortDate: c.lastMessageAt,
          conversation: c,
        })
      }
    }

    // Most recent first
    result.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
    return result
  }, [announcements, conversations, filter])

  const isLoading = announcementsLoading || conversationsLoading

  return (
    <div className="flex flex-col flex-1">
      {/* Header row: filter pills + compose button */}
      <div className="px-4 mt-2 mb-3 flex items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'announcements', label: 'Announcements' },
              { key: 'direct', label: 'Direct' },
            ] as { key: InboxFilter; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === key
                  ? 'bg-[var(--bg-pill-active-accent)] text-[var(--accent-text)]'
                  : 'bg-[var(--bg-card-alt)] text-[var(--text-secondary)] active:bg-[var(--bg-pill-inactive)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Compose button */}
        <button
          type="button"
          onClick={onCompose}
          className="shrink-0 w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center active:bg-gray-700 transition-colors"
          aria-label="Compose message"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
          >
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>

      {/* Feed */}
      <div className="px-4 space-y-2.5 pb-24">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : items.length === 0 ? (
          <EmptyState
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            }
            title="No messages yet"
            description="Send an announcement or message a parent directly."
            actionLabel="Send a message"
            onAction={onCompose}
          />
        ) : (
          items.map(item =>
            item.type === 'announcement' && item.announcement ? (
              <AnnouncementRow
                key={item.id}
                announcement={item.announcement}
                onTap={() => onSelectAnnouncement(item.announcement!)}
              />
            ) : item.type === 'thread' && item.conversation ? (
              <ThreadRow
                key={item.id}
                conversation={item.conversation}
                onTap={() => onSelectThread(item.conversation!)}
              />
            ) : null
          )
        )}
      </div>
    </div>
  )
}
