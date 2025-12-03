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
  blockDirection?: { x: number; y: number }; // Vector for block arrow direction
  isPrimary?: boolean;
  // Pre-snap motion
  motionType?: 'None' | 'Jet' | 'Orbit' | 'Across' | 'Return' | 'Shift';
  motionDirection?: 'toward-center' | 'away-from-center';
  motionEndpoint?: { x: number; y: number }; // Draggable endpoint for motion path
  // Defensive assignments
  coverageRole?: string;                      // Coverage assignment (Deep Third, Flat, Man, etc.)
  coverageDepth?: string;                     // Coverage depth
  coverageDescription?: string;               // Description of coverage responsibility
  blitzGap?: string;                          // Blitz gap assignment (A, B, C, D)
  zoneEndpoint?: { x: number; y: number };    // Endpoint for zone coverage area or blitz arrow
  // Special teams
  specialTeamsPath?: { x: number; y: number }; // Endpoint for special teams player path/lane
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
  location?: string;
  start_time?: string;
  notes?: string;
  team_score?: number | null;
  opponent_score?: number | null;
  game_result?: 'win' | 'loss' | 'tie' | null;
  is_opponent_game?: boolean;
  opponent_team_name?: string;
  created_at: string;
}

/**
 * Database table: team_events
 */
export interface TeamEvent {
  id: string;
  team_id: string;
  event_type: 'practice' | 'meeting' | 'other';
  title: string;
  description?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  practice_plan_id?: string; // Links to practice_plans table
  created_by?: string;
  created_at: string;
  updated_at: string;
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
  // Virtual video support (simplified approach)
  is_virtual?: boolean;           // True if this is a combined video
  source_video_ids?: string[];    // Array of video IDs that make up this virtual video
  virtual_name?: string;          // Display name for virtual videos
  video_count?: number;           // Number of source videos (1 for regular, N for virtual)
  video_group_id?: string;        // Link to video_group for VirtualVideoPlayer compatibility
}

/**
 * Position-to-depth mapping type
 * Keys are position codes (QB, RB, WR, etc.), values are depth orders (1-4)
 * Example: { "QB": 1, "RB": 2, "S": 3 } = 1st team QB, 2nd team RB, 3rd team Safety
 */
export type PositionDepthMap = {
  [positionCode: string]: number;
};

/**
 * Database table: players (roster management)
 * Multi-position support with per-position depth tracking
 */
export interface PlayerRecord {
  id: string;
  team_id: string;
  jersey_number: string;
  first_name: string;
  last_name: string;

  /**
   * Position-to-depth mapping
   * Example: { "QB": 1, "RB": 2, "S": 3 }
   * - Key: Position code (QB, RB, WR, etc.)
   * - Value: Depth order (1=1st team, 2=2nd team, 3=3rd team, 4=4th team)
   */
  position_depths: PositionDepthMap;

