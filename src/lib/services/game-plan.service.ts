// Game Plan Service
// Handles CRUD operations for game plans and situational play organization

import { createClient } from '@/utils/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  GamePlan,
  GamePlanPlayExtended,
  GamePlanPlayWithDetails,
  PlaybookPlay,
  SituationalCategoryId,
  PlayTypeCategoryId,
  Game
} from '@/types/football';
import { getSituationOrder, inferPlayTypeCategory } from '@/config/gamePlanCategories';

/**
 * Side type for offense/defense/special_teams game plans
 */
export type GamePlanSide = 'offense' | 'defense' | 'special_teams';

/**
 * Game plan with plays organized by situation and side
 */
export interface GamePlanWithPlays extends GamePlan {
  game?: Game;
  playsBySituation: Record<string, GamePlanPlayWithDetails[]>;
  offensivePlaysBySituation: Record<string, GamePlanPlayWithDetails[]>;
  defensivePlaysBySituation: Record<string, GamePlanPlayWithDetails[]>;
  specialTeamsPlaysBySituation: Record<string, GamePlanPlayWithDetails[]>;
  totalPlays: number;
  offensePlays: number;
  defensePlays: number;
  specialTeamsPlays: number;
}

/**
 * Get or create a game plan for a specific game
 * @param supabaseClient - Optional Supabase client (for server-side calls, pass the server client)
 */
export async function getOrCreateGamePlan(
  gameId: string,
  teamId: string,
  supabaseClient?: SupabaseClient
): Promise<GamePlan> {
  const supabase = supabaseClient || createClient();

  // First try to find existing game plan for this game
  const { data: existing, error: fetchError } = await supabase
    .from('game_plans')
    .select('*')
    .eq('game_id', gameId)
    .eq('team_id', teamId)
    .single();

  if (existing && !fetchError) {
    return existing as GamePlan;
  }

  // Get game details for the name
  const { data: game } = await supabase
    .from('games')
    .select('opponent, date')
    .eq('id', gameId)
    .single();

  const gameName = game
    ? `vs ${game.opponent} - ${new Date(game.date).toLocaleDateString()}`
    : 'Game Plan';

  // Create new game plan
  const { data: newPlan, error: createError } = await supabase
    .from('game_plans')
    .insert({
      team_id: teamId,
      game_id: gameId,
      name: gameName,
      wristband_format: '2col'
    })
    .select()
    .single();

  if (createError) {
    throw new Error(`Failed to create game plan: ${createError.message}`);
  }

  return newPlan as GamePlan;
}

/**
 * Get a game plan by ID with all plays organized by situation
 */
