/**
 * Report Service
 * Handles shared reports and game summaries for the Communication Hub.
 * All parent-facing data uses positive framing — celebrating growth, effort, and participation.
 */

import { createClient } from '@/utils/supabase/server';
import type {
  SharedReport,
  ReportType,
  ReportVisibility,
  NotificationChannel,
  GameSummary,
  PlayerHighlight,
  GameSummaryStatus,
} from '@/types/communication';

// ============================================================================
// Types
// ============================================================================

export interface CreateReportInput {
  teamId: string;
  coachId: string;
  reportType: ReportType;
  playerId?: string;
  gameId?: string;
  coachNotes?: string;
  reportData: Record<string, unknown>;
  visibility: ReportVisibility;
  targetParentId?: string;
  notificationChannel: NotificationChannel;
}

export interface CreateGameSummaryInput {
  teamId: string;
  coachId: string;
  gameId?: string;
  coachRawNotes?: string;
  opponent?: string;
  scoreUs?: number;
  scoreThem?: number;
  gameDate?: string;
  notificationChannel: NotificationChannel;
}

export interface UpdateGameSummaryInput {
  coachRawNotes?: string;
  aiDraft?: string;
  publishedText?: string;
  playerHighlights?: PlayerHighlight[];
  opponent?: string;
  scoreUs?: number;
  scoreThem?: number;
  gameDate?: string;
  gameId?: string;
  notificationChannel?: NotificationChannel;
}

export interface PlayerReportData {
  playerName: string;
  jerseyNumber: number | null;
  position: string | null;
  gamesPlayed: number;
  totalPlays: number;
  positionsPlayed: string[];
  highlights: string[];
  growthAreas: string[];
  coachComment: string | null;
}

// ============================================================================
// Positive Framing Helpers
// ============================================================================

/**
 * Transform raw stats into growth-oriented language for parents.
 * Rules:
 * - Frame around growth and participation, not raw stats
 * - Never show negative comparisons between players
 * - Show improvement trends
 * - Celebrate effort alongside performance
 */
export function framePositively(stats: {
  totalPlays: number;
  successRate: number;
  yardsPerPlay: number;
  gamesPlayed: number;
  positions: string[];
}): { highlights: string[]; growthAreas: string[] } {
  const highlights: string[] = [];
  const growthAreas: string[] = [];

  // Participation
  if (stats.gamesPlayed > 0) {
    highlights.push(`Active participant in ${stats.gamesPlayed} game${stats.gamesPlayed !== 1 ? 's' : ''} this season`);
  }

  if (stats.totalPlays > 0) {
    highlights.push(`Involved in ${stats.totalPlays} play${stats.totalPlays !== 1 ? 's' : ''}, showing strong commitment`);
  }

  // Versatility
  if (stats.positions.length > 1) {
    highlights.push(`Versatile player contributing at ${stats.positions.join(', ')}`);
  } else if (stats.positions.length === 1) {
    highlights.push(`Developing skills at ${stats.positions[0]}`);
  }

  // Performance — always framed positively
  if (stats.successRate >= 70) {
    highlights.push('Consistently strong execution on the field');
  } else if (stats.successRate >= 50) {
    highlights.push('Showing solid fundamentals with room to grow');
  } else if (stats.successRate > 0) {
    growthAreas.push('Building experience and developing game awareness');
  }

  if (stats.yardsPerPlay >= 5) {
    highlights.push('Making impactful plays when on the field');
  } else if (stats.yardsPerPlay >= 3) {
    highlights.push('Contributing to the team effort on every snap');
  }

  // Always include at least one positive
  if (highlights.length === 0) {
    highlights.push('Working hard and showing dedication to the team');
  }

  return { highlights, growthAreas };
}

/**
 * Generate a parent-friendly season summary sentence.
 */
