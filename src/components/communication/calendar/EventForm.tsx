'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, MapPin, Clock, Bell, Users, AlertCircle } from 'lucide-react';
import { NotificationChannelPicker } from '@/components/communication/shared/NotificationChannelPicker';

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            options?: google.maps.places.AutocompleteOptions
          ) => google.maps.places.Autocomplete;
        };
        event: {
          clearInstanceListeners: (instance: unknown) => void;
        };
      };
    };
  }
}

interface EventFormProps {
  teamId: string;
  initialData?: Partial<{
    id: string;
    event_type: string;
    title: string;
    description: string;
    date: string;
    start_time: string;
    end_time: string;
    location: string;
    location_address: string;
    location_lat: number;
    location_lng: number;
    location_notes: string;
    opponent: string;
    notification_channel: string;
  }>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const EVENT_TYPES = [
  { value: 'practice', label: 'Practice' },
  { value: 'game', label: 'Game' },
  { value: 'scrimmage', label: 'Scrimmage' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'film_session', label: 'Film Session' },
  { value: 'team_bonding', label: 'Team Bonding' },
  { value: 'parent_meeting', label: 'Parent Meeting' },
  { value: 'fundraiser', label: 'Fundraiser' },
  { value: 'other', label: 'Other' },
];

const TITLE_PLACEHOLDERS: Record<string, string> = {
  practice: 'Practice',
  game: 'Game',
  scrimmage: 'Scrimmage',
  meeting: 'Team Meeting',
  film_session: 'Film Review',
  team_bonding: 'Team Event',
  parent_meeting: 'Parent Meeting',
  fundraiser: 'Fundraiser Event',
  other: 'Event',
};

export function EventForm({ teamId, initialData, onSuccess, onCancel }: EventFormProps) {
  // Form state
  const [eventType, setEventType] = useState(initialData?.event_type || 'practice');
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [date, setDate] = useState(initialData?.date || '');
  const [startTime, setStartTime] = useState(initialData?.start_time || '');
  const [endTime, setEndTime] = useState(initialData?.end_time || '');
  const [location, setLocation] = useState(initialData?.location || '');
  const [locationAddress, setLocationAddress] = useState(initialData?.location_address || '');
  const [locationLat, setLocationLat] = useState<number | null>(initialData?.location_lat ?? null);
  const [locationLng, setLocationLng] = useState<number | null>(initialData?.location_lng ?? null);
  const [locationNotes, setLocationNotes] = useState(initialData?.location_notes || '');
  const [opponent, setOpponent] = useState(initialData?.opponent || '');
  const [notificationChannel, setNotificationChannel] = useState<'sms' | 'email' | 'both'>(
    (initialData?.notification_channel as 'sms' | 'email' | 'both') || 'both'
  );

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  // Google Places Autocomplete integration
  useEffect(() => {
    if (!locationInputRef.current || !window.google?.maps?.places) return;

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(
        locationInputRef.current,
        { types: ['establishment', 'geocode'] }
      );

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry?.location) {
          setLocation(place.name || '');
          setLocationAddress(place.formatted_address || '');
          setLocationLat(place.geometry.location.lat());
          setLocationLng(place.geometry.location.lng());
        }
      });

      return () => {
        if (window.google?.maps?.event) {
          window.google.maps.event.clearInstanceListeners(autocomplete);
        }
      };
    } catch (err) {
      console.warn('Google Places Autocomplete failed to initialize:', err);
    }
  }, []);

  // Form validation
  const isValid = (): boolean => {
    if (!eventType || !title.trim() || !date) {
      return false;
    }
    return true;
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValid()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        teamId,
        eventType,
        title: title.trim(),
        description: description.trim() || null,
        date,
        startTime: startTime || null,
        endTime: endTime || null,
        location: location.trim() || null,
        locationAddress: locationAddress.trim() || null,
        locationLat: locationLat,
        locationLng: locationLng,
        locationNotes: locationNotes.trim() || null,
        opponent: (eventType === 'game' || eventType === 'scrimmage') ? opponent.trim() || null : null,
        notificationChannel,
      };

      const endpoint = initialData?.id
        ? `/api/communication/events/${initialData.id}`
        : '/api/communication/events';
      const method = initialData?.id ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save event');
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const titlePlaceholder = TITLE_PLACEHOLDERS[eventType] || 'Event Title';
  const showOpponentField = eventType === 'game' || eventType === 'scrimmage';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Event Type */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Event Type <span className="text-red-500">*</span>
        </label>
        <div className="inline-flex flex-wrap gap-2 p-1 bg-gray-100 rounded-lg">
          {EVENT_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setEventType(type.value)}
              className={`
                px-4 py-2 rounded-md font-medium text-sm transition-all duration-200
                ${
                  eventType === type.value
                    ? 'bg-black text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                }
              `}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Event Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={titlePlaceholder}
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
        />
      </div>

      {/* Date and Time */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label htmlFor="date" className="block text-sm font-medium text-gray-700">
            Date <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
            Start Time
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="time"
              id="start_time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="end_time" className="block text-sm font-medium text-gray-700">
            End Time
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="time"
              id="end_time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Location Section */}
      <div className="space-y-4 p-5 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-600" />
          Location
        </h4>

        <div className="space-y-2">
          <label htmlFor="location" className="block text-sm font-medium text-gray-700">
            Location Name
          </label>
          <input
            ref={locationInputRef}
            type="text"
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Search for a place..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
          />
          {!window.google?.maps?.places && (
            <p className="text-xs text-gray-500">
              Google Places autocomplete unavailable. Enter location manually.
            </p>
          )}
        </div>

        {locationAddress && (
          <div className="p-3 bg-white border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600">{locationAddress}</p>
            {locationLat && locationLng && (
              <p className="text-xs text-gray-500 mt-1">
                Coordinates: {locationLat.toFixed(6)}, {locationLng.toFixed(6)}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="location_notes" className="block text-sm font-medium text-gray-700">
            Location Notes
          </label>
          <input
            type="text"
            id="location_notes"
            value={locationNotes}
            onChange={(e) => setLocationNotes(e.target.value)}
            placeholder="Parking, entrance info, etc."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
          />
        </div>
      </div>

      {/* Opponent (Game/Scrimmage only) */}
      {showOpponentField && (
        <div className="space-y-2">
          <label htmlFor="opponent" className="block text-sm font-medium text-gray-700">
            Opponent
          </label>
          <input
            type="text"
            id="opponent"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="Opponent name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
          />
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional details about the event..."
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors resize-none"
        />
      </div>

      {/* Notification Channel */}
      <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-gray-600" />
          <h4 className="text-sm font-semibold text-gray-900">Notifications</h4>
        </div>
        <NotificationChannelPicker
          value={notificationChannel}
          onChange={setNotificationChannel}
          showLabel={false}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : initialData?.id ? 'Update Event' : 'Create Event'}
        </button>
      </div>
    </form>
  );
}
