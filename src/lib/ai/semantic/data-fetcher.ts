/**
 * Data Fetcher for Semantic Layer
 *
 * Handles all database queries for the coaching intelligence system.
 * Fetches play instances, drives, players, and games for analysis.
 */

import type { SupabaseClient as RealSupabaseClient } from '@supabase/supabase-js';
import type { PlayData, DriveData, PlayerData, GameData, PlaybookPlayData, PracticePlanData, PracticePlanWithDetails, PracticePeriodData, PracticeDrillData, ConceptParams } from './types';

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
    .select('id, team_id, name, opponent, date, team_score, opponent_score, game_result, location, start_time, week_number, notes')
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
    .select('id, team_id, name, opponent, date, team_score, opponent_score, game_result, location, start_time, week_number, notes')
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

/**
 * Get opponents that have scouting data (plays tagged with is_opponent_play = true)
 */
export async function fetchOpponentsWithScoutingData(
  supabase: RealSupabaseClient,
  teamId: string
): Promise<string[]> {
  // Get all games for this team
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, opponent')
    .eq('team_id', teamId);

  if (gamesError || !games) {
    console.error('Error fetching games for scouting:', gamesError);
    return [];
  }

  // Get videos for these games
  const gameIds = games.map(g => g.id);
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select('id, game_id')
    .in('game_id', gameIds);

  if (videosError || !videos) {
    console.error('Error fetching videos for scouting:', videosError);
    return [];
  }

  // Check which videos have opponent plays
  const videoIds = videos.map(v => v.id);
  const { data: opponentPlays, error: playsError } = await supabase
    .from('play_instances')
    .select('video_id')
    .eq('team_id', teamId)
    .eq('is_opponent_play', true)
    .in('video_id', videoIds);

  if (playsError || !opponentPlays) {
    console.error('Error fetching opponent plays:', playsError);
    return [];
  }

  // Map video IDs back to game IDs, then to opponent names
  const videoToGame = new Map(videos.map(v => [v.id, v.game_id]));
  const gameToOpponent = new Map(games.map(g => [g.id, g.opponent]));

  const opponentsWithData = new Set<string>();
  for (const play of opponentPlays) {
    const gameId = videoToGame.get(play.video_id);
    if (gameId) {
      const opponent = gameToOpponent.get(gameId);
      if (opponent) {
        opponentsWithData.add(opponent);
      }
    }
  }

  return Array.from(opponentsWithData);
}

/**
 * Find best matching opponent name from available opponents
 */
export function matchOpponentName(
  searchTerm: string,
  availableOpponents: string[]
): string | null {
  const lowerSearch = searchTerm.toLowerCase();

  // Exact match first
  const exactMatch = availableOpponents.find(
    o => o.toLowerCase() === lowerSearch
  );
  if (exactMatch) return exactMatch;

  // Partial match (contains)
  const partialMatch = availableOpponents.find(
    o => o.toLowerCase().includes(lowerSearch) || lowerSearch.includes(o.toLowerCase())
  );
  if (partialMatch) return partialMatch;

  // Word-level match (any word matches)
  const searchWords = lowerSearch.split(/\s+/);
  for (const opponent of availableOpponents) {
    const opponentWords = opponent.toLowerCase().split(/\s+/);
    if (searchWords.some(sw => opponentWords.some(ow => ow.includes(sw) || sw.includes(ow)))) {
      return opponent;
    }
  }

  return null;
}

/**
 * Fetch all plays from the team's playbook
 */
