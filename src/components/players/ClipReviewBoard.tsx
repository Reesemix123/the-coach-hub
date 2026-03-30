'use client';

import { useState, useCallback } from 'react';
import { Check, X, Pencil, Loader2, Film } from 'lucide-react';
import { VideoPlayer } from '@/components/communication/videos/VideoPlayer';

// ============================================================================
// Types
// ============================================================================

export interface ClipData {
  id: string;
  athleteProfileId: string;
  seasonId: string;
  gameId: string;
  opponent: string;
  gameDate: string | null;
  playResult: string | null;
  playType: string | null;
  coachNote: string | null;
  coachApproved: boolean;
  coachSuppressed: boolean;
  isFeatured: boolean;
  playbackUrl: string | null;
  clipStatus: string | null;
  down: number | null;
  distance: number | null;
  quarter: number | null;
  createdAt: string;
}

export interface PlayerGroup {
  playerId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: string | null;
  position: string | null;
  clips: ClipData[];
}

interface ClipReviewBoardProps {
  teamId: string;
  playerGroups: PlayerGroup[];
}

type FilterTab = 'all' | 'pending' | 'approved' | 'suppressed';

// ============================================================================
// ClipReviewCard
// ============================================================================

interface ClipReviewCardProps {
  clip: ClipData;
  onAction: (clipId: string, action: 'approve' | 'suppress', note?: string) => Promise<void>;
}