  is_active: boolean;
  grade_level?: string;
  weight?: number;
  height?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Helper type for player form data
 */
export interface PlayerFormData {
  jersey_number: string;
  first_name: string;
  last_name: string;
  position_depths: PositionDepthMap;
  grade_level?: string;
  weight?: number;
  height?: number;
  notes?: string;
}

/**
 * Position depth selection (used in UI forms)
 */
export interface PositionDepthSelection {
  position: string;
  depth: number;
  positionName: string; // Full name for display
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
// SPECIAL TEAMS CONSTANTS
// ============================================

export const SPECIAL_TEAMS_UNITS = [
  { value: 'kickoff', label: 'Kickoff' },
  { value: 'kick_return', label: 'Kick Return' },
  { value: 'punt', label: 'Punt' },
  { value: 'punt_return', label: 'Punt Return' },
  { value: 'field_goal', label: 'Field Goal' },
  { value: 'fg_block', label: 'FG Block' },
  { value: 'pat', label: 'PAT (Extra Point)' },
] as const;

export const KICK_RESULTS = [
  { value: 'made', label: 'Made' },
  { value: 'missed', label: 'Missed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'blocked_recovered', label: 'Blocked - Recovered' },
  { value: 'blocked_returned', label: 'Blocked - Returned' },
  { value: 'blocked_td', label: 'Blocked - Returned for TD' },
  { value: 'blocked_lost', label: 'Blocked - Kicking Team Recovered' },
  { value: 'touchback', label: 'Touchback' },
  { value: 'fair_catch', label: 'Fair Catch' },
  { value: 'returned', label: 'Returned' },
  { value: 'out_of_bounds', label: 'Out of Bounds' },
  { value: 'onside_recovered', label: 'Onside - Recovered' },
  { value: 'onside_lost', label: 'Onside - Lost' },
  { value: 'fake_success', label: 'Fake - Success' },
  { value: 'fake_fail', label: 'Fake - Fail' },
  { value: 'muffed', label: 'Muffed' },
  { value: 'downed', label: 'Downed' },
] as const;

export const PUNT_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'directional_left', label: 'Directional Left' },
  { value: 'directional_right', label: 'Directional Right' },
  { value: 'pooch', label: 'Pooch' },
  { value: 'rugby', label: 'Rugby Style' },
  { value: 'sky', label: 'Sky Punt' },
] as const;

export const KICKOFF_TYPES = [
  { value: 'deep_center', label: 'Deep Center' },
  { value: 'deep_left', label: 'Deep Left' },
  { value: 'deep_right', label: 'Deep Right' },
  { value: 'squib_center', label: 'Squib Center' },
  { value: 'squib_left', label: 'Squib Left' },
  { value: 'squib_right', label: 'Squib Right' },
  { value: 'onside_center', label: 'Onside Center' },
  { value: 'onside_left', label: 'Onside Left' },
  { value: 'onside_right', label: 'Onside Right' },
] as const;

export const SNAP_QUALITY_OPTIONS = [
  { value: 'good', label: 'Good' },
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'High' },
  { value: 'wide', label: 'Wide' },
  { value: 'fumbled', label: 'Fumbled' },
] as const;

/**
 * Get kick result options based on special teams unit
 */
export function getKickResultsForUnit(unit: SpecialTeamsUnit): typeof KICK_RESULTS[number][] {
  switch (unit) {
    case 'field_goal':
    case 'pat':
      return KICK_RESULTS.filter(r =>
        ['made', 'missed', 'blocked', 'fake_success', 'fake_fail'].includes(r.value)
      );
    case 'kickoff':
      return KICK_RESULTS.filter(r =>
        ['touchback', 'returned', 'out_of_bounds', 'onside_recovered', 'onside_lost', 'muffed'].includes(r.value)
      );
    case 'kick_return':
      return KICK_RESULTS.filter(r =>
        ['returned', 'touchback', 'muffed', 'fair_catch'].includes(r.value)
      );
    case 'punt':
      return KICK_RESULTS.filter(r =>
        ['returned', 'touchback', 'fair_catch', 'out_of_bounds', 'downed', 'blocked', 'muffed', 'fake_success', 'fake_fail'].includes(r.value)
      );
    case 'punt_return':
      return KICK_RESULTS.filter(r =>
        ['returned', 'fair_catch', 'touchback', 'muffed', 'blocked'].includes(r.value)
      );
    case 'fg_block':
      return KICK_RESULTS.filter(r =>
        ['made', 'missed', 'blocked_recovered', 'blocked_returned', 'blocked_td', 'blocked_lost'].includes(r.value)
      );
    default:
      return [...KICK_RESULTS];
  }
}

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
export type AnalyticsTier = 'basic' | 'plus' | 'premium' | 'ai_powered';

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

  // Distinguish offensive vs defensive possessions
  // 'offense' = your team has the ball
  // 'defense' = opponent has the ball (defensive drive)
  possession_type: 'offense' | 'defense';

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

  // For offense: points scored by your team
  // For defense: points allowed (scored by opponent)
  points: number;

  three_and_out: boolean;
  reached_red_zone: boolean;
  scoring_drive: boolean;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// SPECIAL TEAMS TYPES
// ============================================

/**
 * Special teams unit types
 */
export type SpecialTeamsUnit = 'kickoff' | 'kick_return' | 'punt' | 'punt_return' | 'field_goal' | 'fg_block' | 'pat';

/**
 * Kick result outcomes
 */
export type KickResult =
  | 'made'
  | 'missed'
  | 'blocked'
  | 'touchback'
  | 'fair_catch'
  | 'returned'
  | 'out_of_bounds'
  | 'onside_recovered'
  | 'onside_lost'
  | 'fake_success'
  | 'fake_fail'
  | 'muffed'
  | 'downed';

