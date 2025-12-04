// /api/trial-requests - Trial request management
// Users can request trials, admins can view all requests

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/trial-requests
 * Get trial requests - users see their own, admins see all pending
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is platform admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.is_platform_admin === true;

  // Build query
  let query = supabase
    .from('trial_requests')
    .select(`
      *,
      teams:team_id (id, name),
      profiles:user_id (id, email, full_name)
    `)
    .order('created_at', { ascending: false });

  // If not admin, only show user's own requests
  if (!isAdmin) {
    query = query.eq('user_id', user.id);
  } else {
    // Admins see pending requests by default
    const status = request.nextUrl.searchParams.get('status');
    if (status) {
      query = query.eq('status', status);
    }
  }

  const { data: requests, error } = await query;

  if (error) {
    console.error('Error fetching trial requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }

  return NextResponse.json({
    requests,
    isAdmin
  });
}

/**
 * POST /api/trial-requests
 * Create a new trial request
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { team_id, requested_tier, reason } = body;

    // Validate tier
    const validTiers = ['little_league', 'hs_basic', 'hs_advanced', 'ai_powered'];
    const tier = validTiers.includes(requested_tier) ? requested_tier : 'hs_basic';

    // Check if user already has a pending request for this team
    const { data: existingRequest } = await supabase
      .from('trial_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('team_id', team_id)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending trial request for this team' },
        { status: 400 }
      );
    }

    // If team_id provided, verify user owns the team
    if (team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('user_id')
        .eq('id', team_id)
        .single();

      if (!team || team.user_id !== user.id) {
        return NextResponse.json(
          { error: 'You can only request trials for teams you own' },
          { status: 403 }
        );
      }

      // Check if team already has an active subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('team_id', team_id)
        .single();

      if (subscription && ['active', 'trialing'].includes(subscription.status)) {
        return NextResponse.json(
          { error: 'This team already has an active subscription' },
          { status: 400 }
        );
      }
    }

    // Create the request
    const { data: newRequest, error: insertError } = await supabase
      .from('trial_requests')
      .insert({
        user_id: user.id,
        team_id: team_id || null,
        requested_tier: tier,
        reason: reason || null,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating trial request:', insertError);
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      request: newRequest,
      message: 'Trial request submitted successfully. An admin will review it shortly.'
    });

  } catch (error) {
    console.error('Error processing trial request:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