export async function fetchPlaybookPlays(
  supabase: RealSupabaseClient,
  teamId: string,
  filters?: {
    odk?: 'offense' | 'defense' | 'special_teams';
    playType?: string;
    formation?: string;
    personnel?: string;
    searchTerm?: string;
  }
): Promise<PlaybookPlayData[]> {
  const query = supabase
    .from('playbook_plays')
    .select('id, team_id, play_code, play_name, attributes, page_number, is_archived, created_at, updated_at')
    .eq('team_id', teamId)
    .eq('is_archived', false)
    .order('play_name', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching playbook plays:', error);
    return [];
  }

  let plays = (data || []) as PlaybookPlayData[];

  // Apply filters in memory (JSONB filtering is complex in Supabase)
  if (filters) {
    if (filters.odk) {
      plays = plays.filter(p => p.attributes?.odk === filters.odk);
    }
    if (filters.playType) {
      plays = plays.filter(p =>
        p.attributes?.playType?.toLowerCase() === filters.playType?.toLowerCase()
      );
    }
    if (filters.formation) {
      plays = plays.filter(p =>
        p.attributes?.formation?.toLowerCase().includes(filters.formation!.toLowerCase())
      );
    }
    if (filters.personnel) {
      plays = plays.filter(p =>
        p.attributes?.personnel?.toLowerCase().includes(filters.personnel!.toLowerCase())
      );
    }
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      plays = plays.filter(p =>
        p.play_name.toLowerCase().includes(term) ||
        p.play_code.toLowerCase().includes(term) ||
        p.attributes?.formation?.toLowerCase().includes(term) ||
        p.attributes?.runConcept?.toLowerCase().includes(term) ||
        p.attributes?.passConcept?.toLowerCase().includes(term)
      );
    }
  }

  return plays;
}

/**
 * Search playbook for plays matching criteria
 */
export async function searchPlaybook(
  supabase: RealSupabaseClient,
  teamId: string,
  criteria: {
    targetPosition?: string;  // e.g., "TE", "RB", "WR"
    concept?: string;         // e.g., "power", "zone", "play-action"
    formation?: string;       // e.g., "Shotgun", "I-Form"
    playType?: 'run' | 'pass';
  }
): Promise<PlaybookPlayData[]> {
  const allPlays = await fetchPlaybookPlays(supabase, teamId, { odk: 'offense' });

  let results = allPlays;

  // Filter by play type
  if (criteria.playType) {
    const playTypeMap: Record<string, string[]> = {
      'run': ['Run'],
      'pass': ['Pass', 'Screen', 'RPO', 'Play Action']
    };
    const validTypes = playTypeMap[criteria.playType] || [];
    results = results.filter(p =>
      validTypes.some(t => p.attributes?.playType?.toLowerCase().includes(t.toLowerCase()))
    );
  }

  // Filter by formation
  if (criteria.formation) {
    results = results.filter(p =>
      p.attributes?.formation?.toLowerCase().includes(criteria.formation!.toLowerCase())
    );
  }

  // Filter by concept (check both run and pass concepts)
  if (criteria.concept) {
    const conceptLower = criteria.concept.toLowerCase();
    results = results.filter(p =>
      p.attributes?.runConcept?.toLowerCase().includes(conceptLower) ||
      p.attributes?.passConcept?.toLowerCase().includes(conceptLower) ||
      p.play_name.toLowerCase().includes(conceptLower)
    );
  }

  // Filter by target position (check personnel, play name, or ball carrier)
  if (criteria.targetPosition) {
    const posLower = criteria.targetPosition.toLowerCase();
    results = results.filter(p => {
      // Check personnel (e.g., "12 (1RB-2TE-2WR)")
      if (p.attributes?.personnel?.toLowerCase().includes(posLower)) return true;
      // Check ball carrier
      if (p.attributes?.ballCarrier?.toLowerCase().includes(posLower)) return true;
      // Check play name for position mentions
      if (p.play_name.toLowerCase().includes(posLower)) return true;
      // Check for TE-specific concepts
      if (posLower === 'te' || posLower === 'tight end') {
        // Plays that typically feature TE
        const teKeywords = ['12 personnel', '13 personnel', '22 personnel', '2te', '2-te'];
        return teKeywords.some(kw => p.attributes?.personnel?.toLowerCase().includes(kw));
      }
      return false;
    });
  }

  return results;
}

/**
 * Fetch practice plans for a team
 */
export async function fetchPracticePlans(
  supabase: RealSupabaseClient,
  teamId: string,
  options?: {
    includeTemplates?: boolean;
    limit?: number;
  }
): Promise<PracticePlanData[]> {
  let query = supabase
    .from('practice_plans')
    .select(`
      id,
      team_id,
      title,
      date,
      duration_minutes,
      location,
      notes,
      is_template,
      template_name,
      created_at,
      updated_at
    `)
    .eq('team_id', teamId)
    .order('date', { ascending: false });

  // Filter out templates unless explicitly requested
  if (!options?.includeTemplates) {
    query = query.eq('is_template', false);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching practice plans:', error);
    return [];
  }

  return (data || []) as PracticePlanData[];
}