/**
 * Punt type variations
 */
export type PuntType = 'standard' | 'directional_left' | 'directional_right' | 'pooch' | 'rugby' | 'sky';

/**
 * Kickoff type variations
 */
export type KickoffType =
  | 'deep_center'
  | 'deep_left'
  | 'deep_right'
  | 'squib_center'
  | 'squib_left'
  | 'squib_right'
  | 'onside_center'
  | 'onside_left'
  | 'onside_right';

/**
 * Long snap quality ratings
 */
export type SnapQuality = 'good' | 'low' | 'high' | 'wide' | 'fumbled';

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

  // ============================================
  // SPECIAL TEAMS TRACKING
  // ============================================

  // Unit identification
  special_teams_unit?: SpecialTeamsUnit;

  // Kicking plays (Kickoff, Punt, FG, PAT)
  kicker_id?: string;
  kick_result?: KickResult;
  kick_distance?: number; // For FG: distance of attempt; For Punt: gross distance

  // Return plays (Kick Return, Punt Return)
  returner_id?: string;
  return_yards?: number;
  is_fair_catch?: boolean;
  is_touchback?: boolean;
  is_muffed?: boolean;

  // Punt specific
  punter_id?: string;
  punt_type?: PuntType;
  gunner_tackle_id?: string; // Which gunner made the tackle on coverage

  // Kickoff specific
  kickoff_type?: KickoffType;

  // Long snapper tracking (Punt, FG, PAT)
  long_snapper_id?: string;
  snap_quality?: SnapQuality;

  // Holder tracking (FG/PAT)
  holder_id?: string;

  // Coverage tracking - who made tackle on coverage team
  coverage_tackler_id?: string;

  // Penalty tracking (useful for special teams)
  penalty_on_play?: boolean;
  penalty_type?: string;
  penalty_yards?: number;

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

// ============================================
// GAME PLANS & WRISTBAND SYSTEM
// ============================================

/**
 * Wristband format options for QB play cards
 */
export type WristbandFormat = '3x5' | '4x6' | '2col';

/**
 * Database table: game_plans
 * Collection of plays for a specific game or game plan
 */
export interface GamePlan {
  id: string;
  team_id: string;
  game_id?: string | null;
  name: string;
  description?: string;
  wristband_format: WristbandFormat;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Database table: game_plan_plays
 * Individual play within a game plan with assigned call number
 */
export interface GamePlanPlay {
  id: string;
  game_plan_id: string;
  play_code: string;
  call_number: number;
  sort_order: number;
  notes?: string;
  created_at: string;
}

/**
 * Extended game plan play with full play details
 * Used in UI to display complete information
 */
export interface GamePlanPlayWithDetails extends GamePlanPlay {
  play?: PlaybookPlay;
}

/**
 * Helper type for creating new game plans
 */
export type NewGamePlan = Omit<GamePlan, 'id' | 'created_at' | 'updated_at'>;

/**
 * Helper type for creating new game plan plays
 */
export type NewGamePlanPlay = Omit<GamePlanPlay, 'id' | 'created_at'>;

// ============================================
// VIDEO MANAGEMENT SYSTEM
// ============================================

/**
 * Video group types
 */
export type VideoGroupType = 'sequence' | 'overlay' | 'multi_angle';

/**
 * Video layout presets for overlays
 */
export type VideoLayoutPreset = 'pip' | 'side_by_side' | 'stacked' | 'quad';

/**
 * Overlay positions for picture-in-picture
 */
export type OverlayPosition =
  | 'full'
  | 'top_left'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_right'
  | 'center';

/**
 * Processing job types
 */
export type VideoJobType = 'merge' | 'overlay' | 'transcode' | 'thumbnail';

/**
 * Processing job status
 */
export type VideoJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Timeline marker types
 */
export type MarkerType =
  | 'play'           // Play marker
  | 'quarter_start'  // Quarter boundary start
  | 'quarter_end'    // Quarter boundary end
  | 'halftime'       // Halftime break
  | 'overtime'       // Overtime period
  | 'big_play'       // Significant play
  | 'turnover'       // Turnover marker
  | 'timeout'        // Timeout marker
  | 'quarter'        // Legacy quarter marker
  | 'custom';        // Custom marker

/**
 * Helper: Default colors for each marker type
 */
export const MARKER_COLORS: Record<MarkerType, string> = {
  quarter_start: '#10B981', // green-500
  quarter_end: '#EF4444',   // red-500
  halftime: '#F59E0B',      // amber-500
  overtime: '#8B5CF6',      // purple-500
  big_play: '#3B82F6',      // blue-500
  turnover: '#DC2626',      // red-600
  timeout: '#6B7280',       // gray-500
  play: '#3B82F6',          // blue-500
  quarter: '#10B981',       // green-500 (legacy)
  custom: '#6366F1'         // indigo-500
};

/**
 * Helper: Display labels for each marker type
 */
export const MARKER_LABELS: Record<MarkerType, string> = {
  quarter_start: 'Quarter Start',
  quarter_end: 'Quarter End',
  halftime: 'Halftime',
  overtime: 'Overtime',
  big_play: 'Big Play',
  turnover: 'Turnover',
  timeout: 'Timeout',
  play: 'Play',
  quarter: 'Quarter',
  custom: 'Custom Marker'
};

/**
 * Database table: video_groups
 * Groups related videos together for consolidation or overlay
 */
export interface VideoGroup {
  id: string;
  game_id: string;
  name: string;
  description?: string;
  group_type: VideoGroupType;

