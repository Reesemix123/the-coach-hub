/**
 * API: /api/communication/game-summaries/[id]
 * GET    - Get a single game summary (includes computed game stats when game_id is set)
 * PATCH  - Update a game summary
 * DELETE - Delete a game summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import {
  getGameSummary,
  updateGameSummary,
  deleteGameSummary,
} from '@/lib/services/communication/report.service';
import type { NotificationChannel } from '@/types/communication';

// ============================================================================
// Types for game stats aggregation
// ============================================================================

interface PlayInstanceRow {
  id: string;
  down: number | null;
  yards_gained: number | null;
  resulted_in_first_down: boolean | null;
  is_turnover: boolean | null;
  is_touchdown: boolean | null;
  scoring_type: string | null;
  result: string | null;
  is_opponent_play: boolean | null;
  penalty_yards: number | null;
}

interface PlayerParticipationRow {
  player_id: string;
  participation_type: string;
  yards_gained: number | null;
  is_touchdown: boolean | null;
  result: string | null;
  play_instances: {
    id: string;
    yards_gained: number | null;
    is_touchdown: boolean | null;
    scoring_type: string | null;
    result: string | null;
    is_opponent_play: boolean | null;
  } | null;
  players: {
    id: string;
    first_name: string;
    last_name: string;
    jersey_number: number | null;
    position_categories: { code: string | null } | null;
  } | null;
}

interface PlayerStats {
  playerId: string;
  name: string;
  jerseyNumber: number | null;
  position: string | null;
  rushAttempts: number;
  rushYards: number;
  rushTDs: number;
  passAttempts: number;
  completions: number;
  passYards: number;
  passTDs: number;
  passInts: number;
  targets: number;
  receptions: number;
  recYards: number;
  recTDs: number;
  tackles: number;
  tacklesForLoss: number;
  sacks: number;
}

// ============================================================================
// Aggregation helpers (mirrors game-stats/route.ts)
// ============================================================================

function isTouchdown(play: {
  scoring_type?: string | null;
  is_touchdown?: boolean | null;
  result?: string | null;
}): boolean {
  return (
    play.scoring_type === 'touchdown' ||
    play.is_touchdown === true ||
    (play.result?.includes('touchdown') ?? false)
  );
}

function getPrimaryRole(stats: PlayerStats): string {
  const offTotal = stats.rushYards + stats.recYards + stats.passYards;
  const defTotal = stats.tackles + stats.tacklesForLoss + stats.sacks;

  if (offTotal === 0 && defTotal === 0) return 'Player';

  if (
    stats.passAttempts >= 3 &&
    stats.passYards >= stats.rushYards &&
    stats.passYards >= stats.recYards
  ) {
    return 'Passing';
  }
  if (stats.rushYards > stats.recYards && stats.rushAttempts > 0) {
    return 'Rushing';
  }
  if (stats.targets > 0) {
    return 'Receiving';
  }
  if (defTotal > 0) {
    return 'Defense';
  }
  return 'Player';
}

function buildStatLine(stats: PlayerStats): string | null {
  const role = getPrimaryRole(stats);

  if (role === 'Passing' && stats.passAttempts > 0) {
    const tdPart = stats.passTDs > 0 ? `, ${stats.passTDs} TD` : '';
    const intPart = stats.passInts > 0 ? `, ${stats.passInts} INT` : '';
    return `${stats.completions}/${stats.passAttempts}, ${stats.passYards} yds${tdPart}${intPart}`;
  }
  if (role === 'Rushing' && stats.rushAttempts > 0) {
    const avg = (stats.rushYards / stats.rushAttempts).toFixed(1);
    const tdPart = stats.rushTDs > 0 ? `, ${stats.rushTDs} TD` : '';
    return `${stats.rushAttempts} car, ${stats.rushYards} yds, ${avg} avg${tdPart}`;
  }
  if (role === 'Receiving' && stats.targets > 0) {
    const avg =
      stats.receptions > 0
        ? (stats.recYards / stats.receptions).toFixed(1)
        : '0.0';
    const tdPart = stats.recTDs > 0 ? `, ${stats.recTDs} TD` : '';
    return `${stats.receptions} rec, ${stats.recYards} yds, ${avg} avg${tdPart}`;
  }
  if (role === 'Defense') {
    const parts: string[] = [];
    if (stats.tackles > 0) parts.push(`${stats.tackles} tkl`);
    if (stats.tacklesForLoss > 0) parts.push(`${stats.tacklesForLoss} TFL`);
    if (stats.sacks > 0) parts.push(`${stats.sacks} sack${stats.sacks > 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  return null;
}

function scorePlayer(stats: PlayerStats): number {
  const offScore =
    stats.rushYards +
    stats.recYards +
    stats.passYards * 0.5 +
    (stats.rushTDs + stats.recTDs + stats.passTDs) * 50;
  const defScore =
    stats.tackles * 5 + stats.tacklesForLoss * 10 + stats.sacks * 15;
  return offScore + defScore;
}

/**
 * Fetches and aggregates play stats for a given game.
 * Uses the service client to bypass RLS.
 * Returns null if no play data exists for the game.
 */
