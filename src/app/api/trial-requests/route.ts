// /api/trial-requests - Trial request management
// Guests can request trials with email, admins can view and approve

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// Email validation regex
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Get service role client for anonymous inserts
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase service role configuration missing');
  }

  return createServiceClient(url, serviceKey);
}

/**
 * GET /api/trial-requests
 * Get trial requests - admins see all requests
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

  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Build query - include guest fields
  let query = supabase
    .from('trial_requests')
    .select(`
      *,
      teams:team_id (id, name),
      profiles:user_id (id, email, full_name)
    `)
    .order('created_at', { ascending: false });

  // Filter by status if provided
  const status = request.nextUrl.searchParams.get('status');
  if (status) {
    query = query.eq('status', status);
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
 * Create a new trial request (no authentication required)
 *
 * Request body:
 * {
 *   email: string (required)
 *   name?: string (optional)
 *   reason?: string (optional)
 *   requested_tier?: string (optional, defaults to 'hs_basic')
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, reason, requested_tier } = body;

    // Validate email is provided
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Validate name is provided
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Validate reason is provided
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json(
        { error: 'Please tell us why you are interested in a trial' },
        { status: 400 }
      );
    }

    // Validate tier - use standardized tier names
    const validTiers = ['basic', 'plus', 'premium', 'ai_powered'];
    const tier = validTiers.includes(requested_tier) ? requested_tier : 'plus';

    // Use service client to bypass RLS for guest inserts
    const serviceClient = getServiceClient();

    // Check if this email already has a pending request
    const { data: existingRequest } = await serviceClient
      .from('trial_requests')
      .select('id')
      .eq('guest_email', trimmedEmail)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A trial request for this email is already pending. We\'ll be in touch soon!' },
        { status: 400 }
      );
    }

    // Also check if this email is already a registered user with an active subscription
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('email', trimmedEmail)
      .single();

    if (existingProfile) {
      // Check if they have any active subscriptions
      const { data: teams } = await serviceClient
        .from('teams')
        .select('id')
        .eq('user_id', existingProfile.id);

      if (teams && teams.length > 0) {
        // Check for active subscriptions
        const teamIds = teams.map(t => t.id);
        const { data: activeSubs } = await serviceClient
          .from('subscriptions')
          .select('id')
          .in('team_id', teamIds)
          .in('status', ['active', 'trialing']);

        if (activeSubs && activeSubs.length > 0) {
          return NextResponse.json(
            { error: 'This email is already associated with an active account. Please sign in instead.' },
            { status: 400 }
          );
        }
      }
    }

    // Create the guest trial request
    const { data: newRequest, error: insertError } = await serviceClient
      .from('trial_requests')
      .insert({
        user_id: null, // Guest request - no user_id
        guest_email: trimmedEmail,
        guest_name: name?.trim() || null,
        requested_tier: tier,
        reason: reason?.trim() || null,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating trial request:', insertError);
      return NextResponse.json({ error: 'Failed to submit request. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      request: newRequest,
      message: 'Trial request submitted! We\'ll review your request and get back to you shortly.'
    });

  } catch (error) {
    console.error('Error processing trial request:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