  // Overlay configuration
  layout_preset?: VideoLayoutPreset;
  primary_video_id?: string;

  // Processing status
  has_merged_video: boolean;
  merged_video_id?: string;

  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Database table: video_group_members
 * Links videos to groups with sequencing and overlay metadata
 */
export interface VideoGroupMember {
  id: string;
  video_group_id: string;
  video_id: string;

  // Sequence configuration
  sequence_order?: number;
  start_offset_ms?: number;
  end_offset_ms?: number;

  // Overlay configuration
  sync_point_ms?: number;
  overlay_position?: OverlayPosition;
  overlay_scale?: number;
  overlay_z_index?: number;

  // Audio
  include_audio: boolean;
  audio_volume: number;

  created_at: string;
}

/**
 * Extended video group member with video details
 */
export interface VideoGroupMemberWithVideo extends VideoGroupMember {
  video?: Video;
}

/**
 * Database table: video_processing_jobs
 * Track background video processing tasks
 */
export interface VideoProcessingJob {
  id: string;
  video_group_id?: string;
  job_type: VideoJobType;
  status: VideoJobStatus;

  // Progress
  progress_percent: number;
  current_step?: string;

  // Result
  output_video_id?: string;
  error_message?: string;

  // Performance
  started_at?: string;
  completed_at?: string;
  processing_duration_seconds?: number;

  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Database table: video_timeline_markers
 * Map play instances to virtual timeline positions (video groups)
 * OR mark specific timestamps on individual videos
 */
export interface VideoTimelineMarker {
  id: string;

  // Either video_id OR video_group_id (mutually exclusive)
  video_id?: string;        // For single-video markers (NEW)
  video_group_id?: string;  // For virtual timeline markers (now optional)
  play_instance_id?: string;

  // Virtual timeline (in milliseconds)
  virtual_timestamp_start_ms: number;
  virtual_timestamp_end_ms?: number;

  // Physical video (for video groups)
  actual_video_id?: string;
  actual_timestamp_start_ms?: number;
  actual_timestamp_end_ms?: number;

  // Metadata
  label?: string;
  marker_type: MarkerType;
  quarter?: number;         // 1-4 or 5 for OT (NEW)
  color?: string;           // Hex color for visual styling (NEW)
  notes?: string;

