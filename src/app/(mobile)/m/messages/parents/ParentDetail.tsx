'use client'

import { useState } from 'react'
import { useMobile } from '@/app/(mobile)/MobileContext'
import type { ParentWithChildren } from '../CommHubContext'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// ParentDetail
// ---------------------------------------------------------------------------

interface ParentDetailProps {
  parent: ParentWithChildren
  onBack: () => void
  onChanged: () => void
}

export default function ParentDetail({ parent, onBack, onChanged }: ParentDetailProps) {
  const { teamId } = useMobile()
  const { parent: profile, children } = parent

  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [championLoading, setChampionLoading] = useState(false)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggleChampion() {
    if (!teamId) return
    setChampionLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/communication/parents/${profile.id}/champion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isChampion: !profile.is_champion, teamId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to update champion status')
      } else {
        onChanged()
      }
    } catch {
      setError('Failed to update. Check your connection.')
    } finally {
      setChampionLoading(false)
    }
  }

  async function handleRemove() {
    if (!teamId) return
    setRemoveLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/communication/parents/${profile.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, status: 'removed' }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to remove parent')
        setRemoveLoading(false)
      } else {
        onChanged()
      }
    } catch {
      setError('Failed to remove. Check your connection.')
      setRemoveLoading(false)
    }
  }

  return (
    <div className="pb-8">
      {/* Back header */}
      <div className="px-4 pt-3 mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Parents
        </button>
      </div>

      {/* Name + champion */}
      <div className="px-4 mb-4">
        <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-card-alt)] flex items-center justify-center shrink-0">
              <span className="text-base font-semibold text-[var(--text-secondary)]">
                {profile.first_name[0]}{profile.last_name[0]}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  {profile.first_name} {profile.last_name}
                </h2>
                {profile.is_champion && (
                  <span className="text-amber-500 text-base" title="Team Champion">★</span>
                )}
              </div>
              {profile.is_champion && (
                <p className="text-xs text-amber-600 font-medium">Team Champion</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="px-4 mb-4">
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Contact</p>
        <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
          <a
            href={`mailto:${profile.email}`}
            className="flex items-center gap-3 px-4 py-3 active:bg-[var(--bg-card-alt)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)] shrink-0">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Email</p>
              <p className="text-sm text-blue-600 truncate">{profile.email}</p>
            </div>
          </a>

          {profile.phone && (
            <a
              href={`tel:${profile.phone}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-[var(--bg-card-alt)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)] shrink-0">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.63 19.79 19.79 0 01.08 2a2 2 0 012-2.18h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.06 7.06a16 16 0 006.88 6.88l1.41-1.41a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Phone</p>
                <p className="text-sm text-blue-600">{profile.phone}</p>
              </div>
            </a>
          )}
        </div>
      </div>

      {/* Linked athletes */}
      {children.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Athletes ({children.length})
          </p>
          <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
            {children.map(child => (
              <div key={child.player_id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-[var(--bg-card-alt)] flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-secondary)]">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{child.player_name}</p>
                    {child.jersey_number && (
                      <span className="text-[10px] text-[var(--text-tertiary)]">#{child.jersey_number}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-[var(--text-secondary)]">{child.relationship}</span>
                    {child.is_primary_contact && (
                      <>
                        <span className="text-[var(--text-tertiary)] text-xs">·</span>
                        <span className="text-[10px] font-semibold text-[#B8CA6E] bg-[#B8CA6E]/10 rounded-full px-1.5 py-0.5">Primary Contact</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      <div className="px-4 mb-4">
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Status</p>
        <div className="bg-[var(--bg-card)] rounded-xl px-4 py-3 shadow-sm">
          <p className="text-sm text-[var(--text-secondary)]">Active since {formatDate(profile.created_at)}</p>
        </div>
      </div>

      {/* TODO: Per-parent RSVP history */}

      {error && (
        <div className="px-4 mb-3">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 space-y-2">
        <button
          type="button"
          onClick={handleToggleChampion}
          disabled={championLoading}
          className={`w-full rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
            profile.is_champion
              ? 'bg-amber-50 text-amber-700 active:bg-amber-100'
              : 'bg-[var(--bg-card-alt)] text-[var(--text-primary)] active:bg-[var(--bg-pill-inactive)]'
          }`}
        >
          {championLoading
            ? 'Updating...'
            : profile.is_champion
              ? 'Remove Champion Status'
              : 'Make Team Champion'}
        </button>

        <button
          type="button"
          onClick={() => setShowRemoveConfirm(true)}
          className="w-full bg-red-50 text-red-600 rounded-xl py-3 text-sm font-semibold active:bg-red-100 transition-colors"
        >
          Remove from Team
        </button>
      </div>

      {/* Remove confirmation sheet */}
      {showRemoveConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowRemoveConfirm(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[var(--bg-pill-inactive)]" />
            </div>
            <div className="px-5 pb-6 text-center">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Remove Parent?</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {profile.first_name} {profile.last_name} will lose access to team communications.
              </p>
              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(false)}
                  className="flex-1 bg-[var(--bg-card-alt)] text-[var(--text-primary)] rounded-xl py-3 text-sm font-semibold active:bg-[var(--bg-pill-inactive)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={removeLoading}
                  className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-semibold active:bg-red-700 disabled:opacity-50"
                >
                  {removeLoading ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
