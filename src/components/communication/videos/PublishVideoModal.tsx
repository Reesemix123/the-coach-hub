'use client';

import React, { useState } from 'react';
import { X, Video, AlertTriangle, Loader2 } from 'lucide-react';
import { NotificationChannelPicker } from '@/components/communication/shared/NotificationChannelPicker';
import type { NotificationChannel, VideoShareType } from '@/types/communication';

interface PublishVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (data: {
    confirmationText: string;
    coachNotes: string;
    notificationChannel: NotificationChannel;
    playerId?: string;
  }) => Promise<void>;
  video: {
    id: string;
    title: string;
    share_type: VideoShareType;
    duration_seconds: number | null;
    coach_notes: string | null;
  };
  credits: {
    totalRemaining: number;
  } | null;
  players?: Array<{ id: string; name: string; jersey_number: number | null }>;
}

const CONFIRMATION_TEXT =
  'I confirm this video is appropriate for sharing with families and does not contain any content that should remain private to the coaching staff.';

export function PublishVideoModal({
  isOpen,
  onClose,
  onPublish,
  video,
  credits,
  players,
}: PublishVideoModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [coachNotes, setCoachNotes] = useState(video.coach_notes || '');
  const [channel, setChannel] = useState<NotificationChannel>('email');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isTeamVideo = video.share_type === 'team';
  const noCredits = isTeamVideo && credits !== null && credits.totalRemaining <= 0;

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  async function handlePublish() {
    if (!confirmed) return;
    if (video.share_type === 'individual' && !selectedPlayerId) {
      setError('Please select a player');
      return;
    }

    try {
      setPublishing(true);
      setError(null);
      await onPublish({
        confirmationText: CONFIRMATION_TEXT,
        coachNotes,
        notificationChannel: channel,
        playerId: selectedPlayerId || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Video className="w-6 h-6 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isTeamVideo ? 'Share with Team' : 'Share with Player'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Video Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-1">{video.title}</h3>
            <p className="text-sm text-gray-500">Duration: {formatDuration(video.duration_seconds)}</p>
          </div>

          {/* Video Credits (team videos only) */}
          {isTeamVideo && credits !== null && (
            <div
              className={`rounded-lg p-4 ${
                noCredits
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {noCredits && <AlertTriangle className="w-5 h-5 text-red-600" />}
                <span
                  className={`text-sm font-medium ${
                    noCredits ? 'text-red-800' : 'text-blue-800'
                  }`}
                >
                  {noCredits
                    ? 'No video credits remaining. Purchase a top-up pack to continue sharing.'
                    : `${credits.totalRemaining} video${credits.totalRemaining !== 1 ? 's' : ''} remaining`}
                </span>
              </div>
              {!noCredits && (
                <p className="text-xs text-blue-600 mt-1">
                  This video will use 1 credit when published.
                </p>
              )}
            </div>
          )}

          {/* Individual: unlimited notice */}
          {!isTeamVideo && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <span className="text-sm font-medium text-green-800">
                Individual clips are unlimited.
              </span>
            </div>
          )}

          {/* Player Selection (individual shares) */}
          {!isTeamVideo && players && players.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Player
              </label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Choose a player...</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    #{player.jersey_number} {player.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Coach Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Coach Notes{' '}
              <span className="text-gray-400 font-normal">(visible to parents)</span>
            </label>
            <textarea
              value={coachNotes}
              onChange={(e) => setCoachNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              placeholder="Add notes about this video for parents to see..."
            />
          </div>

          {/* Notification Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notify Parents Via
            </label>
            <NotificationChannelPicker
              value={channel}
              onChange={setChannel}
              showLabel={false}
            />
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <span className="text-sm text-gray-700">{CONFIRMATION_TEXT}</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={!confirmed || publishing || noCredits}
              className="flex-1 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                'Publish & Notify'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
