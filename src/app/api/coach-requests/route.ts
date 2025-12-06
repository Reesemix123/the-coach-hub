// /api/coach-requests - Coach access request management for trial users
// Users can request ability to add coaches during trial period
// Admins can view and approve/deny requests

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/coach-requests
 * Get coach requests - admins see all, users see their own
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
    .from('coach_requests')
    .select(`
      *,
      teams:team_id (id, name),
      profiles:user_id (id, email, full_name)
    `)
    .order('created_at', { ascending: false });

  // Non-admins can only see their own requests
  if (!isAdmin) {
    query = query.eq('user_id', user.id);
  }

  // Filter by status if provided
  const status = request.nextUrl.searchParams.get('status');
  if (status) {
    query = query.eq('status', status);
  }

  const { data: requests, error } = await query;

  if (error) {
    console.error('Error fetching coach requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }

  return NextResponse.json({
    requests,
    isAdmin
  });
}

/**
 * POST /api/coach-requests
 * Create a new coach access request (for trial users)
 *
 * Request body:
 * {
 *   team_id: string (required)
 *   reason?: string (optional)
 * }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { team_id, reason } = body;

    // Validate team_id is provided
    if (!team_id || typeof team_id !== 'string') {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns this team
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id, name')
      .eq('id', team_id)
      .single();

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    if (team.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only team owners can request coach access' },
        { status: 403 }
      );
    }

    // Verify team is on a trial
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('team_id', team_id)
      .single();

    if (subscription?.status !== 'trialing') {
      return NextResponse.json(
        { error: 'Coach requests are only needed for trial accounts. You can add coaches directly.' },
        { status: 400 }
      );
    }

    // Check if there's already a pending request
    const { data: existingRequest } = await supabase
      .from('coach_requests')
      .select('id')
      .eq('team_id', team_id)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A coach access request is already pending for this team.' },
        { status: 400 }
      );
    }

    // Create the request
    const { data: newRequest, error: insertError } = await supabase
      .from('coach_requests')
      .insert({
        team_id,
        user_id: user.id,
        reason: reason?.trim() || null,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating coach request:', insertError);
      return NextResponse.json(
        { error: 'Failed to submit request. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      request: newRequest,
      message: 'Coach access request submitted! An admin will review your request.'
    });

  } catch (error) {
    console.error('Error processing coach request:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
