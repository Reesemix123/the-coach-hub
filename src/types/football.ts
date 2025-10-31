// src/types/football.ts
// TypeScript types matching database schema and footballConfig.ts

/**
 * Player position on the field (for diagram)
 */
export interface Player {
  position: string;
  x: number;
  y: number;
  label: string;
  assignment?: string;
  blockType?: string;           
  blockResponsibility?: string;
  isPrimary?: boolean;
  // Pre-snap motion (NEW)
  motionType?: 'None' | 'Jet' | 'Orbit' | 'Across' | 'Return' | 'Shift';
  motionDirection?: 'toward-center' | 'away-from-center';
  motionEndpoint?: { x: number; y: number }; // Draggable endpoint for motion path
}

/**
 * Route path for a player
 */
export interface Route {
  id: string;
  playerId: string;
  path: { x: number; y: number }[];
  type: 'pass' | 'run' | 'block';
  routeType?: string;
  isPrimary?: boolean;
}

/**
 * Play diagram stored in database (players + routes)
 */
export interface PlayDiagram {
  players: Player[];
  routes: Route[];
  formation: string;
  odk: 'offense' | 'defense' | 'specialTeams';
  fieldPosition?: {
    yard: number;
    hash: 'left' | 'middle' | 'right';
  };
}

/**
 * Play attributes (matches footballConfig.ts PlayAttributes)
 * Stored as JSONB in database
 */
export interface PlayAttributes {
  // Required
  odk: 'offense' | 'defense' | 'specialTeams';
  formation: string;
  
  // Common optional
  downDistance?: string;
  fieldZone?: string;
  hash?: string;
  gameContext?: string[];
  customTags?: string[];
  
  // Offensive
  playType?: string;
  personnel?: string;
  runConcept?: string;
  passConcept?: string;
  protection?: string;
  motion?: string;
  targetHole?: string;
  ballCarrier?: string;
  
  // Defensive
  front?: string;
  coverage?: string;
  blitzType?: string;
  stunt?: string;
  pressLevel?: string;
  
  // Special Teams
  unit?: string;
  kickoffType?: string;
  puntType?: string;
  returnScheme?: string;
  
  // Film analysis result
  result?: {
    outcome?: string;
    yardsGained?: number;
    isSuccess?: boolean;
    notes?: string;
  };
}

/**
 * Database table: playbook_plays
 */
export interface PlaybookPlay {
  id: string;
  team_id: string | null;
  play_code: string;
  play_name: string;
  
  // Main data stored as JSONB
  attributes: PlayAttributes;
  diagram: PlayDiagram;
  
  // Optional metadata
  page_number?: number;
  image_url?: string;
  pdf_url?: string;
  extracted_text?: string;
  extraction_confidence?: string;
  comments?: string;
  is_archived: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Database table: teams
 */
export interface Team {
  id: string;
  name: string;
  level: string;
  colors: {
    primary?: string;
    secondary?: string;
  };
  user_id: string;
  created_at: string;
}

/**
 * Database table: games
 */
export interface Game {
  id: string;
  name: string;
  date?: string;
  opponent?: string;
  team_id?: string;
  user_id: string;
  created_at: string;
}

/**
 * Database table: videos
 */
export interface Video {
  id: string;
  name: string;
  file_path?: string;
  url?: string;
  game_id: string;
  created_at: string;
}

/**
 * Database table: players (roster management)
 */
export interface PlayerRecord {
  id: string;
  team_id: string;
  jersey_number: string;
  first_name: string;
  last_name: string;
  primary_position: string;
  secondary_position?: string;
  position_group: 'offense' | 'defense' | 'special_teams';
  depth_order: number;
  is_active: boolean;
  grade_level?: string;
  weight?: number;
  height?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Database table: play_results (to be created - for film analysis)
 */
export interface PlayResult {
  id: string;
  film_clip_id: string;
  play_id?: string; // Links to playbook_plays
  
  // Context
  down: number;
  distance: number;
  yard_line: number;
  hash_mark: 'left' | 'middle' | 'right';
  
  // What happened
  result: string; // 'completion', 'gain', 'touchdown', etc.
  yards_gained: number;
  
  // Analysis
  defensive_formation?: string;
  was_successful: boolean;
  notes?: string;
  
