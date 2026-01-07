/**
 * AI Help Chat API Route
 *
 * POST /api/chat
 * Handles AI chat messages with rate limiting based on subscription tier.
 * Uses smart routing to direct queries to the appropriate AI provider:
 * - Help questions → Gemini Flash + static context
 * - Coaching questions → Gemini Pro + team data context
 * - General questions → Gemini Flash + minimal context
 *
 * Rate limits:
 * - Basic: 20 messages/day
 * - Plus: 50 messages/day
 * - Premium: Unlimited
 *
 * Message Logging:
 * - All chat messages are stored in chat_messages table for quality improvement
 * - User messages stored before generation, AI responses after streaming completes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { type Message, RATE_LIMITS, generateRoutedResponse } from '@/lib/ai';
import type { SubscriptionTier } from '@/types/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Store a chat message in the database (fire and forget)
 */
async function logChatMessage(
  supabase: SupabaseClient,
  userId: string,
  teamId: string | undefined,
  role: 'user' | 'assistant',
  content: string,
  intent?: string,
  topic?: string,
  sessionId?: string
): Promise<void> {
  try {
    await supabase.from('chat_messages').insert({
      user_id: userId,
      team_id: teamId || null,
      role,
      content,
      intent: intent || null,
      topic: topic || null,
      session_id: sessionId || null,
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('Failed to log chat message:', error);
  }
}

/**
 * Create a stream wrapper that collects the full response while streaming
 */
function createLoggingStream(
  originalStream: ReadableStream<string>,
  onComplete: (fullContent: string) => void
): ReadableStream<string> {
  let fullContent = '';

  return new ReadableStream({
    async start(controller) {
      const reader = originalStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            onComplete(fullContent);
            controller.close();
            break;
          }

          // Collect content
          fullContent += value;

          // Pass through to client
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

// Rate limits by tier (messages per day)
const TIER_RATE_LIMITS: Record<SubscriptionTier, number> = {
  basic: RATE_LIMITS.basic,
  plus: RATE_LIMITS.plus,
  premium: RATE_LIMITS.premium,
};

interface ChatRequest {
  messages: Message[];
  teamId?: string; // Optional: for team-specific context in future
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = (await request.json()) as ChatRequest;
    const { messages, teamId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's subscription tier
    let tier: SubscriptionTier = 'basic';

    if (teamId) {
      // Get tier from team's subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('tier, status, billing_waived')
        .eq('team_id', teamId)
        .maybeSingle();

      if (subscription) {
        const isActive =
          subscription.status === 'active' ||
          subscription.status === 'trialing' ||
          subscription.billing_waived;

        if (isActive) {
          tier = subscription.tier as SubscriptionTier;
        }
      }
    } else {
      // Get tier from user's first team (fallback)
      const { data: teams } = await supabase
        .from('teams')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (teams && teams.length > 0) {
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('tier, status, billing_waived')
          .eq('team_id', teams[0].id)
          .maybeSingle();

        if (subscription) {
          const isActive =
            subscription.status === 'active' ||
            subscription.status === 'trialing' ||
            subscription.billing_waived;

          if (isActive) {
            tier = subscription.tier as SubscriptionTier;
          }
        }
      }
    }

    // Get rate limit for tier
    const rateLimit = TIER_RATE_LIMITS[tier];
    const isUnlimited = rateLimit === Infinity;

    // Check and increment usage (unless unlimited)
    // Skip rate limiting if the database function doesn't exist yet
    if (!isUnlimited) {
      try {
        const { data: usageResult, error: usageError } = await supabase.rpc(
          'increment_chat_usage',
          {
            p_user_id: user.id,
            p_limit: rateLimit,
          }
        );

        if (usageError) {
          // If function doesn't exist, skip rate limiting (migration not applied yet)
          if (usageError.message?.includes('does not exist')) {
            console.warn('Chat usage function not found - skipping rate limit check');
          } else {
            console.error('Error checking chat usage:', usageError);
            // Don't fail the request - just skip rate limiting
          }
        } else {
          const usage = usageResult?.[0];
          if (usage && !usage.allowed) {
            return NextResponse.json(
              {
                error: 'Rate limit exceeded',
                limit: rateLimit,
                used: usage.new_count,
                remaining: 0,
                resetsAt: new Date(
                  new Date().setHours(24, 0, 0, 0)
                ).toISOString(),
              },
              { status: 429 }
            );
          }
        }
      } catch (err) {
        console.warn('Rate limit check failed, proceeding without limit:', err);
      }
    }

    // Generate streaming response using smart router
    try {
      const { stream, classification } = await generateRoutedResponse(
        messages,
        user.id,
        supabase
      );

      // Log classification for debugging
      console.log(`[Chat] Intent: ${classification.intent}, Confidence: ${classification.confidence}`);

      // Generate a session ID for grouping messages in this conversation
      const sessionId = crypto.randomUUID();

      // Extract the topic from classification entities
      const topic = classification.entities?.topic || undefined;

      // Get the latest user message to log
      const latestUserMessage = messages[messages.length - 1];
      if (latestUserMessage && latestUserMessage.role === 'user') {
        // Log user message (fire and forget - don't await)
        logChatMessage(
          supabase,
          user.id,
          teamId,
          'user',
          latestUserMessage.content,
          classification.intent,
          topic,
          sessionId
        );
      }

      // Wrap the stream to capture the AI response for logging
      const loggingStream = createLoggingStream(stream, (fullContent) => {
        // Log AI response after streaming completes (fire and forget)
        logChatMessage(
          supabase,
          user.id,
          teamId,
          'assistant',
          fullContent,
          classification.intent,
          topic,
          sessionId
        );
      });

      // Return streaming response
      return new Response(loggingStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Intent': classification.intent,
        },
      });
    } catch (aiError) {
      console.error('AI generation error:', aiError);
      return NextResponse.json(
        { error: 'Failed to generate response. Please try again.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat
 * Get current chat usage and rate limit info
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get team ID from query params
    const searchParams = request.nextUrl.searchParams;
    const teamId = searchParams.get('teamId');

    // Get user's subscription tier
    let tier: SubscriptionTier = 'basic';

    if (teamId) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('tier, status, billing_waived')
        .eq('team_id', teamId)
        .maybeSingle();

      if (subscription) {
        const isActive =
          subscription.status === 'active' ||
          subscription.status === 'trialing' ||
          subscription.billing_waived;

        if (isActive) {
          tier = subscription.tier as SubscriptionTier;
        }
      }
    } else {
      // Get from first team
      const { data: teams } = await supabase
        .from('teams')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (teams && teams.length > 0) {
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('tier, status, billing_waived')
          .eq('team_id', teams[0].id)
          .maybeSingle();

        if (subscription) {
          const isActive =
            subscription.status === 'active' ||
            subscription.status === 'trialing' ||
            subscription.billing_waived;

          if (isActive) {
            tier = subscription.tier as SubscriptionTier;
          }
        }
      }
    }

    const rateLimit = TIER_RATE_LIMITS[tier];
    const isUnlimited = rateLimit === Infinity;

    // Get current usage
    const { data: usageResult } = await supabase.rpc('get_chat_usage', {
      p_user_id: user.id,
      p_limit: isUnlimited ? 0 : rateLimit,
    });

    const usage = usageResult?.[0];
    const resetAt = new Date(new Date().setHours(24, 0, 0, 0)).toISOString();

    return NextResponse.json({
      tier,
      limit: isUnlimited ? null : rateLimit,
      used: usage?.count ?? 0,
      remaining: isUnlimited ? null : (usage?.remaining ?? rateLimit),
      unlimited: isUnlimited,
      resetsAt: resetAt,
    });
  } catch (error) {
    console.error('Chat usage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
