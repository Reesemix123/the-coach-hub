/**
 * API: /api/communication/plan/status
 * GET - Get communication plan status for a team
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // Verify team exists
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Verify caller is owner or staff
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isOwner = team.user_id === user.id;
    const isStaff = ['owner', 'coach', 'team_admin'].includes(membership?.role ?? '');

    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch the most recent active plan for the team
    const { data: plan } = await supabase
      .from('team_communication_plans')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'active')
      .order('activated_at', { ascending: false })
      .limit(1)
      .single();

    if (!plan) {
      return NextResponse.json({ plan: null, has_plan: false });
    }

    // Count active parents on the team
    const { count: parentCount } = await supabase
      .from('team_parent_access')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'active');

    // Sum remaining credits from video top-up purchases
    const { data: topups } = await supabase
      .from('video_topup_purchases')
      .select('videos_added, videos_used')
      .eq('communication_plan_id', plan.id);

    const topupRemaining = (topups ?? []).reduce(
      (sum, t) => sum + (t.videos_added - t.videos_used),
      0
    );
    const baseRemaining = plan.max_team_videos - plan.team_videos_used;

    // Calculate days until plan expires
    const expiresAt = new Date(plan.expires_at);
    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000)
    );

    return NextResponse.json({
      has_plan: true,
      plan: {
        id: plan.id,
        plan_tier: plan.plan_tier,
        status: plan.status,
        activated_at: plan.activated_at,
        expires_at: plan.expires_at,
        max_parents: plan.max_parents,
        parent_count: parentCount ?? 0,
        max_team_videos: plan.max_team_videos,
        team_videos_used: plan.team_videos_used,
        base_videos_remaining: baseRemaining,
        topup_videos_remaining: topupRemaining,
        total_videos_remaining: baseRemaining + topupRemaining,
        days_remaining: daysRemaining,
        coach_override_status: plan.coach_override_status,
        grace_period_ends_at: plan.grace_period_ends_at,
      },
    });
  } catch (error) {
    console.error('Error fetching plan status:', error);
    return NextResponse.json({ error: 'Failed to fetch plan status' }, { status: 500 });
  }
}