export function generateSeasonSummary(data: {
  playerName: string;
  gamesPlayed: number;
  totalPlays: number;
  positions: string[];
}): string {
  const { playerName, gamesPlayed, totalPlays, positions } = data;

  if (gamesPlayed === 0) {
    return `${playerName} has been practicing hard and preparing for game opportunities.`;
  }

  const positionText = positions.length > 1
    ? `multiple positions (${positions.join(', ')})`
    : positions[0] || 'the team';

  return `${playerName} has been an active contributor this season, participating in ${gamesPlayed} game${gamesPlayed !== 1 ? 's' : ''} and ${totalPlays} play${totalPlays !== 1 ? 's' : ''} at ${positionText}. Keep up the great work!`;
}

// ============================================================================
// Shared Reports CRUD
// ============================================================================

/**
 * Creates a new shared report for a team.
 */
export async function createReport(input: CreateReportInput): Promise<SharedReport> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('shared_reports')
    .insert({
      team_id: input.teamId,
      report_type: input.reportType,
      player_id: input.playerId || null,
      game_id: input.gameId || null,
      coach_id: input.coachId,
      coach_notes: input.coachNotes?.trim() || null,
      report_data: input.reportData,
      visibility: input.visibility,
      target_parent_id: input.targetParentId || null,
      notification_channel: input.notificationChannel,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create report: ${error.message}`);
  return data;
}

/**
 * Fetches all reports for a team, with optional filters.
 */
export async function getTeamReports(
  teamId: string,
  options: { reportType?: ReportType; playerId?: string; limit?: number } = {}
): Promise<SharedReport[]> {
  const supabase = await createClient();

  let query = supabase
    .from('shared_reports')
    .select('*')
    .eq('team_id', teamId)
    .order('shared_at', { ascending: false });

  if (options.reportType) query = query.eq('report_type', options.reportType);
  if (options.playerId) query = query.eq('player_id', options.playerId);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch reports: ${error.message}`);
  return data || [];
}

/**
 * Fetches a single report by ID.
 */
export async function getReportById(reportId: string): Promise<SharedReport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shared_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch report: ${error.message}`);
  }
  return data;
}

/**
 * Deletes a report by ID.
 */
export async function deleteReport(reportId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('shared_reports').delete().eq('id', reportId);
  if (error) throw new Error(`Failed to delete report: ${error.message}`);
}

/**
 * Gets reports visible to a parent (only for their linked children).
 * Also annotates each report with the parent's viewed_at timestamp.
 */
export async function getReportsForParent(
  teamId: string,
  parentId: string
): Promise<Array<SharedReport & { viewed_at: string | null }>> {
  const supabase = await createClient();

  // Get parent's children on this team
  const { data: childLinks } = await supabase
    .from('player_parent_links')
    .select('player_id, players!inner(team_id)')
    .eq('parent_id', parentId)
    .eq('players.team_id', teamId);

  const childPlayerIds = (childLinks || []).map(l => l.player_id);

  const { data: reports, error } = await supabase
    .from('shared_reports')
    .select('*')
    .eq('team_id', teamId)
    .order('shared_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch reports: ${error.message}`);

  // Filter to only reports relevant to this parent's children
  const filteredReports = (reports || []).filter(report => {
    // Game recaps with no player_id are visible to all parents
    if (report.report_type === 'game_recap' && !report.player_id) return true;
    // Reports targeted at this specific parent
    if (report.visibility === 'specific_parent' && report.target_parent_id === parentId) return true;
    // Reports for their children
    if (report.player_id && childPlayerIds.includes(report.player_id)) return true;
    return false;
  });

  // Annotate with view timestamps
  const reportIds = filteredReports.map(r => r.id);
  const { data: views } = reportIds.length > 0
    ? await supabase
        .from('report_views')
        .select('report_id, viewed_at')
        .eq('parent_id', parentId)
        .in('report_id', reportIds)
    : { data: [] };

  const viewMap = new Map((views || []).map(v => [v.report_id, v.viewed_at]));

  return filteredReports.map(report => ({
    ...report,
    viewed_at: viewMap.get(report.id) || null,
  }));
}

/**
 * Records a report view by a parent. Silently ignores duplicates.
 */
