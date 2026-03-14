'use client';

import React, { use, useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Trophy, Star } from 'lucide-react';
import Link from 'next/link';
import type { GameSummary, PlayerHighlight } from '@/types/communication';

export default function ParentGameSummaryPage({
  params,
}: {
  params: Promise<{ teamId: string; summaryId: string }>;
}) {
  const { teamId, summaryId } = use(params);
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        setLoading(true);
        const response = await fetch(`/api/communication/game-summaries/${summaryId}`);
        if (!response.ok) throw new Error('Summary not found');
        const data = await response.json();
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    fetchSummary();
  }, [summaryId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">{error || 'Not found'}</p>
      </div>
    );
  }

  const highlights = (summary.player_highlights ?? []) as PlayerHighlight[];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href={`/parent/teams/${teamId}/reports`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Reports
        </Link>

        {/* Score Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="bg-gray-900 px-6 py-8 text-center">
            <p className="text-sm text-gray-400 uppercase tracking-wider mb-2">
              {summary.game_date
                ? new Date(summary.game_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Game Day'}
            </p>
            <h1 className="text-2xl font-bold text-white mb-4">
              vs {summary.opponent || 'Opponent'}
            </h1>
            {summary.score_us !== null && summary.score_them !== null && (
              <div className="flex items-center justify-center gap-6">
                <div>
                  <p className="text-4xl font-bold text-white">{summary.score_us}</p>
                  <p className="text-xs text-gray-400 uppercase mt-1">Us</p>
                </div>
                <div className="text-2xl text-gray-500">-</div>
                <div>
                  <p className="text-4xl font-bold text-gray-400">{summary.score_them}</p>
                  <p className="text-xs text-gray-400 uppercase mt-1">Them</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Text */}
        {summary.published_text && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {summary.published_text}
            </p>
          </div>
        )}

        {/* Player Highlights */}
        {highlights.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-gray-900">Player Highlights</h2>
            </div>
            <ul className="space-y-3">
              {highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <p className="text-sm text-gray-700">{h.highlight_text}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          Published{' '}
          {summary.published_at
            ? new Date(summary.published_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : ''}
        </p>
      </div>
    </div>
  );
}
