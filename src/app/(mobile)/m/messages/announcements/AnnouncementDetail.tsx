'use client'

import { useState, useEffect } from 'react'
import type { Announcement } from '../CommHubContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReadReceipt {
  parent_id: string
  parent_name: string
  read_at: string | null
}

interface StatsResponse {
  total_targeted?: number
  read_count?: number
  unread_count?: number
  read_parents?: ReadReceipt[]
  unread_parents?: ReadReceipt[]
  // API may return different field names — handle defensively
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AnnouncementDetailProps {
  announcement: Announcement
  onBack: () => void
}

export default function AnnouncementDetail({ announcement, onBack }: AnnouncementDetailProps) {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/communication/announcements/${announcement.id}/stats`)
      .then(res => res.json())
      .then(data => {
        setStats(data)
        setStatsLoading(false)
      })
      .catch(() => setStatsLoading(false))
  }, [announcement.id])

  const priorityLabel = announcement.priority !== 'normal' ? announcement.priority : null

  return (
    <div className="pb-8">
      {/* Back button */}
      <div className="px-4 pt-3 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Announcements
        </button>
      </div>

      {/* Announcement content */}
      <div className="px-4">
        <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            {priorityLabel && (
              <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${
                priorityLabel === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {priorityLabel}
              </span>
            )}
            <span className="text-xs text-[var(--text-tertiary)]">{formatDate(announcement.created_at)}</span>
          </div>

          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">{announcement.title}</h2>
          <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{announcement.body}</p>
        </div>
      </div>

      {/* Read receipts */}
      <div className="px-4 mt-4">
        <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">Read Receipts</p>

        {statsLoading ? (
          <div className="bg-[var(--bg-card)] rounded-xl p-4 animate-pulse shadow-sm">
            <div className="h-4 bg-[var(--bg-card-alt)] rounded w-32 mb-3" />
            <div className="h-3 bg-[var(--bg-card-alt)] rounded w-48 mb-2" />
            <div className="h-3 bg-[var(--bg-card-alt)] rounded w-40" />
          </div>
        ) : stats ? (
          <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden shadow-sm">
            {/* Summary */}
            <div className="px-4 py-3 border-b border-[var(--border-primary)] flex items-center gap-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {stats.read_count ?? 0} of {stats.total_targeted ?? 0} read
              </span>
              {(stats.total_targeted ?? 0) > 0 && (
                <div className="flex-1 h-1.5 bg-[var(--bg-card-alt)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#B8CA6E] rounded-full transition-all"
                    style={{ width: `${Math.round(((stats.read_count ?? 0) / (stats.total_targeted ?? 1)) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Read list */}
            {(stats.read_parents ?? []).length > 0 && (
              <div className="px-4 py-2">
                <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  Read ({stats.read_count ?? 0})
                </p>
                {(stats.read_parents ?? []).map((p: ReadReceipt) => (
                  <div key={p.parent_id} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-[var(--text-primary)]">{p.parent_name}</span>
                    {p.read_at && (
                      <span className="text-[10px] text-[var(--text-tertiary)]">{relativeTime(p.read_at)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Unread list */}
            {(stats.unread_parents ?? []).length > 0 && (
              <div className="px-4 py-2 border-t border-[var(--border-primary)]">
                <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  Not yet read ({stats.unread_count ?? 0})
                </p>
                {(stats.unread_parents ?? []).map((p: ReadReceipt) => (
                  <div key={p.parent_id} className="py-1.5">
                    <span className="text-sm text-[var(--text-secondary)]">{p.parent_name}</span>
                  </div>
                ))}
              </div>
            )}

            {(stats.total_targeted ?? 0) === 0 && (
              <div className="px-4 py-3">
                <p className="text-xs text-[var(--text-tertiary)]">No parents targeted for this announcement</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-sm">
            <p className="text-xs text-[var(--text-tertiary)]">Unable to load read receipts</p>
          </div>
        )}
      </div>
    </div>
  )
}
