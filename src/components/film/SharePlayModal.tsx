'use client';

import React, { useState, useEffect } from 'react';
import { X, Film, Loader2, AlertTriangle, Check, ShoppingCart } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayRecord {
  id: string;
  quarter?: number | null;
  down?: number | null;
  distance?: number | null;
  yard_line?: number | null;
  result?: string | null;
  yards_gained?: number | null;
  team_score_at_snap?: number | null;
  opponent_score_at_snap?: number | null;
  clock_start?: string | null;
}

interface GameRecord {
  id: string;
  name: string;
  opponent?: string | null;
  team_id: string;
}

interface PlayerOption {
  id: string;
  name: string;
  jersey_number: number | null;
}

interface SharePlayModalProps {
  isOpen: boolean;
  play: PlayRecord;
  game: GameRecord;
  players: PlayerOption[];
  teamId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIRMATION_TEXT =
  'I confirm this video is appropriate for sharing with families and does not contain any content that should remain private to the coaching staff.';

const MAX_NOTE_LENGTH = 280;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPlaySummary(play: PlayRecord): string {
  const parts: string[] = [];

  if (play.quarter != null) {
    parts.push(`Q${play.quarter === 5 ? 'OT' : play.quarter}`);
  }

  if (play.clock_start) {
    parts.push(play.clock_start);
  }

  if (play.down != null && play.distance != null) {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const suffix = suffixes[play.down] ?? 'th';
    parts.push(`${play.down}${suffix} & ${play.distance}`);
  }

  if (play.yard_line != null) {
    if (play.yard_line === 50) parts.push('at 50');
    else if (play.yard_line > 50) parts.push(`at OPP ${100 - play.yard_line}`);
    else parts.push(`at OWN ${play.yard_line}`);
  }

  const resultParts: string[] = [];
  if (play.result) resultParts.push(play.result);
  if (play.yards_gained != null) resultParts.push(`${play.yards_gained} yds`);
  if (resultParts.length > 0) parts.push(resultParts.join(', '));

  return parts.join(' · ') || 'Play clip';
}

function ordinalDown(down: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  return `${down}${suffixes[down] ?? 'th'}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SharePlayModal({
  isOpen,
  play,
  game,
  players,
  teamId,
  onClose,
  onSuccess,
}: SharePlayModalProps) {
  const [shareType, setShareType] = useState<'team' | 'individual'>('team');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [coachNote, setCoachNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Credit state
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [purchasingTopup, setPurchasingTopup] = useState(false);

  // Fetch credits when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Reset state on open
    setShareType('team');
    setSelectedPlayerId('');
    setCoachNote('');
    setConfirmed(false);
    setError(null);

    async function fetchCredits() {
      setCreditsLoading(true);
      try {
        const res = await fetch(`/api/communication/videos?teamId=${teamId}&creditsOnly=true`);
        if (res.ok) {
          const data = await res.json();
          setCredits(data.credits?.totalRemaining ?? null);
        }
      } catch {
        // Non-critical — credits display is informational
      } finally {
        setCreditsLoading(false);
      }
    }

    fetchCredits();
  }, [isOpen, teamId]);

  if (!isOpen) return null;

  const noCredits = shareType === 'team' && credits !== null && credits <= 0;
  const canShare =
    confirmed &&
    !sharing &&
    !noCredits &&
    (shareType === 'team' || selectedPlayerId);

  async function handleShare() {
    if (!canShare) return;

    try {
      setSharing(true);
      setError(null);

      const res = await fetch(`/api/film/${game.id}/plays/${play.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareType,
          playerId: shareType === 'individual' ? selectedPlayerId : undefined,
          coachNote: coachNote.trim() || undefined,
          confirmationText: CONFIRMATION_TEXT,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to share (${res.status})`);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share clip');
    } finally {
      setSharing(false);
    }
  }

  async function handlePurchaseTopup() {
    try {
      setPurchasingTopup(true);
      const res = await fetch('/api/communication/videos/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });

      if (!res.ok) throw new Error('Failed to start purchase');

      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setError('Failed to open purchase page');
    } finally {
      setPurchasingTopup(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Film className="w-6 h-6 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Share Play Clip</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Play Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              vs {game.opponent || 'Opponent'}
            </p>
            <p className="font-medium text-gray-900">
              {formatPlaySummary(play)}
            </p>
            {play.team_score_at_snap != null && play.opponent_score_at_snap != null && (
              <p className="text-sm text-gray-600 mt-1">
                Score: {play.team_score_at_snap} – {play.opponent_score_at_snap}
              </p>
            )}
          </div>

          {/* Share Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share with
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShareType('team')}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  shareType === 'team'
                    ? 'border-gray-900 bg-gray-50 text-gray-900'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                All Team Parents
              </button>
              <button
                type="button"
                onClick={() => setShareType('individual')}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  shareType === 'individual'
                    ? 'border-gray-900 bg-gray-50 text-gray-900'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Player&apos;s Parents
              </button>
            </div>
          </div>

          {/* Player Selection (individual shares) */}
          {shareType === 'individual' && (
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
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.jersey_number} {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Credit Display (team shares) */}
          {shareType === 'team' && (
            <div>
              {creditsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking credits...
                </div>
              ) : credits !== null && credits > 0 ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <span className="text-sm font-medium text-blue-800">
                    {credits} video credit{credits !== 1 ? 's' : ''} remaining
                  </span>
                  <p className="text-xs text-blue-600 mt-1">
                    This clip will use 1 credit when encoding completes.
                  </p>
                </div>
              ) : credits !== null && credits <= 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-800">
                      No video credits remaining
                    </span>
                  </div>
                  <p className="text-xs text-red-600 mb-3">
                    Purchase a top-up pack to share team clips.
                  </p>
                  <button
                    onClick={handlePurchaseTopup}
                    disabled={purchasingTopup}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {purchasingTopup ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShoppingCart className="w-3.5 h-3.5" />
                    )}
                    Purchase Top-Up Pack
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Individual: unlimited notice */}
          {shareType === 'individual' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <span className="text-sm font-medium text-green-800 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Individual clips are unlimited
              </span>
            </div>
          )}

          {/* Coach Note */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Coach Note{' '}
                <span className="text-gray-400 font-normal">(optional, visible to parents)</span>
              </label>
              <span className={`text-xs ${coachNote.length > MAX_NOTE_LENGTH ? 'text-red-600' : 'text-gray-400'}`}>
                {coachNote.length}/{MAX_NOTE_LENGTH}
              </span>
            </div>
            <textarea
              value={coachNote}
              onChange={(e) => setCoachNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              placeholder="Great execution on this play..."
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

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleShare}
              disabled={!canShare}
              className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                backgroundColor: canShare ? '#B8CA6E' : undefined,
                color: canShare ? '#1a1410' : undefined,
              }}
            >
              {sharing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sharing clip...
                </>
              ) : (
                'Share Clip'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
