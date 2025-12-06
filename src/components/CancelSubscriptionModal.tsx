// CancelSubscriptionModal.tsx - Confirmation modal for subscription cancellation

'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ContentSummary {
  plays_created: number;
  games_recorded: number;
  plays_tagged: number;
  videos_uploaded: number;
  total_film_minutes: number;
  practice_plans: number;
  players_on_roster: number;
  drives_analyzed: number;
}

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, details: string) => Promise<void>;
  subscriptionEndsAt: string | null;
  contentSummary: ContentSummary | null;
  teamName: string;
}

const CANCELLATION_REASONS = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'not_using', label: 'Not using it enough' },
  { value: 'missing_features', label: 'Missing features I need' },
  { value: 'seasonal', label: 'Season ended (will return)' },
  { value: 'switching_provider', label: 'Switching to another service' },
  { value: 'team_disbanded', label: 'Team disbanded' },
  { value: 'other', label: 'Other reason' }
];

export default function CancelSubscriptionModal({
  isOpen,
  onClose,
  onConfirm,
  subscriptionEndsAt,
  contentSummary,
  teamName
}: CancelSubscriptionModalProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleConfirm = async () => {
    if (!reason) {
      setError('Please select a reason for canceling');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onConfirm(reason, details);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription');
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setReason('');
      setDetails('');
      setError(null);
      onClose();
    }
  };

  // Calculate total content items
  const totalContent = contentSummary
    ? contentSummary.plays_created +
      contentSummary.games_recorded +
      contentSummary.plays_tagged +
      contentSummary.videos_uploaded +
      contentSummary.practice_plans +
      contentSummary.players_on_roster
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Cancel Subscription</h2>
                <p className="text-sm text-gray-500">{teamName}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Warning about losing access */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>We're sorry to see you go.</strong> If you cancel, you'll have access until{' '}
              <strong>{subscriptionEndsAt ? formatDate(subscriptionEndsAt) : 'the end of your billing period'}</strong>.
              After that, you'll have 30 days to resubscribe and regain access to all your data.
            </p>
          </div>

          {/* Content summary */}
          {contentSummary && totalContent > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900 mb-3">
                Here's what you've built with {teamName}:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {contentSummary.plays_created > 0 && (
                  <div className="text-sm">
                    <span className="font-semibold text-gray-900">{contentSummary.plays_created}</span>
                    <span className="text-gray-600"> plays created</span>
                  </div>
                )}
                {contentSummary.games_recorded > 0 && (
                  <div className="text-sm">
                    <span className="font-semibold text-gray-900">{contentSummary.games_recorded}</span>
                    <span className="text-gray-600"> games on file</span>
                  </div>
                )}
                {contentSummary.plays_tagged > 0 && (
                  <div className="text-sm">
                    <span className="font-semibold text-gray-900">{contentSummary.plays_tagged}</span>
                    <span className="text-gray-600"> plays tagged</span>
                  </div>
                )}
                {contentSummary.videos_uploaded > 0 && (
                  <div className="text-sm">
                    <span className="font-semibold text-gray-900">{contentSummary.videos_uploaded}</span>
                    <span className="text-gray-600"> videos uploaded</span>
                  </div>
                )}
                {contentSummary.total_film_minutes > 0 && (
                  <div className="text-sm">
                    <span className="font-semibold text-gray-900">{contentSummary.total_film_minutes}</span>
                    <span className="text-gray-600"> minutes of film</span>
                  </div>
                )}
                {contentSummary.players_on_roster > 0 && (
                  <div className="text-sm">
                    <span className="font-semibold text-gray-900">{contentSummary.players_on_roster}</span>
                    <span className="text-gray-600"> players on roster</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reason selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Why are you canceling? <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            >
              <option value="">Select a reason...</option>
              {CANCELLATION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Additional details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anything else you'd like to share? (optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Help us improve by sharing your feedback..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-none"
              rows={3}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors font-medium disabled:opacity-50"
            >
              Keep My Subscription
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting || !reason}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
            >
              {submitting ? 'Canceling...' : 'Cancel Subscription'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