async function computeGameStats(gameId: string): Promise<{
  overview: {
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
  };
  topPlayers: {
    id: string;
    name: string;
    jerseyNumber: string;
    role: string;
    statLine: string;
  }[];
} | null> {
  const db = createServiceClient();

  const { data: videoRows, error: videoError } = await db
    .from('videos')
    .select('id')
    .eq('game_id', gameId);

  if (videoError) {
    console.error('computeGameStats: error fetching videos:', videoError);
    return null;
  }
  if (!videoRows || videoRows.length === 0) return null;

  const videoIds = videoRows.map((v: { id: string }) => v.id);

  const { data: rawPlays, error: playsError } = await db
    .from('play_instances')
    .select(
      'id, down, yards_gained, resulted_in_first_down, ' +
        'is_turnover, is_touchdown, scoring_type, result, is_opponent_play, penalty_yards'
    )
    .in('video_id', videoIds)
    .eq('is_opponent_play', false);

  if (playsError) {
    console.error('computeGameStats: error fetching plays:', playsError);
    return null;
  }

  const plays = (rawPlays ?? []) as unknown as PlayInstanceRow[];
  if (plays.length === 0) return null;

  const { data: rawParticipation } = await db
    .from('player_participation')
    .select(
      'player_id, participation_type, yards_gained, is_touchdown, result, ' +
        'play_instances!inner(id, yards_gained, is_touchdown, scoring_type, result, is_opponent_play), ' +
        'players(id, first_name, last_name, jersey_number, position_categories:position_categories!primary_position_category_id(code))'
    )
    .in('play_instances.video_id', videoIds)
    .eq('play_instances.is_opponent_play', false);

  const participation = (rawParticipation ?? []) as unknown as PlayerParticipationRow[];

  // Team overview
  const totalPlays = plays.length;
  const totalYards = plays.reduce((sum, p) => sum + (p.yards_gained ?? 0), 0);
  const yardsPerPlay =
    totalPlays > 0 ? Math.round((totalYards / totalPlays) * 10) / 10 : 0;

  const passerRows = participation.filter(r => r.participation_type === 'passer');
  const rusherRows = participation.filter(r => r.participation_type === 'rusher');

  const passAttempts = passerRows.length;
  const passCompletions = passerRows.filter(r => {
    const res = r.play_instances?.result ?? r.result ?? '';
    return (
      res === 'pass_complete' ||
      res === 'complete' ||
      isTouchdown(r.play_instances ?? {})
    );
  }).length;
  const completionPct =
    passAttempts > 0
      ? Math.round((passCompletions / passAttempts) * 1000) / 10
      : 0;
  const passingYards = passerRows.reduce((sum, r) => sum + (r.yards_gained ?? 0), 0);

  const rushAttempts = rusherRows.length;
  const rushingYards = rusherRows.reduce((sum, r) => sum + (r.yards_gained ?? 0), 0);

  const touchdowns = plays.filter(p => isTouchdown(p)).length;
  const turnovers = plays.filter(p => p.is_turnover === true).length;

  const penaltyPlays = plays.filter(
    p => p.penalty_yards !== null && p.penalty_yards !== 0
  );
  const penalties = penaltyPlays.length;
  const penaltyYards = penaltyPlays.reduce(
    (sum, p) => sum + Math.abs(p.penalty_yards ?? 0),
    0
  );

  const firstDowns = plays.filter(p => p.resulted_in_first_down === true).length;

  const thirdDownPlays = plays.filter(p => p.down === 3);
  const thirdDownAttempts = thirdDownPlays.length;
  const thirdDownConversions = thirdDownPlays.filter(
    p => p.resulted_in_first_down === true
  ).length;

  // Per-player stats
  const playerMap = new Map<string, PlayerStats>();

  participation.forEach(row => {
    if (!row.players || !row.play_instances) return;
    if (row.play_instances.is_opponent_play) return;

    const pid = row.player_id;
    if (!playerMap.has(pid)) {
      playerMap.set(pid, {
        playerId: pid,
        name: `${row.players.first_name} ${row.players.last_name}`,
        jerseyNumber: row.players.jersey_number ?? null,
        position: row.players.position_categories?.code ?? null,
        rushAttempts: 0, rushYards: 0, rushTDs: 0,
        passAttempts: 0, completions: 0, passYards: 0, passTDs: 0, passInts: 0,
        targets: 0, receptions: 0, recYards: 0, recTDs: 0,
        tackles: 0, tacklesForLoss: 0, sacks: 0,
      });
    }

    const stats = playerMap.get(pid)!;
    const play = row.play_instances;
    const ptType = row.participation_type;
    const yards = row.yards_gained ?? play.yards_gained ?? 0;
    const td = row.is_touchdown === true || isTouchdown(play);
    const playResult = play.result ?? row.result ?? '';
    const isComplete =
      playResult === 'pass_complete' || playResult === 'complete' || td;
    const isInt =
      playResult === 'pass_interception' || playResult.includes('interception');

    switch (ptType) {
      case 'rusher':
        stats.rushAttempts++;
        stats.rushYards += yards;
        if (td) stats.rushTDs++;
        break;
      case 'passer':
        stats.passAttempts++;
        stats.passYards += yards;
        if (isComplete) stats.completions++;
        if (td) stats.passTDs++;
        if (isInt) stats.passInts++;
        break;
      case 'receiver':
        stats.targets++;
        stats.recYards += yards;
        if (isComplete) stats.receptions++;
        if (td) stats.recTDs++;
        break;
      case 'primary_tackle':
      case 'solo_tackle':
      case 'assist_tackle':
        stats.tackles++;
        break;
      case 'tackle_for_loss':
        stats.tacklesForLoss++;
        stats.tackles++;
        break;
      case 'sack':
        stats.sacks++;
        break;
    }
  });

  const topPlayers = Array.from(playerMap.values())
    .sort((a, b) => scorePlayer(b) - scorePlayer(a))
    .slice(0, 5)
    .flatMap(stats => {
      const statLine = buildStatLine(stats);
      if (!statLine) return [];
      return [
        {
          id: stats.playerId,
          name: stats.name,
          jerseyNumber: stats.jerseyNumber !== null ? String(stats.jerseyNumber) : '',
          role: getPrimaryRole(stats),
          statLine,
        },
      ];
    });

  return {
    overview: {
      totalPlays,
      totalYards,
      yardsPerPlay,
      passingYards,
      rushingYards,
      passAttempts,
      passCompletions,
      completionPct,
      rushAttempts,
      touchdowns,
      turnovers,
      penalties,
      penaltyYards,
      firstDowns,
      thirdDownConversions,
      thirdDownAttempts,
    },
    topPlayers,
  };
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const summary = await getGameSummary(id);
    if (!summary) return NextResponse.json({ error: 'Summary not found' }, { status: 404 });

    // When the summary is linked to a game, compute play stats for the parent view.
    let gameStats: Awaited<ReturnType<typeof computeGameStats>> = null;
    if (summary.game_id) {
      gameStats = await computeGameStats(summary.game_id);
    }

    return NextResponse.json({ summary, gameStats });
  } catch (error) {
    console.error('Error fetching game summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const body = await request.json();

    const summary = await updateGameSummary(id, {
      coachRawNotes: body.coachRawNotes,
      aiDraft: body.aiDraft,
      publishedText: body.publishedText,
      playerHighlights: body.playerHighlights,
      opponent: body.opponent,
      scoreUs: body.scoreUs,
      scoreThem: body.scoreThem,
      gameDate: body.gameDate,
      gameId: body.gameId,
      notificationChannel: body.notificationChannel as NotificationChannel | undefined,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error updating game summary:', error);
    return NextResponse.json({ error: 'Failed to update summary' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    await deleteGameSummary(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting game summary:', error);
    return NextResponse.json({ error: 'Failed to delete summary' }, { status: 500 });
  }
}
