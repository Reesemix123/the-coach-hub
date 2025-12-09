// src/lib/entitlements/token-service.ts
// Upload Token Service - manages token allocation, consumption, and purchases
// Tokens are consumed when creating games, not when uploading cameras

import { createClient as createServerClient } from '@/utils/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export type TokenTransactionType =
  | 'monthly_allocation'
  | 'rollover'
  | 'consumption'
  | 'purchase'
  | 'refund'
  | 'admin_adjustment';

export type TokenSource = 'subscription' | 'purchased';

export interface TokenBalance {
  id: string;
  team_id: string;
  subscription_tokens_available: number;
  subscription_tokens_used_this_period: number;
  period_start: string | null;
  period_end: string | null;
  purchased_tokens_available: number;
  last_rollover_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenTransaction {
  id: string;
  team_id: string;
  transaction_type: TokenTransactionType;
  amount: number;
  balance_after: number;
  source: TokenSource;
  reference_id: string | null;
  reference_type: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TokenBalanceSummary {
  subscriptionAvailable: number;
  purchasedAvailable: number;
  totalAvailable: number;
  usedThisPeriod: number;
  monthlyAllocation: number; // From tier config
  rolloverCap: number; // From tier config
  periodStart: Date | null;
  periodEnd: Date | null;
  hasActiveSubscription: boolean;
}

export interface ConsumeTokenResult {
  success: boolean;
  error?: string;
  source?: TokenSource;
  remainingTotal?: number;
}

export interface AddTokensResult {
  success: boolean;
  error?: string;
  newBalance?: number;
}

// ============================================================================
// Token Service Class
// ============================================================================

export class TokenService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get the current token balance for a team
   */
  async getTokenBalance(teamId: string): Promise<TokenBalance | null> {
    const { data, error } = await this.supabase
      .from('token_balance')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found
        return null;
      }
      console.error('Error fetching token balance:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get a summary of token balance with tier info
   */
  async getTokenBalanceSummary(teamId: string): Promise<TokenBalanceSummary> {
    // Get token balance
    const balance = await this.getTokenBalance(teamId);

    // Get subscription and tier info
    const { data: subscription } = await this.supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('team_id', teamId)
      .single();

    // Get tier config for monthly allocation and rollover cap
    let monthlyAllocation = 0;
    let rolloverCap = 0;

    if (subscription?.tier) {
      const { data: tierConfig } = await this.supabase
        .from('tier_config')
        .select('monthly_upload_tokens, token_rollover_cap')
        .eq('tier_key', subscription.tier)
        .single();

      if (tierConfig) {
        monthlyAllocation = tierConfig.monthly_upload_tokens;
        rolloverCap = tierConfig.token_rollover_cap;
      }
    }

    const hasActiveSubscription = subscription?.status === 'active' || subscription?.status === 'trialing';

    if (!balance) {
      return {
        subscriptionAvailable: 0,
        purchasedAvailable: 0,
        totalAvailable: 0,
        usedThisPeriod: 0,
        monthlyAllocation,
        rolloverCap,
        periodStart: null,
        periodEnd: null,
        hasActiveSubscription
      };
    }

    return {
      subscriptionAvailable: balance.subscription_tokens_available,
      purchasedAvailable: balance.purchased_tokens_available,
      totalAvailable: balance.subscription_tokens_available + balance.purchased_tokens_available,
      usedThisPeriod: balance.subscription_tokens_used_this_period,
      monthlyAllocation,
      rolloverCap,
      periodStart: balance.period_start ? new Date(balance.period_start) : null,
      periodEnd: balance.period_end ? new Date(balance.period_end) : null,
      hasActiveSubscription
    };
  }

  /**
   * Check if team has tokens available
   */
  async hasAvailableTokens(teamId: string): Promise<boolean> {
    const summary = await this.getTokenBalanceSummary(teamId);
    return summary.totalAvailable > 0;
  }

  /**
   * Consume a token when creating a game
   * Uses the database function for atomic operation
   */
  async consumeToken(teamId: string, gameId: string, userId?: string): Promise<ConsumeTokenResult> {
    const { data, error } = await this.supabase.rpc('consume_upload_token', {
      p_team_id: teamId,
      p_game_id: gameId,
      p_user_id: userId || null
    });

    if (error) {
      console.error('Error consuming token:', error);
      return {
        success: false,
        error: 'Failed to consume upload token'
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'No upload tokens available. Purchase additional tokens or wait for your next billing cycle.'
      };
    }

    // Get updated balance
    const balance = await this.getTokenBalance(teamId);

    return {
      success: true,
      remainingTotal: balance
        ? balance.subscription_tokens_available + balance.purchased_tokens_available
        : 0
    };
  }

  /**
   * Add purchased tokens to a team's balance
   */
  async addPurchasedTokens(
    teamId: string,
    amount: number,
    stripePaymentId: string,
    userId?: string
  ): Promise<AddTokensResult> {
    const { data, error } = await this.supabase.rpc('add_purchased_tokens', {
      p_team_id: teamId,
      p_amount: amount,
      p_stripe_payment_id: stripePaymentId,
      p_user_id: userId || null
    });

    if (error) {
      console.error('Error adding purchased tokens:', error);
      return {
        success: false,
        error: 'Failed to add purchased tokens'
      };
    }

    // Get updated balance
    const balance = await this.getTokenBalance(teamId);

    return {
      success: true,
      newBalance: balance
        ? balance.subscription_tokens_available + balance.purchased_tokens_available
        : 0
    };
  }

  /**
   * Initialize tokens for a new subscription
   */
  async initializeSubscriptionTokens(
    teamId: string,
    tierKey: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('initialize_subscription_tokens', {
      p_team_id: teamId,
      p_tier_key: tierKey,
      p_period_start: periodStart.toISOString(),
      p_period_end: periodEnd.toISOString()
    });

    if (error) {
      console.error('Error initializing subscription tokens:', error);
      return false;
    }

    return data === true;
  }

  /**
   * Refresh tokens on billing cycle (with rollover)
   */
  async refreshSubscriptionTokens(
    teamId: string,
    tierKey: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('refresh_subscription_tokens', {
      p_team_id: teamId,
      p_tier_key: tierKey,
      p_period_start: periodStart.toISOString(),
      p_period_end: periodEnd.toISOString()
    });

    if (error) {
      console.error('Error refreshing subscription tokens:', error);
      return false;
    }

    return data === true;
  }

  /**
   * Get transaction history for a team
   */
  async getTransactionHistory(
    teamId: string,
    options?: {
      limit?: number;
      offset?: number;
      type?: TokenTransactionType;
    }
  ): Promise<TokenTransaction[]> {
    let query = this.supabase
      .from('token_transactions')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (options?.type) {
      query = query.eq('transaction_type', options.type);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Admin: Adjust tokens manually (for support cases)
   */
  async adminAdjustTokens(
    teamId: string,
    amount: number,
    source: TokenSource,
    notes: string,
    adminUserId: string
  ): Promise<boolean> {
    // Get current balance
    const balance = await this.getTokenBalance(teamId);

    if (!balance) {
      // Create balance record if it doesn't exist
      const { error: insertError } = await this.supabase
        .from('token_balance')
        .insert({ team_id: teamId });

      if (insertError) {
        console.error('Error creating token balance:', insertError);
        return false;
      }
    }

    // Update the appropriate pool
    const updateField = source === 'subscription'
      ? 'subscription_tokens_available'
      : 'purchased_tokens_available';

    const { error: updateError } = await this.supabase
      .from('token_balance')
      .update({
        [updateField]: (balance?.[updateField] || 0) + amount
      })
      .eq('team_id', teamId);

    if (updateError) {
      console.error('Error updating token balance:', updateError);
      return false;
    }

    // Get new balance for transaction log
    const newBalance = await this.getTokenBalance(teamId);
    const totalAfter = newBalance
      ? newBalance.subscription_tokens_available + newBalance.purchased_tokens_available
      : 0;

    // Log the transaction
    const { error: txError } = await this.supabase
      .from('token_transactions')
      .insert({
        team_id: teamId,
        transaction_type: 'admin_adjustment',
        amount,
        balance_after: totalAfter,
        source,
        notes,
        created_by: adminUserId
      });

    if (txError) {
      console.error('Error logging admin adjustment:', txError);
      // Don't fail - adjustment was made successfully
    }

    return true;
  }

  /**
   * Refund a token (e.g., when a game is deleted)
   */
  async refundToken(
    teamId: string,
    gameId: string,
    notes: string,
    userId?: string
  ): Promise<boolean> {
    // Refund to subscription pool by default
    const balance = await this.getTokenBalance(teamId);

    if (!balance) {
      return false;
    }

    const { error: updateError } = await this.supabase
      .from('token_balance')
      .update({
        subscription_tokens_available: balance.subscription_tokens_available + 1
      })
      .eq('team_id', teamId);

    if (updateError) {
      console.error('Error refunding token:', updateError);
      return false;
    }

    const totalAfter = balance.subscription_tokens_available + 1 + balance.purchased_tokens_available;

    // Log the refund
    const { error: txError } = await this.supabase
      .from('token_transactions')
      .insert({
        team_id: teamId,
        transaction_type: 'refund',
        amount: 1,
        balance_after: totalAfter,
        source: 'subscription',
        reference_id: gameId,
        reference_type: 'game',
        notes,
        created_by: userId || null
      });

    if (txError) {
      console.error('Error logging refund:', txError);
      // Don't fail - refund was made successfully
    }

    return true;
  }
}

// ============================================================================
// Factory function for server-side usage
// ============================================================================

export async function createTokenService(): Promise<TokenService> {
  const supabase = await createServerClient();
  return new TokenService(supabase);
}

// ============================================================================
// Convenience functions for common operations
// ============================================================================

/**
 * Check if a team can create a new game (has tokens available)
 */
export async function canCreateGame(teamId: string): Promise<{
  allowed: boolean;
  tokensAvailable: number;
  reason?: string;
}> {
  const service = await createTokenService();
  const summary = await service.getTokenBalanceSummary(teamId);

  if (!summary.hasActiveSubscription) {
    return {
      allowed: false,
      tokensAvailable: 0,
      reason: 'No active subscription'
    };
  }

  if (summary.totalAvailable < 1) {
    return {
      allowed: false,
      tokensAvailable: 0,
      reason: 'No upload tokens available. Purchase additional tokens or wait for your next billing cycle.'
    };
  }

  return {
    allowed: true,
    tokensAvailable: summary.totalAvailable
  };
}

/**
 * Get a formatted display of token status
 */
export function formatTokenStatus(summary: TokenBalanceSummary): string {
  const { totalAvailable, usedThisPeriod, monthlyAllocation } = summary;

  if (monthlyAllocation > 0) {
    return `${totalAvailable} available (${usedThisPeriod} of ${monthlyAllocation} used this period)`;
  }

  return `${totalAvailable} tokens available`;
}
