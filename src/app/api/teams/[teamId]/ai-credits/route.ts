// /api/teams/:teamId/ai-credits - AI credits status and consumption
// Returns current video minutes and text action balances

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface AICreditsResponse {
  team_id: string;
  // Video minutes
  video_minutes_monthly: number;
  video_minutes_remaining: number;
  video_minutes_purchased: number;
  video_minutes_total: number;
  // Text actions
  text_actions_monthly: number;
  text_actions_remaining: number;
  is_text_unlimited: boolean;
  // Meta
  priority_processing: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  // Usage stats
  video_minutes_used_this_period: number;
  text_actions_used_this_period: number;
}

/**
 * GET /api/teams/:teamId/ai-credits
 * Returns current AI credits status for the team
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Verify user has access to this team
  const { data: team } = await supabase
    .from('teams')
    .select('id, user_id, organization_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Check access
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  const hasAccess =
    team.user_id === user.id ||
    (profile?.organization_id && profile.organization_id === team.organization_id);

  if (!hasAccess) {
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
  }

  // Get credits record
  const { data: credits } = await supabase
    .from('ai_credits')
    .select('*')
    .eq('team_id', teamId)
    .single();

  // Get active purchased minutes
  const now = new Date();
  const { data: purchases } = await supabase
    .from('ai_credit_purchases')
    .select('minutes_remaining')
    .eq('team_id', teamId)
    .gt('expires_at', now.toISOString())
    .gt('minutes_remaining', 0);

  const purchasedMinutes = (purchases || []).reduce(
    (sum, p) => sum + p.minutes_remaining, 0
  );

  // Get usage stats for current period
  let videoMinutesUsed = 0;
  let textActionsUsed = 0;

  if (credits?.current_period_start) {
    const { data: usage } = await supabase
      .from('ai_usage')
      .select('usage_type, units_consumed')
      .eq('team_id', teamId)
      .gte('created_at', credits.current_period_start);

    if (usage) {
      for (const u of usage) {
        if (u.usage_type === 'video_analysis') {
          videoMinutesUsed += Number(u.units_consumed) || 0;
        } else if (u.usage_type === 'text_action') {
          textActionsUsed += 1;
        }
      }
    }
  }

  // If no credits record exists, return zero state
  if (!credits) {
    const response: AICreditsResponse = {
      team_id: teamId,
      video_minutes_monthly: 0,
      video_minutes_remaining: 0,
      video_minutes_purchased: purchasedMinutes,
      video_minutes_total: purchasedMinutes,
      text_actions_monthly: 0,
      text_actions_remaining: 0,
      is_text_unlimited: false,
      priority_processing: false,
      current_period_start: null,
      current_period_end: null,
      video_minutes_used_this_period: 0,
      text_actions_used_this_period: 0
    };

    return NextResponse.json(response);
  }

  const response: AICreditsResponse = {
    team_id: teamId,
    video_minutes_monthly: credits.video_minutes_monthly,
    video_minutes_remaining: credits.video_minutes_remaining,
    video_minutes_purchased: purchasedMinutes,
    video_minutes_total: credits.video_minutes_remaining + purchasedMinutes,
    text_actions_monthly: credits.text_actions_monthly,
    text_actions_remaining: credits.text_actions_remaining,
    is_text_unlimited: credits.text_actions_remaining === -1,
    priority_processing: credits.priority_processing || false,
    current_period_start: credits.current_period_start,
    current_period_end: credits.current_period_end,
    video_minutes_used_this_period: videoMinutesUsed,
    text_actions_used_this_period: textActionsUsed
  };

  return NextResponse.json(response);
}

/**
 * POST /api/teams/:teamId/ai-credits
 * Consume AI credits for a feature
 *
 * Request body:
 * {
 *   type: 'video' | 'text',
 *   minutes?: number,       // Required for type='video'
 *   operation_type?: string,
 *   video_id?: string,
 *   metadata?: object
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Parse request body
  let body: {
    type: 'video' | 'text';
    minutes?: number;
    operation_type?: string;
    video_id?: string;
    metadata?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { type, minutes, operation_type, video_id, metadata } = body;

  if (!type || !['video', 'text'].includes(type)) {
    return NextResponse.json(
      { error: 'type is required and must be "video" or "text"' },
      { status: 400 }
    );
  }

  if (type === 'video' && (!minutes || minutes <= 0)) {
    return NextResponse.json(
      { error: 'minutes is required for video type and must be positive' },
      { status: 400 }
    );
  }

  // Verify user has access to this team
  const { data: team } = await supabase
    .from('teams')
    .select('id, user_id, organization_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Check access
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  const hasAccess =
    team.user_id === user.id ||
    (profile?.organization_id && profile.organization_id === team.organization_id);

  if (!hasAccess) {
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
  }

  // Consume credits using the database function
  if (type === 'video') {
    const { data: result, error: consumeError } = await supabase.rpc('consume_video_minutes', {
      p_team_id: teamId,
      p_user_id: user.id,
      p_minutes: minutes,
      p_video_id: video_id || null,
      p_operation_type: operation_type || 'video_analysis',
      p_metadata: metadata || {}
    });

    if (consumeError) {
      console.error('Failed to consume video minutes:', consumeError);
      return NextResponse.json(
        { error: 'Failed to consume video minutes' },
        { status: 500 }
      );
    }

    const consumeResult = result?.[0];

    if (!consumeResult?.success) {
      return NextResponse.json(
        {
          error: consumeResult?.message || 'Insufficient video minutes',
          code: 'INSUFFICIENT_CREDITS',
          remaining_subscription: consumeResult?.remaining_subscription || 0,
          remaining_purchased: consumeResult?.remaining_purchased || 0
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      type: 'video',
      minutes_consumed: minutes,
      remaining_subscription: consumeResult.remaining_subscription,
      remaining_purchased: consumeResult.remaining_purchased,
      message: consumeResult.message
    });

  } else {
    // Text action
    const { data: result, error: consumeError } = await supabase.rpc('consume_text_action', {
      p_team_id: teamId,
      p_user_id: user.id,
      p_operation_type: operation_type || 'text_action',
      p_metadata: metadata || {}
    });

    if (consumeError) {
      console.error('Failed to consume text action:', consumeError);
      return NextResponse.json(
        { error: 'Failed to consume text action' },
        { status: 500 }
      );
    }

    const consumeResult = result?.[0];

    if (!consumeResult?.success) {
      return NextResponse.json(
        {
          error: consumeResult?.message || 'No text actions remaining',
          code: 'INSUFFICIENT_CREDITS',
          remaining: consumeResult?.remaining || 0,
          is_unlimited: consumeResult?.is_unlimited || false
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      type: 'text',
      remaining: consumeResult.remaining,
      is_unlimited: consumeResult.is_unlimited,
      message: consumeResult.message
    });
  }
}