/**
 * Fetch practice plans with period and drill counts
 */
export async function fetchPracticePlansWithDetails(
  supabase: RealSupabaseClient,
  teamId: string,
  options?: {
    includeTemplates?: boolean;
    limit?: number;
  }
): Promise<PracticePlanData[]> {
  const plans = await fetchPracticePlans(supabase, teamId, options);

  // For each plan, get the count of periods and drills
  const plansWithDetails = await Promise.all(
    plans.map(async (plan) => {
      // Get period count
      const { count: periodsCount } = await supabase
        .from('practice_periods')
        .select('id', { count: 'exact', head: true })
        .eq('practice_plan_id', plan.id);

      // Get total drills count across all periods
      const { data: periods } = await supabase
        .from('practice_periods')
        .select('id')
        .eq('practice_plan_id', plan.id);

      let drillsCount = 0;
      if (periods && periods.length > 0) {
        const periodIds = periods.map(p => p.id);
        const { count } = await supabase
          .from('practice_drills')
          .select('id', { count: 'exact', head: true })
          .in('period_id', periodIds);
        drillsCount = count || 0;
      }

      return {
        ...plan,
        periods_count: periodsCount || 0,
        drills_count: drillsCount,
      };
    })
  );

  return plansWithDetails;
}

/**
 * Fetch a specific practice plan with full details (periods and drills)
 */
export async function fetchPracticePlanById(
  supabase: RealSupabaseClient,
  practiceId: string
): Promise<PracticePlanWithDetails | null> {
  // Fetch the practice plan
  const { data: plan, error: planError } = await supabase
    .from('practice_plans')
    .select('*')
    .eq('id', practiceId)
    .single();

  if (planError || !plan) {
    console.error('Error fetching practice plan:', planError);
    return null;
  }

  // Fetch periods for this practice
  const { data: periods, error: periodsError } = await supabase
    .from('practice_periods')
    .select('*')
    .eq('practice_plan_id', practiceId)
    .order('period_order', { ascending: true });

  if (periodsError) {
    console.error('Error fetching practice periods:', periodsError);
    return null;
  }

  // Fetch drills for all periods
  const periodIds = (periods || []).map(p => p.id);
  let drills: PracticeDrillData[] = [];

  if (periodIds.length > 0) {
    const { data: drillsData, error: drillsError } = await supabase
      .from('practice_drills')
      .select('*')
      .in('period_id', periodIds)
      .order('drill_order', { ascending: true });

    if (drillsError) {
      console.error('Error fetching practice drills:', drillsError);
    } else {
      drills = (drillsData || []) as PracticeDrillData[];
    }
  }

  // Build the nested structure
  const periodsWithDrills = (periods || []).map(period => ({
    ...period as PracticePeriodData,
    drills: drills.filter(d => d.period_id === period.id),
  }));

  return {
    ...(plan as PracticePlanData),
    periods: periodsWithDrills,
  };
}

/**
 * Fetch the most recent practice with full details
 */
export async function fetchLastPracticeWithDetails(
  supabase: RealSupabaseClient,
  teamId: string
): Promise<PracticePlanWithDetails | null> {
  const today = new Date().toISOString().split('T')[0];

  // Get the most recent past practice
  const { data, error } = await supabase
    .from('practice_plans')
    .select('id')
    .eq('team_id', teamId)
    .eq('is_template', false)
    .lt('date', today)
    .order('date', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return fetchPracticePlanById(supabase, data[0].id);
}

/**
 * Fetch the next upcoming practice with full details
 */
export async function fetchNextPracticeWithDetails(
  supabase: RealSupabaseClient,
  teamId: string
): Promise<PracticePlanWithDetails | null> {
  const today = new Date().toISOString().split('T')[0];

  // Get the next upcoming practice
  const { data, error } = await supabase
    .from('practice_plans')
    .select('id')
    .eq('team_id', teamId)
    .eq('is_template', false)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return fetchPracticePlanById(supabase, data[0].id);
}