  created_by?: string;      // NEW
  created_at: string;
  updated_at?: string;      // NEW
}

/**
 * Extended video group with members and videos
 */
export interface VideoGroupWithDetails extends VideoGroup {
  members: VideoGroupMemberWithVideo[];
  processing_job?: VideoProcessingJob;
}

/**
 * Virtual timeline playback state
 */
export interface VirtualTimelineState {
  currentVideoIndex: number;
  currentVideoTime: number;
  totalDuration: number;
  virtualTime: number;
  isPlaying: boolean;
}

/**
 * Helper type for creating new video groups
 */
export type NewVideoGroup = Omit<VideoGroup, 'id' | 'created_at' | 'updated_at' | 'has_merged_video'>;

/**
 * Helper type for creating new video group members
 */
export type NewVideoGroupMember = Omit<VideoGroupMember, 'id' | 'created_at'>;

// ============================================
// PRACTICE PLANNING SYSTEM
// ============================================

/**
 * Database table: practice_plans
 * Main practice plan table
 */
export interface PracticePlan {
  id: string;
  team_id: string;
  title: string;
  date: string;
  duration_minutes: number;
  location?: string;
  notes?: string;
  is_template: boolean;
  template_name?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Database table: practice_periods
 * Sections within a practice
 */
export interface PracticePeriod {
  id: string;
  practice_plan_id: string;
  period_order: number;
  name: string;
  duration_minutes: number;
  period_type: 'warmup' | 'drill' | 'team' | 'special_teams' | 'conditioning' | 'other';
  notes?: string;
  start_time?: number; // Minutes from practice start (0 = beginning). NULL means sequential.
  is_concurrent?: boolean; // TRUE if runs at same time as other periods
  created_at: string;
}

/**
 * Database table: practice_drills
 * Individual drills within periods
 */
export interface PracticeDrill {
  id: string;
  period_id: string;
  drill_order: number;
  drill_name: string;
  position_group?: string;
  description?: string;
  play_codes?: string[];
  equipment_needed?: string;
  created_at: string;
}

/**
 * Extended practice period with drills
 */
export interface PracticePeriodWithDrills extends PracticePeriod {
  drills: PracticeDrill[];
}

/**
 * Extended practice plan with periods and drills
 */
export interface PracticePlanWithDetails extends PracticePlan {
  periods: PracticePeriodWithDrills[];
}

/**
 * Helper type for creating new practice plans
 */
export type NewPracticePlan = Omit<PracticePlan, 'id' | 'created_at' | 'updated_at'>;

/**
 * Helper type for creating new practice periods
 */
export type NewPracticePeriod = Omit<PracticePeriod, 'id' | 'created_at'>;

/**
 * Helper type for creating new practice drills
 */
export type NewPracticeDrill = Omit<PracticeDrill, 'id' | 'created_at'>;

// ============================================================================
// UNIFIED PLAYER STATS (Multi-Position Support)
// ============================================================================

/**
 * Offensive player statistics (from player attribution)
 * Includes rushing, passing, and receiving stats
 */
export interface OffensivePlayerStats {
  // Rushing
  carries: number;
  rushYards: number;
  rushAvg: number;
  rushTouchdowns: number;
  rushSuccessRate: number;

  // Passing
  passAttempts: number;
  completions: number;
  completionPct: number;
  passYards: number;
  passTouchdowns: number;
  interceptions: number;

  // Receiving
  targets: number;
  receptions: number;
  recYards: number;
  recAvg: number;
  recTouchdowns: number;
  catchRate: number;
}

/**
 * Offensive line player statistics (Tier 3)
 * Includes block win rates and penalties
 */
export interface OffensiveLinePlayerStats {
  totalAssignments: number;
  blockWins: number;
  blockLosses: number;
  blockNeutral: number;
  blockWinRate: number;
  penalties: number;
}

/**
 * Defensive player statistics (Tier 3)
 * Includes tackling, pass rush, coverage, and havoc stats
 */
export interface DefensivePlayerStats {
  // Tackling
  defensiveSnaps: number;
  primaryTackles: number;
  assistTackles: number;
  totalTackles: number;
  missedTackles: number;
  tackleParticipation: number;
  missedTackleRate: number;

  // Pass Rush
  pressures: number;
  sacks: number;
  pressureRate: number;
  sackRate: number;

  // Coverage
  targets: number;
  coverageWins: number;
  coverageLosses: number;
  coverageSuccessRate: number;

  // Havoc
  tfls: number;
  forcedFumbles: number;
  interceptions: number;
  pbus: number;
  havocRate?: number;
}

/**
 * Unified player statistics merging offensive, OL, and defensive data
 * Supports multi-position players by showing ALL stats regardless of position group
 */
export interface UnifiedPlayerStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  positions: string[]; // All positions from position_depths
  primaryPosition: string;

