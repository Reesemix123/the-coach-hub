// src/lib/services/advanced-analytics.service.ts
// Tier-based analytics service
// Handles Tier 1-3 analytics: drive analytics, player attribution, OL/defensive tracking, situational splits

import { createClient } from '@/utils/supabase/client';
import type { AnalyticsTier, TeamAnalyticsConfig, PlayInstance, PlayerRecord } from '@/types/football';

export interface TierCapabilities {
  max_fields: number;
  drive_analytics: boolean;
  player_attribution: boolean;
  ol_tracking: boolean;
  defensive_tracking: boolean;
  situational_splits: boolean;
  default_tagging_mode: 'quick' | 'standard' | 'advanced';
}

export interface DriveAnalytics {
  totalDrives: number;
  pointsPerDrive: number;
  avgPlaysPerDrive: number;
  avgYardsPerDrive: number;
  threeAndOutRate: number;
  redZoneTouchdownRate: number;
  scoringDriveRate: number;

  // By result
  touchdowns: number;
  fieldGoals: number;
  punts: number;
  turnovers: number;
  turnoversOnDowns: number;
}

export interface PlayerAttributionStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  position: string;

  // As ball carrier
  carries: number;
  rushYards: number;
  rushAvg: number;
  rushTouchdowns: number;
  rushSuccess: number;
  rushSuccessRate: number;

  // As QB
  dropbacks: number;
  completions: number;
  passAttempts: number;
  completionPct: number;
  passYards: number;
  passTouchdowns: number;
  interceptions: number;
  qbRating?: number;

  // As target
  targets: number;
  receptions: number;
  recYards: number;
  recAvg: number;
  recTouchdowns: number;
  catchRate: number;
}

export interface OffensiveLineStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  position: string;

  totalAssignments: number;
  blockWins: number;
  blockLosses: number;
  blockNeutral: number;
  blockWinRate: number;
  penalties: number;
}

export interface DefensivePlayerStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  position: string;

  // Tackles
  defensiveSnaps: number;
  primaryTackles: number;
  assistTackles: number;
  totalTackles: number;
  missedTackles: number;
  tackleParticipation: number;
  missedTackleRate: number;

  // Pass rush
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
}

export interface SituationalSplit {
  situation: string;
  plays: number;
  yards: number;
  yardsPerPlay: number;
  successRate: number;
  explosiveRate: number;
}

export class AdvancedAnalyticsService {
  private supabase = createClient();

  /**
   * Get team's analytics tier configuration
   */
  async getTeamTier(teamId: string): Promise<TeamAnalyticsConfig> {
    const { data, error } = await this.supabase
      .from('team_analytics_config')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (error || !data) {
      // Return default if not configured
      return {
        team_id: teamId,
        tier: 'hs_basic',
        enable_drive_analytics: true,
        enable_player_attribution: true,
        enable_ol_tracking: false,
        enable_defensive_tracking: false,
        enable_situational_splits: false,
        default_tagging_mode: 'standard',
        updated_at: new Date().toISOString()
      };
    }

    return data as TeamAnalyticsConfig;
  }

  /**
   * Update team's analytics tier
   * Only owners and coaches can modify
   */
  async updateTeamTier(teamId: string, config: Partial<TeamAnalyticsConfig>): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.supabase
      .from('team_analytics_config')
      .upsert({
        team_id: teamId,
        ...config,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      });

