'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Mail, MessageSquare, Check } from 'lucide-react';
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
  }, []);

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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800">
            No phone number on file. Contact your coach to add your phone number for SMS
            notifications.
          </p>
        </div>
      )}
    </div>
  );
}
