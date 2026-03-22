'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Cookie } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TreatSignupItem {
  id: string;
  parent_id: string;
  parent_name: string;
  description: string | null;
  signed_up_at: string;
}

interface TreatsData {
  treats_enabled: boolean;
  max_slots: number;
  signups: TreatSignupItem[];
}

interface TreatSignupProps {
  teamId: string;
  gameId?: string;
  eventId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays treat signup status for a game or event and lets parents sign up
 * or cancel. Renders nothing when treats are disabled for the team.
 *
 * Self-resolves the current parent's profile ID so callers do not need to
 * thread identity props through EventCard.
 */
export function TreatSignup({ teamId, gameId, eventId }: TreatSignupProps) {
  const [data, setData] = useState<TreatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The parent_id of the authenticated user — resolved once on mount
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);

  // Inline form state
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Resolve parent identity and treat data in parallel
      const params = new URLSearchParams({ teamId });
      if (gameId) params.set('gameId', gameId);
      else if (eventId) params.set('eventId', eventId);

      const [profileResponse, treatsResponse] = await Promise.all([
        fetch('/api/communication/parents/profile'),
        fetch(`/api/communication/treats?${params.toString()}`),
      ]);

      // Parent profile — not a fatal error if it fails (user may be a coach
      // viewing a read-only snapshot; they simply won't see action buttons)
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        if (profile?.id) {
          setCurrentParentId(profile.id as string);
        }
      }

      if (!treatsResponse.ok) {
        const body = await treatsResponse.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Failed to load treat signups');
      }

      const json: TreatsData = await treatsResponse.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [teamId, gameId, eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Focus the description input when the form opens
  useEffect(() => {
    if (showForm) {
      descriptionInputRef.current?.focus();
    }
  }, [showForm]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const mySignup = data?.signups.find((s) => s.parent_id === currentParentId) ?? null;
  const slotsTotal = data?.max_slots ?? 0;
  const slotsFilled = data?.signups.length ?? 0;
  const slotsAvailable = slotsTotal - slotsFilled;
  const canSignUp = !mySignup && slotsAvailable > 0;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSignUp = async () => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload: Record<string, string> = { teamId };
      if (gameId) payload.gameId = gameId;
      else if (eventId) payload.eventId = eventId;
      if (description.trim()) payload.description = description.trim();

      const response = await fetch('/api/communication/treats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'Failed to sign up');
      }

      // Refresh data and close form
      await fetchData();
      setShowForm(false);
      setDescription('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!mySignup) return;

    setIsCancelling(true);
    setFormError(null);

    try {
      const response = await fetch(
        `/api/communication/treats?signupId=${encodeURIComponent(mySignup.id)}`,
        { method: 'DELETE' },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'Failed to cancel signup');
      }

      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setDescription('');
    setFormError(null);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Wait for data before deciding whether to show anything
  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <Cookie className="w-3.5 h-3.5 text-gray-300" />
          <span className="text-xs text-gray-400">Loading treats...</span>
        </div>
      </div>
    );
  }

  // Silent — treats disabled or error fetching settings
  if (error || !data || !data.treats_enabled) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Cookie className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-gray-700">Team Treats</span>
        </div>
        <span className="text-xs text-gray-400">
          {slotsFilled} of {slotsTotal} slot{slotsTotal !== 1 ? 's' : ''} filled
        </span>
      </div>

      {/* Signup list */}
      {data.signups.length > 0 ? (
        <ul className="space-y-1 mb-2">
          {data.signups.map((signup) => (
            <li key={signup.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-medium text-gray-800">{signup.parent_name}</span>
                {signup.description && (
                  <span className="text-xs text-gray-500 ml-1">— {signup.description}</span>
                )}
              </div>
              {/* Cancel link for the current parent's own signup */}
              {signup.parent_id === currentParentId && (
                <button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel'}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400 mb-2">No one has signed up yet.</p>
      )}

      {/* Inline sign-up form or trigger button */}
      {currentParentId && canSignUp && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="text-xs font-medium text-gray-700 border border-gray-300 rounded-md px-2.5 py-1 hover:bg-gray-50 transition-colors"
        >
          Sign up to bring treats
        </button>
      )}

      {currentParentId && canSignUp && showForm && (
        <div className="mt-1 space-y-2">
          <input
            ref={descriptionInputRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you bringing?"
            maxLength={120}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSignUp();
              if (e.key === 'Escape') handleFormCancel();
            }}
          />

          {formError && (
            <p className="text-xs text-red-600">{formError}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSignUp}
              disabled={isSubmitting}
              className="px-3 py-1 bg-black text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Submit'}
            </button>
            <button
              onClick={handleFormCancel}
              disabled={isSubmitting}
              className="px-3 py-1 border border-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error shown when not in the inline form (e.g., cancel failure) */}
      {formError && !showForm && (
        <p className="text-xs text-red-600 mt-1">{formError}</p>
      )}

      {/* Slots full — parent hasn't signed up */}
      {currentParentId && !mySignup && slotsAvailable === 0 && (
        <p className="text-xs text-gray-400">All slots are filled.</p>
      )}
    </div>
  );
}