export async function recordReportView(reportId: string, parentId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('report_views')
    .upsert(
      { report_id: reportId, parent_id: parentId },
      { onConflict: 'report_id,parent_id', ignoreDuplicates: true }
    );

  if (error) console.error('Failed to record report view:', error);
}

// ============================================================================
// Game Summaries
// ============================================================================

/**
 * Creates a new game summary draft.
 */
export async function createGameSummary(input: CreateGameSummaryInput): Promise<GameSummary> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('game_summaries')
    .insert({
      team_id: input.teamId,
      coach_id: input.coachId,
      game_id: input.gameId || null,
      coach_raw_notes: input.coachRawNotes?.trim() || null,
      opponent: input.opponent?.trim() || null,
      score_us: input.scoreUs ?? null,
      score_them: input.scoreThem ?? null,
      game_date: input.gameDate || null,
      notification_channel: input.notificationChannel,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create game summary: ${error.message}`);
  return data;
}

/**
 * Fetches a single game summary by ID.
 */
export async function getGameSummary(summaryId: string): Promise<GameSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('game_summaries')
    .select('*')
    .eq('id', summaryId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch game summary: ${error.message}`);
  }
  return data;
}

/**
 * Updates fields on a game summary. Only provided fields are changed.
 */
export async function updateGameSummary(
  summaryId: string,
  input: UpdateGameSummaryInput
): Promise<GameSummary> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (input.coachRawNotes !== undefined) updates.coach_raw_notes = input.coachRawNotes?.trim() || null;
  if (input.aiDraft !== undefined) updates.ai_draft = input.aiDraft;
  if (input.publishedText !== undefined) updates.published_text = input.publishedText?.trim() || null;
  if (input.playerHighlights !== undefined) updates.player_highlights = input.playerHighlights;
  if (input.opponent !== undefined) updates.opponent = input.opponent?.trim() || null;
  if (input.scoreUs !== undefined) updates.score_us = input.scoreUs;
  if (input.scoreThem !== undefined) updates.score_them = input.scoreThem;
  if (input.gameDate !== undefined) updates.game_date = input.gameDate || null;
  if (input.gameId !== undefined) updates.game_id = input.gameId || null;
  if (input.notificationChannel !== undefined) updates.notification_channel = input.notificationChannel;

  const { data, error } = await supabase
    .from('game_summaries')
    .update(updates)
    .eq('id', summaryId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update game summary: ${error.message}`);
  return data;
}

/**
 * Publishes a game summary, stamping published_at and flipping status.
 */
export async function publishGameSummary(summaryId: string): Promise<GameSummary> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('game_summaries')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', summaryId)
    .select()
    .single();

  if (error) throw new Error(`Failed to publish game summary: ${error.message}`);
  return data;
}

/**
 * Fetches all game summaries for a team, newest game first.
 */
export async function getTeamGameSummaries(
  teamId: string,
  options: { status?: GameSummaryStatus; limit?: number } = {}
): Promise<GameSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from('game_summaries')
    .select('*')
    .eq('team_id', teamId)
    .order('game_date', { ascending: false, nullsFirst: false });

  if (options.status) query = query.eq('status', options.status);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch game summaries: ${error.message}`);
  return data || [];
}

/**
 * Fetches published game summaries visible to parents.
 */
