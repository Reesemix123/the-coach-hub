// Setup/Counter Play Relationship Service
// Manages relationships between setup plays and their counter plays

import { createClient } from '@/utils/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PlayRelationship,
  PlayRelationshipWithDetails,
  GamePlanCounterStatus,
  GamePlanCounterStatusWithDetails,
  KeyDefensivePosition,
  KeyIndicatorId,
  NewPlayRelationship
} from '@/types/football';

/**
 * Create a new setup/counter play relationship
 */
export async function createPlayRelationship(
  teamId: string,
  setupPlayCode: string,
  counterPlayCode: string,
  keyPosition?: KeyDefensivePosition,
  keyIndicator?: KeyIndicatorId,
  notes?: string
): Promise<PlayRelationship> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('play_relationships')
    .insert({
      team_id: teamId,
      setup_play_code: setupPlayCode,
      counter_play_code: counterPlayCode,
      key_position: keyPosition,
      key_indicator: keyIndicator,
      notes
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create play relationship: ${error.message}`);
  }

  return data as PlayRelationship;
}

/**
 * Get all play relationships for a team
 * @param supabaseClient - Optional Supabase client (for server-side calls)
 */
export async function getTeamPlayRelationships(
  teamId: string,
  supabaseClient?: SupabaseClient
): Promise<PlayRelationshipWithDetails[]> {
  const supabase = supabaseClient || createClient();

  // Get relationships
  const { data: relationships, error } = await supabase
    .from('play_relationships')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch play relationships: ${error.message}`);
  }

  if (!relationships || relationships.length === 0) {
    return [];
  }

  // Get all unique play codes
  const playCodes = new Set<string>();
  for (const rel of relationships) {
    playCodes.add(rel.setup_play_code);
    playCodes.add(rel.counter_play_code);
  }

  // Fetch play details
  const { data: plays } = await supabase
    .from('playbook_plays')
    .select('*')
    .in('play_code', Array.from(playCodes));

  const playMap = new Map((plays || []).map(p => [p.play_code, p]));

  // Attach play details to relationships
  return relationships.map(rel => ({
    ...rel,
    setup_play: playMap.get(rel.setup_play_code),
    counter_play: playMap.get(rel.counter_play_code)
  })) as PlayRelationshipWithDetails[];
}

/**
 * Get relationships where a specific play is the setup play
 */
export async function getCountersForPlay(
  teamId: string,
  setupPlayCode: string
): Promise<PlayRelationshipWithDetails[]> {
  const supabase = createClient();

  const { data: relationships, error } = await supabase
    .from('play_relationships')
    .select('*')
    .eq('team_id', teamId)
    .eq('setup_play_code', setupPlayCode);

  if (error) {
    throw new Error(`Failed to fetch counters for play: ${error.message}`);
  }

  if (!relationships || relationships.length === 0) {
    return [];
  }

  // Get counter play details
  const counterCodes = relationships.map(r => r.counter_play_code);
  const { data: plays } = await supabase
    .from('playbook_plays')
    .select('*')
    .in('play_code', counterCodes);

  const playMap = new Map((plays || []).map(p => [p.play_code, p]));

  return relationships.map(rel => ({
    ...rel,
    counter_play: playMap.get(rel.counter_play_code)
  })) as PlayRelationshipWithDetails[];
}

/**
 * Get relationships where a specific play is the counter play
 */
export async function getSetupsForCounterPlay(
  teamId: string,
  counterPlayCode: string
): Promise<PlayRelationshipWithDetails[]> {
  const supabase = createClient();

  const { data: relationships, error } = await supabase
    .from('play_relationships')
    .select('*')
    .eq('team_id', teamId)
    .eq('counter_play_code', counterPlayCode);

  if (error) {
    throw new Error(`Failed to fetch setups for counter play: ${error.message}`);
  }

  if (!relationships || relationships.length === 0) {
    return [];
  }

  // Get setup play details
  const setupCodes = relationships.map(r => r.setup_play_code);
  const { data: plays } = await supabase
    .from('playbook_plays')
    .select('*')
    .in('play_code', setupCodes);

  const playMap = new Map((plays || []).map(p => [p.play_code, p]));

  return relationships.map(rel => ({
    ...rel,
    setup_play: playMap.get(rel.setup_play_code)
  })) as PlayRelationshipWithDetails[];
}

/**
 * Update a play relationship
 */
export async function updatePlayRelationship(
  relationshipId: string,
  updates: {
    key_position?: KeyDefensivePosition;
    key_indicator?: KeyIndicatorId;
    notes?: string;
  }
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('play_relationships')
    .update(updates)
    .eq('id', relationshipId);

  if (error) {
    throw new Error(`Failed to update play relationship: ${error.message}`);
  }
}

