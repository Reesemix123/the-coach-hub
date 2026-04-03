'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Loader2, Mail, MessageSquare, Check, Trash2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

type NotificationPreference = 'sms' | 'email' | 'both';

interface ParentProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  notification_preference: NotificationPreference;
  is_champion: boolean;
}

export default function ParentSettingsPage() {
  const [preference, setPreference] = useState<NotificationPreference>('email');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  // Privacy & Data state
  const [athletes, setAthletes] = useState<Array<{ id: string; name: string }>>([]);
  const [deletionRequests, setDeletionRequests] = useState<Array<{ athlete_profile_id: string; status: string }>>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchDeletionData = useCallback(async () => {
    try {
      const [athleteRes, requestRes] = await Promise.all([
        fetch('/api/parent/athlete-profile-id'),
        fetch('/api/parent/deletion-request'),
      ]);
      if (athleteRes.ok) {
        const data = await athleteRes.json();
        if (data.athleteProfileId) {
          const name = data.athleteFirstName && data.athleteLastName
            ? `${data.athleteFirstName} ${data.athleteLastName}`
            : data.athleteFirstName ?? 'Your athlete';
          setAthletes([{ id: data.athleteProfileId, name }]);
        }
      }
      if (requestRes.ok) {
        const data = await requestRes.json();
        setDeletionRequests(data.requests ?? []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const profileRes = await fetch('/api/communication/parents/profile');
        if (profileRes.ok) {
          const data: ParentProfile = await profileRes.json();
          setPreference(data.notification_preference ?? 'email');
          setPhone(data.phone ?? null);
        }
      } catch {
        // silent — user stays on default preference
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
    fetchDeletionData();
  }, [fetchDeletionData]);

  async function handleSave(newPref: NotificationPreference) {
    // SMS requires a phone number on file
    if ((newPref === 'sms' || newPref === 'both') && !phone) {
      setError('Please add a phone number to enable SMS notifications.');
      return;
    }

    setPreference(newPref);
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch('/api/communication/parents/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_preference: newPref }),
      });

      if (!res.ok) throw new Error('Failed to save');

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  const options: Array<{
    value: NotificationPreference;
    label: string;
    description: string;
    icon: React.ElementType;
  }> = [
    {
      value: 'email',
      label: 'Email Only',
      description:
        'Receive announcements, event notifications, video alerts, and message notifications via email.',
      icon: Mail,
    },
    {
      value: 'sms',
      label: 'SMS Only',
      description:
        'Receive short text notifications for announcements, events, and new messages. Standard messaging rates may apply.',
      icon: MessageSquare,
    },
    {
      value: 'both',
      label: 'Email & SMS',
      description:
        'Get the full experience — email for detailed notifications and SMS for time-sensitive alerts.',
      icon: Check,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/parent"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-600 mb-8">Manage your notification preferences</p>

      {/* Notification Preferences */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Notification Channel</h2>
        <p className="text-sm text-gray-500 mb-6">
          Choose how you&apos;d like to receive updates from your coaching staff.
        </p>

        <div className="space-y-3">
          {options.map((option) => {
            const Icon = option.icon;
            const isSelected = preference === option.value;
            const isDisabled =
              (option.value === 'sms' || option.value === 'both') && !phone;

            return (
              <button
                key={option.value}
                onClick={() => handleSave(option.value)}
                disabled={saving || isDisabled}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-gray-900 bg-gray-50'
                    : isDisabled
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{option.label}</span>
                      {isSelected && (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
                    {isDisabled && (
                      <p className="text-xs text-amber-600 mt-1">
                        Requires a phone number on file
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {saving && (
          <p className="text-sm text-gray-500 mt-4 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Saving...
          </p>
        )}
        {saved && (
          <p className="text-sm text-green-600 mt-4 flex items-center gap-2">
            <Check className="w-4 h-4" /> Preferences saved
          </p>
        )}
        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      </div>

      {/* Phone number info */}
      {!phone && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-800">
            No phone number on file. Contact your coach to add your phone number for SMS
            notifications.
          </p>
        </div>
      )}

      {/* Privacy & Data */}
      {athletes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">Privacy & Data</h2>
          <p className="text-sm text-gray-500 mb-6">
            Request deletion of an athlete profile and all associated data.
          </p>

          <div className="space-y-3">
            {athletes.map((athlete) => {
              const latestRequest = deletionRequests.find(
                (r) => r.athlete_profile_id === athlete.id
              );
              const isActive = latestRequest && (latestRequest.status === 'pending' || latestRequest.status === 'approved');

              return (
                <div
                  key={athlete.id}
                  className="p-4 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{athlete.name}</p>
                      <p className="text-xs text-gray-500">Profile, clips, reports, and subscription</p>
                    </div>

                    {latestRequest?.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                        <Loader2 className="w-3 h-3" />
                        Pending review
                      </span>
                    ) : latestRequest?.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-800">
                        <Loader2 className="w-3 h-3" />
                        Approved — awaiting deletion
                      </span>
                    ) : latestRequest?.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-800">
                        <Check className="w-3 h-3" />
                        Deleted
                      </span>
                    ) : latestRequest?.status === 'rejected' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                        Request not approved
                      </span>
                    ) : latestRequest?.status === 'failed' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-800">
                        <AlertTriangle className="w-3 h-3" />
                        Deletion failed — contact support
                      </span>
                    ) : deleteConfirmId === athlete.id ? null : (
                      <button
                        onClick={() => { setDeleteConfirmId(athlete.id); setDeleteReason(''); setDeleteError(null); setDeleteSuccess(null); }}
                        className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
                      >
                        Request Deletion
                      </button>
                    )}
                  </div>

                  {/* Confirmation panel */}
                  {deleteConfirmId === athlete.id && !isActive && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-start gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">
                          This will request permanent deletion of this athlete&apos;s profile,
                          all clips, reports, season history, and any active subscription.
                          This cannot be undone. A platform administrator will review your request.
                        </p>
                      </div>

                      <textarea
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        placeholder="Reason for deletion (optional)"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 mb-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />

                      {deleteError && <p className="text-sm text-red-600 mb-3">{deleteError}</p>}
                      {deleteSuccess && (
                        <p className="text-sm text-green-600 mb-3 flex items-center gap-1">
                          <Check className="w-4 h-4" /> {deleteSuccess}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setDeletingId(athlete.id);
                            setDeleteError(null);
                            try {
                              const res = await fetch('/api/parent/deletion-request', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  athleteProfileId: athlete.id,
                                  reason: deleteReason.trim() || undefined,
                                }),
                              });
                              if (res.ok) {
                                setDeleteSuccess('Deletion request submitted. You will be notified when it is reviewed.');
                                setDeleteConfirmId(null);
                                await fetchDeletionData();
                              } else {
                                const data = await res.json();
                                setDeleteError(data.error ?? 'Failed to submit request');
                              }
                            } catch {
                              setDeleteError('Something went wrong. Please try again.');
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                          disabled={deletingId === athlete.id}
                          className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          {deletingId === athlete.id ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                            </span>
                          ) : (
                            'Submit Deletion Request'
                          )}
                        </button>
                        <button
                          onClick={() => { setDeleteConfirmId(null); setDeleteError(null); }}
                          className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {deleteSuccess && !deleteConfirmId && (
            <p className="text-sm text-green-600 mt-4 flex items-center gap-2">
              <Check className="w-4 h-4" /> {deleteSuccess}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
