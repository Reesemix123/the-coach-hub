// src/lib/entitlements/enforcement-service.ts
// Enforcement Service for Tier Limits
// Handles game locking on downgrade and expiration enforcement

import { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';

// ============================================================================
// Types
// ============================================================================

export interface EnforcementResult {
  success: boolean;
  gamesLocked: number;
  gamesUnlocked: number;
  currentActiveGames: number;
  maxAllowedGames: number;
  error?: string;
}

export interface ExpiringGame {
  gameId: string;
  gameName: string;
  expiresAt: Date;
  daysUntilExpiration: number;
}

export interface ExpirationResult {
  success: boolean;
  gamesExpired: number;
  expiredGames: Array<{
    teamId: string;
    gameId: string;
    gameName: string;
    expiredAt: Date;
  }>;
  error?: string;
}

export interface TierLimits {
  tierKey: string;
  maxActiveGames: number;
  camerasPerGame: number;
  retentionDays: number;
}

// ============================================================================
// Enforcement Service
// ============================================================================

export class EnforcementService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // ============================================================================
  // Core Enforcement Methods
  // ============================================================================

  /**
   * Enforce tier limits for a team
   * Locks/unlocks games as needed based on current tier
   */
  async enforceTierLimits(teamId: string): Promise<EnforcementResult> {
    const { data, error } = await this.supabase.rpc('enforce_tier_limits', {
      p_team_id: teamId
    });

    if (error) {
      console.error('Failed to enforce tier limits:', error);
      return {
        success: false,
        gamesLocked: 0,
        gamesUnlocked: 0,
        currentActiveGames: 0,
        maxAllowedGames: 0,
        error: error.message
      };
    }

    // Handle the result - it returns a single row
    const result = Array.isArray(data) ? data[0] : data;

    return {
      success: true,
      gamesLocked: result?.games_locked || 0,
      gamesUnlocked: result?.games_unlocked || 0,
      currentActiveGames: result?.current_active_games || 0,
      maxAllowedGames: result?.max_allowed_games || 0
    };
  }

  /**
   * Run expiration check across all teams
   * Locks games that have passed their expiration date
   */
  async expireOldGames(): Promise<ExpirationResult> {
    const { data, error } = await this.supabase.rpc('expire_old_games');

    if (error) {
      console.error('Failed to expire old games:', error);
      return {
        success: false,
        gamesExpired: 0,
        expiredGames: [],
        error: error.message
      };
    }

    const expiredGames = (data || []).map((row: {
      team_id: string;
      game_id: string;
      game_name: string;
      expired_at: string;
    }) => ({
      teamId: row.team_id,
      gameId: row.game_id,
      gameName: row.game_name,
      expiredAt: new Date(row.expired_at)
    }));

    return {
      success: true,
      gamesExpired: expiredGames.length,
      expiredGames
    };
  }

  /**
   * Update game expiration dates based on current tier
   * Called when tier changes to recalculate all expirations
   */
  async updateGameExpirations(teamId: string): Promise<{ success: boolean; updatedCount: number }> {
    const { data, error } = await this.supabase.rpc('update_game_expirations', {
      p_team_id: teamId
    });

    if (error) {
      console.error('Failed to update game expirations:', error);
      return { success: false, updatedCount: 0 };
    }

    return { success: true, updatedCount: data || 0 };
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Get games expiring soon for warning display
   */
  async getExpiringGames(teamId: string, daysAhead: number = 7): Promise<ExpiringGame[]> {
    const { data, error } = await this.supabase.rpc('get_expiring_games', {
      p_team_id: teamId,
      p_days_ahead: daysAhead
    });

    if (error) {
      console.error('Failed to get expiring games:', error);
      return [];
    }

    return (data || []).map((row: {
      game_id: string;
      game_name: string;
      expires_at: string;
      days_until_expiration: number;
    }) => ({
      gameId: row.game_id,
      gameName: row.game_name,
      expiresAt: new Date(row.expires_at),
      daysUntilExpiration: row.days_until_expiration
    }));
  }

  /**
   * Get tier limits for a team
   */
  async getTierLimits(teamId: string): Promise<TierLimits | null> {
    const { data, error } = await this.supabase.rpc('get_team_tier_limits', {
      p_team_id: teamId
    });

    if (error || !data || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      tierKey: row.tier_key,
      maxActiveGames: row.max_active_games,
      camerasPerGame: row.cameras_per_game,
      retentionDays: row.retention_days
    };
  }

  /**
   * Count active games for a team
   */
  async countActiveGames(teamId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('count_active_games', {
      p_team_id: teamId
    });

    if (error) {
      console.error('Failed to count active games:', error);
      return 0;
    }

    return data || 0;
  }

  /**
   * Get locked games for a team
   */
  async getLockedGames(teamId: string): Promise<Array<{
    id: string;
    name: string;
    lockedReason: string;
    createdAt: Date;
  }>> {
    const { data, error } = await this.supabase
      .from('games')
      .select('id, name, locked_reason, created_at')
      .eq('team_id', teamId)
      .eq('is_locked', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to get locked games:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      lockedReason: row.locked_reason || 'unknown',
      createdAt: new Date(row.created_at)
    }));
  }

  // ============================================================================
  // Manual Lock/Unlock Methods
  // ============================================================================

  /**
   * Manually lock a specific game
   */
  async lockGame(gameId: string, reason: string = 'manual'): Promise<boolean> {
    const { error } = await this.supabase
      .from('games')
      .update({
        is_locked: true,
        locked_reason: reason
      })
      .eq('id', gameId);

    if (error) {
      console.error('Failed to lock game:', error);
      return false;
    }

    return true;
  }

  /**
   * Manually unlock a specific game (admin/upgrade action)
   */
  async unlockGame(gameId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('games')
      .update({
        is_locked: false,
        locked_reason: null
      })
      .eq('id', gameId);

    if (error) {
      console.error('Failed to unlock game:', error);
      return false;
    }

    return true;
  }

  /**
   * Unlock multiple games for a team (upgrade action)
   */
  async unlockGames(teamId: string, count?: number): Promise<number> {
    const { data, error } = await this.supabase.rpc('unlock_games', {
      p_team_id: teamId,
      p_count: count || null
    });

    if (error) {
      console.error('Failed to unlock games:', error);
      return 0;
    }

    return data || 0;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export async function createEnforcementService(): Promise<EnforcementService> {
  const supabase = await createServerClient();
  return new EnforcementService(supabase);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Enforce tier limits for a team (convenience function)
 */
export async function enforceTierLimits(teamId: string): Promise<EnforcementResult> {
  const service = await createEnforcementService();
  return service.enforceTierLimits(teamId);
}

/**
 * Get games expiring soon (convenience function)
 */
export async function getExpiringGames(teamId: string, daysAhead: number = 7): Promise<ExpiringGame[]> {
  const service = await createEnforcementService();
  return service.getExpiringGames(teamId, daysAhead);
}

/**
 * Run global expiration check (convenience function for cron jobs)
 */
export async function runExpirationCheck(): Promise<ExpirationResult> {
  const service = await createEnforcementService();
  return service.expireOldGames();
}
