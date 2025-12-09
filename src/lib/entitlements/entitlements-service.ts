// src/lib/entitlements/entitlements-service.ts
// Centralized Entitlements Service - Single point of truth for all capability checks
// Features should NEVER query subscription directly - always use this service

import { createClient as createServerClient } from '@/utils/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { SubscriptionTier, SubscriptionStatus, TierConfig } from '@/types/admin';
import { TokenService, TokenBalanceSummary } from './token-service';

// ============================================================================
// Types
// ============================================================================

export interface EntitlementResult {
  allowed: boolean;
  reason?: string;
  upgradeOption?: SubscriptionTier;
  currentUsage?: number;
  limit?: number;
}

export interface GameLimits {
  maxActiveGames: number | null; // null = unlimited (retention-based)
  maxTeamGames: number | null;
  maxOpponentGames: number | null;
  retentionDays: number;
  currentActiveGames: number;
  currentTeamGames: number;
  currentOpponentGames: number;
}

export interface VideoRequirements {
  maxDurationSeconds: number;
  maxResolutionWidth: number;
  maxResolutionHeight: number;
  maxFps: number;
  acceptedFormats: string[];
}

export interface TierInfo {
  tierKey: SubscriptionTier;
  displayName: string;
  status: SubscriptionStatus;
  billingWaived: boolean;
  features: string[];
}

export interface TierComparisonItem {
  tierKey: SubscriptionTier;
  displayName: string;
  isCurrent: boolean;
  isUpgrade: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  uploadTokens: number;
  camerasPerGame: number;
  retentionDays: number;
  features: string[];
}

// ============================================================================
// Entitlements Service Class
// ============================================================================

