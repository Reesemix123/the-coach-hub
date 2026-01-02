// src/lib/services/film-session.service.ts
// Service for managing film tagging sessions, resume position, and analysis status

import { createClient } from '@/utils/supabase/client';
import type { FilmAnalysisStatus, Game, Video } from '@/types/football';

/**
 * Resume position information
 */
export interface ResumePosition {
  videoId: string;
  videoName: string;
  positionMs: number;
  positionFormatted: string;
  lastTaggingAt: string;
  quarter?: number;
}

/**
 * Film analysis status with context
 */
export interface FilmAnalysisInfo {
  status: FilmAnalysisStatus;
  completedAt?: string;
  completedBy?: string;
  playCount: number;
  hasVideos: boolean;
}

export class FilmSessionService {
  private supabase = createClient();

  /**
   * Save the current tagging position for a game
   */
  async savePosition(gameId: string, videoId: string, positionMs: number): Promise<void> {
    const { error } = await this.supabase
      .rpc('save_tagging_position', {
        p_game_id: gameId,
        p_video_id: videoId,
        p_position_ms: Math.round(positionMs) // Round to integer for database
      });

    if (error) {
      console.error('Error saving tagging position:', error);
      throw new Error(`Failed to save position: ${error.message}`);
    }
  }

  /**
   * Get the last tagging position for a game
   */
  async getResumePosition(gameId: string): Promise<ResumePosition | null> {
    const { data: game, error: gameError } = await this.supabase
      .from('games')
      .select(`
        last_tagging_video_id,
        last_tagging_position_ms,
        last_tagging_at
      `)
      .eq('id', gameId)
      .single();

    if (gameError || !game?.last_tagging_video_id || !game.last_tagging_position_ms) {
      return null;
    }

    // Get video details
    const { data: video, error: videoError } = await this.supabase
      .from('videos')
      .select('id, name')
      .eq('id', game.last_tagging_video_id)
      .single();

    if (videoError || !video) {
      return null;
    }

    // Get approximate quarter from markers (if available)
    const { data: markers } = await this.supabase
      .from('video_timeline_markers')
      .select('quarter, virtual_timestamp_start_ms, marker_type')
      .eq('video_id', video.id)
      .in('marker_type', ['quarter_start', 'quarter_end'])
      .lte('virtual_timestamp_start_ms', game.last_tagging_position_ms)
      .order('virtual_timestamp_start_ms', { ascending: false })
      .limit(1);

    const quarter = markers?.[0]?.quarter;

    return {
      videoId: video.id,
      videoName: video.name,
      positionMs: game.last_tagging_position_ms,
      positionFormatted: this.formatTimestamp(game.last_tagging_position_ms),
      lastTaggingAt: game.last_tagging_at,
      quarter
    };
  }

  /**
   * Get the film analysis status with context
   */
  async getAnalysisInfo(gameId: string): Promise<FilmAnalysisInfo> {
    // Get game data
    const { data: game, error: gameError } = await this.supabase
      .from('games')
      .select(`
        film_analysis_status,
        film_analysis_completed_at,
        film_analysis_completed_by
      `)
      .eq('id', gameId)
      .single();

    if (gameError) {
      console.error('Error fetching analysis info:', gameError);
      throw new Error(`Failed to fetch analysis info: ${gameError.message}`);
    }

    // Count videos
    const { count: videoCount } = await this.supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId);