export async function getPublishedSummariesForParent(teamId: string): Promise<GameSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('game_summaries')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'published')
    .order('game_date', { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch published summaries: ${error.message}`);
  return data || [];
}

/**
 * Deletes a game summary by ID.
 */
export async function deleteGameSummary(summaryId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('game_summaries').delete().eq('id', summaryId);
  if (error) throw new Error(`Failed to delete game summary: ${error.message}`);
}

// ============================================================================
// Report Data Builders (positive framing)
// ============================================================================

/**
 * Builds player summary report data with positive framing for parent-facing reports.
 * @param teamId - The team the player belongs to
 * @param playerId - The player to build a summary for
 */
export async function buildPlayerSummaryData(
  teamId: string,
  playerId: string
): Promise<PlayerReportData> {
  const supabase = await createClient();

  const { data: player } = await supabase
    .from('players')
    .select('id, first_name, last_name, jersey_number, position_categories!primary_position_category_id(code, unit)')
    .eq('id', playerId)
    .single();

  if (!player) throw new Error('Player not found');

  const category = (player as unknown as { position_categories?: { code: string | null; unit: string | null } | null }).position_categories ?? null;

  const { data: playInstances } = await supabase
    .from('play_instances')
    .select('id, result, yards_gained, play_code, video_id')
    .eq('player_id', playerId);

  const { data: games } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId);

  const totalPlays = playInstances?.length || 0;
  const successfulPlays = (playInstances || []).filter(p =>
    p.result === 'complete' || p.result === 'touchdown' || (p.yards_gained && p.yards_gained > 0)
  ).length;
  const successRate = totalPlays > 0 ? Math.round((successfulPlays / totalPlays) * 100) : 0;
  const totalYards = (playInstances || []).reduce((sum, p) => sum + (p.yards_gained || 0), 0);
  const yardsPerPlay = totalPlays > 0 ? Math.round((totalYards / totalPlays) * 10) / 10 : 0;

  const positions = [category?.code, category?.unit].filter(Boolean) as string[];
  const gamesPlayed = games?.length || 0;

  const { highlights, growthAreas } = framePositively({
    totalPlays,
    successRate,
    yardsPerPlay,
    gamesPlayed,
    positions,
  });

  return {
    playerName: `${player.first_name} ${player.last_name}`,
    jerseyNumber: player.jersey_number,
    position: category?.code ?? null,
    gamesPlayed,
    totalPlays,
    positionsPlayed: positions,
    highlights,
    growthAreas,
    coachComment: null,
  };
}

/**
 * Builds game recap data from play instance records, with positive team-effort framing.
 * @param teamId - The team the game belongs to
 * @param gameId - The game to build a recap for
 */
export async function buildGameRecapData(
  teamId: string,
  gameId: string
): Promise<Record<string, unknown>> {
  const supabase = await createClient();

  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (!game) throw new Error('Game not found');

  const { data: playInstances } = await supabase
    .from('play_instances')
    .select('*, players(first_name, last_name, jersey_number)')
    .eq('game_id', gameId);

  const totalPlays = playInstances?.length || 0;
  const touchdowns = (playInstances || []).filter(p => p.result === 'touchdown').length;
  const totalYards = (playInstances || []).reduce((sum, p) => sum + (p.yards_gained || 0), 0);

  // Build player involvement map
  const playerInvolvement = new Map<string, { name: string; plays: number; highlights: string[] }>();
  (playInstances || []).forEach(pi => {
    if (pi.players) {
      const p = pi.players as unknown as { first_name: string; last_name: string; jersey_number: number };
      const name = `${p.first_name} ${p.last_name}`;
      if (!playerInvolvement.has(name)) {
        playerInvolvement.set(name, { name, plays: 0, highlights: [] });
      }
      const entry = playerInvolvement.get(name)!;
      entry.plays++;
      if (pi.result === 'touchdown') {
        entry.highlights.push('Scored a touchdown');
      } else if (pi.yards_gained && pi.yards_gained >= 15) {
        entry.highlights.push(`Big play for ${pi.yards_gained} yards`);
      }
    }
  });

  return {
    opponent: game.opponent,
    date: game.game_date || game.date,
    scoreUs: game.team_score,
    scoreThem: game.opponent_score,
    result: game.game_result,
    totalPlays,
    touchdowns,
    totalYards,
    playerContributions: Array.from(playerInvolvement.values())
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10),
    teamEffortSummary: `The team showed great effort with ${totalPlays} plays${touchdowns > 0 ? ` and ${touchdowns} touchdown${touchdowns !== 1 ? 's' : ''}` : ''}. Every player's contribution matters!`,
  };
}