  created_at: string;
}

/**
 * Helper type for creating new plays
 */
export type NewPlay = Omit<PlaybookPlay, 'id' | 'created_at' | 'updated_at'>;

/**
 * Helper type for updating plays
 */
export type PlayUpdate = Partial<Omit<PlaybookPlay, 'id' | 'created_at'>>;

export const RESULT_TYPES = [
  { value: 'rush_gain', label: 'Rush - Gain' },
  { value: 'rush_loss', label: 'Rush - Loss' },
  { value: 'rush_no_gain', label: 'Rush - No Gain' },
  { value: 'pass_complete', label: 'Pass - Complete' },
  { value: 'pass_incomplete', label: 'Pass - Incomplete' },
  { value: 'pass_interception', label: 'Pass - Interception' },
  { value: 'pass_sack', label: 'Pass - Sack' },
  { value: 'touchdown', label: 'Touchdown' },
  { value: 'fumble_lost', label: 'Fumble - Lost' },
  { value: 'fumble_recovered', label: 'Fumble - Recovered' },
  { value: 'penalty', label: 'Penalty' },
];

// ============================================
// MULTI-COACH & ANALYTICS TYPES (Phase 1)
// ============================================

/**
 * Database table: team_memberships
 * Multi-coach collaboration with role-based access
 */
export interface TeamMembership {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'coach' | 'analyst' | 'viewer';
  invited_by?: string;
  invited_at: string;
  joined_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Database table: team_analytics_config
 * Per-team analytics tier selection
 */
export type AnalyticsTier = 'little_league' | 'hs_basic' | 'hs_advanced' | 'ai_powered';

export interface TeamAnalyticsConfig {
  team_id: string;
  tier: AnalyticsTier;
  enable_drive_analytics: boolean;
  enable_player_attribution: boolean;
  enable_ol_tracking: boolean;
  enable_defensive_tracking: boolean;
  enable_situational_splits: boolean;
  default_tagging_mode: 'quick' | 'standard' | 'advanced';
  updated_at: string;
  updated_by?: string;
}

/**
 * Database table: drives
 * Drive-level analytics for Points Per Drive, 3-and-outs, etc.
 */
export interface Drive {
  id: string;
  game_id: string;
  team_id?: string;
  drive_number: number;
  quarter: number;
  start_time?: number;
  end_time?: number;
  start_yard_line: number;
  end_yard_line: number;
  plays_count: number;
  yards_gained: number;
  first_downs: number;
  result: 'touchdown' | 'field_goal' | 'punt' | 'turnover' | 'downs' | 'end_half' | 'end_game' | 'safety';
  points: number;
  three_and_out: boolean;
  reached_red_zone: boolean;
  scoring_drive: boolean;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Database table: play_instances (enhanced with analytics fields)
 * Represents a single play from game film with comprehensive tracking
 */
export interface PlayInstance {
  id: string;
  video_id: string;
  play_code?: string;
  team_id?: string;

  // Timing
  timestamp_start: number;
  timestamp_end?: number;

  // Context (Tier 1+)
  down: number;
  distance: number;
  yard_line: number;
  hash_mark: 'left' | 'middle' | 'right';
  quarter?: number;
  time_remaining?: number;
  score_differential?: number;

  // Outcome
  result?: string;
  yards_gained: number;
  resulted_in_first_down?: boolean;
  is_turnover?: boolean;
  turnover_type?: string;

  // Player attribution (Tier 1-2)
  player_id?: string; // Legacy field
  ball_carrier_id?: string;
  qb_id?: string;
  target_id?: string;

  // Play classification (Tier 2+)
  formation?: string;
  play_type?: 'run' | 'pass' | 'screen' | 'rpo' | 'trick' | 'kick' | 'pat' | 'two_point';
  direction?: 'left' | 'middle' | 'right';

  // Drive linkage (Tier 2+)
  drive_id?: string;

  // Derived metrics (auto-computed)
  success?: boolean;
  explosive?: boolean;

  // Offensive line (Tier 3)
  lt_id?: string;
  lt_block_result?: 'win' | 'loss' | 'neutral';
  lg_id?: string;
  lg_block_result?: 'win' | 'loss' | 'neutral';
  c_id?: string;
  c_block_result?: 'win' | 'loss' | 'neutral';
  rg_id?: string;
  rg_block_result?: 'win' | 'loss' | 'neutral';
  rt_id?: string;
  rt_block_result?: 'win' | 'loss' | 'neutral';
  ol_penalty_player_id?: string;

  // Defensive tracking (Tier 3)
  tackler_ids?: string[];
  missed_tackle_ids?: string[];
  pressure_player_ids?: string[];
  sack_player_id?: string;
  coverage_player_id?: string;
  coverage_result?: 'win' | 'loss' | 'neutral';

  // Defensive events (Tier 3)
  is_tfl?: boolean;
  is_sack?: boolean;
  is_forced_fumble?: boolean;
  is_pbu?: boolean;
  is_interception?: boolean;
  contain_set_edge?: boolean;

  // QB grading (Tier 3)
  qb_decision_grade?: 0 | 1 | 2; // 0=bad, 1=ok, 2=great

  // Situational (Tier 3)
  has_motion?: boolean;
  is_play_action?: boolean;
  facing_blitz?: boolean;
  box_count?: number;
  target_depth?: 'behind_los' | 'short' | 'intermediate' | 'deep';
  pass_location?: 'left' | 'middle' | 'right';
  play_concept?: string;

  // Multi-coach attribution
  tagged_by_user_id?: string;
  reviewed_by_user_id?: string;
  last_edited_at?: string;

  // Legacy fields
  is_opponent_play?: boolean;
  notes?: string;
  tags?: any;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Helper type for creating new play instances
 */
export type NewPlayInstance = Omit<PlayInstance, 'id' | 'created_at' | 'updated_at' | 'success' | 'explosive'>;

/**
 * Helper type for updating play instances
 */
export type PlayInstanceUpdate = Partial<Omit<PlayInstance, 'id' | 'created_at'>>;