export class EntitlementsService {
  private supabase: SupabaseClient;
  private tokenService: TokenService;
  private tierConfigCache: Map<string, TierConfig> = new Map();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.tokenService = new TokenService(supabase);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async getSubscription(teamId: string): Promise<{
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    billing_waived: boolean;
  } | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('tier, status, billing_waived')
      .eq('team_id', teamId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      tier: data.tier as SubscriptionTier,
      status: data.status as SubscriptionStatus,
      billing_waived: data.billing_waived
    };
  }

  private async getTierConfig(tierKey: string): Promise<TierConfig | null> {
    // Check cache first
    if (this.tierConfigCache.has(tierKey)) {
      return this.tierConfigCache.get(tierKey)!;
    }

    const { data, error } = await this.supabase
      .from('tier_config')
      .select('*')
      .eq('tier_key', tierKey)
      .single();

    if (error || !data) {
      return null;
    }

    this.tierConfigCache.set(tierKey, data as TierConfig);
    return data as TierConfig;
  }

  private async getAllTierConfigs(): Promise<TierConfig[]> {
    const { data, error } = await this.supabase
      .from('tier_config')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error || !data) {
      return [];
    }

    // Cache them
    for (const config of data) {
      this.tierConfigCache.set(config.tier_key, config as TierConfig);
    }

    return data as TierConfig[];
  }

  private isActiveStatus(status: SubscriptionStatus, billingWaived: boolean): boolean {
    if (billingWaived) return true;
    return ['active', 'trialing', 'past_due', 'waived'].includes(status);
  }

  // ============================================================================
  // Capability Checks
  // ============================================================================

  /**
   * Check if team can create a new game
   */
  async canCreateGame(teamId: string, gameType: 'team' | 'opponent'): Promise<EntitlementResult> {
    // Get subscription
    const subscription = await this.getSubscription(teamId);
    if (!subscription) {
      return { allowed: false, reason: 'No subscription found' };
    }

    if (!this.isActiveStatus(subscription.status, subscription.billing_waived)) {
      return { allowed: false, reason: 'Subscription is not active' };
    }

    // Get tier config
    const tierConfig = await this.getTierConfig(subscription.tier);
    if (!tierConfig) {
      return { allowed: false, reason: 'Tier configuration not found' };
    }

    // Check token availability
    const tokenSummary = await this.tokenService.getTokenBalanceSummary(teamId);
    if (tokenSummary.totalAvailable < 1) {
      return {
        allowed: false,
        reason: 'No upload tokens available. Purchase additional tokens or wait for your next billing cycle.',
        currentUsage: 0,
        limit: tierConfig.monthly_upload_tokens,
        upgradeOption: this.getNextTier(subscription.tier)
      };
    }

    // Check game limits (for Basic tier)
    if (tierConfig.max_active_games !== null) {
      const gameCounts = await this.getGameCounts(teamId);

      // Check specific game type limits
      if (gameType === 'team' && tierConfig.max_team_games !== null) {
        if (gameCounts.teamGames >= tierConfig.max_team_games) {
          return {
            allowed: false,
            reason: `Team game limit reached. Your plan allows ${tierConfig.max_team_games} active team game${tierConfig.max_team_games === 1 ? '' : 's'}.`,
            upgradeOption: 'plus',
            currentUsage: gameCounts.teamGames,
            limit: tierConfig.max_team_games
          };
        }
      }

      if (gameType === 'opponent' && tierConfig.max_opponent_games !== null) {
        if (gameCounts.opponentGames >= tierConfig.max_opponent_games) {
          return {
            allowed: false,
            reason: `Opponent game limit reached. Your plan allows ${tierConfig.max_opponent_games} active opponent game${tierConfig.max_opponent_games === 1 ? '' : 's'}.`,
            upgradeOption: 'plus',
            currentUsage: gameCounts.opponentGames,
            limit: tierConfig.max_opponent_games
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Check if team can add another camera to a game
   */
  async canAddCamera(teamId: string, gameId: string): Promise<EntitlementResult> {
    // Get subscription
    const subscription = await this.getSubscription(teamId);
    if (!subscription) {
      return { allowed: false, reason: 'No subscription found' };
    }

    if (!this.isActiveStatus(subscription.status, subscription.billing_waived)) {
      return { allowed: false, reason: 'Subscription is not active' };
    }

    // Get tier config
    const tierConfig = await this.getTierConfig(subscription.tier);
    if (!tierConfig) {
      return { allowed: false, reason: 'Tier configuration not found' };
    }

    // Check if game exists and is not locked/expired
    const { data: game } = await this.supabase
      .from('games')
      .select('id, is_locked, expires_at')
      .eq('id', gameId)
      .eq('team_id', teamId)
      .single();

    if (!game) {
      return { allowed: false, reason: 'Game not found' };
    }

    if (game.is_locked) {
      return {
        allowed: false,
        reason: 'Game is locked. Upgrade your plan to access this game.',
        upgradeOption: this.getNextTier(subscription.tier)
      };
    }

    if (game.expires_at && new Date(game.expires_at) < new Date()) {
      return { allowed: false, reason: 'Game has expired' };
    }

    // Count current cameras
    const { count, error } = await this.supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId);

    const currentCameras = count || 0;

    if (currentCameras >= tierConfig.max_cameras_per_game) {
      return {
        allowed: false,
        reason: `Camera limit reached. Your plan allows ${tierConfig.max_cameras_per_game} camera angle${tierConfig.max_cameras_per_game === 1 ? '' : 's'} per game.`,
        upgradeOption: this.getNextTier(subscription.tier),
        currentUsage: currentCameras,
        limit: tierConfig.max_cameras_per_game
      };
    }

    return { allowed: true };
  }

  /**
   * Check if team can access a specific game
   */
  async canAccessGame(teamId: string, gameId: string): Promise<EntitlementResult> {
    // Get subscription
    const subscription = await this.getSubscription(teamId);
    if (!subscription) {
      return { allowed: false, reason: 'No subscription found' };
    }

    if (!this.isActiveStatus(subscription.status, subscription.billing_waived)) {
      return { allowed: false, reason: 'Subscription is not active' };
    }

    // Check if game exists
    const { data: game } = await this.supabase
      .from('games')
      .select('id, is_locked, locked_reason, expires_at')
      .eq('id', gameId)
      .eq('team_id', teamId)
      .single();

    if (!game) {
      return { allowed: false, reason: 'Game not found' };
    }

    if (game.is_locked) {
      return {
        allowed: false,
        reason: game.locked_reason || 'Game is locked due to plan limits. Upgrade to access.',
        upgradeOption: this.getNextTier(subscription.tier)
      };
    }

    if (game.expires_at && new Date(game.expires_at) < new Date()) {
      return { allowed: false, reason: 'Game has expired and is no longer accessible' };
    }

    return { allowed: true };
  }

  /**
   * Check if team can use AI Chat (available on all tiers)
   */
  async canUseAiChat(teamId: string): Promise<EntitlementResult> {
    const subscription = await this.getSubscription(teamId);
    if (!subscription) {
      return { allowed: false, reason: 'No subscription found' };
    }

    if (!this.isActiveStatus(subscription.status, subscription.billing_waived)) {
      return { allowed: false, reason: 'Subscription is not active' };
    }

    // Get tier config
    const tierConfig = await this.getTierConfig(subscription.tier);
    if (!tierConfig) {
      return { allowed: false, reason: 'Tier configuration not found' };
    }

    if (!tierConfig.ai_chat_enabled) {
      return {
        allowed: false,
        reason: 'AI Chat is not available on your plan',
        upgradeOption: 'premium'
      };
    }

    return { allowed: true };
  }

  /**
   * Check if team can use AI Film Tagging (disabled for MVP)
   */
  async canUseAiFilmTagging(teamId: string): Promise<EntitlementResult> {
    const subscription = await this.getSubscription(teamId);
    if (!subscription) {
      return { allowed: false, reason: 'No subscription found' };
    }

    // Get tier config
    const tierConfig = await this.getTierConfig(subscription.tier);
    if (!tierConfig) {
      return { allowed: false, reason: 'Tier configuration not found' };
    }

    if (!tierConfig.ai_film_tagging_enabled) {
      return {
        allowed: false,
        reason: 'AI Film Tagging is coming soon (before 2026 season)'
      };
    }

    // When enabled, check credits
    // For now, always return disabled
    return {
      allowed: false,
      reason: 'AI Film Tagging is coming soon (before 2026 season)'
    };
  }

  // ============================================================================
  // Limit Queries
  // ============================================================================

  /**
   * Get game limits for a team
   */
  async getGameLimits(teamId: string): Promise<GameLimits> {
    const subscription = await this.getSubscription(teamId);
    if (!subscription) {
      return {
        maxActiveGames: 0,
        maxTeamGames: 0,
        maxOpponentGames: 0,
        retentionDays: 0,
        currentActiveGames: 0,
        currentTeamGames: 0,
        currentOpponentGames: 0
      };
    }

    const tierConfig = await this.getTierConfig(subscription.tier);
    if (!tierConfig) {
      return {
        maxActiveGames: 0,
        maxTeamGames: 0,
        maxOpponentGames: 0,
        retentionDays: 30,
        currentActiveGames: 0,
        currentTeamGames: 0,
        currentOpponentGames: 0
      };
    }

    const gameCounts = await this.getGameCounts(teamId);

    return {
      maxActiveGames: tierConfig.max_active_games,
      maxTeamGames: tierConfig.max_team_games,
      maxOpponentGames: tierConfig.max_opponent_games,
      retentionDays: tierConfig.retention_days,
      currentActiveGames: gameCounts.teamGames + gameCounts.opponentGames,
      currentTeamGames: gameCounts.teamGames,
      currentOpponentGames: gameCounts.opponentGames
    };
  }

  /**
   * Get token balance for a team
   */
  async getTokenBalance(teamId: string): Promise<TokenBalanceSummary> {
    return this.tokenService.getTokenBalanceSummary(teamId);
  }

  /**
   * Get camera limit for a team's tier
   */
  async getCameraLimit(teamId: string): Promise<number> {
    const subscription = await this.getSubscription(teamId);
    if (!subscription) return 1;

    const tierConfig = await this.getTierConfig(subscription.tier);
    return tierConfig?.max_cameras_per_game || 1;
  }

  /**
   * Get video requirements for validation
   */
  async getVideoRequirements(teamId: string): Promise<VideoRequirements> {
    const subscription = await this.getSubscription(teamId);
    const tierConfig = subscription ? await this.getTierConfig(subscription.tier) : null;

    return {
      maxDurationSeconds: tierConfig?.max_video_duration_seconds || 10800, // 3 hours
      maxResolutionWidth: 1920, // 1080p
      maxResolutionHeight: 1080,
      maxFps: tierConfig?.max_fps || 60,
      acceptedFormats: ['.mp4']
    };
  }

  // ============================================================================
  // Tier Info
  // ============================================================================

  /**
   * Get current tier info for a team
   */
  async getCurrentTier(teamId: string): Promise<TierInfo | null> {
    const subscription = await this.getSubscription(teamId);
    if (!subscription) return null;

    const tierConfig = await this.getTierConfig(subscription.tier);
    if (!tierConfig) return null;

    return {
      tierKey: subscription.tier,
      displayName: tierConfig.display_name,
      status: subscription.status,
      billingWaived: subscription.billing_waived,
      features: tierConfig.features || []
    };
  }

  /**
   * Get comparison of all tiers for upgrade prompts
   */
  async getTierComparison(teamId: string): Promise<TierComparisonItem[]> {
    const subscription = await this.getSubscription(teamId);
    const currentTier = subscription?.tier || 'basic';
    const tierOrder: SubscriptionTier[] = ['basic', 'plus', 'premium'];

    const allConfigs = await this.getAllTierConfigs();

    return allConfigs.map(config => {
      const tierKey = config.tier_key as SubscriptionTier;
      const isCurrent = tierKey === currentTier;
      const currentIndex = tierOrder.indexOf(currentTier);
      const thisIndex = tierOrder.indexOf(tierKey);

      return {
        tierKey,
        displayName: config.display_name,
        isCurrent,
        isUpgrade: thisIndex > currentIndex,
        monthlyPrice: config.price_monthly_cents / 100,
        yearlyPrice: config.price_yearly_cents / 100,
        uploadTokens: config.monthly_upload_tokens,
        camerasPerGame: config.max_cameras_per_game,
        retentionDays: config.retention_days,
        features: config.features || []
      };
    });
  }

  // ============================================================================
  // Usage Queries
  // ============================================================================

  /**
   * Get count of active games by type
   */
  private async getGameCounts(teamId: string): Promise<{
    teamGames: number;
    opponentGames: number;
  }> {
    const now = new Date().toISOString();

    // Count team games
    const { count: teamCount } = await this.supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('game_type', 'team')
      .eq('is_locked', false)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    // Count opponent games
    const { count: opponentCount } = await this.supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('game_type', 'opponent')
      .eq('is_locked', false)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    return {
      teamGames: teamCount || 0,
      opponentGames: opponentCount || 0
    };
  }

  /**
   * Get cameras count for a game
   */
  async getCamerasForGame(gameId: string): Promise<number> {
    const { count } = await this.supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId);

    return count || 0;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private getNextTier(currentTier: SubscriptionTier): SubscriptionTier | undefined {
    const tierOrder: SubscriptionTier[] = ['basic', 'plus', 'premium'];
    const currentIndex = tierOrder.indexOf(currentTier);
    if (currentIndex < tierOrder.length - 1) {
      return tierOrder[currentIndex + 1];
    }
    return undefined;
  }
}

// ============================================================================
// Factory function for server-side usage
// ============================================================================

export async function createEntitlementsService(): Promise<EntitlementsService> {
  const supabase = await createServerClient();
  return new EntitlementsService(supabase);
}

// ============================================================================
// Convenience functions
// ============================================================================

/**
 * Quick check if team can create a game
 */
export async function checkCanCreateGame(teamId: string, gameType: 'team' | 'opponent'): Promise<EntitlementResult> {
  const service = await createEntitlementsService();
  return service.canCreateGame(teamId, gameType);
}

/**
 * Quick check if team can add a camera
 */
export async function checkCanAddCamera(teamId: string, gameId: string): Promise<EntitlementResult> {
  const service = await createEntitlementsService();
  return service.canAddCamera(teamId, gameId);
}

/**
 * Quick check if team can access a game
 */
export async function checkCanAccessGame(teamId: string, gameId: string): Promise<EntitlementResult> {
  const service = await createEntitlementsService();
  return service.canAccessGame(teamId, gameId);
}
