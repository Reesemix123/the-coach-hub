'use client';

import { useState, useEffect } from 'react';
import { X, Check, Users, AlertCircle, HelpCircle, Loader2 } from 'lucide-react';

interface ChildException {
  player_id: string;
  status: 'attending' | 'not_attending' | 'maybe';
  note?: string;
}

interface CurrentRSVP {
  family_status: 'attending' | 'not_attending' | 'maybe';
  child_exceptions: Array<{
    player_id: string;
    status: string;
    note?: string;
  }>;
  note: string | null;
}

interface Child {
  player_id: string;
  first_name: string;
  last_name: string;
  jersey_number: string | null;
}

interface FamilyRSVPModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  teamId: string;
  currentRSVP?: CurrentRSVP | null;
  onSubmitted?: (familyStatus: string) => void;
}

type FamilyStatus = 'attending' | 'not_attending' | 'maybe' | null;

export function FamilyRSVPModal({
  isOpen,
  onClose,
  eventId,
  teamId,
  currentRSVP,
  onSubmitted,
}: FamilyRSVPModalProps) {
  const [familyStatus, setFamilyStatus] = useState<FamilyStatus>(
    currentRSVP?.family_status || null
  );
  const [childExceptions, setChildExceptions] = useState<Map<string, ChildException>>(
    new Map()
  );
  const [note, setNote] = useState<string>(currentRSVP?.note || '');
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch children on mount
  useEffect(() => {
    if (!isOpen) return;

    const fetchChildren = async () => {
      setIsLoadingChildren(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/communication/events/${eventId}/rsvp?teamId=${teamId}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to load RSVP data');
        }

        const data = await response.json();
        setChildren(data.children || []);

        // Initialize exceptions from current RSVP
        if (currentRSVP?.child_exceptions) {
          const exceptionsMap = new Map<string, ChildException>();
          currentRSVP.child_exceptions.forEach((exc) => {
            exceptionsMap.set(exc.player_id, {
              player_id: exc.player_id,
              status: exc.status as 'attending' | 'not_attending' | 'maybe',
              note: exc.note,
            });
          });
          setChildExceptions(exceptionsMap);
        }
      } catch (err) {
        console.error('Failed to fetch children:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoadingChildren(false);
      }
    };

    fetchChildren();
  }, [isOpen, eventId, teamId, currentRSVP]);

  const handleStatusSelect = (status: FamilyStatus) => {
    setFamilyStatus(status);
    setError(null);
  };

  const cycleChildStatus = (playerId: string) => {
    if (!familyStatus) return;

    const currentException = childExceptions.get(playerId);
    const currentStatus = currentException?.status;

    const statusCycle: Array<FamilyStatus> = ['attending', 'maybe', 'not_attending', null];
    const currentIndex = currentStatus ? statusCycle.indexOf(currentStatus) : -1;
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];

    if (nextStatus === null) {
      // Remove exception (follows family status)
      const newExceptions = new Map(childExceptions);
      newExceptions.delete(playerId);
      setChildExceptions(newExceptions);
    } else {
      // Set or update exception
      const newExceptions = new Map(childExceptions);
      newExceptions.set(playerId, {
        player_id: playerId,
        status: nextStatus,
        note: currentException?.note || '',
      });
      setChildExceptions(newExceptions);
    }
  };

  const updateChildNote = (playerId: string, childNote: string) => {
    const exception = childExceptions.get(playerId);
    if (!exception) return;

    const newExceptions = new Map(childExceptions);
    newExceptions.set(playerId, {
      ...exception,
      note: childNote,
    });
    setChildExceptions(newExceptions);
  };

  const handleSubmit = async () => {
    if (!familyStatus) {
      setError('Please select your attendance status');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/communication/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          familyStatus,
          childExceptions: Array.from(childExceptions.values()),
          note: note.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit RSVP');
      }

      onSubmitted?.(familyStatus);
      onClose();
    } catch (err) {
      console.error('Failed to submit RSVP:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit RSVP');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
          <h2 className="text-xl font-semibold text-gray-900">RSVP</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-8">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Loading state */}
          {isLoadingChildren ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          ) : (
            <>
              {/* Family Status Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Will your family attend?
                </label>
                <div className="space-y-3">
                  {/* Attending */}
                  <button
                    onClick={() => handleStatusSelect('attending')}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      familyStatus === 'attending'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        familyStatus === 'attending'
                          ? 'bg-green-500'
                          : 'bg-gray-100'
                      }`}
                    >
                      <Check
                        className={`w-6 h-6 ${
                          familyStatus === 'attending' ? 'text-white' : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <p
                        className={`font-semibold ${
                          familyStatus === 'attending' ? 'text-green-900' : 'text-gray-900'
                        }`}
                      >
                        Attending
                      </p>
                      <p className="text-sm text-gray-600">All attending</p>
                    </div>
                  </button>

                  {/* Maybe */}
                  <button
                    onClick={() => handleStatusSelect('maybe')}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      familyStatus === 'maybe'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        familyStatus === 'maybe' ? 'bg-amber-500' : 'bg-gray-100'
                      }`}
                    >
                      <HelpCircle
                        className={`w-6 h-6 ${
                          familyStatus === 'maybe' ? 'text-white' : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <p
                        className={`font-semibold ${
                          familyStatus === 'maybe' ? 'text-amber-900' : 'text-gray-900'
                        }`}
                      >
                        Maybe
                      </p>
                      <p className="text-sm text-gray-600">Might attend</p>
                    </div>
                  </button>

                  {/* Not Attending */}
                  <button
                    onClick={() => handleStatusSelect('not_attending')}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      familyStatus === 'not_attending'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        familyStatus === 'not_attending' ? 'bg-red-500' : 'bg-gray-100'
                      }`}
                    >
                      <X
                        className={`w-6 h-6 ${
                          familyStatus === 'not_attending' ? 'text-white' : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <p
                        className={`font-semibold ${
                          familyStatus === 'not_attending' ? 'text-red-900' : 'text-gray-900'
                        }`}
                      >
                        Not Attending
                      </p>
                      <p className="text-sm text-gray-600">Can&apos;t make it</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Per-Child Exceptions (only if family status selected and multiple children) */}
              {familyStatus && children.length > 1 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-5 h-5 text-gray-500" />
                    <label className="text-sm font-medium text-gray-700">
                      Per-Child Exceptions
                    </label>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-gray-600 mb-3">
                      Tap to override family status for individual players
                    </p>
                    {children.map((child) => {
                      const exception = childExceptions.get(child.player_id);
                      const effectiveStatus = exception?.status || familyStatus;
                      const hasException = !!exception;

                      const statusDisplay = {
                        attending: { label: 'Attending', color: 'text-green-700' },
                        maybe: { label: 'Maybe', color: 'text-amber-700' },
                        not_attending: { label: 'Not Attending', color: 'text-red-700' },
                      };

                      const display = statusDisplay[effectiveStatus];

                      return (
                        <div key={child.player_id} className="space-y-2">
                          <button
                            onClick={() => cycleChildStatus(child.player_id)}
                            className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-700">
                                {child.jersey_number || '?'}
                              </div>
                              <span className="font-medium text-gray-900">
                                {child.first_name}
                              </span>
                            </div>
                            <span
                              className={`text-sm font-medium ${
                                hasException ? display.color : 'text-gray-500'
                              }`}
                            >
                              {hasException ? display.label : 'Same as family'}
                            </span>
                          </button>

                          {/* Exception note */}
                          {hasException && (
                            <textarea
                              value={exception.note || ''}
                              onChange={(e) =>
                                updateChildNote(child.player_id, e.target.value)
                              }
                              placeholder={`Note for ${child.first_name} (optional)`}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state for no children */}
              {children.length === 0 && !isLoadingChildren && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700">
                    No players linked to your profile for this team.
                  </p>
                </div>
              )}

              {/* Optional note */}
              <div>
                <label
                  htmlFor="rsvp-note"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Add a note (optional)
                </label>
                <textarea
                  id="rsvp-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything the coach should know..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 space-y-3 rounded-b-3xl sm:rounded-b-2xl">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !familyStatus || isLoadingChildren}
            className="w-full bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg py-3 font-medium text-base transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit RSVP'
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full text-gray-600 hover:text-gray-900 py-2 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
