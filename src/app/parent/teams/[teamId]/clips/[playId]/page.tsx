'use client';

import React, { use, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Loader2, Film } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { VideoPlayer } from '@/components/communication/videos/VideoPlayer';
import { ScoreboardOverlay } from '@/components/film/ScoreboardOverlay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClipPlay {
  id: string;
  quarter: number | null;
  down: number | null;
  distance: number | null;
  yardLine: number | null;
  result: string | null;
  yardsGained: number | null;
  teamScoreAtSnap: number | null;
  opponentScoreAtSnap: number | null;
  clockStart: string | null;
  clipStatus: string | null;
  coachNote: string | null;
  sharedAt: string | null;
}

interface ClipResponse {
  play: ClipPlay;
  teamName: string;
  opponentName: string;
  gameDate: string | null;
  playbackUrl: string | null;
}

interface PageProps {
  params: Promise<{ teamId: string; playId: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPlaySummary(play: ClipPlay): string {
  const parts: string[] = [];

  if (play.quarter != null) {
    parts.push(play.quarter === 5 ? 'OT' : `Q${play.quarter}`);
  }
  if (play.clockStart) {
    parts.push(play.clockStart);
  }
  if (play.down != null && play.distance != null) {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const suffix = suffixes[play.down] ?? 'th';
    parts.push(`${play.down}${suffix} & ${play.distance}`);
  }

  const resultParts: string[] = [];
  if (play.result) resultParts.push(play.result);
  if (play.yardsGained != null) resultParts.push(`${play.yardsGained} yds`);
  if (resultParts.length > 0) parts.push(resultParts.join(', '));

  return parts.join(' · ') || 'Play Clip';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParentClipPage({ params }: PageProps) {
  const { teamId, playId } = use(params);

  const [data, setData] = useState<ClipResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClip = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/film/clips/${playId}`);
      if (!response.ok) {
        throw new Error(
          response.status === 404 ? 'Clip not found' : 'Failed to load clip',
        );
      }

      const json: ClipResponse = await response.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clip');
    } finally {
      setLoading(false);
    }
  }, [playId]);

  useEffect(() => {
    fetchClip();
  }, [fetchClip]);

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error / Not found
  // -------------------------------------------------------------------------
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-4">
          <Film className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">{error ?? 'Clip not found'}</p>
          <Link
            href={`/parent/teams/${teamId}/videos`}
            className="text-sm font-medium text-gray-900 hover:underline"
          >
            Back to Videos
          </Link>
        </div>
      </div>
    );
  }

  const { play, teamName, opponentName, gameDate, playbackUrl } = data;

  // -------------------------------------------------------------------------
  // Processing state
  // -------------------------------------------------------------------------
  if (play.clipStatus !== 'ready') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link
            href={`/parent/teams/${teamId}/videos`}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Videos
          </Link>

          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Clip is processing
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              This play clip is being prepared. Check back in a moment.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 inline-block">
              <p className="text-sm text-gray-700 font-medium">
                vs {opponentName} — {formatPlaySummary(play)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Ready — show player
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          href={`/parent/teams/${teamId}/videos`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Videos
        </Link>

        {/* Heading */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">
            vs {opponentName}
          </h1>
          {gameDate && (
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date(gameDate.length === 10 ? `${gameDate}T12:00:00` : gameDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
        </div>

        {/* Video player with scoreboard overlay */}
        <div className="relative rounded-xl overflow-hidden bg-black">
          <VideoPlayer
            playbackUrl={playbackUrl}
            thumbnailUrl={null}
            title={`vs ${opponentName} — ${formatPlaySummary(play)}`}
          />

          {/* Scoreboard overlay — always visible for parents, no toggle */}
          <ScoreboardOverlay
            teamName={teamName}
            opponentName={opponentName}
            teamScore={play.teamScoreAtSnap}
            opponentScore={play.opponentScoreAtSnap}
            quarter={play.quarter}
            clock={play.clockStart}
            down={play.down}
            distance={play.distance}
            yardLine={play.yardLine}
            visible={true}
            showToggle={false}
          />
        </div>

        {/* Play summary */}
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-900">
            {formatPlaySummary(play)}
          </p>
          {play.teamScoreAtSnap != null && play.opponentScoreAtSnap != null && (
            <p className="text-xs text-gray-500 mt-1">
              Score: {teamName} {play.teamScoreAtSnap} – {play.opponentScoreAtSnap} {opponentName}
            </p>
          )}
        </div>

        {/* Coach note */}
        {play.coachNote && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Coach&apos;s Notes
            </h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {play.coachNote}
            </p>
          </div>
        )}

        {/* Footer branding */}
        <div className="mt-8 flex items-center justify-center gap-2 opacity-40">
          <Image
            src="/apple-touch-icon.png"
            alt="Youth Coach Hub"
            width={20}
            height={20}
            className="rounded"
          />
          <span className="text-xs text-gray-400">Youth Coach Hub</span>
        </div>
      </div>
    </div>
  );
}
