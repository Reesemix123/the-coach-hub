/**
 * Semantic Layer Types
 *
 * Core types for the coaching intelligence semantic layer.
 * Used to structure queries about team performance data.
 */

export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: unknown;
}

export interface MetricDefinition {
  name: string;
  description: string;
  unit?: string;
  calculate: (data: PlayData[]) => number | null;
}

export interface SemanticConcept {
  name: string;
  description: string;
  parameters: ParameterDefinition[];
  resolve: (params: ConceptParams, context: QueryContext) => Promise<string>;
}

export interface SemanticLayer {
  metrics: Record<string, MetricDefinition>;
  concepts: Record<string, SemanticConcept>;
  matchQuery: (
    query: string
  ) => Promise<Array<{ concept: SemanticConcept; params: ConceptParams }>>;
}

// Query context for concept resolution
export interface QueryContext {
  userId: string;
  teamId: string;
  supabase: SupabaseClient;
}

// Parameters for concept queries
export interface ConceptParams {
  timeframe?: 'recent' | 'season' | 'all_time' | 'game_specific';
  gameIds?: string[];
  playType?: 'run' | 'pass' | 'all';
  down?: number;
  distance?: 'short' | 'medium' | 'long';
  fieldZone?: 'red_zone' | 'scoring_position' | 'midfield' | 'own_territory';
  formation?: string;
  playerId?: string;
  playerNumber?: string;
  opponent?: string;  // Opponent team name for scouting/comparison queries
  // Playbook search parameters
  targetPosition?: string;  // Position to feature (QB, RB, WR, TE, OL, LT, LG, C, RG, RT, DL, DE, DT, NT, LB, CB, S, K, P, Returner)
  concept?: string;         // Run/pass/defensive/ST concept (power, zone, levels, cover 2, man, blitz, onside, squib)
  personnel?: string;       // Personnel grouping (12, 11, 21)
  odk?: 'offense' | 'defense' | 'special_teams';  // Offense/Defense/Special Teams
  limit?: number;
}

// Play instance data from database
export interface PlayData {
  id: string;
  play_code: string | null;
  team_id: string;
  video_id: string;

  // Context
  down: number | null;
  distance: number | null;
  yard_line: number | null;
  quarter: number | null;

  // Result
  yards_gained: number | null;
  result: string | null;
  success: boolean | null;
  explosive: boolean | null;

  // Classification
  play_type: 'run' | 'pass' | 'screen' | 'rpo' | 'trick' | 'kick' | 'pat' | 'two_point' | null;
  direction: 'left' | 'middle' | 'right' | null;

  // Player attribution
  ball_carrier_id: string | null;
  qb_id: string | null;
  target_id: string | null;

  // Offensive line attribution (Tier 3)
  lt_id?: string | null;
  lt_block_result?: 'win' | 'loss' | 'neutral' | null;
  lg_id?: string | null;
  lg_block_result?: 'win' | 'loss' | 'neutral' | null;
  c_id?: string | null;
  c_block_result?: 'win' | 'loss' | 'neutral' | null;
  rg_id?: string | null;
  rg_block_result?: 'win' | 'loss' | 'neutral' | null;
  rt_id?: string | null;
  rt_block_result?: 'win' | 'loss' | 'neutral' | null;

  // Defensive attribution (Tier 3)
  tackler_ids?: string[] | null;
  pressure_player_ids?: string[] | null;
  coverage_player_id?: string | null;
  coverage_result?: 'win' | 'loss' | 'neutral' | null;
  is_tfl?: boolean | null;
  is_sack?: boolean | null;
  is_pbu?: boolean | null;
  is_forced_fumble?: boolean | null;
  is_opponent_play?: boolean | null;

  // Special teams attribution
  special_teams_unit?: 'kickoff' | 'kick_return' | 'punt' | 'punt_return' | 'field_goal' | 'pat' | string | null;
  kicker_id?: string | null;
  kick_result?: 'made' | 'missed' | 'blocked' | 'touchback' | 'fair_catch' | 'returned' | 'out_of_bounds' | 'onside_recovered' | 'onside_lost' | 'fake_success' | 'fake_fail' | 'muffed' | 'downed' | string | null;
  kick_distance?: number | null;
  returner_id?: string | null;
  return_yards?: number | null;
  is_fair_catch?: boolean | null;
  is_touchback?: boolean | null;
  is_muffed?: boolean | null;
  punter_id?: string | null;
  punt_type?: 'standard' | 'directional_left' | 'directional_right' | 'pooch' | 'rugby' | 'sky' | string | null;
  gunner_tackle_id?: string | null;
  kickoff_type?: 'deep_center' | 'deep_left' | 'deep_right' | 'squib_center' | 'squib_left' | 'squib_right' | 'onside_center' | 'onside_left' | 'onside_right' | string | null;
  long_snapper_id?: string | null;
  snap_quality?: 'good' | 'low' | 'high' | 'wide' | 'fumbled' | string | null;
  holder_id?: string | null;
  coverage_tackler_id?: string | null;

