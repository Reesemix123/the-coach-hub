/**
 * Data Fetcher for Semantic Layer
 *
 * Handles all database queries for the coaching intelligence system.
 * Fetches play instances, drives, players, and games for analysis.
 */

import type { SupabaseClient as RealSupabaseClient } from '@supabase/supabase-js';
import type { PlayData, DriveData, PlayerData, GameData, ConceptParams } from './types';

type QueryBuilder = ReturnType<RealSupabaseClient['from']>;

/**
 * Fetch play instances for a team with optional filters
 */
export async function fetchPlayInstances(
  supabase: RealSupabaseClient,
  teamId: string,
  params: ConceptParams = {}
): Promise<PlayData[]> {
  let query = supabase
    .from('play_instances')
    .select(`
      id,
      play_code,
      team_id,
      video_id,
      down,
      distance,
      yard_line,
      quarter,
      yards_gained,
      result,
      success,
      explosive,
      play_type,
      direction,
      ball_carrier_id,
      qb_id,
      target_id,
      lt_id,
      lt_block_result,
      lg_id,
      lg_block_result,
      c_id,
      c_block_result,
      rg_id,
      rg_block_result,
      rt_id,
      rt_block_result,
      tackler_ids,
      pressure_player_ids,
      coverage_player_id,
      coverage_result,
      is_tfl,
      is_sack,
      is_pbu,
      is_forced_fumble,
      is_opponent_play,
      special_teams_unit,
      kicker_id,
      kick_result,
      kick_distance,
      returner_id,
      return_yards,
      is_fair_catch,
      is_touchback,
      is_muffed,
      punter_id,
      punt_type,
      gunner_tackle_id,
      kickoff_type,
      long_snapper_id,
      snap_quality,
      holder_id,
      coverage_tackler_id,
      created_at,
      videos!play_instances_video_id_fkey (
        game_id,
        games!videos_game_id_fkey (
          id,
          name,
          opponent,
          date,
          game_result
        )
      )
    `)
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  // Apply play type filter
  if (params.playType && params.playType !== 'all') {
    query = query.eq('play_type', params.playType);
  }

  // Apply down filter
  if (params.down) {
    query = query.eq('down', params.down);
  }

  // Apply field zone filter
  if (params.fieldZone) {
    switch (params.fieldZone) {
      case 'red_zone':
        query = query.gte('yard_line', 80); // Inside opponent's 20
        break;
      case 'scoring_position':
        query = query.gte('yard_line', 70); // Inside opponent's 30
        break;
      case 'midfield':
        query = query.gte('yard_line', 40).lte('yard_line', 60);
        break;
      case 'own_territory':
        query = query.lt('yard_line', 50);
        break;
    }
  }

  // Apply game filter for recent games
  if (params.timeframe === 'recent') {
    // Get last 2-3 games
    // We'll filter after fetching since we need to get unique games first
  }

  // Apply limit
  if (params.limit) {
    query = query.limit(params.limit);
  } else {
    query = query.limit(1000); // Default max
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching play instances:', error);
    return [];
  }

  // Transform the nested data
  return (data || []).map((row) => {
    const play = row as unknown as {
      id: string;
      play_code: string | null;
      team_id: string;
      video_id: string;
      down: number | null;
      distance: number | null;
      yard_line: number | null;
      quarter: number | null;
      yards_gained: number | null;
      result: string | null;
      success: boolean | null;
      explosive: boolean | null;
      play_type: PlayData['play_type'];
      direction: PlayData['direction'];
      ball_carrier_id: string | null;
      qb_id: string | null;
      target_id: string | null;
      lt_id: string | null;
      lt_block_result: 'win' | 'loss' | 'neutral' | null;
      lg_id: string | null;
      lg_block_result: 'win' | 'loss' | 'neutral' | null;
      c_id: string | null;
      c_block_result: 'win' | 'loss' | 'neutral' | null;
      rg_id: string | null;
      rg_block_result: 'win' | 'loss' | 'neutral' | null;
      rt_id: string | null;
      rt_block_result: 'win' | 'loss' | 'neutral' | null;
      tackler_ids: string[] | null;
      pressure_player_ids: string[] | null;
      coverage_player_id: string | null;
      coverage_result: 'win' | 'loss' | 'neutral' | null;
      is_tfl: boolean | null;
      is_sack: boolean | null;
      is_pbu: boolean | null;
      is_forced_fumble: boolean | null;
      is_opponent_play: boolean | null;
      special_teams_unit: string | null;
      kicker_id: string | null;
      kick_result: string | null;
      kick_distance: number | null;
      returner_id: string | null;
      return_yards: number | null;
      is_fair_catch: boolean | null;
      is_touchback: boolean | null;
      is_muffed: boolean | null;
      punter_id: string | null;
      punt_type: string | null;
      gunner_tackle_id: string | null;
      kickoff_type: string | null;
      long_snapper_id: string | null;
      snap_quality: string | null;
      holder_id: string | null;
      coverage_tackler_id: string | null;
      created_at: string;
      videos: { game_id: string; games: unknown } | null;
    };

    const game = play.videos?.games as {
      id: string;
      name: string;
      opponent: string;
      date: string;
      game_result: string | null;
    } | null;

    return {
      id: play.id,
      play_code: play.play_code,
      team_id: play.team_id,
      video_id: play.video_id,
      down: play.down,
      distance: play.distance,
      yard_line: play.yard_line,
      quarter: play.quarter,
      yards_gained: play.yards_gained,
      result: play.result,
      success: play.success,
      explosive: play.explosive,
      play_type: play.play_type,
      direction: play.direction,
      ball_carrier_id: play.ball_carrier_id,
      qb_id: play.qb_id,
      target_id: play.target_id,
      lt_id: play.lt_id,
      lt_block_result: play.lt_block_result,
      lg_id: play.lg_id,
      lg_block_result: play.lg_block_result,
      c_id: play.c_id,
      c_block_result: play.c_block_result,
      rg_id: play.rg_id,
      rg_block_result: play.rg_block_result,
      rt_id: play.rt_id,
      rt_block_result: play.rt_block_result,
      tackler_ids: play.tackler_ids,
      pressure_player_ids: play.pressure_player_ids,
      coverage_player_id: play.coverage_player_id,
      coverage_result: play.coverage_result,
      is_tfl: play.is_tfl,
      is_sack: play.is_sack,
      is_pbu: play.is_pbu,
      is_forced_fumble: play.is_forced_fumble,
      is_opponent_play: play.is_opponent_play,
      special_teams_unit: play.special_teams_unit,
      kicker_id: play.kicker_id,
      kick_result: play.kick_result,
      kick_distance: play.kick_distance,
      returner_id: play.returner_id,
      return_yards: play.return_yards,
      is_fair_catch: play.is_fair_catch,
      is_touchback: play.is_touchback,
      is_muffed: play.is_muffed,
      punter_id: play.punter_id,
      punt_type: play.punt_type,
      gunner_tackle_id: play.gunner_tackle_id,
      kickoff_type: play.kickoff_type,
      long_snapper_id: play.long_snapper_id,
      snap_quality: play.snap_quality,
      holder_id: play.holder_id,
      coverage_tackler_id: play.coverage_tackler_id,
      created_at: play.created_at,
      playbook_play: null,  // Not fetched in this query
      game: game ? {
        id: game.id,
        name: game.name,
        opponent: game.opponent,
        date: game.date,
        game_result: game.game_result,
      } : null,
      ball_carrier: null,  // Not fetched in this query
    };
  }) as PlayData[];
}