  // Stat categories (null if player has no stats in that category)
  offense: OffensivePlayerStats | null;
  offensiveLine: OffensiveLinePlayerStats | null;
  defense: DefensivePlayerStats | null;

  // Derived totals
  totalSnaps: number; // Sum of offensive and defensive snaps
  totalTouchdowns: number; // All TDs combined (rushing + passing + receiving + defensive)
}

/**
 * Filter options for unified player stats view
 */
export type PlayerStatFilter = 'all' | 'offense' | 'defense' | 'ol' | 'position_group';

/**
 * Configuration for filtering unified player stats
 */
export interface PlayerStatFilterConfig {
  filter: PlayerStatFilter;
  positionGroup?: string; // Only used when filter = 'position_group'
}

// ============================================
// GAME PLAN BUILDER SYSTEM
// ============================================

/**
 * Situational category IDs for organizing game plan plays
 */
export type SituationalCategoryId =
  | '1st_down'
  | '2nd_short'
  | '2nd_medium'
  | '2nd_long'
  | '3rd_short'
  | '3rd_medium'
  | '3rd_long'
  | '4th_short'
  | 'red_zone'
  | 'goal_line'
  | '2_minute'
  | 'backed_up'
  | 'opening_script';

/**
 * Play type category IDs for sub-organizing game plan plays
 */
export type PlayTypeCategoryId =
  | 'run'
  | 'short_pass'
  | 'medium_pass'
  | 'long_pass'
  | 'screen'
  | 'play_action'
  | 'rpo'
  | 'draw';

/**
 * Extended GamePlanPlay with situation and play type fields
 */
export interface GamePlanPlayExtended extends GamePlanPlay {
  situation?: SituationalCategoryId;
  play_type_category?: PlayTypeCategoryId;
  side?: 'offense' | 'defense' | 'special_teams';
}

/**
 * Extended GamePlanPlay with full playbook play details
 */
export interface GamePlanPlayWithDetails extends GamePlanPlayExtended {
  play?: PlaybookPlay;
}

/**
 * Key defensive positions to watch for setup/counter plays
 */
export type KeyDefensivePosition =
  | 'MLB'
  | 'WILL'
  | 'SAM'
  | 'ILB'
  | 'SS'
  | 'FS'
  | 'CB1'
  | 'CB2'
  | 'NB'
  | 'NT'
  | '3-tech'
  | '5-tech'
  | 'DE'
  | 'EDGE'
  | 'OLB';

/**
 * Key indicators for when a counter play is ready
 */
export type KeyIndicatorId =
  | 'cheating_inside'
  | 'cheating_outside'
  | 'biting_motion'
  | 'jumping_routes'
  | 'run_fit_aggressive'
  | 'deep_alignment'
  | 'soft_coverage'
  | 'press_alignment'
  | 'spy_qb'
  | 'robber_technique';

/**
 * Database table: play_relationships
 * Links setup plays to counter plays with key position/indicator tracking
 */
export interface PlayRelationship {
  id: string;
  team_id: string;
  setup_play_code: string;
  counter_play_code: string;
  key_position?: KeyDefensivePosition;
  key_indicator?: KeyIndicatorId;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Extended play relationship with full play details
 */
export interface PlayRelationshipWithDetails extends PlayRelationship {
  setup_play?: PlaybookPlay;
  counter_play?: PlaybookPlay;
}

/**
 * Database table: game_plan_counter_status
 * Tracks when a counter play is marked as "ready" for a specific game plan
 */
export interface GamePlanCounterStatus {
  id: string;
  game_plan_id: string;
  relationship_id: string;
  is_ready: boolean;
  marked_at?: string;
  marked_by?: string;
  notes?: string;
}

/**
 * Extended counter status with relationship and play details
 */
export interface GamePlanCounterStatusWithDetails extends GamePlanCounterStatus {
  relationship?: PlayRelationshipWithDetails;
}

/**
 * Opponent profile from film analysis
 * Used to project play success and identify tendencies
 */
export interface OpponentProfile {
  teamName: string;
  totalPlaysAnalyzed: number;
  coverageDistribution: Record<string, number>;
  blitzRate: number;
  blitzRateBySituation: Record<string, number>;
  runStopRate: number;
  passDefenseRate: number;
  tendenciesByDown: Record<string, DefensiveTendency>;
}

/**
 * Defensive tendency by down/distance
 */
export interface DefensiveTendency {
  plays: number;
  mostCommonCoverage: string;
  coveragePercentage: number;
  blitzPercentage: number;
  successRateAgainst: number;
}

/**
 * Opponent offensive profile from film analysis
 * Used for defensive game planning to understand opponent's offense
 */
export interface OpponentOffensiveProfile {
  teamName: string;
  totalPlaysAnalyzed: number;