/**
 * Delete a play relationship
 */
export async function deletePlayRelationship(relationshipId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('play_relationships')
    .delete()
    .eq('id', relationshipId);

  if (error) {
    throw new Error(`Failed to delete play relationship: ${error.message}`);
  }
}

/**
 * Mark a counter as ready for a specific game plan
 */
export async function markCounterReady(
  gamePlanId: string,
  relationshipId: string,
  isReady: boolean,
  notes?: string
): Promise<GamePlanCounterStatus> {
  const supabase = createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Upsert the counter status
  const { data, error } = await supabase
    .from('game_plan_counter_status')
    .upsert({
      game_plan_id: gamePlanId,
      relationship_id: relationshipId,
      is_ready: isReady,
      marked_at: isReady ? new Date().toISOString() : null,
      marked_by: isReady ? user?.id : null,
      notes
    }, {
      onConflict: 'game_plan_id,relationship_id'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update counter status: ${error.message}`);
  }

  return data as GamePlanCounterStatus;
}

/**
 * Get all counter statuses for a game plan
 */
export async function getGamePlanCounterStatuses(
  gamePlanId: string
): Promise<GamePlanCounterStatusWithDetails[]> {
  const supabase = createClient();

  // Get counter statuses
  const { data: statuses, error } = await supabase
    .from('game_plan_counter_status')
    .select('*')
    .eq('game_plan_id', gamePlanId);

  if (error) {
    throw new Error(`Failed to fetch counter statuses: ${error.message}`);
  }

  if (!statuses || statuses.length === 0) {
    return [];
  }

  // Get relationship details
  const relationshipIds = statuses.map(s => s.relationship_id);
  const { data: relationships } = await supabase
    .from('play_relationships')
    .select('*')
    .in('id', relationshipIds);

  // Get play details
  const playCodes = new Set<string>();
  for (const rel of relationships || []) {
    playCodes.add(rel.setup_play_code);
    playCodes.add(rel.counter_play_code);
  }

  const { data: plays } = await supabase
    .from('playbook_plays')
    .select('*')
    .in('play_code', Array.from(playCodes));

  const playMap = new Map((plays || []).map(p => [p.play_code, p]));
  const relationshipMap = new Map((relationships || []).map(r => [r.id, {
    ...r,
    setup_play: playMap.get(r.setup_play_code),
    counter_play: playMap.get(r.counter_play_code)
  }]));

  return statuses.map(status => ({
    ...status,
    relationship: relationshipMap.get(status.relationship_id)
  })) as GamePlanCounterStatusWithDetails[];
}

/**
 * Get ready counters for a game plan (where is_ready = true)
 */
export async function getReadyCounters(
  gamePlanId: string
): Promise<GamePlanCounterStatusWithDetails[]> {
  const allStatuses = await getGamePlanCounterStatuses(gamePlanId);
  return allStatuses.filter(s => s.is_ready);
}

/**
 * Check if a specific counter is ready for a game plan
 */
export async function isCounterReady(
  gamePlanId: string,
  relationshipId: string
): Promise<boolean> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('game_plan_counter_status')
    .select('is_ready')
    .eq('game_plan_id', gamePlanId)
    .eq('relationship_id', relationshipId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to check counter status: ${error.message}`);
  }

  return data?.is_ready ?? false;
}

/**
 * Get a map of all counter statuses for a game plan (for efficient lookup)
 */
export async function getCounterStatusMap(
  gamePlanId: string
): Promise<Map<string, boolean>> {
  const statuses = await getGamePlanCounterStatuses(gamePlanId);
  return new Map(statuses.map(s => [s.relationship_id, s.is_ready]));
}

/**
 * Check if a play has any linked counter relationships
 */
export async function hasCounterRelationship(
  teamId: string,
  playCode: string
): Promise<boolean> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('play_relationships')
    .select('id')
    .eq('team_id', teamId)
    .or(`setup_play_code.eq.${playCode},counter_play_code.eq.${playCode}`)
    .limit(1);

  if (error) {
    console.error('Error checking counter relationships:', error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Get all relationships for a specific play (as either setup or counter)
 */
export async function getPlayRelationships(
  teamId: string,
  playCode: string
): Promise<{
  asSetup: PlayRelationshipWithDetails[];
  asCounter: PlayRelationshipWithDetails[];
}> {
  const [asSetup, asCounter] = await Promise.all([
    getCountersForPlay(teamId, playCode),
    getSetupsForCounterPlay(teamId, playCode)
  ]);

  return { asSetup, asCounter };
}