    // Count tagged plays
    const { count: playCount } = await this.supabase
      .from('play_instances')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId);

    return {
      status: (game?.film_analysis_status as FilmAnalysisStatus) || 'not_started',
      completedAt: game?.film_analysis_completed_at,
      completedBy: game?.film_analysis_completed_by,
      playCount: playCount || 0,
      hasVideos: (videoCount || 0) > 0
    };
  }

  /**
   * Update the film analysis status
   */
  async updateAnalysisStatus(
    gameId: string,
    status: FilmAnalysisStatus
  ): Promise<void> {
    const { error } = await this.supabase
      .rpc('update_film_analysis_status', {
        p_game_id: gameId,
        p_status: status
      });

    if (error) {
      console.error('Error updating analysis status:', error);
      throw new Error(`Failed to update status: ${error.message}`);
    }
  }

  /**
   * Mark film analysis as complete
   * Recalculates quarter scores automatically
   */
  async markAnalysisComplete(gameId: string): Promise<void> {
    await this.updateAnalysisStatus(gameId, 'complete');
  }

  /**
   * Mark film analysis as in progress (un-mark complete)
   */
  async markAnalysisInProgress(gameId: string): Promise<void> {
    await this.updateAnalysisStatus(gameId, 'in_progress');
  }

  /**
   * Check if analysis can be marked complete
   * Returns validation info
   */
  async validateCanComplete(gameId: string): Promise<{
    canComplete: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    // Check for videos
    const { count: videoCount } = await this.supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId);

    if (!videoCount || videoCount === 0) {
      warnings.push('No videos have been uploaded for this game');
    }

    // Check for tagged plays
    const { count: playCount } = await this.supabase
      .from('play_instances')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId);

    if (!playCount || playCount === 0) {
      warnings.push('No plays have been tagged');
    }

    // Check for quarter markers
    const { data: videos } = await this.supabase
      .from('videos')
      .select('id')
      .eq('game_id', gameId);

    if (videos && videos.length > 0) {
      const videoIds = videos.map(v => v.id);
      const { count: markerCount } = await this.supabase
        .from('video_timeline_markers')
        .select('id', { count: 'exact', head: true })
        .in('video_id', videoIds)
        .in('marker_type', ['quarter_start', 'quarter_end', 'game_start', 'game_end']);

      if (!markerCount || markerCount === 0) {
        warnings.push('No game period markers have been placed (quarter start/end)');
      }
    }

    return {
      canComplete: true, // Always allow, but show warnings
      warnings
    };
  }

  /**
   * Get time since last tagging activity
   */
  async getTimeSinceLastActivity(gameId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('games')
      .select('last_tagging_at')
      .eq('id', gameId)
      .single();

    if (error || !data?.last_tagging_at) {
      return null;
    }

    const lastActivity = new Date(data.last_tagging_at);
    const now = new Date();
    const diffMs = now.getTime() - lastActivity.getTime();

    // Format as human-readable
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  /**
   * Format milliseconds to mm:ss or hh:mm:ss
   */
  private formatTimestamp(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Update the game's final score
   */
  async updateGameScore(
    gameId: string,
    teamScore: number | null,
    opponentScore: number | null
  ): Promise<void> {
    // Determine game result based on scores
    let gameResult: 'win' | 'loss' | 'tie' | null = null;
    if (teamScore !== null && opponentScore !== null) {
      if (teamScore > opponentScore) {
        gameResult = 'win';
      } else if (teamScore < opponentScore) {
        gameResult = 'loss';
      } else {
        gameResult = 'tie';
      }
    }

    const { error } = await this.supabase
      .from('games')
      .update({
        team_score: teamScore,
        opponent_score: opponentScore,
        game_result: gameResult
      })
      .eq('id', gameId);

    if (error) {
      console.error('Error updating game score:', error);
      throw new Error(`Failed to update score: ${error.message}`);
    }
  }

  /**
   * Clear resume position (when manually clearing session)
   */
  async clearResumePosition(gameId: string): Promise<void> {
    const { error } = await this.supabase
      .from('games')
      .update({
        last_tagging_video_id: null,
        last_tagging_position_ms: 0,
        last_tagging_at: null,
        last_tagging_by: null
      })
      .eq('id', gameId);

    if (error) {
      console.error('Error clearing resume position:', error);
      throw new Error(`Failed to clear position: ${error.message}`);
    }
  }
}

// Export singleton instance
export const filmSessionService = new FilmSessionService();
