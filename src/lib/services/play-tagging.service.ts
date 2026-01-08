/**
 * PlayTaggingService
 *
 * Service for managing play instance CRUD operations.
 * Centralizes database interactions for play tagging.
 *
 * Features:
 * - Create, update, delete play instances
 * - Manage player participations
 * - Handle data validation and cleaning
 * - Integration with drive service for stats recalculation
 *
 * @module lib/services/play-tagging.service
 * @since Phase 2 - Film System Refactor
 */

import { createClient } from '@/utils/supabase/client';
import type { PlayInstance } from '@/types/football';

/**
 * Data for creating a new play instance
 * All fields are optional except the required identifiers
 */
export interface CreatePlayData {
  video_id: string;
  team_id: string;
  camera_id?: string;
  drive_id?: string;
  timestamp_start: number;
  timestamp_end?: number;
  is_opponent_play?: boolean;

  // Play identification
  play_code?: string;
  formation?: string;
  play_type?: string;
  direction?: string;

  // Situation
  down?: number;
  distance?: number;
  yard_line?: number;
  hash_mark?: string;
  quarter?: number;

  // Result
  result?: string;
  yards_gained?: number;
  resulted_in_first_down?: boolean;
  is_turnover?: boolean;
  turnover_type?: string;

  // Player attribution (offense)
  qb_id?: string;
  ball_carrier_id?: string;
  target_id?: string;

  // Offensive line
  lt_id?: string;
  lt_block_result?: string;
  lg_id?: string;
  lg_block_result?: string;
  c_id?: string;
  c_block_result?: string;
  rg_id?: string;
  rg_block_result?: string;
  rt_id?: string;
  rt_block_result?: string;

  // Defensive tracking
  tackler_ids?: string[];
  missed_tackle_ids?: string[];
  pressure_player_ids?: string[];
  sack_player_id?: string;
  coverage_player_id?: string;
  coverage_result?: string;
  is_tfl?: boolean;
  is_sack?: boolean;
  is_forced_fumble?: boolean;
  is_pbu?: boolean;
  is_interception?: boolean;
  qb_decision_grade?: number;

  // Special teams
  special_teams_unit?: string;
  kicker_id?: string;
  kick_result?: string;
  kick_distance?: number;
  returner_id?: string;
  return_yards?: number;
  is_fair_catch?: boolean;
  is_touchback?: boolean;
  is_muffed?: boolean;
  punter_id?: string;
  punt_type?: string;
  gunner_tackle_id?: string;
  kickoff_type?: string;
  long_snapper_id?: string;
  snap_quality?: string;
  holder_id?: string;
  coverage_tackler_id?: string;
  blocker_id?: string;

  // Scoring
  scoring_type?: string;
  scoring_points?: number;
  is_touchdown?: boolean;
  opponent_scored?: boolean;

  // Penalties
  penalty_on_play?: boolean;
  penalty_type?: string;
  penalty_yards?: number;
  penalty_on_us?: boolean;
  penalty_declined?: boolean;

  // Notes
  notes?: string;
  tags?: string[];
}

/**
 * Player participation record for junction table
 */
export interface PlayerParticipation {
  play_instance_id: string;
  player_id: string;
  position_played?: string;
  assignment?: string;
  assignment_grade?: number;
  notes?: string;
}

/**
 * Result of a play operation
 */
export interface PlayOperationResult {
  success: boolean;
  playId?: string;
  error?: string;
}

/**
 * PlayTaggingService - Manages play instance operations
 */
export class PlayTaggingService {
  private supabase = createClient();

  /**
   * Create a new play instance
   *
   * @param data - Play data
   * @returns Operation result with new play ID
   */
  async createPlay(data: CreatePlayData): Promise<PlayOperationResult> {
    try {
      const cleanedData = this.cleanData(data);

      const { data: newPlay, error } = await this.supabase
        .from('play_instances')
        .insert([cleanedData])
        .select('id')
        .single();

      if (error) {
        console.error('[PlayTaggingService] Create failed:', error);
        return {
          success: false,
          error: this.formatError(error),
        };
      }

      console.log('[PlayTaggingService] Created play:', newPlay.id);
      return {
        success: true,
        playId: newPlay.id,
      };
    } catch (err) {
      console.error('[PlayTaggingService] Create exception:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error creating play',
      };
    }
  }

  /**
   * Update an existing play instance
   *
   * @param playId - ID of play to update
   * @param data - Updated play data
   * @returns Operation result
   */
  async updatePlay(playId: string, data: Partial<CreatePlayData>): Promise<PlayOperationResult> {
    try {
      const cleanedData = this.cleanData(data);

      const { error } = await this.supabase
        .from('play_instances')
        .update(cleanedData)
        .eq('id', playId);

      if (error) {
        console.error('[PlayTaggingService] Update failed:', error);
        return {
          success: false,
          error: this.formatError(error),
        };
      }

      console.log('[PlayTaggingService] Updated play:', playId);
      return {
        success: true,
        playId,
      };
    } catch (err) {
      console.error('[PlayTaggingService] Update exception:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error updating play',
      };
    }
  }

