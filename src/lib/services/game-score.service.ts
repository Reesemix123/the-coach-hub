// src/lib/services/game-score.service.ts
// Service for managing quarter-by-quarter scores and score calculations

import { createClient } from '@/utils/supabase/client';
import type {
  QuarterScores,
  GameScoreBreakdown,
  VideoTimelineMarker,
  Game
} from '@/types/football';

/**
 * Default empty quarter scores
 */
export const EMPTY_QUARTER_SCORES: QuarterScores = {
  q1: 0,
  q2: 0,
  q3: 0,
  q4: 0,
  ot: 0,
  total: 0
};

/**
 * Result of score mismatch check
 */
export interface ScoreMismatchResult {
  has_mismatch: boolean;
  reason?: 'missing_data' | 'mismatch';
  has_calculated: boolean;
  has_manual: boolean;
  calculated_team_total?: number;
  calculated_opponent_total?: number;
  manual_team_total?: number;
  manual_opponent_total?: number;
  mismatch_acknowledged?: boolean;
}

export class GameScoreService {
  private supabase = createClient();

  /**
   * Calculate quarter scores from tagged plays for a game
   * Uses the database function for efficient calculation
   */
  async calculateQuarterScores(gameId: string): Promise<GameScoreBreakdown['calculated']> {
    const { data, error } = await this.supabase
      .rpc('calculate_game_quarter_scores', { p_game_id: gameId });

    if (error) {
      console.error('Error calculating quarter scores:', error);
      throw new Error(`Failed to calculate quarter scores: ${error.message}`);
    }

    // Parse the JSONB result
    if (data?.calculated) {
      return data.calculated;
    }

    // Return default empty scores if no data
    return {
      team: { ...EMPTY_QUARTER_SCORES },
      opponent: { ...EMPTY_QUARTER_SCORES }
    };
  }

  /**
   * Get the current quarter scores for a game
   */
  async getQuarterScores(gameId: string): Promise<GameScoreBreakdown | null> {
    const { data, error } = await this.supabase
      .from('games')
      .select('quarter_scores')
      .eq('id', gameId)
      .single();

    if (error) {
      console.error('Error fetching quarter scores:', error);
      throw new Error(`Failed to fetch quarter scores: ${error.message}`);
    }

    return data?.quarter_scores as GameScoreBreakdown | null;
  }

  /**
   * Update the calculated quarter scores for a game
   * Preserves manual scores and source preference
   */
  async updateCalculatedScores(gameId: string): Promise<void> {
    const { error } = await this.supabase
      .rpc('update_game_quarter_scores', { p_game_id: gameId });

    if (error) {
      console.error('Error updating quarter scores:', error);
      throw new Error(`Failed to update quarter scores: ${error.message}`);
    }
  }

  /**
   * Set manual quarter scores for a game
   */
  async setManualScores(
    gameId: string,
    teamScores: Partial<QuarterScores>,
    opponentScores: Partial<QuarterScores>,
    source: 'calculated' | 'manual' = 'manual'
  ): Promise<void> {
    // Ensure all fields have values
    const teamFull: QuarterScores = {
      q1: teamScores.q1 ?? 0,
      q2: teamScores.q2 ?? 0,
      q3: teamScores.q3 ?? 0,
      q4: teamScores.q4 ?? 0,
      ot: teamScores.ot ?? 0,
      total: teamScores.total ??
        (teamScores.q1 ?? 0) + (teamScores.q2 ?? 0) +
        (teamScores.q3 ?? 0) + (teamScores.q4 ?? 0) + (teamScores.ot ?? 0)
    };

    const opponentFull: QuarterScores = {
      q1: opponentScores.q1 ?? 0,
      q2: opponentScores.q2 ?? 0,
      q3: opponentScores.q3 ?? 0,
      q4: opponentScores.q4 ?? 0,
      ot: opponentScores.ot ?? 0,
      total: opponentScores.total ??
        (opponentScores.q1 ?? 0) + (opponentScores.q2 ?? 0) +
        (opponentScores.q3 ?? 0) + (opponentScores.q4 ?? 0) + (opponentScores.ot ?? 0)
    };

    const { error } = await this.supabase
      .rpc('set_game_manual_scores', {
        p_game_id: gameId,
        p_team_scores: teamFull,
        p_opponent_scores: opponentFull,
        p_source: source
      });

    if (error) {
      console.error('Error setting manual scores:', error);
      throw new Error(`Failed to set manual scores: ${error.message}`);
    }

    // Also update the game's team_score and opponent_score fields for backward compatibility
    await this.supabase
      .from('games')
      .update({
        team_score: teamFull.total,
        opponent_score: opponentFull.total,
        game_result: this.determineGameResult(teamFull.total, opponentFull.total)
      })
      .eq('id', gameId);
  }

  /**
   * Set just the final scores (totals) for a game
   * This creates a manual entry with just the totals
   */
  async setFinalScores(
    gameId: string,
    teamTotal: number,
    opponentTotal: number
  ): Promise<void> {
    await this.setManualScores(
      gameId,
      { total: teamTotal },
      { total: opponentTotal },
      'manual'
    );
  }

  /**
   * Check for score mismatch between calculated and manual scores
   */
  async checkScoreMismatch(gameId: string): Promise<ScoreMismatchResult> {
    const { data, error } = await this.supabase
      .rpc('check_game_score_mismatch', { p_game_id: gameId });

    if (error) {
      console.error('Error checking score mismatch:', error);
      throw new Error(`Failed to check score mismatch: ${error.message}`);
    }

    return data as ScoreMismatchResult;
  }

