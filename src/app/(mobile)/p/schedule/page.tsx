'use client'

import { useState, useEffect } from 'react'
import { useParent } from '../ParentContext'
import { EmptyState } from '@/app/(mobile)/components/EmptyState'
import { getWeather, type WeatherData } from '@/app/(mobile)/m/messages/calendar/weather-service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamEvent {
  id: string
  team_id: string
  event_type: string
  title: string
  description: string | null
  date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  location_lat: number | null
  location_lng: number | null
  opponent: string | null
  rsvp_enabled: boolean
  created_at: string
}

type RsvpStatus = 'attending' | 'not_attending' | 'maybe'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtMonth(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase() }
function fmtDay(d: string) { return new Date(d + 'T00:00:00').getDate().toString() }
function fmtDow(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) }
function fmtMonthYear(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase() }
function fmtFullDate(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }
function fmtTime(t: string | null) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const d = new Date(); d.setHours(Number(h), Number(m))
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function eventTitle(e: TeamEvent) {
  if ((e.event_type === 'game' || e.event_type === 'scrimmage') && e.opponent) return `vs ${e.opponent}`
  return e.event_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const TYPE_COLORS: Record<string, string> = {
  practice: 'bg-blue-500', game: 'bg-red-500', scrimmage: 'bg-orange-500', meeting: 'bg-purple-500',
  team_bonding: 'bg-pink-500', film_session: 'bg-indigo-500', parent_meeting: 'bg-teal-500', fundraiser: 'bg-amber-500',
}

const TYPE_LABELS: Record<string, string> = {
  practice: 'Practice', game: 'Game', scrimmage: 'Scrimmage', meeting: 'Meeting',
  team_bonding: 'Team Bonding', film_session: 'Film Session', parent_meeting: 'Parent Meeting', fundraiser: 'Fundraiser',
}

// ---------------------------------------------------------------------------
// Event card (list item)
// ---------------------------------------------------------------------------

function EventCard({ event, weather, onTap }: { event: TeamEvent; weather: WeatherData | null; onTap: () => void }) {
  const time = event.start_time ? fmtTime(event.start_time) + (event.end_time ? ` – ${fmtTime(event.end_time)}` : '') : ''
  return (
    <button type="button" onClick={onTap} className="w-full flex items-center gap-4 px-4 py-3.5 bg-[var(--bg-card)] active:bg-[var(--bg-card-alt)] transition-colors text-left">
      <div className="w-12 text-center shrink-0">
        <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase">{fmtMonth(event.date)}</p>
        <p className="text-2xl font-bold text-[var(--text-primary)] leading-tight">{fmtDay(event.date)}</p>
      </div>
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${TYPE_COLORS[event.event_type] ?? 'bg-gray-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{eventTitle(event)}</p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{fmtDow(event.date)}{time ? ` · ${time}` : ''}</p>
        {event.location && <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">@ {event.location}</p>}
      </div>
      {weather && (
        <div className="text-center shrink-0 mr-1">
          <span className="text-lg">{weather.icon}</span>
          <p className="text-[10px] text-[var(--text-secondary)] font-medium">{weather.tempHigh}°</p>
        </div>
      )}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)] shrink-0"><path d="M9 18l6-6-6-6" /></svg>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Event detail (read-only + RSVP)
// ---------------------------------------------------------------------------

function EventDetailView({ event, onBack }: { event: TeamEvent; onBack: () => void }) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [rsvp, setRsvp] = useState<RsvpStatus | null>(null)
  const [rsvpSaving, setRsvpSaving] = useState(false)

  useEffect(() => {
    if (event.location_lat && event.location_lng) {
      getWeather(event.location_lat, event.location_lng, event.date).then(w => { if (w) setWeather(w) })
    }
  }, [event])

  // Fetch current RSVP
  useEffect(() => {
    if (!event.rsvp_enabled) return
    fetch(`/api/communication/events/${event.id}/rsvp`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.rsvp?.family_status) setRsvp(data.rsvp.family_status) })
      .catch(() => {})
  }, [event])

  async function handleRsvp(status: RsvpStatus) {
    setRsvpSaving(true)
    setRsvp(status)
    try {
      await fetch(`/api/communication/events/${event.id}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyStatus: status }),
      })
    } catch { /* optimistic update stays */ }
    setRsvpSaving(false)
  }

  const time = event.start_time ? fmtTime(event.start_time) + (event.end_time ? ` – ${fmtTime(event.end_time)}` : '') : ''

  return (
    <div className="pb-8">
      <div className="px-4 pt-3 mb-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Schedule
        </button>
      </div>

      <div className="px-4">
        <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-[var(--shadow)]">
          <span className="text-xs font-semibold bg-[var(--bg-card-alt)] text-[var(--text-secondary)] rounded-full px-2.5 py-0.5">
            {TYPE_LABELS[event.event_type] ?? event.event_type}
          </span>
          <h2 className="text-lg font-bold text-[var(--text-primary)] mt-2">{event.title || eventTitle(event)}</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{fmtFullDate(event.date)}</p>
          {time && <p className="text-sm text-[var(--text-secondary)]">{time}</p>}
          {event.location && <p className="text-sm text-[var(--text-secondary)] mt-1">📍 {event.location}</p>}
          {event.description && <p className="text-sm text-[var(--text-secondary)] mt-3 whitespace-pre-wrap">{event.description}</p>}
        </div>
      </div>

      {weather && (
        <div className="px-4 mt-3">
          <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-[var(--shadow)] flex items-center gap-4">
            <span className="text-3xl">{weather.icon}</span>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{weather.condition}</p>
              <p className="text-xs text-[var(--text-secondary)]">High {weather.tempHigh}° · Low {weather.tempLow}°</p>
            </div>
          </div>
        </div>
      )}

      {event.rsvp_enabled && (
        <div className="px-4 mt-4">
          <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">RSVP</p>
          <div className="flex bg-[var(--bg-pill-inactive)] rounded-lg p-0.5">
            {([['attending', 'Going'], ['maybe', 'Maybe'], ['not_attending', 'Not Going']] as [RsvpStatus, string][]).map(([status, label]) => (
              <button
                key={status}
                type="button"
                onClick={() => handleRsvp(status)}
                disabled={rsvpSaving}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-colors ${
                  rsvp === status
                    ? status === 'attending' ? 'bg-green-500 text-white shadow-sm'
                    : status === 'maybe' ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-red-500 text-white shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <div className="px-4 mt-3 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-[var(--bg-card)] rounded-xl px-4 py-4 animate-pulse">
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-[var(--bg-card-alt)] rounded" />
            <div className="flex-1">
              <div className="h-4 bg-[var(--bg-card-alt)] rounded w-2/3 mb-2" />
              <div className="h-3 bg-[var(--bg-card-alt)] rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ParentSchedulePage() {
  const { currentTeamId } = useParent()
  const [events, setEvents] = useState<TeamEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [weatherMap, setWeatherMap] = useState<Map<string, WeatherData>>(new Map())
  const [selectedEvent, setSelectedEvent] = useState<TeamEvent | null>(null)

  useEffect(() => {
    if (!currentTeamId) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/communication/events?teamId=${currentTeamId}`)
      .then(r => r.json())
      .then(data => { if (data.events) setEvents(data.events); setLoading(false) })
      .catch(() => setLoading(false))
  }, [currentTeamId])

  // Fetch weather for events with coordinates
  useEffect(() => {
    if (events.length === 0) return
    const load = async () => {
      const map = new Map<string, WeatherData>()
      for (const e of events) {
        if (e.location_lat && e.location_lng) {
          const w = await getWeather(e.location_lat, e.location_lng, e.date)
          if (w) map.set(e.id, w)
        }
      }
      if (map.size > 0) setWeatherMap(map)
    }
    load()
  }, [events])

  // Detail view
  if (selectedEvent) {
    return (
      <div className="min-h-full bg-[var(--bg-primary)]">
        <EventDetailView event={selectedEvent} onBack={() => setSelectedEvent(null)} />
      </div>
    )
  }

  // Group by month
  const grouped = events.reduce((acc, e) => {
    const key = fmtMonthYear(e.date)
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {} as Record<string, TeamEvent[]>)

  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-4">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Schedule</h1>
      </div>

      {loading ? (
        <Skeleton />
      ) : events.length === 0 ? (
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
          title="No upcoming events"
          description="Your coach hasn't added any events yet."
        />
      ) : (
        <div className="mt-1 pb-4">
          {Object.entries(grouped).map(([month, monthEvents]) => (
            <div key={month}>
              <div className="px-4 py-2">
                <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">{month}</p>
              </div>
              <div className="bg-[var(--bg-card)] rounded-xl mx-4 overflow-hidden divide-y divide-[var(--border-primary)] mb-3">
                {monthEvents.map(e => (
                  <EventCard key={e.id} event={e} weather={weatherMap.get(e.id) ?? null} onTap={() => setSelectedEvent(e)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
