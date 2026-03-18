'use client';

import React, { useState } from 'react';
import { X, ExternalLink, Loader2, Shield } from 'lucide-react';

interface ShareToVimeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: {
    id: string;
    title: string;
    description: string | null;
  };
  teamId: string;
}

const CONFIRMATION_TEXT =
  'I confirm this video is appropriate for public sharing and understand that a watermark will be applied.';

export function ShareToVimeoModal({
  isOpen,
  onClose,
  video,
  teamId,
}: ShareToVimeoModalProps) {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description || '');
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('unlisted');
  const [confirmed, setConfirmed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleShare() {
    if (!confirmed) return;

    try {
      setSharing(true);
      setError(null);

      const response = await fetch('/api/communication/external-shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          videoId: video.id,
          title,
          description,
          privacySetting: privacy,
          confirmationText: CONFIRMATION_TEXT,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to share');
      }

      setSuccess(true);
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1ab7ea] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">V</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Share to Vimeo</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {success ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <ExternalLink className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Video Shared!</h3>
            <p className="text-sm text-gray-500">
              Your video is being uploaded to Vimeo.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                placeholder="Optional description..."
              />
            </div>

            {/* Privacy */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Privacy
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['unlisted', 'private', 'public'] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPrivacy(opt)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                      privacy === opt
                        ? 'border-gray-900 ring-1 ring-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Watermark notice */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                A watermark will be applied to this video. This is required for
                all external shares.
              </p>
            </div>

            {/* Confirmation checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <span className="text-sm text-gray-700">{CONFIRMATION_TEXT}</span>
            </label>

            {/* Error */}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                disabled={!confirmed || sharing || !title.trim()}
                className="flex-1 px-4 py-2.5 bg-[#1ab7ea] text-white rounded-lg hover:bg-[#1097c4] font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sharing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                {sharing ? 'Sharing...' : 'Share to Vimeo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
