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
 * Database table: players (to be created)
 */
export interface PlayerRecord {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number;
  position: string;
  grade_level?: string;
  created_at: string;
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