'use client'

// Phase 1 of the position architecture redesign.
// The chip-based depth grid is removed. Coaches now pick a single primary
// position CATEGORY (12 options) when creating/editing a player. Depth
// assignments move to the scheme-aware depth chart in Phase 2.

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { MobilePlayer } from '@/app/(mobile)/MobileContext'
import { POSITION_CATEGORIES } from '@/config/footballPositions'

interface PlayerEditSheetProps {
  player: MobilePlayer | null
  preSelectedPosition?: string  // accepted but ignored — Phase 1 doesn't pre-fill from a depth slot
  highlightPosition?: string    // accepted but ignored
  teamId: string
  allPlayers: MobilePlayer[]    // accepted but unused — Phase 1 has no depth conflicts
  onClose: () => void
  onSaved: () => void
}

interface PositionCategoryRow {
  id: string
  code: string
}

export default function PlayerEditSheet({
  player,
  teamId,
  onClose,
  onSaved,
}: PlayerEditSheetProps) {
  const isEdit = !!player
  const [firstName, setFirstName] = useState(player?.first_name ?? '')
  const [lastName, setLastName] = useState(player?.last_name ?? '')
  const [jersey, setJersey] = useState(player?.jersey_number ?? '')
  const [gradeLevel, setGradeLevel] = useState(player?.grade_level ?? '')

  // Primary position category — the only position field collected in Phase 1
  const [categoryRows, setCategoryRows] = useState<PositionCategoryRow[]>([])
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string>('')

  const [saving, setSaving] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  // Load category UUIDs on mount, then set the player's existing primary category if editing.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('position_categories')
      .select('id, code')
      .eq('sport', 'football')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return
        setCategoryRows(data as PositionCategoryRow[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // When editing, hydrate the dropdown from the player's existing category id (if any)
  useEffect(() => {
    if (!isEdit || !player) return
    const existing = (player as unknown as { primary_position_category_id?: string | null })
      .primary_position_category_id
    if (existing) setPrimaryCategoryId(existing)
  }, [isEdit, player])

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim() || !jersey.trim() || !primaryCategoryId) return
    setSaving(true)
    const supabase = createClient()

    if (isEdit && player) {
      await supabase.from('players').update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        jersey_number: jersey.trim(),
        primary_position_category_id: primaryCategoryId,
        grade_level: gradeLevel || null,
      }).eq('id', player.id)
    } else {
      await supabase.from('players').insert({
        team_id: teamId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        jersey_number: jersey.trim(),
        primary_position_category_id: primaryCategoryId,
        is_active: true,
        grade_level: gradeLevel || null,
      })
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  async function handleRemoveFromRoster() {
    if (!player) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('players').update({ is_active: false }).eq('id', player.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up max-h-[85vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[var(--bg-pill-inactive)]" />
        </div>
        <div className="px-5 pb-6">
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">
            {isEdit ? 'Edit Player' : 'Add Player'}
          </h3>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="First"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Last"
              />
            </div>
          </div>

          {/* Jersey */}
          <div className="mb-4">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Jersey Number</label>
            <input
              type="text"
              value={jersey}
              onChange={e => setJersey(e.target.value.replace(/\D/g, '').slice(0, 3))}
              className="w-full mt-1 px-3 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="#"
              inputMode="numeric"
              maxLength={3}
            />
          </div>

          {/* Primary position category */}
          <div className="mb-4">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              Primary Position
            </label>
            <select
              value={primaryCategoryId}
              onChange={e => setPrimaryCategoryId(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-[var(--bg-card)]"
            >
              <option value="">Select position...</option>
              {POSITION_CATEGORIES.map(cat => {
                const row = categoryRows.find(r => r.code === cat.code)
                if (!row) return null
                return (
                  <option key={row.id} value={row.id}>
                    {cat.code} — {cat.name}
                  </option>
                )
              })}
            </select>
            {!primaryCategoryId && (
              <p className="text-xs text-red-500 mt-1">Required</p>
            )}
          </div>

          {/* Grade */}
          <div className="mb-6">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Grade / Year</label>
            <select
              value={gradeLevel ?? ''}
              onChange={e => setGradeLevel(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-[var(--bg-card)]"
            >
              <option value="">Optional</option>
              {['5th', '6th', '7th', '8th', 'Freshman', 'Sophomore', 'Junior', 'Senior'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={
              saving ||
              !firstName.trim() ||
              !lastName.trim() ||
              !jersey.trim() ||
              !primaryCategoryId
            }
            className="w-full bg-[var(--text-primary)] text-[var(--text-inverse)] rounded-xl py-3 text-sm font-semibold min-h-[48px] active:bg-[var(--bg-card-alt)] transition-colors disabled:bg-[var(--bg-card-alt)]"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Player'}
          </button>

          {/* Remove from roster */}
          {isEdit && !showRemoveConfirm && (
            <button
              type="button"
              onClick={() => setShowRemoveConfirm(true)}
              className="w-full mt-3 text-red-500 text-sm font-medium py-2 active:text-red-700"
            >
              Remove from Roster
            </button>
          )}

          {isEdit && showRemoveConfirm && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-sm text-red-700 mb-2">Remove this player from the active roster?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(false)}
                  className="flex-1 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl py-2 text-sm font-medium text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFromRoster}
                  disabled={saving}
                  className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-semibold"
                >
                  {saving ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
