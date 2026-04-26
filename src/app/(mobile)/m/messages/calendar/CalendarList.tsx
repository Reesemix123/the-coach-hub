'use client'

import { useState, useEffect } from 'react'
import { useMobile } from '@/app/(mobile)/MobileContext'
import { getWeather, type WeatherData } from './weather-service'

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

function formatMonth(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
}

function formatDay(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').getDate().toString()
}

function formatDayOfWeek(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
}

function formatTime(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  const d = new Date()
  d.setHours(Number(h), Number(m))
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatMonthYear(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
}

function getEventTitle(event: TeamEvent): string {
  if ((event.event_type === 'game' || event.event_type === 'scrimmage') && event.opponent) {
    return `vs ${event.opponent}`
  }
  return event.event_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const TYPE_COLORS: Record<string, string> = {
  practice: 'bg-blue-500',
  game: 'bg-red-500',
  scrimmage: 'bg-orange-500',
  meeting: 'bg-purple-500',
  team_bonding: 'bg-pink-500',
  film_session: 'bg-indigo-500',
  parent_meeting: 'bg-teal-500',
  fundraiser: 'bg-amber-500',
  other: 'bg-gray-500',
}

function EventCard({ event, weather, onTap }: { event: TeamEvent; weather: WeatherData | null; onTap: () => void }) {
  const timeStr = event.start_time ? formatTime(event.start_time) + (event.end_time ? ` – ${formatTime(event.end_time)}` : '') : ''

  return (
    <button type="button" onClick={onTap} className="w-full flex items-center gap-4 px-4 py-3.5 bg-white active:bg-gray-50 transition-colors text-left">
      {/* Date column */}
      <div className="w-12 text-center shrink-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase">{formatMonth(event.date)}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{formatDay(event.date)}</p>
      </div>

      {/* Type dot */}
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${TYPE_COLORS[event.event_type] ?? 'bg-gray-400'}`} />

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{getEventTitle(event)}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {formatDayOfWeek(event.date)}{timeStr ? ` · ${timeStr}` : ''}
        </p>
        {event.location && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">@ {event.location}</p>
        )}
      </div>

      {/* Weather */}
      {weather && (
        <div className="text-center shrink-0 mr-1">
          <span className="text-lg">{weather.icon}</span>
          <p className="text-[10px] text-gray-500 font-medium">{weather.tempHigh}°</p>
        </div>
      )}

      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300 shrink-0">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}

interface CalendarListProps {
  onSelectEvent: (event: TeamEvent) => void
  onNewEvent: () => void
}

export type { TeamEvent }

export default function CalendarList({ onSelectEvent, onNewEvent }: CalendarListProps) {
  const { teamId } = useMobile()
  const [events, setEvents] = useState<TeamEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [weatherMap, setWeatherMap] = useState<Map<string, WeatherData>>(new Map())

  useEffect(() => {
    if (!teamId) return
    setLoading(true)
    fetch(`/api/communication/events?teamId=${teamId}`)
      .then(res => res.json())
      .then(data => {
        if (data.events) setEvents(data.events)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [teamId])

  // Fetch weather for events with coordinates within 7 days
  useEffect(() => {
    const fetchWeather = async () => {
      const newMap = new Map<string, WeatherData>()
      for (const event of events) {
        if (event.location_lat && event.location_lng) {
          const w = await getWeather(event.location_lat, event.location_lng, event.date)
          if (w) newMap.set(event.id, w)
        }
      }
      if (newMap.size > 0) setWeatherMap(newMap)
    }
    if (events.length > 0) fetchWeather()
  }, [events])

  // Group events by month
  const groupedByMonth = events.reduce((groups, event) => {
    const key = formatMonthYear(event.date)
    if (!groups[key]) groups[key] = []
    groups[key].push(event)
    return groups
  }, {} as Record<string, TeamEvent[]>)

  if (loading) {
    return (
      <div className="px-4 mt-3 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl px-4 py-4 animate-pulse">
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded" />
              <div className="flex-1">
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 gap-3">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <p className="text-sm font-medium text-gray-500 text-center">No events scheduled</p>
        <p className="text-xs text-gray-400 text-center">Add your first practice or game</p>
        <button type="button" onClick={onNewEvent} className="mt-2 bg-[#B8CA6E] text-[#1c1c1e] rounded-xl px-5 py-2.5 text-sm font-semibold active:bg-[#a8b85e]">
          New Event
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3 pb-20">
      {/* New Event button */}
      <div className="px-4 mb-3">
        <button type="button" onClick={onNewEvent} className="w-full bg-[#B8CA6E] text-[#1c1c1e] rounded-xl py-3 text-sm font-bold active:bg-[#a8b85e] transition-colors">
          + New Event
        </button>
      </div>

      {/* Event list grouped by month */}
      {Object.entries(groupedByMonth).map(([month, monthEvents]) => (
        <div key={month}>
          <div className="px-4 py-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{month}</p>
          </div>
          <div className="bg-white rounded-xl mx-4 overflow-hidden divide-y divide-gray-100 mb-3">
            {monthEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                weather={weatherMap.get(event.id) ?? null}
                onTap={() => onSelectEvent(event)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
