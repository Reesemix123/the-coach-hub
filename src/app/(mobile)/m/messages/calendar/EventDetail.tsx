'use client'

import { useState, useEffect } from 'react'
import { getWeather, type WeatherData } from './weather-service'
import type { TeamEvent } from './CalendarList'

interface RsvpSummary {
  attending: { parent_name: string }[]
  not_attending: { parent_name: string }[]
  maybe: { parent_name: string }[]
  no_response: { parent_name: string }[]
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatTime(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  const d = new Date()
  d.setHours(Number(h), Number(m))
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const TYPE_LABELS: Record<string, string> = {
  practice: 'Practice', game: 'Game', scrimmage: 'Scrimmage', meeting: 'Meeting',
  team_bonding: 'Team Bonding', film_session: 'Film Session', parent_meeting: 'Parent Meeting',
  fundraiser: 'Fundraiser', other: 'Other',
}

interface EventDetailProps {
  event: TeamEvent
  onBack: () => void
  onEdit: () => void
  onDeleted: () => void
}

export default function EventDetail({ event, onBack, onEdit, onDeleted }: EventDetailProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [rsvpData, setRsvpData] = useState<RsvpSummary | null>(null)
  const [rsvpLoading, setRsvpLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Fetch weather
  useEffect(() => {
    if (event.location_lat && event.location_lng) {
      getWeather(event.location_lat, event.location_lng, event.date).then(setWeather)
    }
  }, [event])

  // Fetch RSVP data
  useEffect(() => {
    if (!event.rsvp_enabled) { setRsvpLoading(false); return }
    fetch(`/api/communication/events/${event.id}/rsvp`)
      .then(res => res.json())
      .then(data => {
        // The API returns different shapes for coach vs parent. Handle coach shape.
        if (data.rsvps || data.summary) {
          setRsvpData({
            attending: data.summary?.attending ?? data.rsvps?.filter((r: { family_status: string }) => r.family_status === 'attending')?.map((r: { parent_name: string }) => ({ parent_name: r.parent_name })) ?? [],
            not_attending: data.summary?.not_attending ?? data.rsvps?.filter((r: { family_status: string }) => r.family_status === 'not_attending')?.map((r: { parent_name: string }) => ({ parent_name: r.parent_name })) ?? [],
            maybe: data.summary?.maybe ?? data.rsvps?.filter((r: { family_status: string }) => r.family_status === 'maybe')?.map((r: { parent_name: string }) => ({ parent_name: r.parent_name })) ?? [],
            no_response: data.summary?.no_response ?? [],
          })
        }
        setRsvpLoading(false)
      })
      .catch(() => setRsvpLoading(false))
  }, [event])

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/communication/events/${event.id}`, { method: 'DELETE' })
      if (res.ok) {
        onDeleted()
      }
    } catch {}
    setDeleting(false)
  }

  const timeStr = event.start_time ? formatTime(event.start_time) + (event.end_time ? ` – ${formatTime(event.end_time)}` : '') : ''

  return (
    <div className="pb-8">
      {/* Back + Actions */}
      <div className="px-4 pt-3 mb-2 flex items-center justify-between">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Calendar
        </button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onEdit} className="text-sm text-[var(--text-secondary)] font-medium active:text-[var(--text-primary)]">Edit</button>
          <button type="button" onClick={() => setShowDeleteConfirm(true)} className="text-sm text-red-500 font-medium active:text-red-700">Delete</button>
        </div>
      </div>

      {/* Event info card */}
      <div className="px-4">
        <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold bg-[var(--bg-card-alt)] text-[var(--text-secondary)] rounded-full px-2.5 py-0.5">
              {TYPE_LABELS[event.event_type] ?? event.event_type}
            </span>
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{event.title}</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{formatFullDate(event.date)}</p>
          {timeStr && <p className="text-sm text-[var(--text-secondary)]">{timeStr}</p>}
          {event.location && <p className="text-sm text-[var(--text-secondary)] mt-1">📍 {event.location}</p>}
          {event.description && <p className="text-sm text-[var(--text-secondary)] mt-3 whitespace-pre-wrap">{event.description}</p>}
        </div>
      </div>

      {/* Weather */}
      {weather && (
        <div className="px-4 mt-3">
          <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-sm flex items-center gap-4">
            <span className="text-3xl">{weather.icon}</span>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{weather.condition}</p>
              <p className="text-xs text-[var(--text-secondary)]">High {weather.tempHigh}° · Low {weather.tempLow}°</p>
            </div>
          </div>
        </div>
      )}

      {/* RSVP */}
      {event.rsvp_enabled && (
        <div className="px-4 mt-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">RSVPs</p>
          {rsvpLoading ? (
            <div className="bg-[var(--bg-card)] rounded-xl p-4 animate-pulse shadow-sm">
              <div className="h-4 bg-[var(--bg-card-alt)] rounded w-32 mb-2" />
              <div className="h-3 bg-[var(--bg-card-alt)] rounded w-48" />
            </div>
          ) : rsvpData ? (
            <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
              {[
                { label: 'Going', items: rsvpData.attending, color: 'text-green-600' },
                { label: 'Not Going', items: rsvpData.not_attending, color: 'text-red-500' },
                { label: 'Maybe', items: rsvpData.maybe, color: 'text-amber-600' },
                { label: 'No Response', items: rsvpData.no_response, color: 'text-[var(--text-tertiary)]' },
              ].filter(g => g.items.length > 0).map(group => (
                <div key={group.label} className="px-4 py-2.5">
                  <p className={`text-xs font-semibold ${group.color} mb-1`}>{group.label} ({group.items.length})</p>
                  {group.items.map((p, i) => (
                    <p key={i} className="text-sm text-[var(--text-primary)] py-0.5">{p.parent_name}</p>
                  ))}
                </div>
              ))}
              {rsvpData.attending.length === 0 && rsvpData.not_attending.length === 0 && rsvpData.maybe.length === 0 && (
                <div className="px-4 py-3">
                  <p className="text-xs text-[var(--text-tertiary)]">No responses yet</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-sm">
              <p className="text-xs text-[var(--text-tertiary)]">Unable to load RSVPs</p>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-[var(--bg-pill-inactive)]" /></div>
            <div className="px-5 pb-6 text-center">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Delete Event?</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">This cannot be undone.</p>
              <div className="flex gap-3 mt-5">
                <button type="button" onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-[var(--bg-card-alt)] text-[var(--text-primary)] rounded-xl py-3 text-sm font-semibold">Cancel</button>
                <button type="button" onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-semibold">
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