    if (error) throw new Error(`Failed to update tier: ${error.message}`);
  }

  /**
   * Get tier capabilities using database function
   */
  async getTierCapabilities(tier: AnalyticsTier): Promise<TierCapabilities> {
    const { data, error } = await this.supabase
      .rpc('get_tier_capabilities', { p_tier: tier });

    if (error) throw new Error(`Failed to get tier capabilities: ${error.message}`);

    return data as TierCapabilities;
  }

  /**
   * Get drive-level analytics for a team
   * Requires Tier 2+ (hs_basic)
   */
  async getDriveAnalytics(teamId: string, gameId?: string): Promise<DriveAnalytics> {
    // Verify tier supports drive analytics
    const config = await this.getTeamTier(teamId);
    if (!config.enable_drive_analytics) {
      throw new Error('Drive analytics not enabled for this team tier');
    }

    // Build query
    let query = this.supabase
      .from('drives')
      .select('*')
      .eq('team_id', teamId);

    if (gameId) {
      query = query.eq('game_id', gameId);
    }

    const { data: drives, error } = await query;

    if (error) throw new Error(`Failed to fetch drives: ${error.message}`);
    if (!drives || drives.length === 0) {
      return this.getEmptyDriveAnalytics();
    }

    // Calculate metrics
    const totalDrives = drives.length;
    const totalPoints = drives.reduce((sum, d) => sum + d.points, 0);
    const totalPlays = drives.reduce((sum, d) => sum + d.plays_count, 0);
    const totalYards = drives.reduce((sum, d) => sum + d.yards_gained, 0);
    const threeAndOuts = drives.filter(d => d.three_and_out).length;
    const redZoneDrives = drives.filter(d => d.reached_red_zone).length;
    const redZoneTouchdowns = drives.filter(d => d.reached_red_zone && d.result === 'touchdown').length;
    const scoringDrives = drives.filter(d => d.scoring_drive).length;

    // By result
    const touchdowns = drives.filter(d => d.result === 'touchdown').length;
    const fieldGoals = drives.filter(d => d.result === 'field_goal').length;
    const punts = drives.filter(d => d.result === 'punt').length;
    const turnovers = drives.filter(d => d.result === 'turnover').length;
    const turnoversOnDowns = drives.filter(d => d.result === 'downs').length;

    return {
      totalDrives,
      pointsPerDrive: totalPoints / totalDrives,
      avgPlaysPerDrive: totalPlays / totalDrives,
      avgYardsPerDrive: totalYards / totalDrives,
      threeAndOutRate: (threeAndOuts / totalDrives) * 100,
      redZoneTouchdownRate: redZoneDrives > 0 ? (redZoneTouchdowns / redZoneDrives) * 100 : 0,
      scoringDriveRate: (scoringDrives / totalDrives) * 100,
      touchdowns,
      fieldGoals,
      punts,
      turnovers,
      turnoversOnDowns
    };
  }

  /**
   * Get player attribution statistics
   * Requires Tier 2+ (hs_basic)
   */
  async getPlayerAttributionStats(teamId: string, gameId?: string): Promise<PlayerAttributionStats[]> {
    // Verify tier supports player attribution
    const config = await this.getTeamTier(teamId);
    if (!config.enable_player_attribution) {
      throw new Error('Player attribution not enabled for this team tier');
    }

    // Fetch all play instances with player attribution
    let query = this.supabase
      .from('play_instances')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_opponent_play', false);

    if (gameId) {
      const { data: videos } = await this.supabase
        .from('videos')
        .select('id')
        .eq('game_id', gameId);

      if (videos && videos.length > 0) {
        const videoIds = videos.map(v => v.id);
        query = query.in('video_id', videoIds);
      }
    }

    const { data: plays, error } = await query;

    if (error) throw new Error(`Failed to fetch play instances: ${error.message}`);
    if (!plays || plays.length === 0) return [];

    // Get unique player IDs
    const playerIds = new Set<string>();
    plays.forEach((play: any) => {
      if (play.ball_carrier_id) playerIds.add(play.ball_carrier_id);
      if (play.qb_id) playerIds.add(play.qb_id);
      if (play.target_id) playerIds.add(play.target_id);
    });

    if (playerIds.size === 0) return [];

    // Fetch player details
    const { data: players } = await this.supabase
      .from('players')
      .select('*')
      .in('id', Array.from(playerIds));

    if (!players) return [];

    // Calculate stats for each player
    const stats: PlayerAttributionStats[] = [];

    for (const player of players) {
      const ballCarrierPlays = plays.filter((p: any) => p.ball_carrier_id === player.id);
      const qbPlays = plays.filter((p: any) => p.qb_id === player.id);
      const targetPlays = plays.filter((p: any) => p.target_id === player.id);

      // Ball carrier stats
      const carries = ballCarrierPlays.length;
      const rushYards = ballCarrierPlays.reduce((sum: number, p: any) => sum + (p.yards_gained || 0), 0);
      const rushTouchdowns = ballCarrierPlays.filter((p: any) =>
        p.result?.includes('touchdown') || (p.yard_line && p.yard_line >= 100)
      ).length;
      const rushSuccess = ballCarrierPlays.filter((p: any) => p.success).length;

      // QB stats
      const dropbacks = qbPlays.filter((p: any) => p.play_type === 'pass').length;
      const passAttempts = dropbacks;
      const completions = qbPlays.filter((p: any) =>
        p.result?.includes('complete') ||
        (p.result?.includes('touchdown') && p.play_type === 'pass')
      ).length;
      const passYards = qbPlays
        .filter((p: any) => p.play_type === 'pass')
        .reduce((sum: number, p: any) => sum + (p.yards_gained || 0), 0);
      const passTouchdowns = qbPlays.filter((p: any) =>
        p.result?.includes('touchdown') && p.play_type === 'pass'
      ).length;
      const interceptions = qbPlays.filter((p: any) =>
        p.result?.includes('interception') || p.is_interception
      ).length;

      // Target stats
      const targets = targetPlays.length;
      const receptions = targetPlays.filter((p: any) =>
        p.result?.includes('complete') ||
        (p.result?.includes('touchdown') && p.play_type === 'pass')
      ).length;
      const recYards = targetPlays
        .filter((p: any) => p.result?.includes('complete') || p.result?.includes('touchdown'))
        .reduce((sum: number, p: any) => sum + (p.yards_gained || 0), 0);
      const recTouchdowns = targetPlays.filter((p: any) =>
        p.result?.includes('touchdown') && p.play_type === 'pass'
      ).length;

      stats.push({
        playerId: player.id,
        playerName: `${player.first_name} ${player.last_name}`,
        jerseyNumber: player.jersey_number,
        position: player.primary_position,

        carries,
        rushYards,
        rushAvg: carries > 0 ? rushYards / carries : 0,
        rushTouchdowns,
        rushSuccess,
        rushSuccessRate: carries > 0 ? (rushSuccess / carries) * 100 : 0,

        dropbacks,
        completions,
        passAttempts,
        completionPct: passAttempts > 0 ? (completions / passAttempts) * 100 : 0,
        passYards,
        passTouchdowns,
        interceptions,

        targets,
        receptions,
        recYards,
        recAvg: receptions > 0 ? recYards / receptions : 0,
        recTouchdowns,
        catchRate: targets > 0 ? (receptions / targets) * 100 : 0
      });
    }

    // Filter out players with no stats
    return stats.filter(s => s.carries > 0 || s.passAttempts > 0 || s.targets > 0);
  }

  /**
   * Get offensive line stats using database function
   * Requires Tier 3 (hs_advanced)
   */
  async getOffensiveLineStats(teamId: string): Promise<OffensiveLineStats[]> {
    // Verify tier supports OL tracking
    const config = await this.getTeamTier(teamId);
    if (!config.enable_ol_tracking) {
      throw new Error('OL tracking not enabled for this team tier');
    }

    // Get all OL players
    const { data: olPlayers } = await this.supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .in('primary_position', ['LT', 'LG', 'C', 'RG', 'RT'])
      .eq('is_active', true);

    if (!olPlayers || olPlayers.length === 0) return [];

    // Calculate block win rate for each player using database function
    const stats: OffensiveLineStats[] = [];

    for (const player of olPlayers) {
      const { data: blockStats } = await this.supabase
        .rpc('calculate_block_win_rate', { p_player_id: player.id });

      if (blockStats && blockStats.length > 0) {
        const stat = blockStats[0];

        // Get penalty count
        const { data: plays } = await this.supabase
          .from('play_instances')
          .select('id')
          .eq('team_id', teamId)
          .eq('ol_penalty_player_id', player.id);

        stats.push({
          playerId: player.id,
          playerName: `${player.first_name} ${player.last_name}`,
          jerseyNumber: player.jersey_number,
          position: player.primary_position,
          totalAssignments: stat.assignments,
          blockWins: stat.wins,
          blockLosses: stat.losses,
          blockNeutral: stat.neutral,
          blockWinRate: stat.win_rate || 0,
          penalties: plays?.length || 0
        });
      }
    }

    return stats;
  }

  /**
   * Get defensive player stats using database functions
   * Requires Tier 3 (hs_advanced)
   */
  async getDefensiveStats(teamId: string): Promise<DefensivePlayerStats[]> {
    // Verify tier supports defensive tracking
    const config = await this.getTeamTier(teamId);
    if (!config.enable_defensive_tracking) {
      throw new Error('Defensive tracking not enabled for this team tier');
    }

    // Get all defensive players
    const { data: defPlayers } = await this.supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .eq('position_group', 'defense')
      .eq('is_active', true);

    if (!defPlayers || defPlayers.length === 0) return [];

    // Calculate stats for each player using database functions
    const stats: DefensivePlayerStats[] = [];

    for (const player of defPlayers) {
      // Tackle stats
      const { data: tackleStats } = await this.supabase
        .rpc('calculate_tackle_participation', {
          p_player_id: player.id,
          p_team_id: teamId
        });

      // Pressure stats
      const { data: pressureStats } = await this.supabase
        .rpc('calculate_pressure_rate', {
          p_player_id: player.id,
          p_team_id: teamId
        });

      // Coverage stats
      const { data: coverageStats } = await this.supabase
        .rpc('calculate_coverage_success', {
          p_player_id: player.id,
          p_team_id: teamId
        });

      // Havoc events
      const { data: havocPlays } = await this.supabase
        .from('play_instances')
        .select('is_tfl, is_sack, is_forced_fumble, is_interception, is_pbu')
        .eq('team_id', teamId)
        .or(`tackler_ids.cs.{${player.id}},sack_player_id.eq.${player.id}`);

      const tackle = tackleStats?.[0] || {};
      const pressure = pressureStats?.[0] || {};
      const coverage = coverageStats?.[0] || {};

      // Count havoc events
      let tfls = 0, forcedFumbles = 0, interceptions = 0, pbus = 0;
      if (havocPlays) {
        tfls = havocPlays.filter(p => p.is_tfl).length;
        forcedFumbles = havocPlays.filter(p => p.is_forced_fumble).length;
        interceptions = havocPlays.filter(p => p.is_interception).length;
        pbus = havocPlays.filter(p => p.is_pbu).length;
      }

      stats.push({
        playerId: player.id,
        playerName: `${player.first_name} ${player.last_name}`,
        jerseyNumber: player.jersey_number,
        position: player.primary_position,

        defensiveSnaps: tackle.defensive_snaps || 0,
        primaryTackles: tackle.primary_tackles || 0,
        assistTackles: tackle.assist_tackles || 0,
        totalTackles: tackle.total_tackles || 0,
        missedTackles: tackle.missed_tackles || 0,
        tackleParticipation: tackle.participation_rate || 0,
        missedTackleRate: tackle.missed_tackle_rate || 0,

        pressures: pressure.pressures || 0,
        sacks: pressure.sacks || 0,
        pressureRate: pressure.pressure_rate || 0,
        sackRate: pressure.sack_rate || 0,

        targets: coverage.targets || 0,
        coverageWins: coverage.successes || 0,
        coverageLosses: (coverage.targets || 0) - (coverage.successes || 0),
        coverageSuccessRate: coverage.success_rate || 0,

        tfls,
        forcedFumbles,
        interceptions,
        pbus
      });
    }

    return stats.filter(s => s.defensiveSnaps > 0);
  }

  /**
   * Get situational splits (motion, play action, blitz, etc.)
   * Requires Tier 3 (hs_advanced)
   */
  async getSituationalSplits(teamId: string): Promise<SituationalSplit[]> {
    // Verify tier supports situational splits
    const config = await this.getTeamTier(teamId);
    if (!config.enable_situational_splits) {
      throw new Error('Situational splits not enabled for this team tier');
    }

    const splits: SituationalSplit[] = [];

    // Motion vs No Motion
    const { data: motionSplit } = await this.supabase
      .rpc('get_situational_split', {
        p_team_id: teamId,
        p_situation: 'has_motion',
        p_value: true
      });

    if (motionSplit && motionSplit.length > 0) {
      const stat = motionSplit[0];
      splits.push({
        situation: 'With Motion',
        plays: stat.plays,
        yards: stat.yards,
        yardsPerPlay: stat.yards_per_play,
        successRate: stat.success_rate,
        explosiveRate: stat.explosive_rate
      });
    }

    // Play Action vs Non-PA
    const { data: paSplit } = await this.supabase
      .rpc('get_situational_split', {
        p_team_id: teamId,
        p_situation: 'is_play_action',
        p_value: true
      });

    if (paSplit && paSplit.length > 0) {
      const stat = paSplit[0];
      splits.push({
        situation: 'Play Action',
        plays: stat.plays,
        yards: stat.yards,
        yardsPerPlay: stat.yards_per_play,
        successRate: stat.success_rate,
        explosiveRate: stat.explosive_rate
      });
    }

    // vs Blitz
    const { data: blitzSplit } = await this.supabase
      .rpc('get_situational_split', {
        p_team_id: teamId,
        p_situation: 'facing_blitz',
        p_value: true
      });

    if (blitzSplit && blitzSplit.length > 0) {
      const stat = blitzSplit[0];
      splits.push({
        situation: 'vs Blitz',
        plays: stat.plays,
        yards: stat.yards,
        yardsPerPlay: stat.yards_per_play,
        successRate: stat.success_rate,
        explosiveRate: stat.explosive_rate
      });
    }

    return splits;
  }

  /**
   * Helper: Empty drive analytics
   */
  private getEmptyDriveAnalytics(): DriveAnalytics {
    return {
      totalDrives: 0,
      pointsPerDrive: 0,
      avgPlaysPerDrive: 0,
      avgYardsPerDrive: 0,
      threeAndOutRate: 0,
      redZoneTouchdownRate: 0,
      scoringDriveRate: 0,
      touchdowns: 0,
      fieldGoals: 0,
      punts: 0,
      turnovers: 0,
      turnoversOnDowns: 0
    };
  }
}
