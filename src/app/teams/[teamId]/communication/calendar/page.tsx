'use client';

import { useState, useEffect, use } from 'react';
import { Calendar as CalendarIcon, Plus, Filter, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { EventCard } from '@/components/communication/calendar/EventCard';
import { EventForm } from '@/components/communication/calendar/EventForm';
import { RSVPAttendanceModal } from '@/components/communication/calendar/RSVPAttendanceModal';
import type { TeamEventExtended, EventType } from '@/types/communication';

interface EventWithRsvpSummary extends TeamEventExtended {
  rsvp_summary: {
    attending: number;
    not_attending: number;
    maybe: number;
    no_response: number;
  };
}

type FilterMode = 'upcoming' | 'past' | 'all';

export default function TeamCalendarPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);

  // State
  const [events, setEvents] = useState<EventWithRsvpSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('upcoming');
  const [eventTypeFilter, setEventTypeFilter] = useState<EventType | 'all'>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Load Google Places API
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey || document.getElementById('google-places-script')) return;

    const script = document.createElement('script');
    script.id = 'google-places-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Fetch events
  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        teamId,
        upcoming: filterMode === 'upcoming' ? 'true' : 'false',
      });

      if (eventTypeFilter !== 'all') {
        params.append('eventType', eventTypeFilter);
      }

      const response = await fetch(`/api/communication/events?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();

      const rawEvents: TeamEventExtended[] = data.events || [];

      // Fetch RSVP summaries for each event in parallel
      const eventsWithSummaries: EventWithRsvpSummary[] = await Promise.all(
        rawEvents.map(async (event) => {
          try {
            const rsvpResponse = await fetch(`/api/communication/events/${event.id}/rsvp`);
            if (rsvpResponse.ok) {
              const rsvpData = await rsvpResponse.json();
              return {
                ...event,
                rsvp_summary: {
                  attending: rsvpData.summary?.attending || 0,
                  not_attending: rsvpData.summary?.not_attending || 0,
                  maybe: rsvpData.summary?.maybe || 0,
                  no_response: rsvpData.summary?.no_response || 0,
                },
              };
            }
          } catch {
            // Silently fail for individual RSVP fetches
          }
          return {
            ...event,
            rsvp_summary: { attending: 0, not_attending: 0, maybe: 0, no_response: 0 },
          };
        })
      );

      setEvents(eventsWithSummaries);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [teamId, filterMode, eventTypeFilter]);

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const dateKey = formatDateGroup(event.date);
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, EventWithRsvpSummary[]>);

  const handleFormSuccess = () => {
    setShowForm(false);
    fetchEvents();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/teams/${teamId}/communication`}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
              <p className="text-gray-600 mt-1">Manage team events and schedule</p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            New Event
          </button>
        </div>

        {/* Event Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Event</h2>
            <EventForm
              teamId={teamId}
              onSuccess={handleFormSuccess}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Time filter */}
            <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              {(['upcoming', 'past', 'all'] as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={`
                    px-4 py-2 rounded-md font-medium text-sm transition-all duration-200
                    ${
                      filterMode === mode
                        ? 'bg-black text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                    }
                  `}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            {/* Event type filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value as EventType | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              >
                <option value="all">All Types</option>
                <option value="practice">Practice</option>
                <option value="game">Game</option>
                <option value="meeting">Meeting</option>
                <option value="scrimmage">Scrimmage</option>
                <option value="team_bonding">Team Bonding</option>
                <option value="film_session">Film Session</option>
                <option value="parent_meeting">Parent Meeting</option>
                <option value="fundraiser">Fundraiser</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Events List */}
        {Object.keys(groupedEvents).length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No {filterMode} events</h3>
            <p className="text-gray-600 mb-6">
              {filterMode === 'upcoming'
                ? 'Create your first event to get started.'
                : 'No events found for this filter.'}
            </p>
            {filterMode === 'upcoming' && !showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Create First Event
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedEvents).map(([dateGroup, groupEvents]) => (
              <div key={dateGroup}>
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                  {dateGroup}
                </h2>
                <div className="space-y-4">
                  {groupEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      showRsvpSummary={true}
                      rsvpSummary={event.rsvp_summary}
                      onViewDetails={(id) => setSelectedEventId(id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RSVP Attendance Modal */}
      <RSVPAttendanceModal
        eventId={selectedEventId || ''}
        eventTitle={events.find(e => e.id === selectedEventId)?.title || ''}
        isOpen={!!selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </div>
  );
}

// Helper: Format date group header
function formatDateGroup(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Reset time for comparison
  const resetTime = (d: Date) => {
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const eventDate = resetTime(new Date(date));
  const todayReset = resetTime(new Date(today));
  const tomorrowReset = resetTime(new Date(tomorrow));

  if (eventDate.getTime() === todayReset.getTime()) {
    return 'Today';
  } else if (eventDate.getTime() === tomorrowReset.getTime()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
}