  /**
   * Acknowledge a score mismatch (user has seen and accepted the difference)
   */
  async acknowledgeMismatch(gameId: string): Promise<void> {
    const { error } = await this.supabase
      .rpc('acknowledge_game_score_mismatch', { p_game_id: gameId });

    if (error) {
      console.error('Error acknowledging mismatch:', error);
      throw new Error(`Failed to acknowledge mismatch: ${error.message}`);
    }
  }

  /**
   * Set the authoritative score source (calculated vs manual)
   */
  async setScoreSource(gameId: string, source: 'calculated' | 'manual'): Promise<void> {
    const { data: game, error: fetchError } = await this.supabase
      .from('games')
      .select('quarter_scores')
      .eq('id', gameId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch game: ${fetchError.message}`);
    }

    const currentScores = (game?.quarter_scores as GameScoreBreakdown) || {};
    const updatedScores: GameScoreBreakdown = {
      ...currentScores,
      source,
      mismatch_acknowledged: true
    };

    const { error } = await this.supabase
      .from('games')
      .update({ quarter_scores: updatedScores })
      .eq('id', gameId);

    if (error) {
      console.error('Error setting score source:', error);
      throw new Error(`Failed to set score source: ${error.message}`);
    }

    // Update the legacy team_score/opponent_score fields based on source
    const scoreData = source === 'calculated'
      ? currentScores.calculated
      : currentScores.manual;

    if (scoreData) {
      await this.supabase
        .from('games')
        .update({
          team_score: scoreData.team.total,
          opponent_score: scoreData.opponent.total,
          game_result: this.determineGameResult(scoreData.team.total, scoreData.opponent.total)
        })
        .eq('id', gameId);
    }
  }

  /**
   * Determine quarter for a play timestamp using game period markers
   * Returns 1-4 for regulation, 5+ for overtime
   */
  getQuarterForTimestamp(markers: VideoTimelineMarker[], timestampMs: number): number {
    // Filter and sort quarter-related markers
    const quarterMarkers = markers
      .filter(m =>
        m.marker_type === 'quarter_start' ||
        m.marker_type === 'quarter_end' ||
        m.marker_type === 'overtime' ||
        m.marker_type === 'game_start'
      )
      .sort((a, b) => a.virtual_timestamp_start_ms - b.virtual_timestamp_start_ms);

    if (quarterMarkers.length === 0) {
      return 1; // Default to Q1 if no markers
    }

    let currentQuarter = 1;

    for (const marker of quarterMarkers) {
      if (marker.virtual_timestamp_start_ms > timestampMs) {
        break;
      }

      if (marker.marker_type === 'quarter_start' && marker.quarter) {
        currentQuarter = marker.quarter;
      } else if (marker.marker_type === 'quarter_end' && marker.quarter) {
        // Move to next quarter after end marker
        currentQuarter = marker.quarter + 1;
      } else if (marker.marker_type === 'overtime') {
        // Overtime periods use quarter values 5+ (or use marker.quarter if specified)
        currentQuarter = marker.quarter || 5;
      }
    }

    return currentQuarter;
  }

  /**
   * Get all game period markers for a game (across all videos)
   */
  async getGamePeriodMarkers(gameId: string): Promise<VideoTimelineMarker[]> {
    const { data: videos, error: videosError } = await this.supabase
      .from('videos')
      .select('id')
      .eq('game_id', gameId);

    if (videosError || !videos?.length) {
      return [];
    }

    const videoIds = videos.map(v => v.id);

    const { data, error } = await this.supabase
      .from('video_timeline_markers')
      .select('*')
      .in('video_id', videoIds)
      .in('marker_type', ['game_start', 'quarter_start', 'quarter_end', 'halftime', 'overtime', 'game_end'])
      .order('virtual_timestamp_start_ms', { ascending: true });

    if (error) {
      console.error('Error fetching game period markers:', error);
      return [];
    }

    return (data as VideoTimelineMarker[]) || [];
  }

  /**
   * Determine game result from scores
   */
  private determineGameResult(teamScore: number, opponentScore: number): 'win' | 'loss' | 'tie' {
    if (teamScore > opponentScore) return 'win';
    if (teamScore < opponentScore) return 'loss';
    return 'tie';
  }

  /**
   * Format quarter scores for display
   */
  formatScoresForDisplay(scores: GameScoreBreakdown | null): {
    team: string[];
    opponent: string[];
    headers: string[];
  } {
    const headers = ['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'Final'];

    if (!scores?.calculated && !scores?.manual) {
      return {
        team: ['-', '-', '-', '-', '-', '-'],
        opponent: ['-', '-', '-', '-', '-', '-'],
        headers
      };
    }

    // Use the authoritative source, defaulting to calculated
    const source = scores.source || 'calculated';
    const data = source === 'manual' && scores.manual ? scores.manual : scores.calculated;

    if (!data) {
      return {
        team: ['-', '-', '-', '-', '-', '-'],
        opponent: ['-', '-', '-', '-', '-', '-'],
        headers
      };
    }

    return {
      team: [
        String(data.team.q1),
        String(data.team.q2),
        String(data.team.q3),
        String(data.team.q4),
        data.team.ot > 0 ? String(data.team.ot) : '-',
        String(data.team.total)
      ],
      opponent: [
        String(data.opponent.q1),
        String(data.opponent.q2),
        String(data.opponent.q3),
        String(data.opponent.q4),
        data.opponent.ot > 0 ? String(data.opponent.ot) : '-',
        String(data.opponent.total)
      ],
      headers
    };
  }
}

// Export singleton instance
export const gameScoreService = new GameScoreService();