export async function getGamePlanWithPlays(
  gamePlanId: string,
  supabaseClient?: SupabaseClient
): Promise<GamePlanWithPlays> {
  const supabase = supabaseClient || createClient();

  // Get game plan
  const { data: gamePlan, error: planError } = await supabase
    .from('game_plans')
    .select('*, games(*)')
    .eq('id', gamePlanId)
    .single();

  if (planError) {
    throw new Error(`Failed to fetch game plan: ${planError.message}`);
  }

  // Get all plays in this game plan
  const { data: plays, error: playsError } = await supabase
    .from('game_plan_plays')
    .select('*')
    .eq('game_plan_id', gamePlanId)
    .order('sort_order', { ascending: true });

  if (playsError) {
    throw new Error(`Failed to fetch game plan plays: ${playsError.message}`);
  }

  // Get playbook details for each play
  const playCodes = plays?.map(p => p.play_code) || [];

  let playbookPlays: PlaybookPlay[] = [];
  if (playCodes.length > 0) {
    const { data: playbook } = await supabase
      .from('playbook_plays')
      .select('*')
      .in('play_code', playCodes);

    playbookPlays = (playbook as PlaybookPlay[]) || [];
  }

  // Create a lookup map for playbook plays
  const playbookMap = new Map(playbookPlays.map(p => [p.play_code, p]));

  // Organize plays by situation and side
  const playsBySituation: Record<string, GamePlanPlayWithDetails[]> = {};
  const offensivePlaysBySituation: Record<string, GamePlanPlayWithDetails[]> = {};
  const defensivePlaysBySituation: Record<string, GamePlanPlayWithDetails[]> = {};
  const specialTeamsPlaysBySituation: Record<string, GamePlanPlayWithDetails[]> = {};

  let offensePlays = 0;
  let defensePlays = 0;
  let specialTeamsPlays = 0;

  for (const play of (plays || [])) {
    const situation = play.situation || 'unassigned';
    const playbookPlay = playbookMap.get(play.play_code);
    const side = play.side || 'offense'; // Default to offense for backward compatibility

    const playWithDetails = {
      ...play,
      play: playbookPlay
    } as GamePlanPlayWithDetails;

    // Add to all plays by situation (legacy/combined view)
    if (!playsBySituation[situation]) {
      playsBySituation[situation] = [];
    }
    playsBySituation[situation].push(playWithDetails);

    // Add to side-specific collections
    if (side === 'defense') {
      defensePlays++;
      if (!defensivePlaysBySituation[situation]) {
        defensivePlaysBySituation[situation] = [];
      }
      defensivePlaysBySituation[situation].push(playWithDetails);
    } else if (side === 'special_teams') {
      specialTeamsPlays++;
      if (!specialTeamsPlaysBySituation[situation]) {
        specialTeamsPlaysBySituation[situation] = [];
      }
      specialTeamsPlaysBySituation[situation].push(playWithDetails);
    } else {
      offensePlays++;
      if (!offensivePlaysBySituation[situation]) {
        offensivePlaysBySituation[situation] = [];
      }
      offensivePlaysBySituation[situation].push(playWithDetails);
    }
  }

  // Sort situations by display order
  const sortedPlaysBySituation: Record<string, GamePlanPlayWithDetails[]> = {};
  const situationKeys = Object.keys(playsBySituation).sort(
    (a, b) => getSituationOrder(a) - getSituationOrder(b)
  );

  for (const key of situationKeys) {
    sortedPlaysBySituation[key] = playsBySituation[key];
  }

  // Sort offensive plays by situation
  const sortedOffensivePlaysBySituation: Record<string, GamePlanPlayWithDetails[]> = {};
  const offenseKeys = Object.keys(offensivePlaysBySituation).sort(
    (a, b) => getSituationOrder(a) - getSituationOrder(b)
  );

  for (const key of offenseKeys) {
    sortedOffensivePlaysBySituation[key] = offensivePlaysBySituation[key];
  }

  // Sort defensive plays by situation
  const sortedDefensivePlaysBySituation: Record<string, GamePlanPlayWithDetails[]> = {};
  const defenseKeys = Object.keys(defensivePlaysBySituation).sort(
    (a, b) => getSituationOrder(a) - getSituationOrder(b)
  );

  for (const key of defenseKeys) {
    sortedDefensivePlaysBySituation[key] = defensivePlaysBySituation[key];
  }

  // Sort special teams plays by situation
  const sortedSpecialTeamsPlaysBySituation: Record<string, GamePlanPlayWithDetails[]> = {};
  const stKeys = Object.keys(specialTeamsPlaysBySituation).sort(
    (a, b) => getSituationOrder(a) - getSituationOrder(b)
  );

  for (const key of stKeys) {
    sortedSpecialTeamsPlaysBySituation[key] = specialTeamsPlaysBySituation[key];
  }

  return {
    ...gamePlan,
    game: gamePlan.games as Game,
    playsBySituation: sortedPlaysBySituation,
    offensivePlaysBySituation: sortedOffensivePlaysBySituation,
    defensivePlaysBySituation: sortedDefensivePlaysBySituation,
    specialTeamsPlaysBySituation: sortedSpecialTeamsPlaysBySituation,
    totalPlays: plays?.length || 0,
    offensePlays,
    defensePlays,
    specialTeamsPlays
  } as GamePlanWithPlays;
}

/**
 * Add a play to a game plan situation
 * @param side - The side (offense/defense) for the play. Defaults to 'offense'.
 */
export async function addPlayToSituation(
  gamePlanId: string,
  playCode: string,
  situation: SituationalCategoryId,
  playTypeCategory?: PlayTypeCategoryId,
  side: GamePlanSide = 'offense'
): Promise<void> {
  const supabase = createClient();

  // Get the current max call number and sort order for this side
  const { data: existingPlays } = await supabase
    .from('game_plan_plays')
    .select('call_number, sort_order')
    .eq('game_plan_id', gamePlanId)
    .eq('side', side)
    .order('call_number', { ascending: false })
    .limit(1);

  const nextCallNumber = (existingPlays?.[0]?.call_number || 0) + 1;
  const nextSortOrder = (existingPlays?.[0]?.sort_order || 0) + 1;

  // If no play type category provided, try to infer from playbook
  let finalPlayTypeCategory = playTypeCategory;
  if (!finalPlayTypeCategory) {
    const { data: play } = await supabase
      .from('playbook_plays')
      .select('attributes')
      .eq('play_code', playCode)
      .single();

    if (play?.attributes) {
      finalPlayTypeCategory = inferPlayTypeCategory(play.attributes) as PlayTypeCategoryId;
    }
  }

  const { error } = await supabase
    .from('game_plan_plays')
    .insert({
      game_plan_id: gamePlanId,
      play_code: playCode,
      call_number: nextCallNumber,
      sort_order: nextSortOrder,
      situation,
      play_type_category: finalPlayTypeCategory,
      side
    });

  if (error) {
    throw new Error(`Failed to add play to game plan: ${error.message}`);
  }
}

/**
 * Remove a play from a game plan situation
 */
export async function removePlayFromGamePlan(
  gamePlanId: string,
  playCode: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('game_plan_plays')
    .delete()
    .eq('game_plan_id', gamePlanId)
    .eq('play_code', playCode);

  if (error) {
    throw new Error(`Failed to remove play from game plan: ${error.message}`);
  }
}

/**
 * Update a play's situation or notes
 */
export async function updateGamePlanPlay(
  gamePlanPlayId: string,
  updates: {
    situation?: SituationalCategoryId;
    play_type_category?: PlayTypeCategoryId;
    notes?: string;
    sort_order?: number;
  }
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('game_plan_plays')
    .update(updates)
    .eq('id', gamePlanPlayId);

  if (error) {
    throw new Error(`Failed to update game plan play: ${error.message}`);
  }
}

