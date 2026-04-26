'use client'

import { useState } from 'react'
import { useMobile } from '@/app/(mobile)/MobileContext'
import { useCommHub } from '../CommHubContext'
import type { TeamEvent } from './CalendarList'

const EVENT_TYPES = [
  { value: 'practice', label: 'Practice' },
  { value: 'game', label: 'Game' },
  { value: 'scrimmage', label: 'Scrimmage' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'team_bonding', label: 'Team Bonding' },
  { value: 'film_session', label: 'Film Session' },
  { value: 'parent_meeting', label: 'Parent Meeting' },
  { value: 'fundraiser', label: 'Fundraiser' },
  { value: 'other', label: 'Other' },
]

const CHANNELS = [
  { value: 'in_app', label: 'In-App', requiresPaid: false },
  { value: 'email', label: 'Email', requiresPaid: true },
  { value: 'both', label: 'Email + SMS', requiresPaid: true },
]

interface NewEventSheetProps {
  editingEvent?: TeamEvent | null
  onClose: () => void
  onSaved: () => void
}

export default function NewEventSheet({ editingEvent, onClose, onSaved }: NewEventSheetProps) {
  const { teamId } = useMobile()
  const { isPaid } = useCommHub()
  const isEdit = !!editingEvent

  const [title, setTitle] = useState(editingEvent?.title ?? '')
  const [eventType, setEventType] = useState(editingEvent?.event_type ?? 'practice')
  const [date, setDate] = useState(() => {
    if (editingEvent?.date) return editingEvent.date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  const [startTime, setStartTime] = useState(editingEvent?.start_time?.slice(0, 5) ?? '16:00')
  const [endTime, setEndTime] = useState(editingEvent?.end_time?.slice(0, 5) ?? '17:30')
  const [location, setLocation] = useState(editingEvent?.location ?? '')
  const [opponent, setOpponent] = useState(editingEvent?.opponent ?? '')
  const [description, setDescription] = useState(editingEvent?.description ?? '')
  const [rsvpEnabled, setRsvpEnabled] = useState(editingEvent?.rsvp_enabled ?? true)
  const [channel, setChannel] = useState('in_app')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showOpponent = eventType === 'game' || eventType === 'scrimmage'

  async function handleSave() {
    if (!title.trim() || !date || !teamId) return
    setSaving(true)
    setError(null)

    try {
      if (isEdit && editingEvent) {
        // PATCH existing event
        const res = await fetch(`/api/communication/events/${editingEvent.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            event_type: eventType,
            date,
            start_time: startTime || null,
            end_time: endTime || null,
            location: location.trim() || null,
            // TODO: Google Places autocomplete for location_address, location_lat, location_lng
            opponent: showOpponent ? opponent.trim() || null : null,
            description: description.trim() || null,
            rsvp_enabled: rsvpEnabled,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Failed to update')
          setSaving(false)
          return
        }
      } else {
        // POST new event
        const res = await fetch('/api/communication/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId,
            title: title.trim(),
            eventType,
            date,
            startTime: startTime || null,
            endTime: endTime || null,
            location: location.trim() || null,
            // TODO: Google Places autocomplete for locationAddress, locationLat, locationLng
            opponent: showOpponent ? opponent.trim() || null : null,
            description: description.trim() || null,
            notificationChannel: channel,
            rsvpEnabled: rsvpEnabled,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Failed to create')
          setSaving(false)
          return
        }
      }

      onSaved()
      onClose()
    } catch {
      setError('Failed to save. Check your connection.')
      setSaving(false)
    }
  }

  // TODO: Event attachments — team_events table doesn't support attachments yet

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] rounded-t-2xl pb-[env(safe-area-inset-bottom)] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[var(--bg-pill-inactive)]" />
        </div>
        <div className="px-5 pb-6">
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">{isEdit ? 'Edit Event' : 'New Event'}</h3>

          {/* Title */}
          <div className="mb-4">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="e.g., Practice, Scrimmage, Team BBQ" />
          </div>

          {/* Event Type */}
          <div className="mb-4">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Event Type</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {EVENT_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setEventType(t.value)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    eventType === t.value ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]' : 'bg-[var(--bg-card-alt)] text-[var(--text-secondary)] active:bg-[var(--bg-pill-inactive)]'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full mt-1 px-2 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Start</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full mt-1 px-2 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">End</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full mt-1 px-2 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          {/* Location */}
          <div className="mb-4">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Location</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Field name or address" />
          </div>

          {/* Opponent (game/scrimmage only) */}
          {showOpponent && (
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Opponent</label>
              <input type="text" value={opponent} onChange={e => setOpponent(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Opponent team name" />
            </div>
          )}

          {/* Details */}
          <div className="mb-4">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Details</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full mt-1 px-3 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              placeholder="Optional notes for parents" />
          </div>

          {/* RSVP toggle */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Enable RSVP</p>
              <p className="text-xs text-[var(--text-tertiary)]">Parents can respond Yes / No / Maybe</p>
            </div>
            <button type="button" onClick={() => setRsvpEnabled(!rsvpEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${rsvpEnabled ? 'bg-[#B8CA6E]' : 'bg-gray-300'}`}>
              <div className={`absolute top-[2px] w-[20px] h-[20px] rounded-full bg-[var(--bg-card)] shadow transition-transform ${rsvpEnabled ? 'left-[22px]' : 'left-[2px]'}`} />
            </button>
          </div>

          {/* Notification channel (new events only) */}
          {!isEdit && (
            <div className="mb-6">
              <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Notify Parents</label>
              <div className="flex gap-2 mt-1">
                {CHANNELS.map(ch => {
                  const disabled = ch.requiresPaid && !isPaid
                  return (
                    <button key={ch.value} type="button" onClick={() => !disabled && setChannel(ch.value)} disabled={disabled}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        channel === ch.value ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                          : disabled ? 'bg-[var(--bg-card-alt)] text-[var(--text-tertiary)]' : 'bg-[var(--bg-card-alt)] text-[var(--text-secondary)] active:bg-[var(--bg-pill-inactive)]'
                      }`}>
                      {ch.label}
                      {disabled && <span className="block text-[10px] text-[var(--text-tertiary)]">Upgrade</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          <button type="button" onClick={handleSave}
            disabled={saving || !title.trim() || !date}
            className="w-full bg-[#B8CA6E] text-[#1c1c1e] rounded-xl py-3 text-sm font-bold active:bg-[#a8b85e] transition-colors disabled:bg-[var(--bg-pill-inactive)] disabled:text-[var(--text-tertiary)]">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Event'}
          </button>
        </div>
      </div>
    </>
  )
}