function ClipReviewCard({ clip, onAction }: ClipReviewCardProps) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(clip.coachNote ?? '');
  const [savingNote, setSavingNote] = useState(false);

  const borderColor = clip.coachApproved
    ? 'border-green-400'
    : clip.coachSuppressed
      ? 'border-gray-300'
      : 'border-amber-300';

  const cardOpacity = clip.coachSuppressed ? 'opacity-60' : '';

  const contextLine =
    clip.quarter !== null && clip.down !== null && clip.distance !== null
      ? `Q${clip.quarter} · ${clip.down}th & ${clip.distance}`
      : clip.opponent;

  const videoTitle = `${clip.opponent}${clip.playType ? ` · ${clip.playType}` : ''}`;

  async function handleSaveNote() {
    setSavingNote(true);
    await onAction(clip.id, 'approve', noteText);
    setSavingNote(false);
    setEditingNote(false);
  }

  return (
    <div className={`w-72 flex-shrink-0 bg-white rounded-xl border ${borderColor} ${cardOpacity} overflow-hidden`}>
      {/* Video */}
      <VideoPlayer playbackUrl={clip.playbackUrl} thumbnailUrl={null} title={videoTitle} />

      {/* Context */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-xs text-gray-500 truncate">{contextLine}</p>
        {clip.playResult && (
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {clip.playResult}
          </span>
        )}
      </div>

      {/* Note editor */}
      {editingNote && (
        <div className="px-3 pb-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
            placeholder="Add a coach note..."
            className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
          />
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleSaveNote}
              disabled={savingNote}
              className="flex-1 text-xs py-1 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              {savingNote ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Save'}
            </button>
            <button
              onClick={() => {
                setEditingNote(false);
                setNoteText(clip.coachNote ?? '');
              }}
              className="flex-1 text-xs py-1 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing note preview */}
      {!editingNote && clip.coachNote && (
        <p className="px-3 pb-1 text-xs text-gray-500 italic truncate">{clip.coachNote}</p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1 px-3 pb-3 pt-1">
        <button
          onClick={() => onAction(clip.id, 'approve')}
          title="Approve"
          className={`flex-1 flex items-center justify-center py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            clip.coachApproved
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 text-gray-600 hover:bg-green-50 hover:border-green-400 hover:text-green-700'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onAction(clip.id, 'suppress')}
          title="Suppress"
          className={`flex-1 flex items-center justify-center py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            clip.coachSuppressed
              ? 'bg-gray-400 border-gray-400 text-white'
              : 'border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setNoteText(clip.coachNote ?? '');
            setEditingNote((prev) => !prev);
          }}
          title="Add note"
          className="flex-1 flex items-center justify-center py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 text-xs font-medium transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// PlayerClipGroup
// ============================================================================

interface PlayerClipGroupProps {
  group: PlayerGroup & { clips: ClipData[] };
  onAction: (clipId: string, action: 'approve' | 'suppress', note?: string) => Promise<void>;
}

function PlayerClipGroup({ group, onAction }: PlayerClipGroupProps) {
  if (group.clips.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-700 flex-shrink-0">
          {group.jerseyNumber ? `#${group.jerseyNumber}` : '?'}
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">
            {group.firstName} {group.lastName}
          </p>
          <p className="text-xs text-gray-500">
            {group.position ?? 'No position'} &middot; {group.clips.length}{' '}
            {group.clips.length === 1 ? 'clip' : 'clips'}
          </p>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {group.clips.map((clip) => (
          <ClipReviewCard key={clip.id} clip={clip} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ClipReviewBoard (main export)
// ============================================================================

export function ClipReviewBoard({ teamId, playerGroups }: ClipReviewBoardProps) {
  // Flatten all clips into a map keyed by id for O(1) updates
  const [clips, setClips] = useState<Map<string, ClipData>>(() => {
    const map = new Map<string, ClipData>();
    for (const group of playerGroups) {
      for (const clip of group.clips) {
        map.set(clip.id, clip);
      }
    }
    return map;
  });

  const [filter, setFilter] = useState<FilterTab>('all');
  const [bulkApproving, setBulkApproving] = useState(false);

  // Derive pending count from live clip state
  const pendingCount = Array.from(clips.values()).filter(
    (c) => !c.coachApproved && !c.coachSuppressed,
  ).length;

  const handleAction = useCallback(
    async (clipId: string, action: 'approve' | 'suppress', note?: string) => {
      // Optimistic update
      const previous = new Map(clips);
      setClips((prev) => {
        const next = new Map(prev);
        const clip = next.get(clipId);
        if (!clip) return prev;

        const updated = { ...clip };
        if (action === 'approve') {
          updated.coachApproved = true;
          updated.coachSuppressed = false;
        } else {
          updated.coachSuppressed = true;
          updated.coachApproved = false;
        }
        if (note !== undefined) updated.coachNote = note;
        next.set(clipId, updated);
        return next;
      });

      const body: Record<string, string> = { action };
      if (note !== undefined) body.note = note;

      const res = await fetch(`/api/player-profiles/clips/${clipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.error('Failed to update clip — reverting');
        setClips(previous);
      }
    },
    [clips],
  );

  const handleBulkApprove = useCallback(async () => {
    setBulkApproving(true);

    const res = await fetch('/api/player-profiles/clips/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId }),
    });

    if (res.ok) {
      setClips((prev) => {
        const next = new Map(prev);
        for (const [id, clip] of next) {
          if (!clip.coachApproved && !clip.coachSuppressed) {
            next.set(id, { ...clip, coachApproved: true });
          }
        }
        return next;
      });
    } else {
      console.error('Bulk approve failed');
    }

    setBulkApproving(false);
  }, [teamId]);

  // Rebuild player groups from live clip state, applying the active filter
  const filteredGroups = playerGroups
    .map((group) => {
      const liveClips = group.clips
        .map((c) => clips.get(c.id) ?? c)
        .filter((c) => {
          if (filter === 'pending') return !c.coachApproved && !c.coachSuppressed;
          if (filter === 'approved') return c.coachApproved;
          if (filter === 'suppressed') return c.coachSuppressed;
          return true;
        });
      return { ...group, clips: liveClips };
    })
    .filter((g) => g.clips.length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Clip Review</h2>
          {pendingCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              {pendingCount} pending
            </span>
          )}
        </div>
        {pendingCount > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={bulkApproving}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#B8CA6E] text-[#1a1410] hover:brightness-105 disabled:opacity-50 flex items-center gap-2"
          >
            {bulkApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve all pending'}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'approved', 'suppressed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full capitalize transition-colors ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Player groups */}
      {filteredGroups.map((group) => (
        <PlayerClipGroup key={group.playerId} group={group} onAction={handleAction} />
      ))}

      {/* Empty state */}
      {filteredGroups.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Film className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">No clips yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Clips are generated automatically when you complete film analysis.
          </p>
        </div>
      )}
    </div>
  );
}