/**
 * Reorder plays within a situation
 */
export async function reorderPlays(
  gamePlanId: string,
  situation: SituationalCategoryId,
  playOrders: { id: string; sortOrder: number }[]
): Promise<void> {
  const supabase = createClient();

  // Update each play's sort order
  for (const { id, sortOrder } of playOrders) {
    const { error } = await supabase
      .from('game_plan_plays')
      .update({ sort_order: sortOrder })
      .eq('id', id)
      .eq('game_plan_id', gamePlanId);

    if (error) {
      throw new Error(`Failed to reorder plays: ${error.message}`);
    }
  }
}

/**
 * Get all plays in a game plan organized by situation and play type
 */
export async function getPlaysBySituationAndType(
  gamePlanId: string
): Promise<Record<string, Record<string, GamePlanPlayWithDetails[]>>> {
  const gamePlan = await getGamePlanWithPlays(gamePlanId);

  const result: Record<string, Record<string, GamePlanPlayWithDetails[]>> = {};

  for (const [situation, plays] of Object.entries(gamePlan.playsBySituation)) {
    result[situation] = {};

    for (const play of plays) {
      const playType = play.play_type_category || 'unassigned';

      if (!result[situation][playType]) {
        result[situation][playType] = [];
      }

      result[situation][playType].push(play);
    }
  }

  return result;
}

/**
 * Update game plan settings
 */
export async function updateGamePlan(
  gamePlanId: string,
  updates: {
    name?: string;
    description?: string;
    wristband_format?: '3x5' | '4x6' | '2col';
  }
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('game_plans')
    .update(updates)
    .eq('id', gamePlanId);

  if (error) {
    throw new Error(`Failed to update game plan: ${error.message}`);
  }
}

/**
 * Delete a game plan
 */
export async function deleteGamePlan(gamePlanId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('game_plans')
    .delete()
    .eq('id', gamePlanId);

  if (error) {
    throw new Error(`Failed to delete game plan: ${error.message}`);
  }
}

/**
 * Copy a game plan to a new game
 */
export async function copyGamePlan(
  sourceGamePlanId: string,
  targetGameId: string,
  teamId: string
): Promise<GamePlan> {
  const supabase = createClient();

  // Get source game plan
  const { data: source, error: sourceError } = await supabase
    .from('game_plans')
    .select('*')
    .eq('id', sourceGamePlanId)
    .single();

  if (sourceError) {
    throw new Error(`Failed to fetch source game plan: ${sourceError.message}`);
  }

  // Get target game details
  const { data: game } = await supabase
    .from('games')
    .select('opponent, date')
    .eq('id', targetGameId)
    .single();

  const gameName = game
    ? `vs ${game.opponent} - ${new Date(game.date).toLocaleDateString()}`
    : 'Game Plan';

  // Create new game plan
  const { data: newPlan, error: createError } = await supabase
    .from('game_plans')
    .insert({
      team_id: teamId,
      game_id: targetGameId,
      name: gameName,
      description: source.description,
      wristband_format: source.wristband_format
    })
    .select()
    .single();

  if (createError) {
    throw new Error(`Failed to create game plan: ${createError.message}`);
  }

  // Get source plays
  const { data: sourcePlays } = await supabase
    .from('game_plan_plays')
    .select('*')
    .eq('game_plan_id', sourceGamePlanId);

  // Copy plays to new game plan
  if (sourcePlays && sourcePlays.length > 0) {
    const newPlays = sourcePlays.map(play => ({
      game_plan_id: newPlan.id,
      play_code: play.play_code,
      call_number: play.call_number,
      sort_order: play.sort_order,
      situation: play.situation,
      play_type_category: play.play_type_category,
      notes: play.notes,
      side: play.side || 'offense' // Preserve side when copying
    }));

    const { error: copyError } = await supabase
      .from('game_plan_plays')
      .insert(newPlays);

    if (copyError) {
      throw new Error(`Failed to copy plays: ${copyError.message}`);
    }
  }

  return newPlan as GamePlan;
}

/**
 * Check if a play is already in a game plan (for a specific side)
 * @param side - Optional side to check. If not provided, checks both sides.
 */
export async function isPlayInGamePlan(
  gamePlanId: string,
  playCode: string,
  side?: GamePlanSide
): Promise<boolean> {
  const supabase = createClient();

  let query = supabase
    .from('game_plan_plays')
    .select('id')
    .eq('game_plan_id', gamePlanId)
    .eq('play_code', playCode);

  // If side specified, only check that side
  if (side) {
    query = query.eq('side', side);
  }

  const { data, error } = await query.limit(1);

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to check play: ${error.message}`);
  }

  return data && data.length > 0;
}

/**
 * Get all game plans for a team
 */
export async function getTeamGamePlans(teamId: string): Promise<GamePlan[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('game_plans')
    .select('*, games(opponent, date)')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch game plans: ${error.message}`);
  }

  return data as GamePlan[];
}
