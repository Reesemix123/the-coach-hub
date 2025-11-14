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
        position_depths: player.position_depths || {}, // Include all positions for multi-position filtering

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

    // Get all active players for the team
    const { data: allPlayers } = await this.supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true);

    if (!allPlayers || allPlayers.length === 0) return [];

    // Filter to players who have ANY OL position in their position_depths
    // This supports multi-position players (e.g., a TE who also plays RT)
    const OL_POSITIONS = ['LT', 'LG', 'C', 'RG', 'RT'];
    const olPlayers = allPlayers.filter(player => {
      const positions = Object.keys(player.position_depths || {});
      return positions.some(pos => OL_POSITIONS.includes(pos));
    });

    if (olPlayers.length === 0) return [];

    // Calculate block win rate for each player using database function
    // PARALLELIZED: Fetch all players at once instead of sequential loop
    const startTime = performance.now();

    const statsPromises = olPlayers.map(async (player) => {
      try {
        // Parallel fetch: block stats + penalty count
        const [blockStatsResult, penaltyResult] = await Promise.allSettled([
          this.supabase.rpc('calculate_block_win_rate', { p_player_id: player.id }),
          this.supabase
            .from('play_instances')
            .select('id')
            .eq('team_id', teamId)
            .eq('ol_penalty_player_id', player.id)
        ]);

        // Handle block stats
        if (blockStatsResult.status === 'rejected') {
          console.warn(`⚠️ Block win rate RPC failed for player ${player.id}:`, blockStatsResult.reason?.message);
          return null;
        }

        const { data: blockStats, error: rpcError } = blockStatsResult.value;
        if (rpcError) {
          console.warn(`⚠️ Block win rate RPC failed for player ${player.id}:`, rpcError.message);
          return null;
        }

        if (!blockStats || blockStats.length === 0) {
          return null;
        }

        const stat = blockStats[0];

        // Handle penalty count
        let penalties = 0;
        if (penaltyResult.status === 'fulfilled') {
          const { data: plays, error: penaltyError } = penaltyResult.value;
          if (!penaltyError && plays) {
            penalties = plays.length;
          } else if (penaltyError) {
            console.warn(`⚠️ Penalty query failed (column might not exist yet):`, penaltyError.message);
          }
        }

        return {
          playerId: player.id,
          playerName: `${player.first_name} ${player.last_name}`,
          jerseyNumber: player.jersey_number,
          position: player.primary_position,
          position_depths: player.position_depths || {}, // Include all positions for multi-position filtering
          totalAssignments: stat.assignments,
          blockWins: stat.wins,
          blockLosses: stat.losses,
          blockNeutral: stat.neutral,
          blockWinRate: stat.win_rate || 0,
          penalties: penalties
        };
      } catch (playerError: any) {
        console.warn(`⚠️ Failed to get OL stats for player ${player.id}:`, playerError.message);
        return null;
      }
    });

    const results = await Promise.allSettled(statsPromises);
    const stats = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<OffensiveLineStats>).value);

    const elapsedTime = performance.now() - startTime;
    console.log(`📊 OL stats completed: ${stats.length} players in ${elapsedTime.toFixed(0)}ms (${olPlayers.length} total)`);

    return stats;
  }

  /**
   * Get defensive player stats using JUNCTION TABLE queries
   * Requires Tier 3 (hs_advanced)
   *
   * ARCHITECTURE NOTE (Migration 032):
   * Now uses normalized player_participation table instead of arrays.
   * Benefits: O(log n) queries, scalable to 100k+ plays, no timeouts.
   */
  async getDefensiveStats(teamId: string): Promise<DefensivePlayerStats[]> {
    const startTime = performance.now();

    // Verify tier supports defensive tracking
    const config = await this.getTeamTier(teamId);
    if (!config.enable_defensive_tracking) {
      throw new Error('Defensive tracking not enabled for this team tier');
    }

    console.log('🛡️ Fetching defensive stats from player_participation table...');

    // Get all active defensive players
    const { data: allPlayers } = await this.supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true);

    if (!allPlayers || allPlayers.length === 0) return [];

    // Filter to defensive players
    const DEFENSIVE_POSITIONS = ['DE', 'DT', 'DT1', 'DT2', 'NT', 'LB', 'MLB', 'SAM', 'WILL', 'OLB', 'ILB', 'CB', 'LCB', 'RCB', 'S', 'FS', 'SS'];
    const defPlayers = allPlayers.filter(player => {
      const positions = Object.keys(player.position_depths || {});
      return positions.some(pos => DEFENSIVE_POSITIONS.includes(pos));
    });

    if (defPlayers.length === 0) return [];

    console.log(`📊 Calculating stats for ${defPlayers.length} defensive players`);

    // Get total defensive snaps for denominator
    const { count: totalSnaps } = await this.supabase
      .from('play_instances')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('is_opponent_play', false);

    const defensiveSnaps = totalSnaps || 0;

    // Calculate stats for each player using efficient junction table queries
    const statsPromises = defPlayers.map(async (player) => {
      try {
        // Use RPC functions for tackle and pressure stats (fast!)
        const [tackleStats, pressureStats] = await Promise.all([
          this.supabase.rpc('get_player_tackle_stats', {
            p_player_id: player.id,
            p_team_id: teamId
          }),
          this.supabase.rpc('get_player_pressure_stats', {
            p_player_id: player.id,
            p_team_id: teamId
          })
        ]);

        // Coverage stats (single query)
        const { data: coverageData } = await this.supabase
          .from('player_participation')
          .select('result')
          .eq('player_id', player.id)
          .eq('team_id', teamId)
          .eq('participation_type', 'coverage_assignment');

        const targets = coverageData?.length || 0;
        const coverageWins = coverageData?.filter(c => c.result === 'win').length || 0;
        const coverageLosses = targets - coverageWins;

        // Extract stats from RPC results
        const primaryTackles = tackleStats.data?.[0]?.primary_tackles || 0;
        const assistTackles = tackleStats.data?.[0]?.assist_tackles || 0;
        const missedTackles = tackleStats.data?.[0]?.missed_tackles || 0;
        const totalTackles = tackleStats.data?.[0]?.total_tackles || 0;

        const sacks = pressureStats.data?.[0]?.sacks || 0;
        const hurries = pressureStats.data?.[0]?.hurries || 0;
        const hits = pressureStats.data?.[0]?.hits || 0;
        const totalPressures = pressureStats.data?.[0]?.total_pressures || 0;

        // Get pass rush snaps for rate calculations
        const { count: passRushSnaps } = await this.supabase
          .from('play_instances')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamId)
          .eq('is_opponent_play', false)
          .eq('play_type', 'pass');

        // Calculate rates
        const tackleParticipation = defensiveSnaps > 0 ? (totalTackles / defensiveSnaps) * 100 : 0;
        const totalTackleOpportunities = totalTackles + missedTackles;
        const missedTackleRate = totalTackleOpportunities > 0 ? (missedTackles / totalTackleOpportunities) * 100 : 0;

        const pressureRate = (passRushSnaps || 0) > 0 ? (totalPressures / (passRushSnaps || 1)) * 100 : 0;
        const sackRate = (passRushSnaps || 0) > 0 ? (sacks / (passRushSnaps || 1)) * 100 : 0;
        const coverageSuccessRate = targets > 0 ? (coverageWins / targets) * 100 : 0;

        // Get havoc plays (TFL, FF, INT, PBU) - would need additional fields in player_participation
        // For now, set to 0 (these fields don't exist in junction table yet)
        const tfls = 0;
        const forcedFumbles = 0;
        const interceptions = 0;
        const pbus = 0;

        return {
          playerId: player.id,
          playerName: `${player.first_name} ${player.last_name}`,
          jerseyNumber: player.jersey_number,
          position: player.primary_position,
          position_depths: player.position_depths || {},

          defensiveSnaps,
          primaryTackles,
          assistTackles,
          totalTackles,
          missedTackles,
          tackleParticipation: Math.round(tackleParticipation * 10) / 10,
          missedTackleRate: Math.round(missedTackleRate * 10) / 10,

          pressures: totalPressures,
          sacks,
          pressureRate: Math.round(pressureRate * 10) / 10,
          sackRate: Math.round(sackRate * 10) / 10,

          targets,
          coverageWins,
          coverageLosses,
          coverageSuccessRate: Math.round(coverageSuccessRate * 10) / 10,

          tfls,
          forcedFumbles,
          interceptions,
          pbus
        };
      } catch (playerError: any) {
        console.warn(`⚠️ Failed to get defensive stats for player ${player.id}:`, playerError.message);
        return null;
      }
    });

    const results = await Promise.allSettled(statsPromises);
    const stats = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<DefensivePlayerStats>).value)
      .filter(s => s.totalTackles > 0 || s.pressures > 0 || s.targets > 0); // Only include players with defensive participation

    const elapsedTime = performance.now() - startTime;
    console.log(`✅ Defensive stats calculated: ${stats.length} players in ${elapsedTime.toFixed(0)}ms (junction table)`);

    return stats;
  }

  /**
   * Get unified player statistics (offensive + OL + defensive)
   * Merges all stat sources by player ID to support multi-position players
   * Returns complete player profiles regardless of position group
   *
   * @param teamId Team ID
   * @param gameId Optional game ID to filter stats
   * @returns Array of unified player stats with all categories merged
   */
  async getUnifiedPlayerStats(teamId: string, gameId?: string): Promise<any[]> {
    console.log('🔄 getUnifiedPlayerStats: Starting for teamId:', teamId, gameId ? `gameId: ${gameId}` : '(season)');

    const config = await this.getTeamTier(teamId);

    // 1. Fetch all data sources in parallel for better performance
    console.log('📊 Fetching all stat sources in parallel...');
    const [offensiveStats, olStats, defensiveStats] = await Promise.all([
      // Always fetch offensive stats (Tier 2+)
      config.enable_player_attribution
        ? this.getPlayerAttributionStats(teamId, gameId).catch(err => {
            console.warn('⚠️ Offensive stats failed:', err.message);
            return [];
          })
        : Promise.resolve([]),

      // Fetch OL stats if Tier 3
      config.enable_ol_tracking
        ? this.getOffensiveLineStats(teamId).catch(err => {
            console.warn('⚠️ OL stats failed:', err.message);
            return [];
          })
        : Promise.resolve([]),

      // Fetch defensive stats if Tier 3 (with timeout protection)
      config.enable_defensive_tracking
        ? Promise.race([
            this.getDefensiveStats(teamId),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Defensive stats timeout after 10s')), 10000)
            )
          ]).catch(err => {
            console.warn('⚠️ Defensive stats failed or timed out:', err.message);
            return [];
          })
        : Promise.resolve([])
    ]);

    console.log('✅ Stats fetched:', {
      offensive: offensiveStats.length,
      ol: olStats.length,
      defensive: defensiveStats.length
    });

    // Log sample data to debug
    if (offensiveStats.length > 0) {
      console.log('📋 Sample offensive stat:', offensiveStats[0]);
    }
    if (olStats.length > 0) {
      console.log('📋 Sample OL stat:', olStats[0]);
    }
    if (defensiveStats.length > 0) {
      console.log('📋 Sample defensive stat:', defensiveStats[0]);
    }

    // 2. Get ALL unique player IDs across all sources
    const playerIdSet = new Set<string>();
    offensiveStats.forEach((s: any) => {
      if (s.playerId) {
        playerIdSet.add(s.playerId);
      } else {
        console.warn('⚠️ Offensive stat missing playerId:', s);
      }
    });
    olStats.forEach((s: any) => {
      if (s.playerId) {
        playerIdSet.add(s.playerId);
      } else {
        console.warn('⚠️ OL stat missing playerId:', s);
      }
    });
    defensiveStats.forEach((s: any) => {
      if (s.playerId) {
        playerIdSet.add(s.playerId);
      } else {
        console.warn('⚠️ Defensive stat missing playerId:', s);
      }
    });

    console.log('👥 Total unique players with stats:', playerIdSet.size);
    console.log('👥 Player IDs:', Array.from(playerIdSet));

    if (playerIdSet.size === 0) {
      console.log('⚠️ No players with stats found - check if player attribution is enabled and plays are tagged');
      return [];
    }

    // 3. Fetch player details for all players with stats
    const { data: players } = await this.supabase
      .from('players')
      .select('*')
      .in('id', Array.from(playerIdSet));

    if (!players) {
      console.log('❌ Failed to fetch player details');
      return [];
    }

    console.log('👥 Player details fetched:', players.length);

    // 4. Merge stats by player
    const unified = players.map(player => {
      const offStats = offensiveStats.find((s: any) => s.playerId === player.id);
      const olStat = olStats.find((s: any) => s.playerId === player.id);
      const defStat = defensiveStats.find((s: any) => s.playerId === player.id);

      // Calculate derived totals
      const offensiveSnaps = (offStats?.carries || 0) + (offStats?.passAttempts || 0) + (offStats?.targets || 0);
      const defensiveSnaps = defStat?.defensiveSnaps || 0;
      const totalSnaps = offensiveSnaps + defensiveSnaps;

      const totalTouchdowns =
        (offStats?.rushTouchdowns || 0) +
        (offStats?.passTouchdowns || 0) +
        (offStats?.recTouchdowns || 0) +
        (defStat?.interceptions || 0); // Defensive TDs

      return {
        playerId: player.id,
        playerName: `${player.first_name} ${player.last_name}`,
        jerseyNumber: player.jersey_number,
        positions: Object.keys(player.position_depths || {}),
        primaryPosition: player.primary_position,

        // Offensive stats (null if no offensive stats)
        offense: offStats ? {
          carries: offStats.carries || 0,
          rushYards: offStats.rushYards || 0,
          rushAvg: offStats.rushAvg || 0,
          rushTouchdowns: offStats.rushTouchdowns || 0,
          rushSuccessRate: offStats.rushSuccessRate || 0,

          passAttempts: offStats.passAttempts || 0,
          completions: offStats.completions || 0,
          completionPct: offStats.completionPct || 0,
          passYards: offStats.passYards || 0,
          passTouchdowns: offStats.passTouchdowns || 0,
          interceptions: offStats.interceptions || 0,

          targets: offStats.targets || 0,
          receptions: offStats.receptions || 0,
          recYards: offStats.recYards || 0,
          recAvg: offStats.recAvg || 0,
          recTouchdowns: offStats.recTouchdowns || 0,
          catchRate: offStats.catchRate || 0
        } : null,

        // Offensive line stats (null if no OL stats)
        offensiveLine: olStat ? {
          totalAssignments: olStat.totalAssignments || 0,
          blockWins: olStat.blockWins || 0,
          blockLosses: olStat.blockLosses || 0,
          blockNeutral: olStat.blockNeutral || 0,
          blockWinRate: olStat.blockWinRate || 0,
          penalties: olStat.penalties || 0
        } : null,

        // Defensive stats (null if no defensive stats)
        defense: defStat ? {
          defensiveSnaps: defStat.defensiveSnaps || 0,
          primaryTackles: defStat.primaryTackles || 0,
          assistTackles: defStat.assistTackles || 0,
          totalTackles: defStat.totalTackles || 0,
          missedTackles: defStat.missedTackles || 0,
          tackleParticipation: defStat.tackleParticipation || 0,
          missedTackleRate: defStat.missedTackleRate || 0,

          pressures: defStat.pressures || 0,
          sacks: defStat.sacks || 0,
          pressureRate: defStat.pressureRate || 0,
          sackRate: defStat.sackRate || 0,

          targets: defStat.targets || 0,
          coverageWins: defStat.coverageWins || 0,
          coverageLosses: defStat.coverageLosses || 0,
          coverageSuccessRate: defStat.coverageSuccessRate || 0,

          tfls: defStat.tfls || 0,
          forcedFumbles: defStat.forcedFumbles || 0,
          interceptions: defStat.interceptions || 0,
          pbus: defStat.pbus || 0,
          havocRate: defStat.defensiveSnaps > 0
            ? (((defStat.tfls || 0) + (defStat.sacks || 0) + (defStat.interceptions || 0) + (defStat.pbus || 0) + (defStat.forcedFumbles || 0)) / defStat.defensiveSnaps) * 100
            : 0
        } : null,

        // Derived totals
        totalSnaps,
        totalTouchdowns
      };
    });

    // 5. Filter out players with no stats in any category
    const filtered = unified.filter(s =>
      s.offense !== null || s.offensiveLine !== null || s.defense !== null
    );

    console.log('✅ Unified stats created:', filtered.length, 'players with stats');
    console.log('📊 Sample unified stat:', filtered[0]);

    return filtered;
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
   * Get QB-specific stats for a player
   * Shows passing, rushing, and decision-making metrics
   */
  async getQBStats(playerId: string, gameId?: string) {
    const { data: player } = await this.supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (!player) throw new Error('Player not found');

    // Build query
    let query = this.supabase
      .from('play_instances')
      .select('*')
      .eq('qb_id', playerId)
      .eq('is_opponent_play', false);

    if (gameId) {
      const { data: videos } = await this.supabase
        .from('videos')
        .select('id')
        .eq('game_id', gameId);

      if (videos && videos.length > 0) {
        query = query.in('video_id', videos.map(v => v.id));
      }
    }

    const { data: plays } = await query;
    if (!plays || plays.length === 0) return null;

    // Passing stats
    const passPlays = plays.filter(p => p.play_type === 'pass');
    const completions = passPlays.filter(p =>
      p.result?.includes('complete') || (p.result?.includes('touchdown') && p.play_type === 'pass')
    ).length;
    const passYards = passPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
    const passTDs = passPlays.filter(p => p.result?.includes('touchdown')).length;
    const interceptions = passPlays.filter(p => p.result?.includes('interception') || p.is_interception).length;
    const sacks = passPlays.filter(p => p.is_sack).length;

    // Rushing stats (when QB is ball carrier)
    const rushPlays = plays.filter(p => p.ball_carrier_id === playerId && p.play_type === 'run');
    const rushYards = rushPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
    const rushTDs = rushPlays.filter(p => p.result?.includes('touchdown')).length;

    // Situational stats
    const thirdDownAttempts = passPlays.filter(p => p.down === 3);
    const thirdDownConversions = thirdDownAttempts.filter(p => p.resulted_in_first_down || p.result?.includes('touchdown')).length;

    const redZoneAttempts = passPlays.filter(p => p.yard_line && p.yard_line >= 80);
    const redZoneTDs = redZoneAttempts.filter(p => p.result?.includes('touchdown')).length;

    // Pressure stats
    const pressuredPlays = passPlays.filter(p => p.facing_blitz || p.is_sack);
    const completionsUnderPressure = pressuredPlays.filter(p =>
      p.result?.includes('complete') || p.result?.includes('touchdown')
    ).length;

    return {
      playerName: `${player.first_name} ${player.last_name}`,
      jerseyNumber: player.jersey_number,
      position: player.primary_position,

      // Passing
      dropbacks: passPlays.length,
      completions,
      attempts: passPlays.length,
      completionPct: passPlays.length > 0 ? (completions / passPlays.length) * 100 : 0,
      passYards,
      yardsPerAttempt: passPlays.length > 0 ? passYards / passPlays.length : 0,
      passTDs,
      interceptions,
      sacks,

      // Rushing
      rushAttempts: rushPlays.length,
      rushYards,
      rushAvg: rushPlays.length > 0 ? rushYards / rushPlays.length : 0,
      rushTDs,

      // Situational
      thirdDownAttempts: thirdDownAttempts.length,
      thirdDownConversions,
      thirdDownPct: thirdDownAttempts.length > 0 ? (thirdDownConversions / thirdDownAttempts.length) * 100 : 0,

      redZoneAttempts: redZoneAttempts.length,
      redZoneTDs,
      redZoneTDPct: redZoneAttempts.length > 0 ? (redZoneTDs / redZoneAttempts.length) * 100 : 0,

      pressuredDropbacks: pressuredPlays.length,
      completionsUnderPressure,
      pressureCompletionPct: pressuredPlays.length > 0 ? (completionsUnderPressure / pressuredPlays.length) * 100 : 0
    };
  }

  /**
   * Get RB-specific stats for a player
   * Shows rushing, receiving, and blocking metrics
   */
  async getRBStats(playerId: string, gameId?: string) {
    const { data: player } = await this.supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (!player) throw new Error('Player not found');

    // Build query for plays where player is ball carrier or target
    let query = this.supabase
      .from('play_instances')
      .select('*')
      .or(`ball_carrier_id.eq.${playerId},target_id.eq.${playerId}`)
      .eq('is_opponent_play', false);

    if (gameId) {
      const { data: videos } = await this.supabase
        .from('videos')
        .select('id')
        .eq('game_id', gameId);

      if (videos && videos.length > 0) {
        query = query.in('video_id', videos.map(v => v.id));
      }
    }

    const { data: plays } = await query;
    if (!plays || plays.length === 0) return null;

    // Rushing stats
    const rushPlays = plays.filter(p => p.ball_carrier_id === playerId && p.play_type === 'run');
    const rushYards = rushPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
    const rushTDs = rushPlays.filter(p => p.result?.includes('touchdown')).length;
    const rushSuccess = rushPlays.filter(p => p.success).length;
    const explosive = rushPlays.filter(p => (p.yards_gained || 0) >= 10).length;

    // Receiving stats
    const targets = plays.filter(p => p.target_id === playerId);
    const receptions = targets.filter(p =>
      p.result?.includes('complete') || p.result?.includes('touchdown')
    ).length;
    const recYards = targets
      .filter(p => p.result?.includes('complete') || p.result?.includes('touchdown'))
      .reduce((sum, p) => sum + (p.yards_gained || 0), 0);
    const recTDs = targets.filter(p => p.result?.includes('touchdown')).length;

    // Situational
    const thirdDownRushes = rushPlays.filter(p => p.down === 3);
    const thirdDownConversions = thirdDownRushes.filter(p => p.resulted_in_first_down || p.result?.includes('touchdown')).length;

    return {
      playerName: `${player.first_name} ${player.last_name}`,
      jerseyNumber: player.jersey_number,
      position: player.primary_position,

      // Rushing
      carries: rushPlays.length,
      rushYards,
      rushAvg: rushPlays.length > 0 ? rushYards / rushPlays.length : 0,
      rushTDs,
      rushSuccess,
      rushSuccessRate: rushPlays.length > 0 ? (rushSuccess / rushPlays.length) * 100 : 0,
      explosiveRuns: explosive,
      explosiveRate: rushPlays.length > 0 ? (explosive / rushPlays.length) * 100 : 0,

      // Receiving
      targets: targets.length,
      receptions,
      recYards,
      recAvg: receptions > 0 ? recYards / receptions : 0,
      recTDs,
      catchRate: targets.length > 0 ? (receptions / targets.length) * 100 : 0,

      // Combined
      totalTouches: rushPlays.length + receptions,
      totalYards: rushYards + recYards,
      totalTDs: rushTDs + recTDs,
      yardsPerTouch: (rushPlays.length + receptions) > 0 ? (rushYards + recYards) / (rushPlays.length + receptions) : 0,

      // Situational
      thirdDownRushes: thirdDownRushes.length,
      thirdDownConversions,
      thirdDownPct: thirdDownRushes.length > 0 ? (thirdDownConversions / thirdDownRushes.length) * 100 : 0
    };
  }

  /**
   * Get WR/TE-specific stats for a player
   * Shows receiving, route running, and blocking metrics
   */
  async getWRTEStats(playerId: string, gameId?: string) {
    const { data: player } = await this.supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (!player) throw new Error('Player not found');

    // Build query for plays where player is target
    let query = this.supabase
      .from('play_instances')
      .select('*')
      .eq('target_id', playerId)
      .eq('is_opponent_play', false);

    if (gameId) {
      const { data: videos } = await this.supabase
        .from('videos')
        .select('id')
        .eq('game_id', gameId);

      if (videos && videos.length > 0) {
        query = query.in('video_id', videos.map(v => v.id));
      }
    }

    const { data: plays } = await query;
    if (!plays || plays.length === 0) return null;

    // Receiving stats
    const receptions = plays.filter(p =>
      p.result?.includes('complete') || p.result?.includes('touchdown')
    ).length;
    const recYards = plays
      .filter(p => p.result?.includes('complete') || p.result?.includes('touchdown'))
      .reduce((sum, p) => sum + (p.yards_gained || 0), 0);
    const recTDs = plays.filter(p => p.result?.includes('touchdown')).length;
    const explosive = plays.filter(p => (p.yards_gained || 0) >= 15).length;

    // Drops (incomplete where QB didn't get pressured/sacked)
    const catchableTargets = plays.filter(p =>
      !p.is_sack &&
      !p.result?.includes('throwaway') &&
      !p.result?.includes('batted')
    );
    const drops = catchableTargets.filter(p =>
      !p.result?.includes('complete') && !p.result?.includes('touchdown')
    ).length;

    // Situational
    const thirdDownTargets = plays.filter(p => p.down === 3);
    const thirdDownCatches = thirdDownTargets.filter(p =>
      (p.result?.includes('complete') || p.result?.includes('touchdown')) &&
      (p.resulted_in_first_down || p.result?.includes('touchdown'))
    ).length;

    const redZoneTargets = plays.filter(p => p.yard_line && p.yard_line >= 80);
    const redZoneTDs = redZoneTargets.filter(p => p.result?.includes('touchdown')).length;

    return {
      playerName: `${player.first_name} ${player.last_name}`,
      jerseyNumber: player.jersey_number,
      position: player.primary_position,

      // Receiving
      targets: plays.length,
      receptions,
      recYards,
      recAvg: receptions > 0 ? recYards / receptions : 0,
      yardsPerTarget: plays.length > 0 ? recYards / plays.length : 0,
      recTDs,
      catchRate: plays.length > 0 ? (receptions / plays.length) * 100 : 0,
      explosiveCatches: explosive,
      explosiveRate: receptions > 0 ? (explosive / receptions) * 100 : 0,

      drops,
      dropRate: catchableTargets.length > 0 ? (drops / catchableTargets.length) * 100 : 0,

      // Situational
      thirdDownTargets: thirdDownTargets.length,
      thirdDownConversions: thirdDownCatches,
      thirdDownPct: thirdDownTargets.length > 0 ? (thirdDownCatches / thirdDownTargets.length) * 100 : 0,

      redZoneTargets: redZoneTargets.length,
      redZoneTDs,
      redZoneTDPct: redZoneTargets.length > 0 ? (redZoneTDs / redZoneTargets.length) * 100 : 0
    };
  }

  /**
   * Get DL-specific stats for a player
   * Shows pass rush, run defense, and havoc metrics
   */
  async getDLStats(playerId: string, gameId?: string) {
    const { data: player } = await this.supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (!player) throw new Error('Player not found');

    // Build query for defensive plays where player participated
    let query = this.supabase
      .from('play_instances')
      .select('*')
      .eq('team_id', player.team_id)
      .eq('is_opponent_play', true);

    if (gameId) {
      const { data: videos } = await this.supabase
        .from('videos')
        .select('id')
        .eq('game_id', gameId);

      if (videos && videos.length > 0) {
        query = query.in('video_id', videos.map(v => v.id));
      }
    }

    const { data: allPlays } = await query;
    if (!allPlays || allPlays.length === 0) return null;

    // Filter plays where this player was involved
    const plays = allPlays.filter(p =>
      p.tackler_ids?.includes(playerId) ||
      p.missed_tackle_ids?.includes(playerId) ||
      p.pressure_player_ids?.includes(playerId) ||
      p.sack_player_id === playerId
    );

    if (plays.length === 0) return null;

    // Tackle stats
    const primaryTackles = plays.filter(p => p.tackler_ids?.[0] === playerId).length;
    const assistTackles = plays.filter(p =>
      p.tackler_ids?.includes(playerId) && p.tackler_ids?.[0] !== playerId
    ).length;
    const missedTackles = plays.filter(p => p.missed_tackle_ids?.includes(playerId)).length;

    // Pass rush stats
    const passPlays = allPlays.filter(p => p.play_type === 'pass');
    const pressures = passPlays.filter(p => p.pressure_player_ids?.includes(playerId)).length;
    const sacks = passPlays.filter(p => p.sack_player_id === playerId).length;

    // Run defense
    const runPlays = allPlays.filter(p => p.play_type === 'run');
    const runStops = runPlays.filter(p =>
      p.tackler_ids?.includes(playerId) && !p.success
    ).length;

    // Havoc
    const tfls = plays.filter(p =>
      p.is_tfl && p.tackler_ids?.includes(playerId)
    ).length;
    const forcedFumbles = plays.filter(p =>
      p.is_forced_fumble && p.tackler_ids?.includes(playerId)
    ).length;

    const defensiveSnaps = allPlays.length;

    return {
      playerName: `${player.first_name} ${player.last_name}`,
      jerseyNumber: player.jersey_number,
      position: player.primary_position,

      // Tackles
      defensiveSnaps,
      primaryTackles,
      assistTackles,
      totalTackles: primaryTackles + assistTackles,
      missedTackles,
      tackleParticipation: defensiveSnaps > 0 ? ((primaryTackles + assistTackles) / defensiveSnaps) * 100 : 0,
      missedTackleRate: (primaryTackles + assistTackles + missedTackles) > 0
        ? (missedTackles / (primaryTackles + assistTackles + missedTackles)) * 100
        : 0,

      // Pass Rush
      passRushSnaps: passPlays.length,
      pressures,
      sacks,
      pressureRate: passPlays.length > 0 ? (pressures / passPlays.length) * 100 : 0,
      sackRate: passPlays.length > 0 ? (sacks / passPlays.length) * 100 : 0,

      // Run Defense
      runDefenseSnaps: runPlays.length,
      runStops,
      runStopRate: runPlays.length > 0 ? (runStops / runPlays.length) * 100 : 0,

      // Havoc
      tfls,
      forcedFumbles,
      havocPlays: tfls + sacks + forcedFumbles,
      havocRate: defensiveSnaps > 0 ? ((tfls + sacks + forcedFumbles) / defensiveSnaps) * 100 : 0
    };
  }

  /**
   * Get LB-specific stats for a player
   * Shows tackling, coverage, and blitz metrics
   */
  async getLBStats(playerId: string, gameId?: string) {
    const { data: player } = await this.supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (!player) throw new Error('Player not found');

    // Build query for defensive plays
    let query = this.supabase
      .from('play_instances')
      .select('*')
      .eq('team_id', player.team_id)
      .eq('is_opponent_play', true);

    if (gameId) {
      const { data: videos } = await this.supabase
        .from('videos')
        .select('id')
        .eq('game_id', gameId);

      if (videos && videos.length > 0) {
        query = query.in('video_id', videos.map(v => v.id));
      }
    }

    const { data: allPlays } = await query;
    if (!allPlays || allPlays.length === 0) return null;

    const plays = allPlays.filter(p =>
      p.tackler_ids?.includes(playerId) ||
      p.missed_tackle_ids?.includes(playerId) ||
      p.coverage_player_id === playerId ||
      p.pressure_player_ids?.includes(playerId)
    );

    if (plays.length === 0) return null;

    // Tackle stats
    const primaryTackles = plays.filter(p => p.tackler_ids?.[0] === playerId).length;
    const assistTackles = plays.filter(p =>
      p.tackler_ids?.includes(playerId) && p.tackler_ids?.[0] !== playerId
    ).length;
    const missedTackles = plays.filter(p => p.missed_tackle_ids?.includes(playerId)).length;

    // Coverage stats
    const coverageSnaps = allPlays.filter(p => p.coverage_player_id === playerId);
    const coverageWins = coverageSnaps.filter(p => p.coverage_result === 'win').length;

    // Blitz stats
    const blitzSnaps = allPlays.filter(p =>
      p.play_type === 'pass' && p.pressure_player_ids?.includes(playerId)
    );
    const pressures = blitzSnaps.filter(p => p.pressure_player_ids?.includes(playerId)).length;
    const sacks = blitzSnaps.filter(p => p.sack_player_id === playerId).length;

    // Havoc
    const tfls = plays.filter(p => p.is_tfl && p.tackler_ids?.includes(playerId)).length;
    const forcedFumbles = plays.filter(p =>
      p.is_forced_fumble && p.tackler_ids?.includes(playerId)
    ).length;
    const interceptions = plays.filter(p =>
      p.is_interception && p.coverage_player_id === playerId
    ).length;
    const pbus = plays.filter(p =>
      p.is_pbu && p.coverage_player_id === playerId
    ).length;

    const defensiveSnaps = allPlays.length;

    return {
      playerName: `${player.first_name} ${player.last_name}`,
      jerseyNumber: player.jersey_number,
      position: player.primary_position,

      // Tackles
      defensiveSnaps,
      primaryTackles,
      assistTackles,
      totalTackles: primaryTackles + assistTackles,
      missedTackles,
      tackleParticipation: defensiveSnaps > 0 ? ((primaryTackles + assistTackles) / defensiveSnaps) * 100 : 0,

      // Coverage
      coverageSnaps: coverageSnaps.length,
      coverageWins,
      coverageSuccessRate: coverageSnaps.length > 0 ? (coverageWins / coverageSnaps.length) * 100 : 0,

      // Blitz
      blitzSnaps: blitzSnaps.length,
      pressures,
      sacks,
      pressureRate: blitzSnaps.length > 0 ? (pressures / blitzSnaps.length) * 100 : 0,

      // Havoc
      tfls,
      forcedFumbles,
      interceptions,
      pbus,
      havocPlays: tfls + forcedFumbles + interceptions + pbus + sacks,
      havocRate: defensiveSnaps > 0 ? ((tfls + forcedFumbles + interceptions + pbus + sacks) / defensiveSnaps) * 100 : 0
    };
  }

  /**
   * Get DB-specific stats for a player
   * Shows coverage, interceptions, and pass breakup metrics
   */
  async getDBStats(playerId: string, gameId?: string) {
    const { data: player } = await this.supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (!player) throw new Error('Player not found');

    // Build query for defensive plays
    let query = this.supabase
      .from('play_instances')
      .select('*')
      .eq('team_id', player.team_id)
      .eq('is_opponent_play', true);

    if (gameId) {
      const { data: videos } = await this.supabase
        .from('videos')
        .select('id')
        .eq('game_id', gameId);

      if (videos && videos.length > 0) {
        query = query.in('video_id', videos.map(v => v.id));
      }
    }

    const { data: allPlays } = await query;
    if (!allPlays || allPlays.length === 0) return null;

    const plays = allPlays.filter(p =>
      p.tackler_ids?.includes(playerId) ||
      p.coverage_player_id === playerId
    );

    if (plays.length === 0) return null;

    // Coverage stats
    const coverageSnaps = allPlays.filter(p => p.coverage_player_id === playerId);
    const targets = coverageSnaps.filter(p => p.play_type === 'pass');
    const coverageWins = targets.filter(p => p.coverage_result === 'win').length;
    const completionsAllowed = targets.filter(p =>
      (p.result?.includes('complete') || p.result?.includes('touchdown')) &&
      p.coverage_result !== 'win'
    ).length;
    const yardsAllowed = targets
      .filter(p => p.result?.includes('complete') || p.result?.includes('touchdown'))
      .reduce((sum, p) => sum + (p.yards_gained || 0), 0);

    // Ball production
    const interceptions = plays.filter(p =>
      p.is_interception && p.coverage_player_id === playerId
    ).length;
    const pbus = plays.filter(p =>
      p.is_pbu && p.coverage_player_id === playerId
    ).length;

    // Tackle stats
    const primaryTackles = plays.filter(p => p.tackler_ids?.[0] === playerId).length;
    const assistTackles = plays.filter(p =>
      p.tackler_ids?.includes(playerId) && p.tackler_ids?.[0] !== playerId
    ).length;
    const missedTackles = plays.filter(p => p.missed_tackle_ids?.includes(playerId)).length;

    const defensiveSnaps = allPlays.length;

    return {
      playerName: `${player.first_name} ${player.last_name}`,
      jerseyNumber: player.jersey_number,
      position: player.primary_position,

      // Coverage
      defensiveSnaps,
      coverageSnaps: coverageSnaps.length,
      targets: targets.length,
      completionsAllowed,
      yardsAllowed,
      yardsAllowedPerTarget: targets.length > 0 ? yardsAllowed / targets.length : 0,
      coverageWins,
      coverageSuccessRate: targets.length > 0 ? (coverageWins / targets.length) * 100 : 0,

      // Ball Production
      interceptions,
      pbus,
      ballProduction: interceptions + pbus,
      ballProductionRate: defensiveSnaps > 0 ? ((interceptions + pbus) / defensiveSnaps) * 100 : 0,

      // Tackles
      primaryTackles,
      assistTackles,
      totalTackles: primaryTackles + assistTackles,
      missedTackles,
      tackleParticipation: defensiveSnaps > 0 ? ((primaryTackles + assistTackles) / defensiveSnaps) * 100 : 0
    };
  }

  /**
   * Get defensive drive analytics
   * Shows opponent possession metrics (yards allowed, stops, etc.)
   */
  async getDefensiveDriveAnalytics(teamId: string, gameId?: string) {
    const config = await this.getTeamTier(teamId);
    if (!config.enable_drive_analytics) {
      throw new Error('Drive analytics not enabled for this team tier');
    }

    // Build query for defensive drives
    let query = this.supabase
      .from('drives')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_offensive_drive', false);

    if (gameId) {
      query = query.eq('game_id', gameId);
    }

    const { data: drives, error } = await query;

    if (error) throw new Error(`Failed to fetch defensive drives: ${error.message}`);
    if (!drives || drives.length === 0) {
      return {
        totalDrives: 0,
        pointsAllowedPerDrive: 0,
        avgPlaysPerDrive: 0,
        avgYardsAllowedPerDrive: 0,
        threeAndOutRate: 0,
        redZoneStopRate: 0,
        scoringDriveAllowedRate: 0,
        touchdownsAllowed: 0,
        fieldGoalsAllowed: 0,
        stops: 0,
        turnovers: 0
      };
    }

    // Calculate defensive metrics
    const totalDrives = drives.length;
    const pointsAllowed = drives.reduce((sum, d) => sum + d.points, 0);
    const totalPlays = drives.reduce((sum, d) => sum + d.plays_count, 0);
    const totalYards = drives.reduce((sum, d) => sum + d.yards_gained, 0);
    const threeAndOuts = drives.filter(d => d.three_and_out).length;
    const redZoneDrives = drives.filter(d => d.reached_red_zone).length;
    const redZoneStops = drives.filter(d =>
      d.reached_red_zone && d.result !== 'touchdown'
    ).length;
    const scoringDrives = drives.filter(d => d.scoring_drive).length;

    const touchdownsAllowed = drives.filter(d => d.result === 'touchdown').length;
    const fieldGoalsAllowed = drives.filter(d => d.result === 'field_goal').length;
    const stops = drives.filter(d =>
      d.result === 'punt' || d.result === 'downs' || d.result === 'turnover'
    ).length;
    const turnovers = drives.filter(d => d.result === 'turnover').length;

    return {
      totalDrives,
      pointsAllowedPerDrive: totalDrives > 0 ? pointsAllowed / totalDrives : 0,
      avgPlaysPerDrive: totalDrives > 0 ? totalPlays / totalDrives : 0,
      avgYardsAllowedPerDrive: totalDrives > 0 ? totalYards / totalDrives : 0,
      threeAndOutRate: totalDrives > 0 ? (threeAndOuts / totalDrives) * 100 : 0,
      redZoneStopRate: redZoneDrives > 0 ? (redZoneStops / redZoneDrives) * 100 : 0,
      scoringDriveAllowedRate: totalDrives > 0 ? (scoringDrives / totalDrives) * 100 : 0,
      touchdownsAllowed,
      fieldGoalsAllowed,
      stops,
      turnovers
    };
  }

  /**
   * Get defensive down breakdown analytics
   * Shows opponent performance by down and distance
   */
  async getDefensiveDownBreakdown(teamId: string, gameId?: string) {
    // Build query for opponent plays
    let query = this.supabase
      .from('play_instances')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_opponent_play', true);

    if (gameId) {
      const { data: videos } = await this.supabase
        .from('videos')
        .select('id')
        .eq('game_id', gameId);

      if (videos && videos.length > 0) {
        query = query.in('video_id', videos.map(v => v.id));
      }
    }

    const { data: plays, error } = await query;

    if (error) throw new Error(`Failed to fetch plays: ${error.message}`);
    if (!plays || plays.length === 0) return [];

    // Group by down
    const downStats = [1, 2, 3, 4].map(down => {
      const downPlays = plays.filter(p => p.down === down);
      if (downPlays.length === 0) return null;

      const yardsAllowed = downPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);

      // Defensive success = opponent failed to get expected yards
      const defensiveSuccesses = downPlays.filter(p => {
        const gain = p.yards_gained || 0;
        const distance = p.distance || 10;
        if (down === 1) return gain < 0.40 * distance;
        if (down === 2) return gain < 0.60 * distance;
        return gain < distance;
      }).length;

      const stops = downPlays.filter(p => !p.resulted_in_first_down).length;
      const turnovers = downPlays.filter(p => p.is_turnover).length;

      return {
        down,
        plays: downPlays.length,
        yardsAllowed,
        yardsAllowedPerPlay: yardsAllowed / downPlays.length,
        defensiveSuccessRate: (defensiveSuccesses / downPlays.length) * 100,
        stopRate: (stops / downPlays.length) * 100,
        turnovers,
        turnoverRate: (turnovers / downPlays.length) * 100
      };
    });

    return downStats.filter(s => s !== null);
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