/**
 * Fetch recent games for a team
 */
export async function fetchRecentGames(
  supabase: RealSupabaseClient,
  teamId: string,
  limit: number = 3
): Promise<GameData[]> {
  const { data, error } = await supabase
    .from('games')
    .select('id, team_id, name, opponent, date, team_score, opponent_score, game_result')
    .eq('team_id', teamId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching games:', error);
    return [];
  }

  return (data || []) as GameData[];
}

/**
 * Fetch all games for a team
 */
export async function fetchAllGames(
  supabase: RealSupabaseClient,
  teamId: string
): Promise<GameData[]> {
  const { data, error } = await supabase
    .from('games')
    .select('id, team_id, name, opponent, date, team_score, opponent_score, game_result')
    .eq('team_id', teamId)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching games:', error);
    return [];
  }

  return (data || []) as GameData[];
}

/**
 * Fetch drives for a team
 */
export async function fetchDrives(
  supabase: RealSupabaseClient,
  teamId: string,
  gameIds?: string[]
): Promise<DriveData[]> {
  let query = supabase
    .from('drives')
    .select('*')
    .eq('team_id', teamId)
    .eq('possession_type', 'offense')
    .order('created_at', { ascending: false });

  if (gameIds && gameIds.length > 0) {
    query = query.in('game_id', gameIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching drives:', error);
    return [];
  }

  return (data || []) as DriveData[];
}

/**
 * Fetch players for a team
 */
export async function fetchPlayers(
  supabase: RealSupabaseClient,
  teamId: string
): Promise<PlayerData[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, team_id, jersey_number, first_name, last_name, position_depths, is_active')
    .eq('team_id', teamId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching players:', error);
    return [];
  }

  return (data || []) as PlayerData[];
}

/**
 * Find a player by jersey number
 */
export async function findPlayerByNumber(
  supabase: RealSupabaseClient,
  teamId: string,
  jerseyNumber: string
): Promise<PlayerData | null> {
  const { data, error } = await supabase
    .from('players')
    .select('id, team_id, jersey_number, first_name, last_name, position_depths, is_active')
    .eq('team_id', teamId)
    .eq('jersey_number', jerseyNumber)
    .maybeSingle();

  if (error) {
    console.error('Error finding player:', error);
    return null;
  }

  return data as PlayerData | null;
}

/**
 * Fetch play instances for a specific player (as ball carrier)
 */
export async function fetchPlayerPlays(
  supabase: RealSupabaseClient,
  teamId: string,
  playerId: string,
  params: ConceptParams = {}
): Promise<PlayData[]> {
  // Use the main fetch function with player filter
  const allPlays = await fetchPlayInstances(supabase, teamId, params);

  // Filter to just this player's plays
  return allPlays.filter(
    (play) => play.ball_carrier_id === playerId || play.qb_id === playerId || play.target_id === playerId
  );
}

/**
 * Get unique games from play data
 */
export function getUniqueGames(plays: PlayData[]): { id: string; opponent: string; date: string }[] {
  const gameMap = new Map<string, { id: string; opponent: string; date: string }>();

  for (const play of plays) {
    if (play.game && !gameMap.has(play.game.id)) {
      gameMap.set(play.game.id, {
        id: play.game.id,
        opponent: play.game.opponent,
        date: play.game.date,
      });
    }
  }

  return Array.from(gameMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * Filter plays to recent games only
 */
export function filterToRecentGames(plays: PlayData[], numGames: number = 2): PlayData[] {
  const games = getUniqueGames(plays);
  const recentGameIds = games.slice(0, numGames).map((g) => g.id);

  return plays.filter((play) => play.game && recentGameIds.includes(play.game.id));
}

/**
 * Get team ID for a user
 */
export async function getTeamIdForUser(
  supabase: RealSupabaseClient,
  userId: string
): Promise<string | null> {
  // First check teams owned by user
  const { data: ownedTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (ownedTeams && ownedTeams.length > 0) {
    return ownedTeams[0].id;
  }

  // Then check team memberships
  const { data: memberships } = await supabase
    .from('team_memberships')
    .select('team_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1);

  if (memberships && memberships.length > 0) {
    return memberships[0].team_id;
  }

  return null;
}

/**
 * Get team name
 */
export async function getTeamName(
  supabase: RealSupabaseClient,
  teamId: string
): Promise<string> {
  const { data } = await supabase
    .from('teams')
    .select('name')
    .eq('id', teamId)
    .single();

  return data?.name || 'Your Team';
}
