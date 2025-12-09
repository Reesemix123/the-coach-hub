// src/lib/ai/ai-service.ts
// AI Service Placeholder
// This service provides stubs for future AI features (chat, film tagging)
// All methods check entitlements before proceeding

import { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { EntitlementsService } from '@/lib/entitlements/entitlements-service';

// ============================================================================
// Types
// ============================================================================

export interface AIServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: AIErrorCode;
}

export type AIErrorCode =
  | 'feature_disabled'
  | 'no_credits'
  | 'rate_limited'
  | 'processing_error'
  | 'invalid_input'
  | 'tier_required';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ChatSession {
  id: string;
  teamId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FilmTaggingResult {
  playId: string;
  confidence: number;
  suggestedFormation?: string;
  suggestedPlayType?: string;
  suggestedConcept?: string;
  players?: Array<{
    position: string;
    route?: string;
    assignment?: string;
  }>;
}

export interface AIUsageSummary {
  chatMessagesUsed: number;
  filmTaggingMinutesUsed: number;
  chatMessagesRemaining: number;
  filmTaggingMinutesRemaining: number;
}

// ============================================================================
// AI Service
// ============================================================================

export class AIService {
  private supabase: SupabaseClient;
  private entitlements: EntitlementsService;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.entitlements = new EntitlementsService(supabase);
  }

  // ============================================================================
  // Feature Access Checks
  // ============================================================================

  /**
   * Check if team can use AI chat feature
   */
  async canUseAIChat(teamId: string): Promise<{ allowed: boolean; reason?: string }> {
    const check = await this.entitlements.canUseAiChat(teamId);

    if (!check.allowed) {
      return {
        allowed: false,
        reason: check.reason || 'AI Chat is not available on your current plan'
      };
    }

    return { allowed: true };
  }

  /**
   * Check if team can use AI film tagging feature
   */
  async canUseFilmTagging(teamId: string): Promise<{ allowed: boolean; reason?: string }> {
    const check = await this.entitlements.canUseAiFilmTagging(teamId);

    if (!check.allowed) {
      return {
        allowed: false,
        reason: check.reason || 'AI Film Tagging is not available on your current plan'
      };
    }

    return { allowed: true };
  }

  // ============================================================================
  // AI Chat (Placeholder)
  // ============================================================================

  /**
   * Send a message to the AI coach assistant
   * PLACEHOLDER: Returns a stub response until AI integration is complete
   */
  async sendChatMessage(
    teamId: string,
    message: string,
    sessionId?: string
  ): Promise<AIServiceResult<{ message: ChatMessage; sessionId: string }>> {
    // Check entitlement
    const access = await this.canUseAIChat(teamId);
    if (!access.allowed) {
      return {
        success: false,
        error: access.reason,
        errorCode: 'feature_disabled'
      };
    }

    // PLACEHOLDER: Return a stub response
    // TODO: Integrate with actual AI service (OpenAI, Claude, etc.)
    const response: ChatMessage = {
      role: 'assistant',
      content: 'AI Coach is coming soon! This feature is currently in development. ' +
               'When ready, I\'ll be able to help you analyze plays, suggest game plans, ' +
               'and answer coaching questions.',
      timestamp: new Date()
    };

    return {
      success: true,
      data: {
        message: response,
        sessionId: sessionId || `session_${Date.now()}`
      }
    };
  }

  /**
   * Get chat history for a session
   * PLACEHOLDER: Returns empty until AI integration is complete
   */
  async getChatHistory(
    teamId: string,
    sessionId: string
  ): Promise<AIServiceResult<ChatSession>> {
    // Check entitlement
    const access = await this.canUseAIChat(teamId);
    if (!access.allowed) {
      return {
        success: false,
        error: access.reason,
        errorCode: 'feature_disabled'
      };
    }

    // PLACEHOLDER: Return empty session
    return {
      success: true,
      data: {
        id: sessionId,
        teamId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
  }

  // ============================================================================
  // AI Film Tagging (Placeholder)
  // ============================================================================

  /**
   * Request AI analysis of a video segment
   * PLACEHOLDER: Returns a stub response until AI integration is complete
   */
  async analyzeVideoSegment(
    teamId: string,
    videoId: string,
    startTime: number,
    endTime: number
  ): Promise<AIServiceResult<FilmTaggingResult>> {
    // Check entitlement
    const access = await this.canUseFilmTagging(teamId);
    if (!access.allowed) {
      return {
        success: false,
        error: access.reason,
        errorCode: 'feature_disabled'
      };
    }

    // PLACEHOLDER: Return a stub response
    // TODO: Integrate with video analysis AI service
    return {
      success: true,
      data: {
        playId: `play_${Date.now()}`,
        confidence: 0,
        suggestedFormation: undefined,
        suggestedPlayType: undefined,
        suggestedConcept: undefined,
        players: []
      }
    };
  }

  /**
   * Request AI to tag an entire game film
   * PLACEHOLDER: Returns processing status until AI integration is complete
   */
  async requestFullGameAnalysis(
    teamId: string,
    gameId: string
  ): Promise<AIServiceResult<{ jobId: string; status: string }>> {
    // Check entitlement
    const access = await this.canUseFilmTagging(teamId);
    if (!access.allowed) {
      return {
        success: false,
        error: access.reason,
        errorCode: 'feature_disabled'
      };
    }

    // PLACEHOLDER: Return a stub job ID
    return {
      success: true,
      data: {
        jobId: `job_${Date.now()}`,
        status: 'feature_coming_soon'
      }
    };
  }

  // ============================================================================
  // Usage Tracking (Placeholder)
  // ============================================================================

  /**
   * Get AI usage summary for a team
   * PLACEHOLDER: Returns zeros until AI integration is complete
   */
  async getUsageSummary(teamId: string): Promise<AIServiceResult<AIUsageSummary>> {
    // Get tier info for limits
    const tier = await this.entitlements.getCurrentTier(teamId);

    // PLACEHOLDER: Return zero usage (feature not yet active)
    return {
      success: true,
      data: {
        chatMessagesUsed: 0,
        filmTaggingMinutesUsed: 0,
        chatMessagesRemaining: tier.aiChatEnabled ? -1 : 0, // -1 = unlimited for premium
        filmTaggingMinutesRemaining: tier.aiFilmTaggingEnabled ? tier.aiFilmCreditsMonthly : 0
      }
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export async function createAIService(): Promise<AIService> {
  const supabase = await createServerClient();
  return new AIService(supabase);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick check if AI features are available for a team
 */
export async function checkAIAccess(teamId: string): Promise<{
  chatEnabled: boolean;
  filmTaggingEnabled: boolean;
  upgradeRequired: boolean;
  requiredTier?: string;
}> {
  const service = await createAIService();

  const [chatCheck, filmCheck] = await Promise.all([
    service.canUseAIChat(teamId),
    service.canUseFilmTagging(teamId)
  ]);

  const upgradeRequired = !chatCheck.allowed || !filmCheck.allowed;

  return {
    chatEnabled: chatCheck.allowed,
    filmTaggingEnabled: filmCheck.allowed,
    upgradeRequired,
    requiredTier: upgradeRequired ? 'premium' : undefined
  };
}
