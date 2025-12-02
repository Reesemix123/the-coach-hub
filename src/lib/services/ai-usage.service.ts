// src/lib/services/ai-usage.service.ts
// Service for logging AI credit usage with limit checking

import { createClient } from '@/utils/supabase/client';

export type AIFeature =
  | 'auto_tagging'
  | 'strategy_assistant'
  | 'play_recognition'
  | 'scouting_analysis'
  | 'play_analysis'
  | 'game_summary'
  | 'opponent_tendencies'
  | 'practice_plan'
  | 'player_evaluation'
  | 'other';

// Feature costs - how many credits each AI feature uses
export const AI_FEATURE_COSTS: Record<string, number> = {
  'play_analysis': 1,
  'auto_tagging': 1,
  'game_summary': 5,
  'opponent_tendencies': 10,
  'practice_plan': 8,
  'player_evaluation': 3,
  'strategy_assistant': 2,
  'play_recognition': 1,
  'scouting_analysis': 10,
  'other': 1
};

export function getCreditCost(feature: string): number {
  return AI_FEATURE_COSTS[feature] || AI_FEATURE_COSTS['other'];
}

export interface LogAIUsageParams {
  teamId: string;
  feature: AIFeature;
  credits?: number;
  metadata?: Record<string, unknown>;
}

export interface AIUsageLog {
  id: string;
  team_id: string;
  user_id: string | null;
  feature: string;
  credits_used: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AICreditsStatus {
  credits_allowed: number;
  credits_used: number;
  credits_remaining: number;
  period_start: string;
  period_end: string;
  is_trial: boolean;
  trial_limit: number | null;
  percentage_used: number;
  near_limit: boolean;
  at_limit: boolean;
}

export interface ConsumeCreditsResult {
  success: boolean;
  error?: string;
  code?: 'CREDITS_EXHAUSTED' | 'TRIAL_LIMIT_EXCEEDED' | 'TIER_REQUIRED' | 'ERROR';
  log_id?: string;
  credits_consumed?: number;
  credits_remaining?: number;
}

export class AIUsageService {
  private supabase = createClient();

  /**
   * Get current AI credits status for a team
   */
  async getCreditsStatus(teamId: string): Promise<AICreditsStatus | null> {
    try {
      const response = await fetch(`/api/teams/${teamId}/ai-credits`);
      if (!response.ok) {
        console.error('Failed to get credits status');
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching credits status:', error);
      return null;
    }
  }

  /**
   * Check if team has enough credits for a feature (without consuming)
   */
  async canUseFeature(teamId: string, feature: AIFeature): Promise<{ canUse: boolean; reason?: string; creditsNeeded: number; creditsAvailable: number }> {
    const status = await this.getCreditsStatus(teamId);
    const creditsNeeded = getCreditCost(feature);

    if (!status) {
      return { canUse: false, reason: 'Unable to check credit status', creditsNeeded, creditsAvailable: 0 };
    }

    if (status.at_limit) {
      return { canUse: false, reason: 'AI credits exhausted for this billing period', creditsNeeded, creditsAvailable: 0 };
    }

    if (status.credits_remaining < creditsNeeded) {
      return {
        canUse: false,
        reason: `Not enough credits. Need ${creditsNeeded}, have ${status.credits_remaining}`,
        creditsNeeded,
        creditsAvailable: status.credits_remaining
      };
    }

    return { canUse: true, creditsNeeded, creditsAvailable: status.credits_remaining };
  }

  /**
   * Consume AI credits for a feature (with limit checking)
   * This is the recommended method to use - it checks limits before consuming
   *
   * @returns Result with success/error status and remaining credits
   */
  async consumeCredits(
    teamId: string,
    feature: AIFeature,
    metadata?: Record<string, unknown>
  ): Promise<ConsumeCreditsResult> {
    try {
      const response = await fetch(`/api/teams/${teamId}/ai-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, metadata })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to consume credits',
          code: data.code || 'ERROR',
          credits_remaining: data.credits_remaining
        };
      }

      return {
        success: true,
        log_id: data.log_id,
        credits_consumed: data.credits_consumed,
        credits_remaining: data.credits_remaining
      };
    } catch (error) {
      console.error('Error consuming credits:', error);
      return {
        success: false,
        error: 'Failed to consume AI credits',
        code: 'ERROR'
      };
    }
  }

  /**
   * Log AI credit usage for a team (legacy method - does not check limits)
   * Use consumeCredits() instead for proper limit checking
   *
   * @param params - Team ID, feature name, optional credits (default 1), optional metadata
   * @returns The created log entry ID
   * @deprecated Use consumeCredits() instead
   */
  async logUsage(params: LogAIUsageParams): Promise<string | null> {
    const { teamId, feature, credits = 1, metadata } = params;

    // Get current user
    const { data: { user } } = await this.supabase.auth.getUser();

    // Call the database function that logs and increments credits
    const { data, error } = await this.supabase.rpc('log_ai_usage', {
      p_team_id: teamId,
      p_user_id: user?.id || null,
      p_feature: feature,
      p_credits: credits,
      p_metadata: metadata || null
    });

    if (error) {
      console.error('Failed to log AI usage:', error);
      return null;
    }

    return data as string;
  }

  /**
   * Get AI usage logs for a team
   *
   * @param teamId - Team ID
   * @param options - Optional filters (feature, startDate, endDate, limit)
   */
  async getTeamUsage(
    teamId: string,
    options?: {
      feature?: AIFeature;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<AIUsageLog[]> {
    let query = this.supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (options?.feature) {
      query = query.eq('feature', options.feature);
    }

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to get AI usage:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get AI usage summary by feature for a team
   */
  async getUsageByFeature(
    teamId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ feature: string; total_credits: number; usage_count: number }[]> {
    let query = this.supabase
      .from('ai_usage_logs')
      .select('feature, credits_used')
      .eq('team_id', teamId);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    // Aggregate by feature
    const byFeature: Record<string, { total_credits: number; usage_count: number }> = {};
    data.forEach(row => {
      if (!byFeature[row.feature]) {
        byFeature[row.feature] = { total_credits: 0, usage_count: 0 };
      }
      byFeature[row.feature].total_credits += row.credits_used;
      byFeature[row.feature].usage_count += 1;
    });

    return Object.entries(byFeature).map(([feature, stats]) => ({
      feature,
      ...stats
    }));
  }

  /**
   * Get AI usage by user for a team
   */
  async getUsageByUser(
    teamId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ user_id: string; total_credits: number; usage_count: number }[]> {
    let query = this.supabase
      .from('ai_usage_logs')
      .select('user_id, credits_used')
      .eq('team_id', teamId)
      .not('user_id', 'is', null);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    // Aggregate by user
    const byUser: Record<string, { total_credits: number; usage_count: number }> = {};
    data.forEach(row => {
      if (!row.user_id) return;
      if (!byUser[row.user_id]) {
        byUser[row.user_id] = { total_credits: 0, usage_count: 0 };
      }
      byUser[row.user_id].total_credits += row.credits_used;
      byUser[row.user_id].usage_count += 1;
    });

    return Object.entries(byUser).map(([user_id, stats]) => ({
      user_id,
      ...stats
    }));
  }
}

// Singleton instance
export const aiUsageService = new AIUsageService();