  // Metadata
  created_at: string;

  // Joined data
  playbook_play?: {
    play_name: string;
    attributes: PlaybookAttributes;
  } | null;
  game?: {
    id: string;
    name: string;
    opponent: string;
    date: string;
    game_result: string | null;
  } | null;
  ball_carrier?: {
    id: string;
    jersey_number: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export interface PlaybookAttributes {
  odk?: string;
  formation?: string;
  playType?: string;
  // Offensive attributes
  runConcept?: string;
  passConcept?: string;
  personnel?: string;
  targetHole?: string;
  ballCarrier?: string;
  // Defensive attributes
  coverage?: string;        // Cover 2, Cover 3, Man, etc.
  blitzType?: string;       // Zone blitz, Fire zone, etc.
  defensiveScheme?: string; // 4-3, 3-4, Nickel, etc.
  // Special teams attributes
  specialTeamsType?: string;  // Kickoff, Punt, FG, etc.
  returnType?: string;        // Kick return, Punt return
}

export interface PlaybookPlayData {
  id: string;
  team_id: string | null;
  play_code: string;
  play_name: string;
  attributes: PlaybookAttributes | null;
  page_number: number | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface DriveData {
  id: string;
  game_id: string;
  team_id: string;
  drive_number: number;
  quarter: number | null;
  start_yard_line: number | null;
  end_yard_line: number | null;
  plays_count: number;
  yards_gained: number;
  first_downs: number;
  result: string;
  points: number;
  three_and_out: boolean;
  scoring_drive: boolean;
  reached_red_zone: boolean;
}

export interface PlayerData {
  id: string;
  team_id: string;
  jersey_number: string;
  first_name: string | null;
  last_name: string | null;
  position_depths: Record<string, number>;
  is_active: boolean;
}

export interface GameData {
  id: string;
  team_id: string;
  name: string;
  opponent: string;
  date: string;
  team_score: number | null;
  opponent_score: number | null;
  game_result: 'win' | 'loss' | 'tie' | null;
  // Schedule fields
  location?: string | null;
  start_time?: string | null;
  week_number?: number | null;
  notes?: string | null;
}

// Supabase client type (simplified)
export interface SupabaseClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string | number) => Promise<{ data: unknown[]; error: Error | null }>;
      in: (column: string, values: string[]) => Promise<{ data: unknown[]; error: Error | null }>;
      order: (column: string, options?: { ascending?: boolean }) => {
        limit: (count: number) => Promise<{ data: unknown[]; error: Error | null }>;
      } & Promise<{ data: unknown[]; error: Error | null }>;
      gte: (column: string, value: unknown) => unknown;
      lte: (column: string, value: unknown) => unknown;
      limit: (count: number) => Promise<{ data: unknown[]; error: Error | null }>;
    };
  };
}

// Aggregated stats for formatting
export interface AggregatedStats {
  totalPlays: number;
  totalYards: number;
  avgYards: number;
  successRate: number;
  explosiveRate: number;
  successfulPlays: number;
  explosivePlays: number;
}

export interface FormationStats extends AggregatedStats {
  formation: string;
}

export interface PlayConceptStats extends AggregatedStats {
  playCode: string;
  playName: string;
  playType: string;
}

export interface PlayerStats extends AggregatedStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
}

export interface SituationStats extends AggregatedStats {
  situation: string;
  runPct?: number;
  passPct?: number;
}

export interface TrendData {
  period: string;
  gameId?: string;
  opponent?: string;
  stats: AggregatedStats;
}

// Practice planning data
export interface PracticePlanData {
  id: string;
  team_id: string;
  title: string;
  date: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  is_template: boolean;
  template_name: string | null;
  created_at: string;
  updated_at: string;
  // Aggregated from periods
  periods_count?: number;
  drills_count?: number;
}

export interface PracticePeriodData {
  id: string;
  practice_plan_id: string;
  period_order: number;
  name: string;
  duration_minutes: number;
  period_type: 'warmup' | 'drill' | 'team' | 'special_teams' | 'conditioning' | 'other';
  notes: string | null;
}

export interface PracticeDrillData {
  id: string;
  period_id: string;
  drill_order: number;
  drill_name: string;
  position_group: string | null;
  description: string | null;
  play_codes: string[] | null;
  equipment_needed: string | null;
}

// Full practice plan with nested periods and drills
export interface PracticePlanWithDetails extends PracticePlanData {
  periods: (PracticePeriodData & {
    drills: PracticeDrillData[];
  })[];
}
