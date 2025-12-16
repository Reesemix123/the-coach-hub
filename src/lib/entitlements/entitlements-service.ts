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

export interface GameStorageLimits {
  maxStoragePerGameBytes: number | null;
  maxDurationPerGameSeconds: number | null;
  maxDurationPerCameraSeconds: number | null;
}

export interface GameStorageUsage {
  gameId: string;
  teamId: string;
  tier: string;
  totalStorageBytes: number;
  totalDurationSeconds: number;
  cameraCount: number;
  limits: GameStorageLimits;
  isStorageExceeded: boolean;
  isDurationExceeded: boolean;
}

export interface GameUploadCheckResult {
  allowed: boolean;
  reason?: string;
  message?: string;
  currentBytes?: number;
  fileBytes?: number;
  maxBytes?: number;
  currentSeconds?: number;
  fileSeconds?: number;
  maxSeconds?: number;
  cameraLane?: number;
  currentCameraSeconds?: number;
  maxCameraSeconds?: number;
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
    past_due_since: string | null;
    payment_suspended: boolean;
  } | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('tier, status, billing_waived, past_due_since, payment_suspended')
      .eq('team_id', teamId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      tier: data.tier as SubscriptionTier,
      status: data.status as SubscriptionStatus,
      billing_waived: data.billing_waived,
      past_due_since: data.past_due_since,
      payment_suspended: data.payment_suspended || false
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

  private isActiveStatus(
    status: SubscriptionStatus,
    billingWaived: boolean,
    pastDueSince: string | null,
    paymentSuspended: boolean
  ): boolean {
    if (billingWaived) return true;

    // If payment is suspended (grace period expired), deny access
    if (paymentSuspended) return false;

    // If past_due, check if within 7-day grace period
    if (status === 'past_due' && pastDueSince) {
      const gracePeriodDays = 7;
      const pastDueDate = new Date(pastDueSince);
      const gracePeriodEnd = new Date(pastDueDate.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);

      if (new Date() > gracePeriodEnd) {
        // Grace period expired - should be suspended
        // (The webhook or a cron should have set payment_suspended, but check here too)
        return false;
      }
    }

    return ['active', 'trialing', 'past_due', 'waived'].includes(status);
  }

  /**
   * Get payment status info for a team (for displaying warnings)
   */
  async getPaymentStatus(teamId: string): Promise<{
    status: 'current' | 'past_due' | 'suspended' | 'none';
    gracePeriodDaysRemaining: number | null;
    pastDueSince: string | null;
  }> {
    const subscription = await this.getSubscription(teamId);

    if (!subscription) {
      return { status: 'none', gracePeriodDaysRemaining: null, pastDueSince: null };
    }

    if (subscription.payment_suspended) {
      return { status: 'suspended', gracePeriodDaysRemaining: 0, pastDueSince: subscription.past_due_since };
    }

    if (subscription.status === 'past_due' && subscription.past_due_since) {
      const gracePeriodDays = 7;
      const pastDueDate = new Date(subscription.past_due_since);
      const now = new Date();
      const daysPassed = Math.floor((now.getTime() - pastDueDate.getTime()) / (24 * 60 * 60 * 1000));
      const daysRemaining = Math.max(0, gracePeriodDays - daysPassed);

      if (daysRemaining === 0) {
        return { status: 'suspended', gracePeriodDaysRemaining: 0, pastDueSince: subscription.past_due_since };
      }

      return { status: 'past_due', gracePeriodDaysRemaining: daysRemaining, pastDueSince: subscription.past_due_since };
    }

    return { status: 'current', gracePeriodDaysRemaining: null, pastDueSince: null };
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

    if (!this.isActiveStatus(subscription.status, subscription.billing_waived, subscription.past_due_since, subscription.payment_suspended)) {
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

    if (!this.isActiveStatus(subscription.status, subscription.billing_waived, subscription.past_due_since, subscription.payment_suspended)) {
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

    if (!this.isActiveStatus(subscription.status, subscription.billing_waived, subscription.past_due_since, subscription.payment_suspended)) {
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

    if (!this.isActiveStatus(subscription.status, subscription.billing_waived, subscription.past_due_since, subscription.payment_suspended)) {
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
      maxDurationSeconds: tierConfig?.max_video_duration_seconds || 7200, // 2 hours (120 min)
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
  // Game Storage Limits
  // ============================================================================

  /**
   * Get game storage limits for a team's tier
   */
  async getGameStorageLimits(teamId: string): Promise<GameStorageLimits> {
    const subscription = await this.getSubscription(teamId);
    const tierConfig = subscription ? await this.getTierConfig(subscription.tier) : null;

    return {
      maxStoragePerGameBytes: tierConfig?.max_storage_per_game_bytes || null,
      maxDurationPerGameSeconds: tierConfig?.max_duration_per_game_seconds || null,
      maxDurationPerCameraSeconds: tierConfig?.max_duration_per_camera_seconds || null
    };
  }

  /**
   * Get current storage/duration usage for a game
   */
  async getGameStorageUsage(gameId: string): Promise<GameStorageUsage | null> {
    const { data, error } = await this.supabase.rpc('get_game_storage_usage', {
      p_game_id: gameId
    });

    if (error || !data) {
      console.error('Failed to get game storage usage:', error);
      return null;
    }

    return {
      gameId: data.game_id,
      teamId: data.team_id,
      tier: data.tier,
      totalStorageBytes: data.total_storage_bytes,
      totalDurationSeconds: data.total_duration_seconds,
      cameraCount: data.camera_count,
      limits: {
        maxStoragePerGameBytes: data.limits?.max_storage_bytes || null,
        maxDurationPerGameSeconds: data.limits?.max_duration_seconds || null,
        maxDurationPerCameraSeconds: data.limits?.max_duration_per_camera_seconds || null
      },
      isStorageExceeded: data.is_storage_exceeded,
      isDurationExceeded: data.is_duration_exceeded
    };
  }

  /**
   * Check if a video upload is allowed for a game based on per-game limits
   */
  async checkGameUploadAllowed(
    gameId: string,
    fileSizeBytes: number,
    durationSeconds?: number,
    cameraLane?: number
  ): Promise<GameUploadCheckResult> {
    const { data, error } = await this.supabase.rpc('check_game_upload_allowed', {
      p_game_id: gameId,
      p_file_size_bytes: fileSizeBytes,
      p_duration_seconds: durationSeconds || null,
      p_camera_lane: cameraLane || null
    });

    if (error) {
      console.error('Failed to check game upload allowed:', error);
      // Allow upload if check fails (fail open)
      return { allowed: true };
    }

    return {
      allowed: data.allowed,
      reason: data.reason,
      message: data.message,
      currentBytes: data.current_bytes || data.current_storage_bytes,
      fileBytes: data.file_bytes,
      maxBytes: data.max_bytes,
      currentSeconds: data.current_seconds || data.current_duration_seconds,
      fileSeconds: data.file_seconds,
      maxSeconds: data.max_seconds,
      cameraLane: data.camera_lane,
      currentCameraSeconds: data.current_camera_seconds,
      maxCameraSeconds: data.max_camera_seconds
    };
  }

  /**
   * Check if adding a clip to a timeline lane is allowed
   */
  async checkTimelineClipAllowed(
    gameId: string,
    cameraLane: number,
    videoId: string
  ): Promise<GameUploadCheckResult> {
    const { data, error } = await this.supabase.rpc('check_timeline_clip_allowed', {
      p_game_id: gameId,
      p_camera_lane: cameraLane,
      p_video_id: videoId
    });

    if (error) {
      console.error('Failed to check timeline clip allowed:', error);
      // Allow if check fails (fail open)
      return { allowed: true };
    }

    return {
      allowed: data.allowed,
      reason: data.reason,
      message: data.message,
      cameraLane: data.camera_lane,
      currentCameraSeconds: data.current_lane_seconds,
      fileSeconds: data.clip_seconds,
      maxCameraSeconds: data.max_camera_seconds
    };
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

/**
 * Quick check if a video upload is allowed for a game based on per-game limits
 */
export async function checkGameUploadAllowed(
  gameId: string,
  fileSizeBytes: number,
  durationSeconds?: number,
  cameraLane?: number
): Promise<GameUploadCheckResult> {
  const service = await createEntitlementsService();
  return service.checkGameUploadAllowed(gameId, fileSizeBytes, durationSeconds, cameraLane);
}

/**
 * Quick check if adding a clip to a timeline lane is allowed
 */
export async function checkTimelineClipAllowed(
  gameId: string,
  cameraLane: number,
  videoId: string
): Promise<GameUploadCheckResult> {
  const service = await createEntitlementsService();
  return service.checkTimelineClipAllowed(gameId, cameraLane, videoId);
}

/**
 * Get game storage usage and limits
 */
export async function getGameStorageUsage(gameId: string): Promise<GameStorageUsage | null> {
  const service = await createEntitlementsService();
  return service.getGameStorageUsage(gameId);
}

/**
 * Get payment status for a team (for warning banners)
 */
export async function getPaymentStatus(teamId: string): Promise<{
  status: 'current' | 'past_due' | 'suspended' | 'none';
  gracePeriodDaysRemaining: number | null;
  pastDueSince: string | null;
}> {
  const service = await createEntitlementsService();
  return service.getPaymentStatus(teamId);
}
