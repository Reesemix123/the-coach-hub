'use client'

import { useState } from 'react'
import { useCommHub, type Announcement } from '../CommHubContext'

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

function channelLabel(channel: string): string | null {
  switch (channel) {
    case 'email': return 'Email'
    case 'sms': return 'SMS'
    case 'email_sms': case 'both': return 'Email + SMS'
    case 'in_app': case 'push': return null
    default: return null
  }
}

// ---------------------------------------------------------------------------
// Announcement Card
// ---------------------------------------------------------------------------

function AnnouncementCard({
  announcement,
  onTap,
}: {
  announcement: Announcement
  onTap: () => void
}) {
  const ch = channelLabel(announcement.notification_channel)

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full bg-[var(--bg-card)] rounded-xl px-4 py-3.5 text-left active:opacity-70 transition-opacity shadow-sm"
    >
      <div className="flex items-start gap-2">
        {/* Priority dot */}
        {announcement.priority === 'urgent' && (
          <span className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0" />
        )}
        {announcement.priority === 'important' && (
          <span className="w-2 h-2 bg-amber-500 rounded-full mt-1.5 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{announcement.title}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{announcement.body}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-[var(--text-tertiary)]">{relativeTime(announcement.created_at)}</span>
            {ch && (
              <>
                <span className="text-[var(--text-tertiary)] text-[10px]">·</span>
                <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-card-alt)] rounded-full px-1.5 py-0.5">{ch}</span>
              </>
            )}
            {announcement.target_position_group && (
              <>
                <span className="text-[var(--text-tertiary)] text-[10px]">·</span>
                <span className="text-[10px] text-[var(--text-tertiary)] capitalize">{announcement.target_position_group}</span>
              </>
            )}
          </div>
        </div>

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)] shrink-0 mt-1">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Announcement List
// ---------------------------------------------------------------------------

interface AnnouncementListProps {
  onSelectAnnouncement: (a: Announcement) => void
  onCompose: () => void
}

export default function AnnouncementList({ onSelectAnnouncement, onCompose }: AnnouncementListProps) {
  const { announcements, announcementsLoading, parentCount, planTier } = useCommHub()

  if (announcementsLoading) {
    return (
      <div className="px-4 space-y-3 mt-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-[var(--bg-card)] rounded-xl px-4 py-4 animate-pulse shadow-sm">
            <div className="h-4 bg-[var(--bg-card-alt)] rounded w-2/3 mb-2" />
            <div className="h-3 bg-[var(--bg-card-alt)] rounded w-full mb-1" />
            <div className="h-3 bg-[var(--bg-card-alt)] rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  // Empty state: no parents invited
  if (parentCount === 0 && announcements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 gap-3">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)]">
          <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M21 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
        <p className="text-sm font-medium text-[var(--text-secondary)] text-center">Invite parents to start communicating</p>
        <p className="text-xs text-[var(--text-tertiary)] text-center">Parents can be invited from the desktop app</p>
      </div>
    )
  }

  // Empty state: no announcements yet
  if (announcements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 gap-3">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)]">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <p className="text-sm font-medium text-[var(--text-secondary)] text-center">No announcements yet</p>
        <p className="text-xs text-[var(--text-tertiary)] text-center">Send your first one to connect with parents</p>
        <button
          type="button"
          onClick={onCompose}
          className="mt-2 bg-[#B8CA6E] text-[#1c1c1e] rounded-xl px-5 py-2.5 text-sm font-semibold active:bg-[#a8b85e]"
        >
          New Announcement
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 space-y-3 mt-3 pb-20">
      {announcements.map(a => (
        <AnnouncementCard
          key={a.id}
          announcement={a}
          onTap={() => onSelectAnnouncement(a)}
        />
      ))}

      {/* Compose button (fixed bottom) */}
      <div className="fixed bottom-[calc(49px+env(safe-area-inset-bottom))] left-0 right-0 px-4 py-3 bg-gradient-to-t from-[#f2f2f7] via-[#f2f2f7] to-transparent">
        <button
          type="button"
          onClick={onCompose}
          className="w-full bg-[#B8CA6E] text-[#1c1c1e] rounded-xl py-3 text-sm font-bold active:bg-[#a8b85e] transition-colors"
        >
          New Announcement
        </button>
      </div>
    </div>
  )
}
