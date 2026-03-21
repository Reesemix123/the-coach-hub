'use client';

import React, { memo } from 'react';
import { Calendar, MapPin, Clock, Users, ChevronRight, Check, X, HelpCircle } from 'lucide-react';
import { RSVPButton } from './RSVPButton';

interface EventCardProps {
  event: {
    id: string;
    event_type: string;
    title: string;
    description: string | null;
    date: string;
    start_time: string | null;
    end_time: string | null;
    location: string | null;
    location_address: string | null;
    location_lat: number | null;
    location_lng: number | null;
    opponent: string | null;
    start_datetime: string | null;
    notification_channel: string;
  };
  rsvpStatus?: 'attending' | 'not_attending' | 'maybe' | null;
  rsvpSummary?: {
    attending: number;
    not_attending: number;
    maybe: number;
    no_response: number;
  };
  showRsvpSummary?: boolean;
  teamId?: string;
  onRsvpChange?: (eventId: string, newStatus: string) => void;
  onViewDetails?: (eventId: string) => void;
  onOpenMap?: (lat: number, lng: number, name: string) => void;
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  practice: { label: 'Practice', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  game: { label: 'Game', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
  scrimmage: { label: 'Scrimmage', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  meeting: { label: 'Meeting', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  film_session: { label: 'Film Session', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200' },
  team_bonding: { label: 'Team Bonding', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  parent_meeting: { label: 'Parent Meeting', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  fundraiser: { label: 'Fundraiser', color: 'text-pink-700', bgColor: 'bg-pink-50 border-pink-200' },
  other: { label: 'Other', color: 'text-gray-700', bgColor: 'bg-gray-50 border-gray-200' },
};

const ACCENT_COLORS: Record<string, string> = {
  practice: 'border-l-blue-500',
  game: 'border-l-red-500',
  scrimmage: 'border-l-orange-500',
  meeting: 'border-l-purple-500',
  film_session: 'border-l-indigo-500',
  team_bonding: 'border-l-green-500',
  parent_meeting: 'border-l-amber-500',
  fundraiser: 'border-l-pink-500',
  other: 'border-l-gray-500',
};

export const EventCard = memo(function EventCard({
  event,
  rsvpStatus,
  rsvpSummary,
  showRsvpSummary = false,
  teamId,
  onRsvpChange,
  onViewDetails,
  onOpenMap,
}: EventCardProps) {
  const typeConfig = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.other;
  const accentColor = ACCENT_COLORS[event.event_type] || ACCENT_COLORS.other;

  // Format date and time
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const formatTime = (timeString: string | null): string => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  // Check if event is in the past
  const isPast = event.start_datetime ? new Date(event.start_datetime) < new Date() : false;

  // Generate Google Maps URL
  const generateMapsUrl = (lat: number, lng: number): string => {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  };

  const dateDisplay = formatDate(event.date);
  const timeDisplay =
    event.start_time && event.end_time
      ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
      : event.start_time
      ? formatTime(event.start_time)
      : null;

  return (
    <div
      className={`
        bg-white border border-gray-200 rounded-xl border-l-4
        ${accentColor}
        ${isPast ? 'opacity-60' : ''}
        transition-shadow hover:shadow-md
      `}
    >
      <div className="p-5">
        {/* Event Type Badge */}
        <div className="mb-3">
          <span
            className={`
              inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border
              ${typeConfig.bgColor} ${typeConfig.color}
            `}
          >
            {typeConfig.label}
          </span>
        </div>

        {/* Title and Opponent */}
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {event.title}
          </h3>
          {event.opponent && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
              vs {event.opponent}
            </span>
          )}
        </div>

        {/* Date and Time */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
            <span className="font-medium">{dateDisplay}</span>
          </div>
          {timeDisplay && (
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="w-4 h-4 mr-2 text-gray-400" />
              <span>{timeDisplay}</span>
            </div>
          )}
        </div>

        {/* Location */}
        {event.location && (
          <div className="mb-3">
            {event.location_lat && event.location_lng ? (
              <a
                href={generateMapsUrl(event.location_lat, event.location_lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start text-sm text-blue-600 hover:text-blue-700 transition-colors"
                onClick={(e) => {
                  if (onOpenMap) {
                    e.preventDefault();
                    onOpenMap(event.location_lat!, event.location_lng!, event.location!);
                  }
                }}
              >
                <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">{event.location}</div>
                  {event.location_address && (
                    <div className="text-gray-500 mt-0.5">{event.location_address}</div>
                  )}
                </div>
              </a>
            ) : (
              <div className="flex items-start text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
                <div>
                  <div className="font-medium">{event.location}</div>
                  {event.location_address && (
                    <div className="text-gray-500 mt-0.5">{event.location_address}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {event.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {event.description}
          </p>
        )}

        {/* RSVP (Parent View) */}
        {teamId && !showRsvpSummary && (
          <div className="mb-3">
            <RSVPButton
              eventId={event.id}
              teamId={teamId}
              currentStatus={rsvpStatus ?? null}
              onRSVPSubmitted={(newStatus) => onRsvpChange?.(event.id, newStatus)}
            />
          </div>
        )}

        {/* RSVP Status badge — shown only when no interactive button is available */}
        {rsvpStatus && !teamId && !showRsvpSummary && (
          <div className="flex items-center mb-3">
            {rsvpStatus === 'attending' && (
              <div className="flex items-center text-sm text-green-700 bg-green-50 px-2.5 py-1 rounded-md">
                <Check className="w-4 h-4 mr-1.5" />
                <span className="font-medium">You&apos;re attending</span>
              </div>
            )}
            {rsvpStatus === 'not_attending' && (
              <div className="flex items-center text-sm text-red-700 bg-red-50 px-2.5 py-1 rounded-md">
                <X className="w-4 h-4 mr-1.5" />
                <span className="font-medium">You&apos;re not attending</span>
              </div>
            )}
            {rsvpStatus === 'maybe' && (
              <div className="flex items-center text-sm text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
                <HelpCircle className="w-4 h-4 mr-1.5" />
                <span className="font-medium">Maybe</span>
              </div>
            )}
          </div>
        )}

        {/* RSVP Summary (Coach View) */}
        {showRsvpSummary && rsvpSummary && (
          <div className="flex items-center text-sm text-gray-600 mb-3">
            <Users className="w-4 h-4 mr-2 text-gray-400" />
            <span>
              <span className="font-medium text-green-700">{rsvpSummary.attending} attending</span>
              {' · '}
              <span className="font-medium text-red-700">{rsvpSummary.not_attending} not attending</span>
              {' · '}
              <span className="font-medium text-amber-700">{rsvpSummary.maybe} maybe</span>
            </span>
          </div>
        )}

        {/* View Details Button */}
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(event.id)}
            className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            View Details
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        )}
      </div>
    </div>
  );
});
