'use client';

import React, { use, useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Trophy, Star, BarChart2, Users } from 'lucide-react';
import Link from 'next/link';
import type { GameSummary, PlayerHighlight } from '@/types/communication';

// ============================================================================
// Types
// ============================================================================

interface GameOverview {
  totalPlays: number;
  totalYards: number;
  yardsPerPlay: number;
  passingYards: number;
  rushingYards: number;
  passAttempts: number;
  passCompletions: number;
  completionPct: number;
  rushAttempts: number;
  touchdowns: number;
  turnovers: number;
  penalties: number;
  penaltyYards: number;
  firstDowns: number;
  thirdDownConversions: number;
  thirdDownAttempts: number;
}

interface TopPlayer {
  id: string;
  name: string;
  jerseyNumber: string;
  role: string;
  statLine: string;
}

interface GameStats {
  overview: GameOverview;
  topPlayers: TopPlayer[];
}

// ============================================================================
// Sub-components
// ============================================================================

interface StatCellProps {
  label: string;
  value: string | number;
}

function StatCell({ label, value }: StatCellProps) {
  return (
    <div className="flex flex-col items-center py-3 px-2">
      <span className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</span>
      <span className="text-lg font-bold text-gray-900">{value}</span>
    </div>
  );
}

const ROLE_BADGE_CLASSES: Record<string, string> = {
  Passing: 'bg-green-100 text-green-700',
  Rushing: 'bg-blue-100 text-blue-700',
  Receiving: 'bg-amber-100 text-amber-700',
  Defense: 'bg-red-100 text-red-700',
};

function RoleBadge({ role }: { role: string }) {
  const classes = ROLE_BADGE_CLASSES[role] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${classes}`}>
      {role}
    </span>
  );
}

interface GameStatsCardProps {
  overview: GameOverview;
}

function GameStatsCard({ overview }: GameStatsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <BarChart2 className="w-5 h-5 text-gray-500" />
        <h2 className="font-semibold text-gray-900">Game Stats</h2>
      </div>

      {/* Row 1: Total Plays / Total Yards / Yds per Play */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
        <StatCell label="Total Plays" value={overview.totalPlays} />
        <StatCell label="Total Yards" value={overview.totalYards} />
        <StatCell label="Yds / Play" value={overview.yardsPerPlay} />
      </div>

      {/* Row 2: Passing / Rushing / TDs */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
        <StatCell
          label="Passing"
          value={
            overview.passAttempts > 0
              ? `${overview.passCompletions}/${overview.passAttempts} (${overview.completionPct}%)`
              : '—'
          }
        />
        <StatCell
          label="Rushing"
          value={
            overview.rushAttempts > 0
              ? `${overview.rushAttempts} car, ${overview.rushingYards} yds`
              : '—'
          }
        />
        <StatCell label="TDs" value={overview.touchdowns} />
      </div>

      {/* Row 3: Turnovers / Penalties / 3rd Down */}
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        <StatCell label="Turnovers" value={overview.turnovers} />
        <StatCell
          label="Penalties"
          value={
            overview.penalties > 0
              ? `${overview.penalties} (${overview.penaltyYards} yds)`
              : '0'
          }
        />
        <StatCell
          label="3rd Down"
          value={
            overview.thirdDownAttempts > 0
              ? `${overview.thirdDownConversions}/${overview.thirdDownAttempts}`
              : '—'
          }
        />
      </div>
    </div>
  );
}

interface TopPlayersCardProps {
  players: TopPlayer[];
}

function TopPlayersCard({ players }: TopPlayersCardProps) {
  if (players.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <Users className="w-5 h-5 text-gray-500" />
        <h2 className="font-semibold text-gray-900">Top Performers</h2>
      </div>
      <ul className="divide-y divide-gray-100">
        {players.map(player => (
          <li key={player.id} className="flex items-center gap-3 px-6 py-3">
            {/* Jersey number badge */}
            <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {player.jerseyNumber || '#'}
            </div>

            {/* Name + stat line */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{player.name}</p>
              <p className="text-xs text-gray-500 truncate">{player.statLine}</p>
            </div>

            {/* Role badge */}
            <RoleBadge role={player.role} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function ParentGameSummaryPage({
  params,
}: {
  params: Promise<{ teamId: string; summaryId: string }>;
}) {
  const { teamId, summaryId } = use(params);
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
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
        setGameStats(data.gameStats ?? null);
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

        {/* Game Stats — shown when play data is linked */}
        {gameStats && <GameStatsCard overview={gameStats.overview} />}

        {/* Top Performers — shown alongside game stats */}
        {gameStats && gameStats.topPlayers.length > 0 && (
          <TopPlayersCard players={gameStats.topPlayers} />
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
