'use client';

import React, { useState } from 'react';
import { AlertCircle, Loader2, Send } from 'lucide-react';
import { NotificationChannelPicker } from '@/components/communication/shared/NotificationChannelPicker';
import { AnnouncementPriority, NotificationChannel, PositionGroup } from '@/types/communication';

interface AnnouncementFormProps {
  teamId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const PRIORITY_OPTIONS: Array<{ value: AnnouncementPriority; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'important', label: 'Important' },
  { value: 'urgent', label: 'Urgent' },
];

const POSITION_GROUP_OPTIONS: Array<{ value: PositionGroup | null; label: string }> = [
  { value: null, label: 'All Parents' },
  { value: 'offense', label: 'Offense Parents Only' },
  { value: 'defense', label: 'Defense Parents Only' },
  { value: 'special_teams', label: 'Special Teams Parents Only' },
];

export function AnnouncementForm({ teamId, onSuccess, onCancel }: AnnouncementFormProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('normal');
  const [targetGroup, setTargetGroup] = useState<PositionGroup | null>(null);
  const [notificationChannel, setNotificationChannel] = useState<NotificationChannel>('both');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!body.trim()) {
      setError('Message body is required');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/communication/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          title: title.trim(),
          body: body.trim(),
          priority,
          notificationChannel,
          targetPositionGroup: targetGroup,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send announcement');
      }

      onSuccess();
    } catch (err) {
      console.error('Failed to send announcement:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={submitting}
          placeholder="Announcement title..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Body */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Message
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          disabled={submitting}
          rows={6}
          placeholder="Write your announcement message..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
        />
      </div>

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Priority
        </label>
        <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          {PRIORITY_OPTIONS.map((option) => {
            const isSelected = priority === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriority(option.value)}
                disabled={submitting}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-md
                  font-medium text-sm transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    isSelected
                      ? 'bg-black text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                  }
                `}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Position Group */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Send To
        </label>
        <div className="space-y-2">
          {POSITION_GROUP_OPTIONS.map((option) => (
            <label
              key={option.label}
              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <input
                type="radio"
                name="targetGroup"
                value={option.value ?? 'all'}
                checked={targetGroup === option.value}
                onChange={() => setTargetGroup(option.value)}
                disabled={submitting}
                className="w-4 h-4 text-gray-900"
              />
              <span className="text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Notification Channel */}
      <NotificationChannelPicker
        value={notificationChannel}
        onChange={setNotificationChannel}
        disabled={submitting}
      />

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-3 px-6 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send Announcement
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
