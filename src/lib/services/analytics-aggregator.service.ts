/**
 * Analytics Aggregator Service
 *
 * Central service for filtering and aggregating analytics data.
 * Supports filtering by:
 * - ODK (Offense/Defense/Special Teams)
 * - Level (Season/Game/Player)
 * - Specific game or player
 *
 * Delegates to AnalyticsService and AdvancedAnalyticsService
 * but adds additional filtering and aggregation logic.
 */

import { AnalyticsService } from './analytics.service';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import type { PlayInstance } from '@/types/football';

export interface AnalyticsFilter {
  teamId: string;
  odk: 'offense' | 'defense' | 'special_teams';
  level: 'season' | 'game' | 'player';
  gameId?: string; // Required when level = 'game'
  playerId?: string; // Required when level = 'player'
}

export class AnalyticsAggregatorService {
  private analyticsService: AnalyticsService;
  private advancedService: AdvancedAnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
    this.advancedService = new AdvancedAnalyticsService();
  }

  /**
   * Get filtered play instances based on ODK, level, and game/player
   */
  async getFilteredPlays(filter: AnalyticsFilter): Promise<PlayInstance[]> {
    // Implementation will use existing service methods
    // and add additional filtering logic

    // For now, return empty array - will implement filtering
    return [];
  }

  /**
   * Get overall performance stats (Season or Game level)
   */
  async getOverallPerformance(filter: AnalyticsFilter) {
    if (filter.level === 'season') {
      return this.analyticsService.getTeamAnalytics(filter.teamId);
    } else if (filter.level === 'game' && filter.gameId) {
      // Filter to specific game
      const seasonStats = await this.analyticsService.getTeamAnalytics(filter.teamId);
      // TODO: Add game filtering
      return seasonStats;
    }

    return null;
  }

  /**
   * Get drive analytics (Season or Game level, Tier 2+)
   */
  async getDriveAnalytics(filter: AnalyticsFilter) {
    if (filter.level === 'player') return null; // Not applicable at player level

    const driveStats = await this.advancedService.getDriveAnalytics(filter.teamId);

    if (filter.level === 'game' && filter.gameId) {
      // TODO: Filter to specific game
      return driveStats;
    }

    return driveStats;
  }

  /**
   * Get player stats (Player level only, Tier 2+)
   */
  async getPlayerStats(filter: AnalyticsFilter) {
    if (filter.level !== 'player') return []; // Only at player level

    const playerStats = await this.advancedService.getPlayerAttributionStats(filter.teamId);

    if (filter.gameId) {
      // TODO: Filter to specific game
      return playerStats;
    }

    return playerStats;
  }

  /**
   * Get offensive line stats (Tier 3)
   */
  async getOffensiveLineStats(filter: AnalyticsFilter) {
    if (filter.odk !== 'offense') return [];

    const olStats = await this.advancedService.getOffensiveLineStats(filter.teamId);

    if (filter.level === 'game' && filter.gameId) {
      // TODO: Filter to specific game
      return olStats;
    }

    return olStats;
  }

  /**
   * Get defensive stats (Tier 3)
   */
  async getDefensiveStats(filter: AnalyticsFilter) {
    if (filter.odk !== 'defense') return [];

    const defStats = await this.advancedService.getDefensiveStats(filter.teamId);

    if (filter.level === 'game' && filter.gameId) {
      // TODO: Filter to specific game
      return defStats;
    }

    return defStats;
  }

  /**
   * Get situational splits (Tier 3)
   */
  async getSituationalSplits(filter: AnalyticsFilter) {
    if (filter.level === 'player') return []; // Not applicable at player level

    const splits = await this.advancedService.getSituationalSplits(filter.teamId);

    if (filter.level === 'game' && filter.gameId) {
      // TODO: Filter to specific game
      return splits;
    }

    return splits;
  }

  /**
   * Get top performing plays
   */
  async getTopPlays(filter: AnalyticsFilter) {
    if (filter.level === 'player') return []; // Not applicable at player level

    // TODO: Implement top plays by game or season
    // For now, return from basic analytics
    const basicStats = await this.analyticsService.getTeamAnalytics(filter.teamId);
    return basicStats.topPlays || [];
  }
}
