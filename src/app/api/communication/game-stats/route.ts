/**
 * API: /api/communication/game-stats
 * GET - Return aggregated play stats for a specific game (coach only).
 *
 * Query params: teamId, gameId
 *
 * Used by the Game Summary Editor to give coaches a preview of film analysis
 * data before generating an AI draft.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

// ============================================================================
// Types
// ============================================================================

interface PlayInstanceRow {
  id: string;
  down: number | null;
  distance: number | null;
  yard_line: number | null;
  yards_gained: number | null;
  resulted_in_first_down: boolean | null;
  is_turnover: boolean | null;
  is_touchdown: boolean | null;
  scoring_type: string | null;
  result: string | null;
  play_code: string | null;
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
    primary_position: string | null;
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
// Helpers
// ============================================================================

/**
 * Checks whether a play resulted in a touchdown using all available signals.
 */
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

/**
 * Determines the primary role of a player based on their stat profile.
 * Returns the role label used in the top players list.
 */
function getPrimaryRole(stats: PlayerStats): string {
  const offTotal = stats.rushYards + stats.recYards + stats.passYards;
  const defTotal = stats.tackles + stats.tacklesForLoss + stats.sacks;

  if (offTotal === 0 && defTotal === 0) return 'Player';

  if (stats.passAttempts >= 3 && stats.passYards >= stats.rushYards && stats.passYards >= stats.recYards) {
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

/**
 * Builds a compact stat line string for a player based on their primary role.
 * Returns null if the player had no meaningful activity.
 */
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
    const avg = stats.receptions > 0
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

/**
 * Scores a player for sorting by impact (yards and TDs weighted).
 */
function scorePlayer(stats: PlayerStats): number {
  const offScore =
    stats.rushYards +
    stats.recYards +
    stats.passYards * 0.5 +
    (stats.rushTDs + stats.recTDs + stats.passTDs) * 50;
  const defScore =
    stats.tackles * 5 +
    stats.tacklesForLoss * 10 +
    stats.sacks * 15;
  return offScore + defScore;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // 1. Parse query params
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const gameId = searchParams.get('gameId');

    if (!teamId || !gameId) {
      return NextResponse.json(
        { error: 'teamId and gameId are required' },
        { status: 400 }
      );
    }

    // 2. Authenticate via cookie-aware client
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Authorize — user must be team owner or active coach/owner member
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const isOwner = team.user_id === user.id;

    if (!isOwner) {
      const { data: membership } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      const allowedRoles = ['owner', 'coach'];
      if (!membership || !allowedRoles.includes(membership.role)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // 4. Fetch play data via service client (bypasses RLS)
    const db = createServiceClient();

    // Get video IDs associated with this game
    const { data: videoRows, error: videoError } = await db
      .from('videos')
      .select('id')
      .eq('game_id', gameId);

    if (videoError) {
      console.error('Error fetching videos for game:', videoError);
      return NextResponse.json({ error: 'Failed to fetch game videos' }, { status: 500 });
    }

    if (!videoRows || videoRows.length === 0) {
      // No videos linked — return empty stats
      return NextResponse.json({
        overview: null,
        topPlayers: [],
      });
    }

    const videoIds = videoRows.map(v => v.id);

    // Fetch all offensive play instances for this game's videos
    const { data: rawPlays, error: playsError } = await db
      .from('play_instances')
      .select(
        'id, down, distance, yard_line, yards_gained, resulted_in_first_down, ' +
        'is_turnover, is_touchdown, scoring_type, result, play_code, is_opponent_play, ' +
        'penalty_yards'
      )
      .in('video_id', videoIds)
      .eq('is_opponent_play', false);

    if (playsError) {
      console.error('Error fetching play instances:', playsError);
      return NextResponse.json({ error: 'Failed to fetch play data' }, { status: 500 });
    }

    const plays = (rawPlays ?? []) as unknown as PlayInstanceRow[];

    if (plays.length === 0) {
      return NextResponse.json({ overview: null, topPlayers: [] });
    }

    // Fetch player participation joined to plays and players
    const { data: rawParticipation, error: participationError } = await db
      .from('player_participation')
      .select(
        'player_id, participation_type, yards_gained, is_touchdown, result, ' +
        'play_instances!inner(id, yards_gained, is_touchdown, scoring_type, result, is_opponent_play), ' +
        'players(id, first_name, last_name, jersey_number, primary_position)'
      )
      .in('play_instances.video_id', videoIds)
      .eq('play_instances.is_opponent_play', false);

    if (participationError) {
      console.error('Error fetching player participation:', participationError);
      // Non-fatal — we can still return team overview without player stats
    }

    const participation = (rawParticipation ?? []) as unknown as PlayerParticipationRow[];

    // -------------------------------------------------------------------------
    // Compute team overview
    // -------------------------------------------------------------------------
    const totalPlays = plays.length;
    const totalYards = plays.reduce((sum, p) => sum + (p.yards_gained ?? 0), 0);
    const yardsPerPlay = totalPlays > 0
      ? Math.round((totalYards / totalPlays) * 10) / 10
      : 0;

    // Passing stats: inferred from participation type
    const passerRows = participation.filter(r => r.participation_type === 'passer');
    const receiverRows = participation.filter(r => r.participation_type === 'receiver');
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
    const completionPct = passAttempts > 0
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

    // -------------------------------------------------------------------------
    // Compute per-player stats
    // -------------------------------------------------------------------------
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
          position: row.players.primary_position ?? null,
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
        return [{
          id: stats.playerId,
          name: stats.name,
          jerseyNumber: stats.jerseyNumber !== null ? String(stats.jerseyNumber) : '',
          role: getPrimaryRole(stats),
          statLine,
        }];
      });

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Error fetching game stats:', error);
    return NextResponse.json({ error: 'Failed to fetch game stats' }, { status: 500 });
  }
}
