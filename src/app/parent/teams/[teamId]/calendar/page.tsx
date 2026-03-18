'use client';

import { useState, useEffect, use } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { EventCard } from '@/components/communication/calendar/EventCard';
import type { EventWithRSVP } from '@/types/communication';

export default function ParentCalendarPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);

  // State
  const [upcomingEvents, setUpcomingEvents] = useState<EventWithRSVP[]>([]);
  const [pastEvents, setPastEvents] = useState<EventWithRSVP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Fetch upcoming events
  const fetchUpcomingEvents = async () => {
    try {
      const params = new URLSearchParams({
        teamId,
        upcoming: 'true',
      });

      const response = await fetch(`/api/communication/events?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      setUpcomingEvents(data.events || []);
    } catch (err) {
      console.error('Error fetching upcoming events:', err);
      throw err;
    }
  };

  // Fetch past events
  const fetchPastEvents = async () => {
    try {
      const params = new URLSearchParams({
        teamId,
        upcoming: 'false',
        limit: '20', // Limit past events to last 20
      });

      const response = await fetch(`/api/communication/events?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch past events');
      }

      const data = await response.json();
      setPastEvents(data.events || []);
    } catch (err) {
      console.error('Error fetching past events:', err);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        await fetchUpcomingEvents();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [teamId]);

  // Load past events when section is expanded
  useEffect(() => {
    if (showPastEvents && pastEvents.length === 0) {
      fetchPastEvents();
    }
  }, [showPastEvents]);

  // Group events by date
  const groupEventsByDate = (events: EventWithRSVP[]) => {
    return events.reduce((acc, event) => {
      const dateKey = formatDateGroup(event.date);
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(event);
      return acc;
    }, {} as Record<string, EventWithRSVP[]>);
  };

  const groupedUpcoming = groupEventsByDate(upcomingEvents);
  const groupedPast = groupEventsByDate(pastEvents);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/parent"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
            <p className="text-gray-600 text-sm mt-0.5">Team events and activities</p>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Upcoming Events */}
        {Object.keys(groupedUpcoming).length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No upcoming events</h3>
            <p className="text-gray-600 text-sm">
              Check back later for new events from your coach.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedUpcoming).map(([dateGroup, events]) => (
              <div key={dateGroup}>
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 px-1">
                  {dateGroup}
                </h2>
                <div className="space-y-3">
                  {events.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      showRsvpSummary={false}
                      expandable={true}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Past Events Section */}
        {(pastEvents.length > 0 || showPastEvents) && (
          <div className="mt-8">
            <button
              onClick={() => setShowPastEvents(!showPastEvents)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">
                Past Events {pastEvents.length > 0 && `(${pastEvents.length})`}
              </span>
              {showPastEvents ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {showPastEvents && (
              <div className="mt-4 space-y-6">
                {Object.keys(groupedPast).length === 0 ? (
                  <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-sm">No past events</p>
                  </div>
                ) : (
                  Object.entries(groupedPast).map(([dateGroup, events]) => (
                    <div key={dateGroup}>
                      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 px-1">
                        {dateGroup}
                      </h3>
                      <div className="space-y-3 opacity-75">
                        {events.map((event) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            showRsvpSummary={false}
                            expandable={true}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty State - No events at all */}
        {upcomingEvents.length === 0 && pastEvents.length === 0 && !showPastEvents && (
          <div className="mt-6 text-center py-8 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 text-sm">
              Your coach hasn't added any events yet.
            </p>
          </div>
        )}
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
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }
}