  /**
   * Delete a play instance
   *
   * @param playId - ID of play to delete
   * @returns Operation result
   */
  async deletePlay(playId: string): Promise<PlayOperationResult> {
    try {
      // First delete associated participations
      await this.deleteParticipations(playId);

      const { error } = await this.supabase
        .from('play_instances')
        .delete()
        .eq('id', playId);

      if (error) {
        console.error('[PlayTaggingService] Delete failed:', error);
        return {
          success: false,
          error: this.formatError(error),
        };
      }

      console.log('[PlayTaggingService] Deleted play:', playId);
      return {
        success: true,
        playId,
      };
    } catch (err) {
      console.error('[PlayTaggingService] Delete exception:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error deleting play',
      };
    }
  }

  /**
   * Get a play instance by ID
   *
   * @param playId - ID of play to fetch
   * @returns Play instance or null
   */
  async getPlay(playId: string): Promise<PlayInstance | null> {
    const { data, error } = await this.supabase
      .from('play_instances')
      .select('*')
      .eq('id', playId)
      .single();

    if (error) {
      console.error('[PlayTaggingService] Get failed:', error);
      return null;
    }

    return data as PlayInstance;
  }

  /**
   * Get all plays for a video
   *
   * @param videoId - Video ID
   * @returns Array of play instances
   */
  async getPlaysForVideo(videoId: string): Promise<PlayInstance[]> {
    const { data, error } = await this.supabase
      .from('play_instances')
      .select('*')
      .eq('video_id', videoId)
      .order('timestamp_start', { ascending: true });

    if (error) {
      console.error('[PlayTaggingService] Get plays for video failed:', error);
      return [];
    }

    return (data as PlayInstance[]) || [];
  }

  /**
   * Get all plays for a game (across all videos)
   *
   * @param gameId - Game ID
   * @param teamId - Team ID
   * @returns Array of play instances with video info
   */
  async getPlaysForGame(gameId: string, teamId: string): Promise<PlayInstance[]> {
    const { data, error } = await this.supabase
      .from('play_instances')
      .select(`
        *,
        videos!inner(game_id)
      `)
      .eq('team_id', teamId)
      .eq('videos.game_id', gameId)
      .order('timestamp_start', { ascending: true });

    if (error) {
      console.error('[PlayTaggingService] Get plays for game failed:', error);
      return [];
    }

    return (data as PlayInstance[]) || [];
  }

  /**
   * Add player participations for a play
   *
   * @param participations - Array of participation records
   */
  async addParticipations(participations: PlayerParticipation[]): Promise<void> {
    if (participations.length === 0) return;

    const { error } = await this.supabase
      .from('player_participation')
      .insert(participations);

    if (error) {
      console.error('[PlayTaggingService] Add participations failed:', error);
      throw new Error(`Failed to add player participations: ${error.message}`);
    }
  }

  /**
   * Delete all participations for a play
   *
   * @param playId - Play instance ID
   */
  async deleteParticipations(playId: string): Promise<void> {
    const { error } = await this.supabase
      .from('player_participation')
      .delete()
      .eq('play_instance_id', playId);

    if (error) {
      // Don't throw - participations may not exist
      console.log('[PlayTaggingService] Delete participations (may not exist):', error.message);
    }
  }

  /**
   * Check for duplicate plays (same video, similar timestamp)
   *
   * @param videoId - Video ID
   * @param timestampStart - Start timestamp
   * @param tolerance - Time tolerance in seconds (default 2)
   * @returns true if duplicate exists
   */
  async checkDuplicate(
    videoId: string,
    timestampStart: number,
    tolerance: number = 2
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('play_instances')
      .select('id')
      .eq('video_id', videoId)
      .gte('timestamp_start', timestampStart - tolerance)
      .lte('timestamp_start', timestampStart + tolerance)
      .limit(1);

    if (error) {
      console.error('[PlayTaggingService] Duplicate check failed:', error);
      return false; // Err on side of allowing creation
    }

    return (data?.length ?? 0) > 0;
  }

  /**
   * Clean data for database insertion
   * Converts undefined and empty strings to null
   */
  private cleanData(data: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        value === undefined || value === '' ? null : value,
      ])
    );
  }

  /**
   * Format database error for user display
   */
  private formatError(error: { message: string; code?: string }): string {
    // Handle common errors with friendly messages
    if (error.code === '23505') {
      return 'A play with this timestamp already exists.';
    }
    if (error.code === '23503') {
      return 'Invalid reference (video, team, or player not found).';
    }
    if (error.code === '23514') {
      return 'Invalid data format. Please check your entries.';
    }

    return error.message || 'An unexpected error occurred.';
  }
}

/**
 * Singleton instance
 */
let defaultInstance: PlayTaggingService | null = null;

/**
 * Get the default PlayTaggingService instance
 */
export function getPlayTaggingService(): PlayTaggingService {
  if (!defaultInstance) {
    defaultInstance = new PlayTaggingService();
  }
  return defaultInstance;
}

export default PlayTaggingService;