  // Run/Pass tendencies
  runPercentage: number;
  passPercentage: number;
  runPercentageByDown: Record<string, number>; // e.g., { '1st': 60, '2nd_short': 70, '3rd_long': 20 }

  // Formation tendencies
  formationDistribution: Record<string, number>; // e.g., { 'Shotgun': 55, 'I-Form': 25, 'Pistol': 20 }
  topFormations: Array<{ formation: string; percentage: number; runRate: number }>;

  // Play concept tendencies
  runConceptDistribution: Record<string, number>; // e.g., { 'Inside Zone': 40, 'Power': 30, 'Counter': 15 }
  passConceptDistribution: Record<string, number>; // e.g., { 'Slant': 25, 'Curl': 20, 'Go': 15 }

  // Personnel tendencies
  personnelDistribution: Record<string, number>; // e.g., { '11': 60, '12': 25, '21': 15 }

  // Situational tendencies
  redZoneRunPercentage: number;
  thirdDownConversionRate: number;
  passingDownRunRate: number; // Run rate on 3rd & long, etc.

  // Averages
  avgYardsPerPlay: number;
  avgYardsPerRun: number;
  avgYardsPerPass: number;

  // Tendencies by down
  tendenciesByDown: Record<string, OffensiveTendency>;
}

/**
 * Offensive tendency by down/distance
 */
export interface OffensiveTendency {
  plays: number;
  runPercentage: number;
  passPercentage: number;
  mostCommonFormation: string;
  formationPercentage: number;
  avgYards: number;
  successRate: number;
}

/**
 * Opponent special teams profile from film analysis
 * Used for special teams game planning
 */
export interface OpponentSpecialTeamsProfile {
  teamName: string;
  totalPlaysAnalyzed: number;

  // Kickoff tendencies (when they kick off)
  kickoff: {
    plays: number;
    avgDistance: number;
    touchbackRate: number;
    onsideAttemptRate: number;
    directionDistribution: Record<string, number>; // left, middle, right
  };

  // Kick return tendencies (when they return kicks)
  kickReturn: {
    plays: number;
    avgReturnYards: number;
    touchbackRate: number;
    returnTDRate: number;
  };

  // Punt tendencies (when they punt)
  punt: {
    plays: number;
    avgDistance: number;
    avgHangTime: number;
    directionDistribution: Record<string, number>;
    fakeAttemptRate: number;
    insideThe20Rate: number;
  };

  // Punt return tendencies (when they return punts)
  puntReturn: {
    plays: number;
    avgReturnYards: number;
    fairCatchRate: number;
    blockAttemptRate: number;
    returnTDRate: number;
  };

  // FG/PAT tendencies
  fieldGoal: {
    plays: number;
    attemptsByRange: Record<string, number>; // '0-29', '30-39', '40-49', '50+'
    accuracyByRange: Record<string, number>;
    overallAccuracy: number;
    blockRate: number;
    fakeAttemptRate: number;
  };

  pat: {
    plays: number;
    accuracy: number;
    twoPointAttemptRate: number;
    twoPointConversionRate: number;
  };
}

/**
 * Play match score against opponent
 */
export interface PlayMatchScore {
  playCode: string;
  score: number; // 0-100
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  keyMatchup?: string; // e.g., "LG vs 3-tech #95"
}

/**
 * Key matchup within a play
 */
export interface KeyMatchup {
  position: string; // 'LG', 'X', 'RB', etc.
  versus: string; // '3-tech', 'CB1', 'MLB', etc.
  importance: 'primary' | 'secondary';
}

/**
 * Helper type for creating new play relationships
 */
export type NewPlayRelationship = Omit<PlayRelationship, 'id' | 'created_at' | 'updated_at'>;

/**
 * Helper type for creating new counter status
 */
export type NewGamePlanCounterStatus = Omit<GamePlanCounterStatus, 'id'>;